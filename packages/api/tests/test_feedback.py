"""Improvement notes: public submit, admin read, and the shipped changelog."""
import os
import tempfile
import unittest
from datetime import datetime

_fd, _path = tempfile.mkstemp(prefix="chartsuno_feedback_test_", suffix=".db")
os.close(_fd)
os.environ.setdefault("DATABASE_URL", "sqlite:///" + _path)
os.environ.setdefault("JWT_SECRET_KEY", "feedback-test-secret-not-production-0123456789")
os.environ.setdefault("ENVIRONMENT", "development")

from fastapi.testclient import TestClient  # noqa: E402

import main  # noqa: E402
from dependencies import create_access_token  # noqa: E402
from models.database import Base, Feedback, SessionLocal, User, engine  # noqa: E402

TOKEN = "feedback-read-token-for-tests"


class FeedbackTests(unittest.TestCase):
    def setUp(self):
        if engine.dialect.name != "sqlite" or not any(part in str(engine.url) for part in ("test", "audit")):
            self.fail("Run feedback tests with an explicit disposable SQLite test DATABASE_URL")
        os.environ.pop("FEEDBACK_READ_TOKEN", None)
        Base.metadata.drop_all(engine)
        Base.metadata.create_all(engine)
        self.db = SessionLocal()
        self.addCleanup(self.db.close)
        self.client = TestClient(main.app)
        self.addCleanup(self.client.close)
        main.limiter.reset()

    def tearDown(self):
        os.environ.pop("FEEDBACK_READ_TOKEN", None)

    def _note(self, message="Make the grid darker", **extra):
        body = {"message": message, "page_path": "/chart/abc?auth_code=secret", "website": ""}
        body.update(extra)
        return self.client.post("/api/feedback", json=body)

    def _admin(self, token=TOKEN):
        os.environ["FEEDBACK_READ_TOKEN"] = token
        return {"Authorization": f"Bearer {token}"}

    def test_anonymous_submit_strips_the_query_and_stamps_the_server(self):
        response = self._note(email="  Person@Example.test ")
        self.assertEqual(response.status_code, 201, response.text)
        self.assertEqual(response.json(), {"ok": True})
        self.db.expire_all()
        row = self.db.query(Feedback).one()
        self.assertEqual(row.message, "Make the grid darker")
        self.assertEqual(row.email, "person@example.test")
        self.assertEqual(row.page_path, "/chart/abc")
        self.assertIsNone(row.user_id)
        self.assertEqual(row.status, "new")
        self.assertIsNone(row.public_note)
        self.assertIsNone(row.shipped_at)
        self.assertIsNotNone(row.created_at)
        self.assertEqual(response.headers["cache-control"], "no-store")

    def test_signed_in_user_is_stored_and_body_cannot_set_status_or_user(self):
        user = User(email="person@example.test", google_id="person")
        self.db.add(user)
        self.db.commit()
        response = self.client.post(
            "/api/feedback",
            headers={"Authorization": "Bearer " + create_access_token(user.id)},
            json={"message": "Remember my last palette", "user_id": "other", "status": "shipped"},
        )
        self.assertEqual(response.status_code, 201, response.text)
        self.db.expire_all()
        row = self.db.query(Feedback).one()
        self.assertEqual(row.user_id, user.id)
        self.assertEqual(row.status, "new")
        self.assertEqual(row.page_path, "/")

    def test_bad_session_still_accepts_an_anonymous_note(self):
        response = self.client.post(
            "/api/feedback",
            headers={"Authorization": "Bearer not-a-jwt"},
            json={"message": "Still send it"},
        )
        self.assertEqual(response.status_code, 201, response.text)
        self.db.expire_all()
        self.assertIsNone(self.db.query(Feedback).one().user_id)

    def test_honeypot_is_stored_as_spam_with_the_same_response(self):
        response = self._note(website="http://spam.test", email="bot@example.test")
        self.assertEqual(response.status_code, 201, response.text)
        self.assertEqual(response.json(), {"ok": True})
        self.db.expire_all()
        row = self.db.query(Feedback).one()
        self.assertEqual(row.status, "spam")
        self.assertIsNone(row.email)
        self.assertEqual(self.client.get("/api/improvements/shipped-count").json(), {"count": 0})

    def test_blank_long_and_bad_email_are_rejected(self):
        self.assertEqual(self.client.post("/api/feedback", json={"message": "   "}).status_code, 422)
        self.assertEqual(self._note("x" * 2001).status_code, 422)
        self.assertEqual(self._note(email="not-an-email").status_code, 422)
        self.assertEqual(self.db.query(Feedback).count(), 0)

    def test_submit_is_rate_limited_per_forwarded_ip(self):
        headers = {"X-Forwarded-For": "203.0.113.10, 10.0.0.1"}
        for _ in range(5):
            response = self.client.post("/api/feedback", headers=headers, json={"message": "Again"})
            self.assertEqual(response.status_code, 201, response.text)
        blocked = self.client.post("/api/feedback", headers=headers, json={"message": "Again"})
        self.assertEqual(blocked.status_code, 429)
        other = self.client.post(
            "/api/feedback",
            headers={"X-Forwarded-For": "203.0.113.11"},
            json={"message": "From someone else"},
        )
        self.assertEqual(other.status_code, 201, other.text)

    def test_admin_read_requires_the_token_and_returns_newest_first(self):
        self.db.add_all([
            Feedback(message="older", page_path="/a", status="new", created_at=datetime(2026, 1, 1), updated_at=datetime(2026, 1, 1)),
            Feedback(message="newer", page_path="/b", status="new", created_at=datetime(2026, 2, 1), updated_at=datetime(2026, 2, 1)),
        ])
        self.db.commit()
        self.assertEqual(self.client.get("/api/feedback").status_code, 401)
        self.assertEqual(self.client.get("/api/feedback", headers={"Authorization": "Bearer " + TOKEN}).status_code, 401)
        headers = self._admin()
        self.assertEqual(self.client.get("/api/feedback", headers={"Authorization": "Bearer wrong"}).status_code, 401)
        body = self.client.get("/api/feedback", headers=headers)
        self.assertEqual(body.status_code, 200, body.text)
        self.assertEqual([item["message"] for item in body.json()["items"]], ["newer", "older"])
        self.assertEqual(body.headers["cache-control"], "no-store")

    def test_patch_ships_a_public_note_without_leaking_the_raw_note(self):
        created = self._note("RAW-SECRET-NOTE", email="hidden@example.test")
        self.assertEqual(created.status_code, 201, created.text)
        self.db.expire_all()
        row = self.db.query(Feedback).one()
        headers = self._admin()
        missing = self.client.patch("/api/feedback/missing", headers=headers, json={"status": "spam"})
        self.assertEqual(missing.status_code, 404)
        empty = self.client.patch(f"/api/feedback/{row.id}", headers=headers, json={})
        self.assertEqual(empty.status_code, 422)
        denied = self.client.patch(f"/api/feedback/{row.id}", json={"status": "shipped"})
        self.assertEqual(denied.status_code, 401)

        shipped = self.client.patch(
            f"/api/feedback/{row.id}",
            headers=headers,
            json={"status": "shipped", "public_note": "  Darker grid lines  "},
        )
        self.assertEqual(shipped.status_code, 200, shipped.text)
        self.assertEqual(shipped.json()["status"], "shipped")
        self.assertEqual(shipped.json()["public_note"], "Darker grid lines")
        shipped_at = shipped.json()["shipped_at"]
        self.assertTrue(shipped_at)

        note_only = self.client.patch(
            f"/api/feedback/{row.id}",
            headers=headers,
            json={"public_note": "Darker grid lines"},
        )
        self.assertEqual(note_only.json()["shipped_at"], shipped_at)

        public = self.client.get("/api/improvements/shipped")
        self.assertEqual(public.status_code, 200, public.text)
        payload = public.json()
        self.assertEqual(set(payload["items"][0]), {"id", "public_note", "shipped_at"})
        self.assertEqual(payload["items"][0]["public_note"], "Darker grid lines")
        self.assertNotIn("RAW-SECRET-NOTE", public.text)
        self.assertNotIn("hidden@example.test", public.text)
        self.assertEqual(self.client.get("/api/improvements/shipped-count").json(), {"count": 1})

        spam = self.client.patch(f"/api/feedback/{row.id}", headers=headers, json={"status": "spam"})
        self.assertEqual(spam.status_code, 200, spam.text)
        self.assertIsNone(spam.json()["shipped_at"])
        self.assertEqual(self.client.get("/api/improvements/shipped").json(), {"items": []})
        self.assertEqual(self.client.get("/api/improvements/shipped-count").json(), {"count": 0})
        self.assertNotIn("RAW-SECRET-NOTE", self.client.get("/api/improvements/shipped-count").text)


if __name__ == "__main__":
    unittest.main()
