"""App Review demo sign-in and the iOS public-dataset filter.

The demo account exists only while REVIEW_LOGIN_EMAIL and
REVIEW_LOGIN_PASSWORD are set. Deleting it is allowed; the next successful
login creates it again.
"""
import atexit
import os
import tempfile
import unittest

TEST_SECRET = "review-login-test-secret-not-production-0123456789"

_fd, _path = tempfile.mkstemp(suffix=".db")
os.close(_fd)
os.environ.setdefault("DATABASE_URL", "sqlite:///" + _path)
os.environ.setdefault("JWT_SECRET_KEY", TEST_SECRET)
os.environ.setdefault("ENVIRONMENT", "development")
os.environ.pop("REVIEW_LOGIN_EMAIL", None)
os.environ.pop("REVIEW_LOGIN_PASSWORD", None)

from fastapi.testclient import TestClient  # noqa: E402

import dependencies  # noqa: E402
import main  # noqa: E402
from models.database import REVIEW_LOGIN_GOOGLE_ID, Base, SessionLocal, Team, User, engine  # noqa: E402
from services.review_login import credentials_match  # noqa: E402
from unittest.mock import patch  # noqa: E402


@atexit.register
def _cleanup_database():
    engine.dispose()
    if os.path.exists(_path):
        os.unlink(_path)


class ReviewLoginTests(unittest.TestCase):
    def setUp(self):
        os.environ.pop("REVIEW_LOGIN_EMAIL", None)
        os.environ.pop("REVIEW_LOGIN_PASSWORD", None)
        patcher = patch.object(dependencies, "JWT_SECRET_KEY", TEST_SECRET)
        patcher.start()
        self.addCleanup(patcher.stop)
        for module_name in ("IS_PRODUCTION",):
            for module in (dependencies, main):
                patcher = patch.object(module, module_name, False)
                patcher.start()
                self.addCleanup(patcher.stop)
        Base.metadata.drop_all(engine)
        Base.metadata.create_all(engine)
        self.client = TestClient(main.app)
        main.limiter.reset()

    def tearDown(self):
        os.environ.pop("REVIEW_LOGIN_EMAIL", None)
        os.environ.pop("REVIEW_LOGIN_PASSWORD", None)
        self.client.close()

    def _enable(self, email="review@chartsuno.test", password="correct-horse-battery"):
        os.environ["REVIEW_LOGIN_EMAIL"] = email
        os.environ["REVIEW_LOGIN_PASSWORD"] = password
        return email, password

    def _login(self, email, password):
        return self.client.post("/api/auth/review/login", json={
            "email": email,
            "password": password,
            "deliver": "token",
        })

    def test_status_and_login_are_disabled_until_both_env_vars_are_set(self):
        self.assertEqual(self.client.get("/api/auth/review/status").json(), {"enabled": False})
        response = self._login("review@chartsuno.test", "correct-horse-battery")
        self.assertEqual(response.status_code, 404, response.text)
        self.assertFalse(credentials_match("review@chartsuno.test", "correct-horse-battery"))
        os.environ["REVIEW_LOGIN_EMAIL"] = "review@chartsuno.test"
        self.assertEqual(self.client.get("/api/auth/review/status").json()["enabled"], False)
        os.environ["REVIEW_LOGIN_PASSWORD"] = "correct-horse-battery"
        self.assertEqual(self.client.get("/api/auth/review/status").json(), {"enabled": True})
        with SessionLocal() as db:
            self.assertIsNone(db.query(User).filter(User.google_id == REVIEW_LOGIN_GOOGLE_ID).first())

    def test_wrong_email_or_password_does_not_create_a_user(self):
        email, password = self._enable()
        wrong_email = self._login("other@chartsuno.test", password)
        wrong_password = self._login(email, "nope")
        self.assertEqual(wrong_email.status_code, 401, wrong_email.text)
        self.assertEqual(wrong_password.status_code, 401, wrong_password.text)
        self.assertFalse(credentials_match("other@chartsuno.test", password))
        self.assertTrue(credentials_match(email.upper(), password))
        with SessionLocal() as db:
            self.assertIsNone(db.query(User).filter(User.google_id == REVIEW_LOGIN_GOOGLE_ID).first())

    def test_login_creates_a_demo_user_that_can_save_a_chart(self):
        _email, password = self._enable("Review@Chartsuno.test")
        response = self._login("review@chartsuno.test", password)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertNotIn("set-cookie", response.headers)
        token = response.json()["token"]
        me = self.client.get("/api/user/me", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(me.status_code, 200, me.text)
        body = me.json()
        self.assertEqual(body["email"], "review@chartsuno.test")
        self.assertEqual(body["name"], "App Review")
        self.assertEqual(body["providers"], ["review"])
        user_id = body["id"]
        again = self._login("  Review@Chartsuno.test  ", password)
        self.assertEqual(again.status_code, 200, again.text)
        again_me = self.client.get("/api/user/me", headers={"Authorization": f"Bearer {again.json()['token']}"})
        self.assertEqual(again_me.json()["id"], user_id)
        created = self.client.post("/api/charts", headers={"Authorization": f"Bearer {token}"}, json={
            "title": "Review chart",
            "data": {"labels": ["A"], "series": [{"name": "S", "data": [1]}]},
            "config": {"type": "bar"},
        })
        self.assertEqual(created.status_code, 200, created.text)
        with SessionLocal() as db:
            user = db.query(User).filter(User.id == user_id).one()
            self.assertEqual(user.google_id, REVIEW_LOGIN_GOOGLE_ID)
            self.assertIsNotNone(db.query(Team).filter(Team.owner_id == user.id, Team.is_personal.is_(True)).first())

    def test_deleting_the_demo_user_still_works_and_login_recreates_it(self):
        _email, password = self._enable()
        first = self._login("review@chartsuno.test", password)
        token = first.json()["token"]
        me = self.client.get("/api/user/me", headers={"Authorization": f"Bearer {token}"}).json()
        deleted = self.client.delete("/api/user/me", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(deleted.status_code, 200, deleted.text)
        self.assertEqual(self.client.get("/api/user/me", headers={"Authorization": f"Bearer {token}"}).status_code, 401)
        with SessionLocal() as db:
            self.assertIsNone(db.query(User).filter(User.id == me["id"]).first())
        second = self._login("review@chartsuno.test", password)
        self.assertEqual(second.status_code, 200, second.text)
        recreated = self.client.get("/api/user/me", headers={"Authorization": f"Bearer {second.json()['token']}"})
        self.assertEqual(recreated.status_code, 200, recreated.text)
        self.assertNotEqual(recreated.json()["id"], me["id"])
        chart = self.client.post("/api/charts", headers={"Authorization": f"Bearer {second.json()['token']}"}, json={
            "title": "After recreate",
            "data": {"labels": ["A"], "series": [{"name": "S", "data": [2]}]},
            "config": {"type": "bar"},
        })
        self.assertEqual(chart.status_code, 200, chart.text)

    def test_review_login_does_not_take_over_an_existing_account(self):
        with SessionLocal() as db:
            db.add(User(email="ada@example.com", name="Ada", google_id="google-ada"))
            db.commit()
        self._enable("ada@example.com")
        response = self._login("ada@example.com", "correct-horse-battery")
        self.assertEqual(response.status_code, 409, response.text)
        with SessionLocal() as db:
            user = db.query(User).filter(User.email == "ada@example.com").one()
            self.assertEqual(user.google_id, "google-ada")
            self.assertEqual(user.providers, ["google"])

    def test_login_is_rate_limited(self):
        self._enable()
        statuses = [self._login("review@chartsuno.test", "wrong").status_code for _ in range(6)]
        self.assertEqual(statuses[:5], [401, 401, 401, 401, 401])
        self.assertEqual(statuses[5], 429)

    def test_ios_client_hides_imdb_datasets_and_keeps_the_others(self):
        web = self.client.get("/api/datasets/public")
        self.assertEqual(web.status_code, 200, web.text)
        web_ids = {dataset["id"] for dataset in web.json()["datasets"]}
        self.assertIn("imdb_titles", web_ids)
        self.assertIn("imdb_episode_race", web_ids)
        self.assertIn("hacker_news", web_ids)
        self.assertIn("usa_names", web_ids)

        for headers in (
            {"X-Chartsuno-Client": "ios"},
            {"Origin": "capacitor://localhost"},
        ):
            ios = self.client.get("/api/datasets/public", headers=headers)
            self.assertEqual(ios.status_code, 200, ios.text)
            ios_ids = {dataset["id"] for dataset in ios.json()["datasets"]}
            self.assertTrue(all(not dataset_id.startswith("imdb_") for dataset_id in ios_ids))
            self.assertIn("hacker_news", ios_ids)
            self.assertIn("usa_names", ios_ids)

        blocked = self.client.post(
            "/api/datasets/public/generate",
            headers={"X-Chartsuno-Client": "ios"},
            json={"dataset_id": "imdb_titles", "prompt": "ratings by year", "top_n": 10},
        )
        self.assertEqual(blocked.status_code, 404, blocked.text)
        other = self.client.post(
            "/api/datasets/public/generate",
            headers={"X-Chartsuno-Client": "ios"},
            json={"dataset_id": "hacker_news", "prompt": "monthly posts", "top_n": 10},
        )
        self.assertNotEqual(other.status_code, 404, other.text)


if __name__ == "__main__":
    unittest.main()
