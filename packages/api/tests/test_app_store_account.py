"""Sign in with Apple, account deletion, and public-feed safety.

Apple's signature is mocked. The tests cover the account the token maps to,
not Apple's network.
"""
import atexit
import os
import tempfile
import unittest
from unittest.mock import patch

TEST_SECRET = "app-store-account-test-secret-not-production-0123456789"
BOT_TOKEN = "moderation-test-token"

_fd, _path = tempfile.mkstemp(suffix=".db")
os.close(_fd)
os.environ.setdefault("DATABASE_URL", "sqlite:///" + _path)
os.environ.setdefault("JWT_SECRET_KEY", TEST_SECRET)
os.environ.setdefault("ENVIRONMENT", "development")

from fastapi.testclient import TestClient  # noqa: E402

import dependencies  # noqa: E402
import main  # noqa: E402
from dependencies import create_access_token  # noqa: E402
from models.database import Base, Chart, SessionLocal, Team, TeamMember, User, engine  # noqa: E402


@atexit.register
def _cleanup_database():
    engine.dispose()
    if os.path.exists(_path):
        os.unlink(_path)


class AppStoreAccountTests(unittest.TestCase):
    def _pin(self, module, name, value):
        patcher = patch.object(module, name, value)
        patcher.start()
        self.addCleanup(patcher.stop)

    def setUp(self):
        self._pin(dependencies, "JWT_SECRET_KEY", TEST_SECRET)
        self._pin(dependencies, "IS_PRODUCTION", False)
        self._pin(main, "IS_PRODUCTION", False)
        self._pin(main, "BOT_INTERNAL_API_TOKEN", BOT_TOKEN)
        Base.metadata.drop_all(engine)
        Base.metadata.create_all(engine)
        self.client = TestClient(main.app)
        main.limiter.reset()

    def tearDown(self):
        self.client.close()

    def _auth(self, user_id: str) -> dict:
        return {"Authorization": f"Bearer {create_access_token(user_id)}"}

    def _apple(self, claims, full_name=None):
        with patch.object(main, "verify_apple_identity_token", return_value=claims):
            return self.client.post("/api/auth/apple", json={
                "identity_token": "header.payload.signature",
                "full_name": full_name,
                "deliver": "token",
            })

    def test_apple_sign_in_creates_account_and_bearer_session(self):
        response = self._apple(
            {"sub": "apple-sub-1", "email": "Ada@privaterelay.appleid.com", "email_verified": "true"},
            full_name="Ada Lovelace",
        )
        self.assertEqual(response.status_code, 200, response.text)
        self.assertNotIn("set-cookie", response.headers)
        token = response.json()["token"]
        me = self.client.get("/api/user/me", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(me.status_code, 200, me.text)
        body = me.json()
        self.assertEqual(body["email"], "ada@privaterelay.appleid.com")
        self.assertEqual(body["name"], "Ada Lovelace")
        self.assertEqual(body["providers"], ["apple"])
        with SessionLocal() as db:
            user = db.query(User).filter(User.apple_id == "apple-sub-1").one()
            self.assertIsNone(user.google_id)
            self.assertIsNotNone(db.query(Team).filter(Team.owner_id == user.id, Team.is_personal.is_(True)).first())

    def test_apple_links_verified_email_to_existing_google_account(self):
        with SessionLocal() as db:
            user = User(email="ada@example.com", name="Ada", google_id="google-ada")
            db.add(user)
            db.commit()
            user_id = user.id
        response = self._apple(
            {"sub": "apple-sub-2", "email": "ada@example.com", "email_verified": True},
        )
        self.assertEqual(response.status_code, 200, response.text)
        me = self.client.get("/api/user/me", headers={"Authorization": f"Bearer {response.json()['token']}"})
        self.assertEqual(me.json()["id"], user_id)
        self.assertEqual(me.json()["providers"], ["google", "apple"])

    def test_apple_returning_user_does_not_need_an_email(self):
        self.assertEqual(self._apple(
            {"sub": "apple-sub-3", "email": "relay@privaterelay.appleid.com", "email_verified": "true"},
        ).status_code, 200)
        response = self._apple({"sub": "apple-sub-3"})
        self.assertEqual(response.status_code, 200, response.text)

    def test_apple_first_sign_in_without_email_is_rejected(self):
        response = self._apple({"sub": "apple-sub-missing"})
        self.assertEqual(response.status_code, 400, response.text)

    def test_delete_account_removes_user_charts_and_session(self):
        with SessionLocal() as db:
            user = User(email="gone@example.com", name="Gone", google_id="google-gone")
            db.add(user)
            db.commit()
            db.refresh(user)
            main._create_personal_team(db, user)
            chart = Chart(
                user_id=user.id,
                title="Mine",
                data={"labels": ["A"], "series": [{"name": "S", "data": [1]}]},
                config={"type": "bar"},
                is_public=True,
            )
            db.add(chart)
            db.commit()
            user_id = user.id
            chart_id = chart.id
        response = self.client.delete("/api/user/me", headers=self._auth(user_id))
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(self.client.get("/api/user/me", headers=self._auth(user_id)).status_code, 401)
        self.assertEqual(self.client.get(f"/api/charts/{chart_id}").status_code, 404)
        with SessionLocal() as db:
            self.assertIsNone(db.query(User).filter(User.id == user_id).first())
            self.assertIsNone(db.query(Team).filter(Team.owner_id == user_id).first())

    def test_delete_account_transfers_a_shared_team(self):
        with SessionLocal() as db:
            owner = User(email="owner@example.com", name="Owner", google_id="google-owner")
            member = User(email="member@example.com", name="Member", google_id="google-member")
            db.add_all([owner, member])
            db.commit()
            team = Team(name="Shared", slug="shared-team", owner_id=owner.id, is_personal=False)
            db.add(team)
            db.flush()
            db.add_all([
                TeamMember(team_id=team.id, user_id=owner.id, role="owner"),
                TeamMember(team_id=team.id, user_id=member.id, role="member"),
            ])
            db.commit()
            owner_id = owner.id
            member_id = member.id
            team_id = team.id
        response = self.client.delete("/api/user/me", headers=self._auth(owner_id))
        self.assertEqual(response.status_code, 200, response.text)
        with SessionLocal() as db:
            team = db.query(Team).filter(Team.id == team_id).one()
            self.assertEqual(team.owner_id, member_id)
            self.assertEqual(
                db.query(TeamMember).filter(TeamMember.team_id == team_id, TeamMember.user_id == member_id).one().role,
                "owner",
            )
            self.assertIsNone(db.query(User).filter(User.id == owner_id).first())

    def test_report_and_block_hide_public_charts_from_the_viewer(self):
        with SessionLocal() as db:
            author = User(email="author@example.com", name="Author", google_id="google-author")
            viewer = User(email="viewer@example.com", name="Viewer", google_id="google-viewer")
            stranger = User(email="stranger@example.com", name="Stranger", google_id="google-stranger")
            db.add_all([author, viewer, stranger])
            db.commit()
            first = Chart(
                user_id=author.id, title="Public one", is_public=True,
                data={"labels": ["A"], "series": [{"name": "S", "data": [1]}]}, config={"type": "bar"},
            )
            second = Chart(
                user_id=author.id, title="Public two", is_public=True,
                data={"labels": ["A"], "series": [{"name": "S", "data": [1]}]}, config={"type": "bar"},
            )
            db.add_all([first, second])
            db.commit()
            author_id, viewer_id, stranger_id = author.id, viewer.id, stranger.id
            first_id, second_id = first.id, second.id

        reported = self.client.post(
            f"/api/charts/{first_id}/report",
            headers=self._auth(viewer_id),
            json={"reason": "spam"},
        )
        self.assertEqual(reported.status_code, 200, reported.text)
        again = self.client.post(
            f"/api/charts/{first_id}/report",
            headers=self._auth(viewer_id),
            json={"reason": "spam"},
        )
        self.assertEqual(again.status_code, 200, again.text)

        viewer_feed = self.client.get("/api/charts/public", headers=self._auth(viewer_id)).json()
        self.assertEqual([chart["title"] for chart in viewer_feed["charts"]], ["Public two"])
        stranger_feed = self.client.get("/api/charts/public", headers=self._auth(stranger_id)).json()
        self.assertEqual(stranger_feed["total"], 2)
        self.assertEqual(self.client.get(f"/api/charts/{first_id}", headers=self._auth(viewer_id)).status_code, 404)

        blocked = self.client.post(f"/api/users/{author_id}/block", headers=self._auth(viewer_id))
        self.assertEqual(blocked.status_code, 200, blocked.text)
        after_block = self.client.get("/api/charts/public", headers=self._auth(viewer_id)).json()
        self.assertEqual(after_block["charts"], [])

        inbox = self.client.get("/api/moderation/reports", headers={"x-bot-token": BOT_TOKEN})
        self.assertEqual(inbox.status_code, 200, inbox.text)
        report_id = inbox.json()["reports"][0]["id"]
        self.assertEqual(self.client.get("/api/moderation/reports").status_code, 401)
        hidden = self.client.post(f"/api/moderation/reports/{report_id}/hide", headers={"x-bot-token": BOT_TOKEN})
        self.assertEqual(hidden.status_code, 200, hidden.text)
        with SessionLocal() as db:
            self.assertFalse(db.query(Chart).filter(Chart.id == first_id).one().is_public)
        public_again = self.client.get("/api/charts/public", headers=self._auth(stranger_id)).json()
        self.assertEqual([chart["id"] for chart in public_again["charts"]], [second_id])
