import os
import tempfile
import unittest
from datetime import datetime, timedelta
from unittest.mock import patch
from urllib.parse import parse_qs, urlsplit

import httpx
import jwt
from fastapi.testclient import TestClient

os.environ.setdefault('DATABASE_URL', 'sqlite:///' + tempfile.mktemp(prefix='web_auth_', suffix='.db'))
import main
from models.database import Base, engine
from services import web_auth
from services.native_auth import pkce_challenge


class FakeGoogle:
    async def __aenter__(self): return self
    async def __aexit__(self, *args): pass
    async def post(self, *args, **kwargs): return httpx.Response(200, json={'access_token': 'test-provider-token'})
    async def get(self, *args, **kwargs):
        return httpx.Response(200, json={'id': 'web-test', 'email': 'web@example.test', 'name': 'Web Test'})


class WebAuthTests(unittest.TestCase):
    def setUp(self):
        Base.metadata.drop_all(engine)
        Base.metadata.create_all(engine)
        self.client = TestClient(main.app)
        self.addCleanup(self.client.close)
        self.verifier = 'a' * 43
        self.nonce = 'b' * 43
        self.patchers = [patch.object(main, 'GOOGLE_CLIENT_ID', 'test-client'),
                         patch.object(main, 'GOOGLE_CLIENT_SECRET', 'test-secret'),
                         patch.object(main, 'IS_PRODUCTION', False)]
        for p in self.patchers:
            p.start(); self.addCleanup(p.stop)
        main.limiter.reset()

    def start(self):
        r = self.client.get('/auth/google', params={'web_challenge': pkce_challenge(self.verifier),
            'web_nonce': self.nonce, 'target': 'http://localhost:5173/new?source=demo#data'})
        self.assertEqual(r.status_code, 200, r.text)
        return parse_qs(urlsplit(r.json()['auth_url']).query)['state'][0]

    def test_rejects_forged_expired_or_missing_browser_state_before_provider_call(self):
        expired = 'web.' + jwt.encode({'aud': web_auth.AUDIENCE, 'challenge': pkce_challenge(self.verifier),
            'nonce': self.nonce, 'frontend': 'http://localhost:5173', 'exp': datetime.utcnow() - timedelta(seconds=1)},
            web_auth.JWT_SECRET_KEY, algorithm=web_auth.JWT_ALGORITHM)
        with patch.object(main.httpx, 'AsyncClient') as provider:
            for state in ['forged-unbound-state', 'web.invalid', expired]:
                self.assertEqual(self.client.get('/auth/callback', params={'code': 'test', 'state': state}).status_code, 400)
            provider.assert_not_called()
        self.assertEqual(self.client.get('/auth/google').status_code, 400)

    def test_callback_preserves_target_and_delivers_only_one_use_pkce_code(self):
        state = self.start()
        with patch.object(main.httpx, 'AsyncClient', return_value=FakeGoogle()):
            r = self.client.get('/auth/callback', params={'code': 'test', 'state': state}, follow_redirects=False)
        self.assertEqual(r.status_code, 302, r.text)
        target = urlsplit(r.headers['location']); query = parse_qs(target.query)
        self.assertEqual((target.path, target.fragment), ('/new', 'data'))
        self.assertEqual(query['source'], ['demo'])
        self.assertEqual(query['auth_state'], [self.nonce])
        self.assertNotIn('auth_token', query)
        self.assertEqual(r.headers['cache-control'], 'no-store')
        code = query['auth_code'][0]
        wrong = self.client.post('/api/auth/web/exchange', json={'code': code, 'verifier': 'z' * 43})
        self.assertEqual(wrong.status_code, 401)
        accepted = self.client.post('/api/auth/web/exchange', json={'code': code, 'verifier': self.verifier})
        self.assertEqual(accepted.status_code, 200, accepted.text)
        self.assertIn('HttpOnly', accepted.headers['set-cookie'])
        self.assertNotIn('token', accepted.json())
        self.assertEqual(self.client.get('/api/user/me').json()['email'], 'web@example.test')
        self.assertEqual(self.client.post('/api/auth/web/exchange', json={'code': code, 'verifier': self.verifier}).status_code, 401)
