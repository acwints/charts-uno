"""Real HTTP callback -> PKCE redemption -> cookie auth, with Google isolated."""
import atexit
import os
import tempfile
import unittest
from datetime import datetime, timedelta
from urllib.parse import urlsplit, parse_qs
from unittest.mock import patch

_fd, _path = tempfile.mkstemp(suffix=".db")
os.close(_fd)
os.environ["DATABASE_URL"] = "sqlite:///" + _path
os.environ["JWT_SECRET_KEY"] = "native-auth-test-secret-not-production-0123456789"
os.environ["GOOGLE_CLIENT_ID"] = "test-client"
os.environ["GOOGLE_CLIENT_SECRET"] = "test-secret"
os.environ["ENVIRONMENT"] = "development"

import httpx
from fastapi.testclient import TestClient
import main
from dependencies import decode_token
from models.database import Base, engine, SessionLocal
from services.native_auth import NativeAuthCode, pkce_challenge


class FakeGoogle:
    async def __aenter__(self): return self
    async def __aexit__(self, *args): pass
    async def post(self, *args, **kwargs):
        return httpx.Response(200, json={"access_token": "provider-only-test-token"})
    async def get(self, *args, **kwargs):
        return httpx.Response(200, json={"id": "native-test-user", "email": "native@example.test", "name": "Native Tester"})


@atexit.register
def cleanup_database():
    engine.dispose()
    if os.path.exists(_path):
        os.unlink(_path)


class NativeAuthTests(unittest.TestCase):
    def setUp(self):
        Base.metadata.drop_all(engine)
        Base.metadata.create_all(engine)
        self.client = TestClient(main.app)
        self.verifier = "a" * 43
        self.nonce = "b" * 43
        main.limiter.reset()

    def tearDown(self):
        self.client.close()

    def start(self):
        response = self.client.get("/auth/google", params={"native_challenge": pkce_challenge(self.verifier), "native_nonce": self.nonce})
        self.assertEqual(response.status_code, 200)
        return parse_qs(urlsplit(response.json()["auth_url"]).query)["state"][0]

    def callback(self):
        state = self.start()
        with patch.object(main.httpx, "AsyncClient", return_value=FakeGoogle()):
            response = self.client.get("/auth/callback", params={"code": "google-code", "state": state}, follow_redirects=False)
        self.assertEqual(response.status_code, 302, response.text)
        self.assertEqual(response.headers["cache-control"], "no-store")
        url = urlsplit(response.headers["location"])
        self.assertEqual((url.scheme, url.netloc), ("com.chartsuno.app", "auth-callback"))
        query = parse_qs(url.query)
        self.assertEqual(query["state"], [self.nonce])
        self.assertNotIn("auth_token", query)
        return query["code"][0]

    def exchange(self, code, verifier=None):
        return self.client.post("/api/auth/native/exchange", json={"code": code, "verifier": verifier or self.verifier})

    def test_callback_and_cookie_survive_subsequent_requests(self):
        code = self.callback()
        self.assertEqual(self.client.get("/api/user/me").status_code, 401)
        response = self.exchange(code)
        self.assertEqual(response.status_code, 200, response.text)
        cookie = response.headers["set-cookie"]
        self.assertIn("HttpOnly", cookie)
        self.assertIn("SameSite=lax", cookie)
        self.assertEqual(self.client.get("/api/user/me").json()["email"], "native@example.test")
        self.assertEqual(self.client.get("/api/user/me").status_code, 200)
        self.client.post("/api/auth/logout")
        self.assertEqual(self.client.get("/api/user/me").status_code, 401)

    def test_replay_is_rejected(self):
        code = self.callback()
        self.assertEqual(self.exchange(code).status_code, 200)
        self.assertEqual(self.exchange(code).status_code, 401)

    def test_wrong_verifier_does_not_consume_code(self):
        code = self.callback()
        self.assertEqual(self.exchange(code, "z" * 43).status_code, 401)
        self.assertEqual(self.exchange(code).status_code, 200)

    def test_expired_code_is_rejected(self):
        code = self.callback()
        with SessionLocal() as db:
            db.query(NativeAuthCode).update({"expires_at": datetime.utcnow() - timedelta(seconds=1)})
            db.commit()
        self.assertEqual(self.exchange(code).status_code, 401)

    def test_tampered_state_is_rejected_before_provider_call(self):
        state = self.start()
        prefix, payload, signature = state.rsplit(".", 2)
        signature = ("a" if signature[0] != "a" else "b") + signature[1:]
        response = self.client.get("/auth/callback", params={"code": "code", "state": f"{prefix}.{payload}.{signature}"})
        self.assertEqual(response.status_code, 400)

    def test_provider_cancel_returns_to_app(self):
        response = self.client.get("/auth/callback", params={"state": self.start(), "error": "access_denied"}, follow_redirects=False)
        self.assertEqual(response.status_code, 302)
        query = parse_qs(urlsplit(response.headers["location"]).query)
        self.assertEqual(query, {"error": ["cancelled"], "state": [self.nonce]})

    def test_provider_failure_returns_to_app(self):
        state = self.start()
        for failure in [httpx.Response(400, json={"error": "invalid_grant"}), httpx.ConnectError("offline")]:
            class FailedGoogle(FakeGoogle):
                async def post(self, *args, **kwargs):
                    if isinstance(failure, Exception):
                        raise failure
                    return failure
            with patch.object(main.httpx, "AsyncClient", return_value=FailedGoogle()):
                response = self.client.get("/auth/callback", params={"state": state, "code": "bad-code"}, follow_redirects=False)
            self.assertEqual(response.status_code, 302)
            self.assertEqual(parse_qs(urlsplit(response.headers["location"]).query), {"error": ["failed"], "state": [self.nonce]})

    def test_expired_signed_state_returns_to_app_without_authenticating(self):
        import jwt
        from dependencies import JWT_SECRET_KEY, JWT_ALGORITHM
        token = self.start().removeprefix("native.")
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM], audience="chartsuno-native-auth")
        payload["exp"] = datetime.utcnow() - timedelta(seconds=1)
        expired = "native." + jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
        response = self.client.get("/auth/callback", params={"state": expired, "code": "code"}, follow_redirects=False)
        self.assertEqual(response.status_code, 302)
        self.assertEqual(parse_qs(urlsplit(response.headers["location"]).query), {"error": ["expired"], "state": [self.nonce]})
        self.assertEqual(self.client.get("/api/user/me").status_code, 401)
        with SessionLocal() as db:
            self.assertEqual(db.query(NativeAuthCode).count(), 0)
        forged = "native." + jwt.encode(payload, "different-secret-abcdefghijklmnopqrstuvwxyz", algorithm=JWT_ALGORITHM)
        self.assertEqual(self.client.get("/auth/callback", params={"state": forged, "code": "code"}).status_code, 400)

    def test_missing_or_invalid_pkce_parameters(self):
        for params in [{"native_nonce": self.nonce}, {"native_challenge": "abc", "native_nonce": self.nonce}]:
            self.assertEqual(self.client.get("/auth/google", params=params).status_code, 400)

    def test_state_cannot_be_used_as_session_token(self):
        self.assertIsNone(decode_token(self.start().removeprefix("native.")))

    def test_redirect_targets_require_exact_origin(self):
        self.assertEqual(main._safe_frontend_target("https://chartsuno.com/chart/123"), "https://chartsuno.com/chart/123")
        for target in ["https://chartsuno.com.evil.test", "https://chartsuno.com@evil.test", "http://localhost:8080@evil.test", "javascript:alert(1)"]:
            self.assertEqual(main._safe_frontend_target(target), main.FRONTEND_URL)


if __name__ == "__main__":
    unittest.main()
