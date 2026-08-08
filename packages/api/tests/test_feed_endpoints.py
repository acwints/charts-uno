"""End-to-end tests for the social feed endpoints.

Uses a throwaway SQLite database and real JWT auth so the exact request
paths the web/mobile feed makes (public feed, like, save, view counts)
are exercised against the live FastAPI app.
"""

import os
import tempfile
import unittest

# The database engine binds to DATABASE_URL at import time, so this must be
# set before importing the app.
_db_fd, _DB_PATH = tempfile.mkstemp(prefix="feed_test_", suffix=".db")
os.close(_db_fd)
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_PATH}"

from fastapi.testclient import TestClient  # noqa: E402

import main  # noqa: E402
from dependencies import create_access_token  # noqa: E402
from models.database import Base, engine, SessionLocal, User, Chart  # noqa: E402


def _make_user(db, email: str, name: str) -> User:
    user = User(email=email, name=name, google_id=f"google-{email}")
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _make_chart(db, user: User, title: str, is_public: bool = True) -> Chart:
    chart = Chart(
        user_id=user.id,
        title=title,
        data={"labels": ["A", "B"], "series": [{"name": "S", "data": [1, 2]}]},
        config={"type": "bar"},
        is_public=is_public,
    )
    db.add(chart)
    db.commit()
    db.refresh(chart)
    return chart


class FeedEndpointTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=engine)
        cls.client = TestClient(main.app)

    def setUp(self):
        # Fresh tables per test so counts and totals are deterministic.
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        self.db = SessionLocal()
        self.author = _make_user(self.db, "author@example.com", "Author")
        self.viewer = _make_user(self.db, "viewer@example.com", "Viewer")
        self.viewer_auth = {
            "Authorization": f"Bearer {create_access_token(self.viewer.id)}"
        }

    def tearDown(self):
        self.db.close()

    def test_public_feed_lists_only_public_charts(self):
        _make_chart(self.db, self.author, "Public one")
        _make_chart(self.db, self.author, "Private one", is_public=False)

        resp = self.client.get("/api/charts/public")
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body["total"], 1)
        self.assertEqual(len(body["charts"]), 1)
        self.assertEqual(body["charts"][0]["title"], "Public one")
        self.assertFalse(body["charts"][0]["is_liked"])
        self.assertEqual(body["charts"][0]["user"]["name"], "Author")

    def test_public_feed_pagination(self):
        for i in range(5):
            _make_chart(self.db, self.author, f"Chart {i}")

        resp = self.client.get("/api/charts/public?limit=2&offset=2")
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body["total"], 5)
        self.assertEqual(len(body["charts"]), 2)
        self.assertEqual(body["limit"], 2)
        self.assertEqual(body["offset"], 2)

    def test_like_is_idempotent_and_updates_count(self):
        chart = _make_chart(self.db, self.author, "Likeable")

        first = self.client.post(f"/api/charts/{chart.id}/like", headers=self.viewer_auth)
        self.assertEqual(first.status_code, 200)

        # A repeat like (double tap / stale client) must succeed without
        # inflating the count.
        second = self.client.post(f"/api/charts/{chart.id}/like", headers=self.viewer_auth)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(second.json()["id"], first.json()["id"])

        feed = self.client.get("/api/charts/public", headers=self.viewer_auth).json()
        self.assertEqual(feed["charts"][0]["like_count"], 1)
        self.assertTrue(feed["charts"][0]["is_liked"])

        liked = self.client.get("/api/liked", headers=self.viewer_auth).json()
        self.assertEqual([c["id"] for c in liked], [chart.id])

    def test_unlike_is_idempotent(self):
        chart = _make_chart(self.db, self.author, "Unlikeable")
        self.client.post(f"/api/charts/{chart.id}/like", headers=self.viewer_auth)

        first = self.client.delete(f"/api/charts/{chart.id}/like", headers=self.viewer_auth)
        second = self.client.delete(f"/api/charts/{chart.id}/like", headers=self.viewer_auth)
        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)

        feed = self.client.get("/api/charts/public", headers=self.viewer_auth).json()
        self.assertEqual(feed["charts"][0]["like_count"], 0)
        self.assertFalse(feed["charts"][0]["is_liked"])

    def test_save_and_unsave_are_idempotent(self):
        chart = _make_chart(self.db, self.author, "Saveable")

        first = self.client.post(f"/api/charts/{chart.id}/save", headers=self.viewer_auth)
        second = self.client.post(f"/api/charts/{chart.id}/save", headers=self.viewer_auth)
        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(second.json()["id"], first.json()["id"])

        saved = self.client.get("/api/saved", headers=self.viewer_auth).json()
        self.assertEqual(len(saved), 1)
        self.assertEqual(saved[0]["chart"]["id"], chart.id)
        self.assertTrue(saved[0]["chart"]["is_saved"])

        for _ in range(2):
            resp = self.client.delete(f"/api/charts/{chart.id}/save", headers=self.viewer_auth)
            self.assertEqual(resp.status_code, 200)

        saved_after = self.client.get("/api/saved", headers=self.viewer_auth).json()
        self.assertEqual(saved_after, [])

    def test_like_and_save_require_auth(self):
        chart = _make_chart(self.db, self.author, "Auth required")

        self.assertEqual(self.client.post(f"/api/charts/{chart.id}/like").status_code, 401)
        self.assertEqual(self.client.post(f"/api/charts/{chart.id}/save").status_code, 401)

    def test_chart_view_increments_view_count(self):
        chart = _make_chart(self.db, self.author, "Viewable")

        for _ in range(2):
            resp = self.client.get(f"/api/charts/{chart.id}")
            self.assertEqual(resp.status_code, 200)

        self.assertEqual(resp.json()["view_count"], 2)

    def test_private_chart_denied_to_anonymous(self):
        chart = _make_chart(self.db, self.author, "Secret", is_public=False)

        resp = self.client.get(f"/api/charts/{chart.id}")
        self.assertEqual(resp.status_code, 403)


if __name__ == "__main__":
    unittest.main()
