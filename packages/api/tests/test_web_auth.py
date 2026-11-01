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

    def test_new_google_signup_stores_a_known_referral_and_ignores_a_later_one(self):
        from models.database import SessionLocal, User

        db = SessionLocal()
        self.addCleanup(db.close)
        db.add(User(email='friend@gmail.com', google_id='friend', name='Friend', referral_code='Abcd1234'))
        db.commit()

        started = self.client.get('/auth/google', params={
            'web_challenge': pkce_challenge(self.verifier),
            'web_nonce': self.nonce,
            'target': 'http://localhost:5173/',
            'ref': 'Abcd1234',
        })
        self.assertEqual(started.status_code, 200, started.text)
        state = parse_qs(urlsplit(started.json()['auth_url']).query)['state'][0]
        with patch.object(main.httpx, 'AsyncClient', return_value=FakeGoogle()):
            callback = self.client.get('/auth/callback', params={'code': 'test', 'state': state}, follow_redirects=False)
        self.assertEqual(callback.status_code, 302, callback.text)
        db.expire_all()
        created = db.query(User).filter(User.email == 'web@example.test').one()
        self.assertEqual(created.referred_by, 'Abcd1234')
        self.assertRegex(created.referral_code, r'^[A-Za-z0-9_-]{8}$')
        self.assertNotEqual(created.referral_code, 'Abcd1234')

        activity = self.client.get('/api/stats/activity')
        self.assertEqual(activity.json()['referred_signups'], 0)
        self.assertEqual(activity.json()['signups'], 1)
        counted = self.client.get('/api/count').json()
        self.assertEqual(counted['count'], 1)
        self.assertEqual(counted['accounts_total'], 2)
        self.assertEqual(counted['signups_last_7d'], 1)
        self.assertEqual(counted['users_with_a_chart'], 0)

        again = self.client.get('/auth/google', params={
            'web_challenge': pkce_challenge('c' * 43),
            'web_nonce': 'd' * 43,
            'target': 'http://localhost:5173/',
            'ref': 'zzzzzzzz',
        })
        state = parse_qs(urlsplit(again.json()['auth_url']).query)['state'][0]
        with patch.object(main.httpx, 'AsyncClient', return_value=FakeGoogle()):
            second = self.client.get('/auth/callback', params={'code': 'test', 'state': state}, follow_redirects=False)
        self.assertEqual(second.status_code, 302, second.text)
        db.expire_all()
        self.assertEqual(db.query(User).filter(User.email == 'web@example.test').one().referred_by, 'Abcd1234')

    def test_unknown_referral_does_not_block_signup(self):
        from models.database import SessionLocal, User

        started = self.client.get('/auth/google', params={
            'web_challenge': pkce_challenge(self.verifier),
            'web_nonce': self.nonce,
            'target': 'http://localhost:5173/',
            'ref': 'nope',
        })
        self.assertEqual(started.status_code, 200, started.text)
        state = parse_qs(urlsplit(started.json()['auth_url']).query)['state'][0]
        with patch.object(main.httpx, 'AsyncClient', return_value=FakeGoogle()):
            callback = self.client.get('/auth/callback', params={'code': 'test', 'state': state}, follow_redirects=False)
        self.assertEqual(callback.status_code, 302, callback.text)
        db = SessionLocal()
        self.addCleanup(db.close)
        created = db.query(User).filter(User.email == 'web@example.test').one()
        self.assertIsNone(created.referred_by)
        self.assertRegex(created.referral_code, r'^[A-Za-z0-9_-]{8}$')
