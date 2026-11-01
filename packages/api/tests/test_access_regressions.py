"""Request-level regressions for visibility, refresh authorization and quotas."""
import asyncio
import os
import tempfile
import unittest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, patch

_fd, _path = tempfile.mkstemp(prefix="chartsuno_access_test_", suffix=".db")
os.close(_fd)
os.environ.setdefault("DATABASE_URL", "sqlite:///" + _path)
from fastapi.testclient import TestClient
import main
from dependencies import create_access_token
from models.database import Base, engine, SessionLocal, User, Chart, SqlConnection, TeamMember, ChartPublication, Dashboard, DashboardItem

class AccessRegressionTests(unittest.TestCase):
    def setUp(self):
        # Never drop a database inherited from a production environment.
        if engine.dialect.name != "sqlite" or not any(s in str(engine.url) for s in ("test", "audit")):
            self.fail("Run regressions with an explicit disposable SQLite test DATABASE_URL")
        Base.metadata.drop_all(engine)
        Base.metadata.create_all(engine)
        self.db = SessionLocal()
        self.addCleanup(self.db.close)
        self.owner = User(email="owner@example.test", google_id="owner")
        self.viewer = User(email="viewer@example.test", google_id="viewer")
        self.db.add_all([self.owner, self.viewer]); self.db.commit()
        self.team = main._create_personal_team(self.db, self.owner)
        self.viewer_team = main._create_personal_team(self.db, self.viewer)
        self.client = TestClient(main.app)
        self.auth = {"Authorization": "Bearer " + create_access_token(self.viewer.id)}
        self.owner_auth = {"Authorization": "Bearer " + create_access_token(self.owner.id)}
        self.chart = Chart(user_id=self.owner.id, team_id=self.team.id, title="Secret", data={"labels":["A"], "series":[{"name":"S", "data":[42]}]}, config={"type":"bar"}, is_public=False)
        self.db.add(self.chart); self.db.commit()

    def dashboard(self, public=False):
        return self.client.post("/api/dashboards", headers=self.auth, json={"name":"Board", "is_public":public}).json()["id"]

    def connection(self):
        c = SqlConnection(team_id=self.team.id, name="DB", host="opaque", database_name="opaque", username="opaque", encrypted_password="opaque", created_by=self.owner.id, status="ok")
        self.db.add(c); self.db.commit(); return c

    def test_dashboard_cannot_attach_unreadable_chart(self):
        r = self.client.post(f"/api/dashboards/{self.dashboard()}/items", headers=self.auth, json={"items":[{"chart_id":self.chart.id}]})
        self.assertEqual(r.status_code, 403)

    def test_existing_dashboard_item_rechecks_visibility_for_anonymous_viewer(self):
        did = self.dashboard(True)
        self.db.add(DashboardItem(dashboard_id=did, chart_id=self.chart.id)); self.db.commit()
        r = self.client.get(f"/api/dashboards/{did}")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["items"], [])
        self.assertEqual(r.json()["item_count"], 0)

    def test_saved_and_liked_stop_exposing_unpublished_chart(self):
        self.chart.is_public=True; self.db.commit()
        for action in ("save", "like"):
            self.assertEqual(self.client.post(f"/api/charts/{self.chart.id}/{action}", headers=self.auth).status_code, 200)
        self.chart.is_public=False; self.db.commit()
        for path in ("/api/saved", "/api/liked"):
            self.assertEqual(self.client.get(path, headers=self.auth).json(), [])

    def test_saved_and_dashboard_stop_exposing_chart_after_membership_revocation(self):
        member=TeamMember(team_id=self.team.id, user_id=self.viewer.id, role="member")
        self.db.add(member); self.db.add(ChartPublication(chart_id=self.chart.id, team_id=self.team.id, published_by=self.owner.id)); self.db.commit()
        did=self.dashboard()
        self.assertEqual(self.client.post(f"/api/charts/{self.chart.id}/save", headers=self.auth).status_code,200)
        self.assertEqual(self.client.post(f"/api/dashboards/{did}/items",headers=self.auth,json={"items":[{"chart_id":self.chart.id}]}).status_code,200)
        self.db.delete(member); self.db.commit()
        self.assertEqual(self.client.get("/api/saved",headers=self.auth).json(),[])
        self.assertEqual(self.client.get(f"/api/dashboards/{did}",headers=self.auth).json()["items"],[])

    def test_create_chart_rejects_other_team_sql_connection(self):
        c=self.connection()
        r=self.client.post("/api/charts",headers=self.auth,json={"data":self.chart.data,"config":self.chart.config,"source_type":"sql","sql_connection_id":c.id,"refresh_query":{"sql":"SELECT secret"}})
        self.assertEqual(r.status_code,403)

    def test_sql_link_for_current_member_succeeds_and_rejects_nontext_sql(self):
        c = self.connection()
        payload = {"data": self.chart.data, "config": self.chart.config,
                   "source_type": "sql", "sql_connection_id": c.id,
                   "refresh_query": {"sql": "SELECT 1"}}
        self.assertEqual(self.client.post("/api/charts", headers=self.owner_auth, json=payload).status_code, 200)
        payload["refresh_query"]["sql"] = 123
        self.assertEqual(self.client.post("/api/charts", headers=self.owner_auth, json=payload).status_code, 400)

    def test_refresh_rechecks_chart_owner_connection_membership(self):
        c=self.connection(); self.chart.sql_connection_id=c.id; self.chart.refresh_query={"sql":"SELECT 1"}; self.db.commit()
        with patch.object(main,"execute_user_sql",new_callable=AsyncMock) as execute:
            execute.return_value=(["n"],[{"n":1}])
            self.assertIsNotNone(asyncio.run(main._refresh_sql_chart(self.chart,self.db)))
            self.db.query(TeamMember).filter(TeamMember.user_id==self.owner.id,TeamMember.team_id==self.team.id).delete(); self.db.commit()
            self.assertIsNone(asyncio.run(main._refresh_sql_chart(self.chart,self.db)))
            self.assertEqual(execute.await_count,1)

    def test_public_attribution_has_no_private_account_fields(self):
        self.chart.is_public=True; self.db.commit()
        author=self.client.get("/api/charts/public").json()["charts"][0]["user"]
        self.assertEqual(author["id"],self.owner.id)
        self.assertFalse(set(author)&{"email","last_login","providers","created_at"})
        self.assertEqual(self.client.get("/api/user/me",headers=self.owner_auth).json()["email"],self.owner.email)

    def test_free_quota_rolls_over_but_same_period_does_not(self):
        sub=self.viewer_team.subscription; sub.charts_created_this_month=10
        sub.billing_cycle_start=datetime.utcnow().replace(day=1,hour=0,minute=0,second=0,microsecond=0)-timedelta(days=1); self.db.commit()
        self.assertTrue(main._check_can_create_chart(self.db,self.viewer_team))
        self.assertEqual(sub.charts_created_this_month,0)
        sub.charts_created_this_month=10; self.db.commit()
        self.assertFalse(main._check_can_create_chart(self.db,self.viewer_team))

    def test_concurrent_requests_cannot_consume_same_final_quota_slot(self):
        from concurrent.futures import ThreadPoolExecutor
        from threading import Barrier
        sub = self.viewer_team.subscription
        sub.billing_cycle_start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        sub.charts_created_this_month = 9
        self.db.commit()
        barrier = Barrier(2)
        # Force both requests past a stale successful read; the conditional
        # consume must still allow only one, independent of read timing.
        def checked(db, team):
            barrier.wait(timeout=5)
            return True
        payload = {"data": self.chart.data, "config": self.chart.config}
        def create(_):
            return self.client.post("/api/charts", headers=self.auth, json=payload).status_code
        with patch.object(main, "_check_can_create_chart", side_effect=checked):
            with ThreadPoolExecutor(max_workers=2) as pool:
                statuses = sorted(pool.map(create, range(2)))
        self.assertEqual(statuses, [200, 403])
        self.db.refresh(sub)
        self.assertEqual(sub.charts_created_this_month, 10)
        self.assertEqual(self.db.query(Chart).filter(Chart.user_id == self.viewer.id).count(), 1)

    def test_failed_chart_insert_does_not_consume_quota(self):
        from sqlalchemy.exc import IntegrityError
        sub = self.viewer_team.subscription
        sub.billing_cycle_start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        sub.charts_created_this_month = 9
        self.db.commit()
        def duplicate_chart(**kwargs):
            return Chart(id=self.chart.id, **kwargs)
        with patch.object(main, "Chart", side_effect=duplicate_chart):
            with self.assertRaises(IntegrityError):
                self.client.post("/api/charts", headers=self.auth, json={"data": self.chart.data, "config": self.chart.config})
        self.db.refresh(sub)
        self.assertEqual(sub.charts_created_this_month, 9)

    def test_stock_refresh_awaits_adapter(self):
        expected={"labels":["A"],"series":[]}
        with patch.object(main,"fetch_stock_prices",new_callable=AsyncMock,return_value=expected) as fetch:
            self.assertEqual(asyncio.run(main._refresh_stock_chart({"ticker":"AAPL"})),expected)
            fetch.assert_awaited_once_with("AAPL","3M",None)

    def test_bootstrap_reaches_head_and_is_repeatable(self):
        from sqlalchemy import text
        with engine.begin() as c:
            c.execute(text("DROP TABLE IF EXISTS alembic_version"))
        main.init_db()
        with engine.begin() as c:
            self.assertEqual(c.execute(text("SELECT version_num FROM alembic_version")).scalar(), "008_add_user_referrals")
            # Recover the exact historical failure: latest columns, old stamp.
            c.execute(text("UPDATE alembic_version SET version_num='002_add_branding'"))
        main.init_db(); main.init_db()
        with engine.connect() as c:
            self.assertEqual(c.execute(text("SELECT version_num FROM alembic_version")).scalar(), "008_add_user_referrals")
        self.db.refresh(self.chart)
        self.assertEqual(self.chart.data["series"][0]["data"], [42])

    def test_failed_migration_prevents_startup(self):
        with patch("alembic.command.upgrade",side_effect=RuntimeError("migration unavailable")):
            with self.assertRaisesRegex(RuntimeError,"migration unavailable"):
                main.init_db()
