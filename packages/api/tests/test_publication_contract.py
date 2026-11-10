"""Publication consent and immutable reader views, exercised through real HTTP routes."""
import copy
import unittest
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient
import main
from dependencies import create_access_token
from models.database import Base, Chart, ChartRevision, ChartPublication, Dashboard, DashboardItem, SessionLocal, Team, TeamMember, User, engine, init_db
from services.publication import freeze_legacy


class PublicationContractTests(unittest.TestCase):
    def setUp(self):
        if engine.dialect.name != "sqlite" or "chartsuno_api_test_" not in str(engine.url):
            self.fail("Use scripts/test_api.py with its disposable database")
        Base.metadata.drop_all(engine)
        Base.metadata.create_all(engine)
        self.db = SessionLocal()
        self.addCleanup(self.db.close)
        self.owner = User(email="publication@example.test", google_id="publication", name="Author")
        self.other = User(email="reader@example.test", google_id="publication-reader")
        self.db.add_all([self.owner, self.other]); self.db.commit()
        self.team = main._create_personal_team(self.db, self.owner)
        self.chart = Chart(user_id=self.owner.id, team_id=self.team.id, title="Counts", data={
            "labels": ["A", "B"], "series": [{"name": "Count", "data": [0.00000012, None]}],
            "categoricalColumns": [{"name": "Group", "data": ["East", "West"]}],
            "private_upload_path": "SECRET", "sqlQuery": "SECRET", "verifiedData": True,
        }, config={"type": "bar", "title": "Counts", "private": "SECRET"}, source_type="paste", is_public=False)
        self.db.add(self.chart); self.db.commit()
        self.auth = {"Authorization": "Bearer " + create_access_token(self.owner.id)}
        self.other_auth = {"Authorization": "Bearer " + create_access_token(self.other.id)}
        self.client = TestClient(main.app); self.addCleanup(self.client.close)
        main.limiter.reset()
        self.path = f"/api/charts/{self.chart.id}"
        self.payload = {"source": {"kind": "own_data", "title": "My own data", "description": "I counted items in each region."}, "chart_type": "bar", "caption": "Regional counts"}

    def preview(self, payload=None):
        response = self.client.post(self.path + "/publication-preview", json=payload or self.payload, headers=self.auth)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertNotIn("SECRET", response.text)
        return response.json()

    def publish(self, **extra):
        preview = self.preview({**self.payload, "is_public": extra.get("is_public", True)})
        response = self.client.post(self.path + "/publish", json={**self.payload, "expected_draft_hash": preview["draft_hash"], **extra}, headers=self.auth)
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def test_own_data_is_attributed_not_verified_and_retry_is_idempotent(self):
        post = self.publish()
        self.assertEqual(post["source_declaration"]["kind"], "own_data")
        self.assertIsNone(post["source_url"])
        self.assertNotIn("verifiedData", post["data"])
        self.assertNotIn("SECRET", str(post))
        retry = self.publish()
        self.assertEqual(post["revision_id"], retry["revision_id"])
        self.assertEqual(self.db.query(ChartRevision).count(), 1)
        self.assertEqual(post["data"]["series"][0]["data"], [0.00000012, None])

    def test_edit_does_not_mutate_feed_reader_or_existing_share_and_correction_is_explicit(self):
        post = self.publish()
        token = self.client.post(self.path + "/share", headers=self.auth).json()["token"]
        old_png = self.client.get(f"/s/{token}/og.png").content
        edited = self.client.put(self.path, headers=self.auth, json={"title": "New", "data": {"labels": ["A", "B"], "series": [{"name": "Count", "data": [20, 30]}]}})
        self.assertEqual(edited.status_code, 200)
        self.assertEqual(self.client.get(self.path, headers=self.auth).json()["data"]["series"][0]["data"], [20, 30])
        for headers in ({}, self.auth, self.other_auth):
            reader = self.client.get(self.path + "?view=published", headers=headers).json()
            self.assertEqual(reader["data"], post["data"])
        feed = self.client.get("/api/charts/public", headers=self.auth).json()["charts"][0]
        self.assertEqual(feed["data"], post["data"])
        self.assertEqual(self.client.get(f"/s/{token}/og.png").content, old_png)
        preview = self.preview()
        denied = self.client.post(self.path + "/publish", headers=self.auth, json={**self.payload, "expected_draft_hash": preview["draft_hash"]})
        self.assertEqual(denied.status_code, 422)
        corrected = self.publish(correction_note="Corrected the counts after recounting.")
        self.assertNotEqual(corrected["revision_id"], post["revision_id"])
        self.assertEqual(corrected["parent_revision_id"], post["revision_id"])
        self.assertEqual(self.client.get(f"/api/share/{token}").json()["data"], post["data"])
        revisions = self.client.get(self.path + "/revisions", headers=self.auth).json()
        self.assertEqual(len(revisions), 2)
        self.assertEqual(revisions[1]["data"], post["data"])
        self.client.put(self.path + "/publish-targets", json={"is_public": False}, headers=self.auth)
        self.assertEqual(self.client.get(self.path + "/revisions").status_code, 403)
        self.assertEqual(self.client.get(f"/api/share/{token}").status_code, 404)
        self.assertEqual(self.client.get(f"/s/{token}").status_code, 404)

    def test_stale_review_or_modified_proposal_cannot_publish(self):
        review = self.preview()
        self.client.put(self.path, json={"description": "Changed privately"}, headers=self.auth)
        stale = self.client.post(self.path + "/publish", json={**self.payload, "expected_draft_hash": review["draft_hash"]}, headers=self.auth)
        self.assertEqual(stale.status_code, 409)
        review = self.preview()
        tampered = self.client.post(self.path + "/publish", json={**self.payload, "caption": "Changed after review", "expected_draft_hash": review["draft_hash"]}, headers=self.auth)
        self.assertEqual(tampered.status_code, 409)
        self.assertEqual(self.db.query(ChartRevision).count(), 0)

    def test_publication_bypasses_and_unauthorized_review_are_rejected(self):
        self.assertEqual(self.client.put(self.path, json={"is_public": True}, headers=self.auth).status_code, 409)
        self.assertEqual(self.client.put(self.path + "/publish-targets", json={"is_public": True}, headers=self.auth).status_code, 409)
        self.assertEqual(self.client.post(self.path + "/share", headers=self.auth).status_code, 409)
        self.assertEqual(self.client.post(self.path + "/publication-preview", json=self.payload, headers=self.other_auth).status_code, 403)
        group = Team(name="Group", slug="group", owner_id=self.owner.id, is_personal=False)
        self.db.add(group); self.db.flush()
        self.db.add(TeamMember(team_id=group.id, user_id=self.owner.id, role="owner")); self.db.commit()
        response = self.client.put(self.path + "/publish-targets", json={"team_ids": [group.id]}, headers=self.auth)
        self.assertEqual(response.status_code, 409)
        self.publish(is_public=False)
        response = self.client.put(self.path + "/publish-targets", json={"team_ids": [group.id]}, headers=self.auth)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.client.get(self.path).status_code, 403)
        self.assertEqual(self.client.post(self.path + "/share", headers=self.auth).status_code, 200)

    def test_invalid_tables_and_chart_semantics_are_blocked_before_publication(self):
        original = copy.deepcopy(self.chart.data)
        cases = [
            {"labels": [], "series": []},
            {"labels": ["A"], "series": [{"name": "N", "data": [None]}]},
            {"labels": ["A", "B"], "series": [{"name": "N", "data": [1]}]},
            {"labels": ["A"], "series": [{"name": "N", "data": [float("inf")]}]},
            {"labels": ["A"], "series": [{"name": "N", "data": [True]}]},
            {"labels": ["A"], "series": [{"name": "N", "data": [1]}, {"name": "n", "data": [2]}]},
            {**original, "sourceType": "image"}, {**original, "sourceType": "prompt"},
            {**original, "categoricalColumns": [{"name": "Group", "data": ["A"]}]},
        ]
        for data in cases:
            with self.subTest(data=data):
                self.chart.data = data; self.db.commit()
                preview = self.preview()
                self.assertTrue(preview["errors"])
                response = self.client.post(self.path + "/publish", json={**self.payload, "expected_draft_hash": preview["draft_hash"]}, headers=self.auth)
                self.assertEqual(response.status_code, 422, response.text)
        self.chart.data = original
        self.chart.config = {"type": "line", "seriesConfig": {"Count": {"axis": "right"}}}; self.db.commit()
        self.assertTrue(self.preview()["errors"], "Changing chart type cannot erase mixed-unit evidence")
        self.chart.config = {"type": "pie"}; self.db.commit()
        self.assertTrue(self.preview({**self.payload, "chart_type": "pie"})["errors"])
        self.assertEqual(self.db.query(ChartRevision).count(), 0)

    def test_external_source_requires_safe_url_and_own_label_is_canonical(self):
        for url in (None, "javascript:alert(1)", "https://user:password@example.test"):
            payload = {**self.payload, "source": {"kind": "external", "title": "Source", "description": "Dataset", "url": url}}
            self.assertTrue(self.preview(payload)["errors"])
        payload = {**self.payload, "source": {"kind": "own_data", "title": "Verified!", "description": "I counted these."}}
        self.assertEqual(self.preview(payload)["chart"]["source_declaration"]["title"], "My own data")

    def test_legacy_public_team_and_unlisted_records_are_frozen_without_claiming_review(self):
        self.chart.is_public = True
        self.chart.share_token = "legacy_publication_token_12345678"; self.db.commit()
        init_db(); self.db.expire_all()
        self.assertTrue(self.chart.publication_snapshot["legacy_snapshot"])
        self.assertIsNone(self.chart.publication_snapshot["source_declaration"])
        before = self.client.get(self.path).json()["data"]
        self.client.put(self.path, json={"data": {"labels": ["X"], "series": [{"name": "Changed", "data": [99]}]}}, headers=self.auth)
        self.assertEqual(self.client.get(self.path).json()["data"], before)
        self.assertEqual(self.client.get(f"/api/share/{self.chart.share_token}").json()["data"], before)
        init_db()
        self.assertEqual(self.db.query(ChartRevision).count(), 1)

    def test_cron_refresh_only_changes_draft(self):
        self.chart.source_type = "stock"; self.chart.refresh_query = {"ticker": "TEST"}
        dashboard = Dashboard(user_id=self.owner.id, name="Refresh", auto_refresh=True)
        self.db.add(dashboard); self.db.flush()
        self.db.add(DashboardItem(dashboard_id=dashboard.id, chart_id=self.chart.id)); self.db.commit()
        post = self.publish()
        new = {"labels": ["Today"], "series": [{"name": "Price", "data": [42]}]}
        with patch.object(main, "CRON_SECRET", "test-cron"), patch.object(main, "_refresh_stock_chart", AsyncMock(return_value=new)):
            response = self.client.post("/api/internal/cron/refresh-dashboards", headers={"x-cron-secret": "test-cron"})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(self.client.get(self.path).json()["data"], post["data"])
        self.assertEqual(self.client.get(self.path, headers=self.auth).json()["data"], new)

    def test_replay_after_revocation_and_competing_correction_cannot_restore_or_overwrite(self):
        review = self.preview()
        payload = {**self.payload, "expected_draft_hash": review["draft_hash"]}
        first = self.client.post(self.path + "/publish", json=payload, headers=self.auth)
        self.assertEqual(first.status_code, 200)
        self.assertEqual(self.client.post(self.path + "/publish", json=payload, headers=self.auth).json()["revision_id"], first.json()["revision_id"])
        self.client.put(self.path, json={"is_public": False}, headers=self.auth)
        self.assertEqual(self.client.post(self.path + "/publish", json=payload, headers=self.auth).status_code, 409)
        self.assertEqual(self.client.get(self.path).status_code, 403)
        a = {**self.payload, "caption": "Correction A"}
        b = {**self.payload, "caption": "Correction B"}
        ar, br = self.preview(a), self.preview(b)
        self.assertEqual(self.client.post(self.path + "/publish", json={**a, "expected_draft_hash": ar["draft_hash"], "correction_note": "A"}, headers=self.auth).status_code, 200)
        self.assertEqual(self.client.post(self.path + "/publish", json={**b, "expected_draft_hash": br["draft_hash"], "correction_note": "B"}, headers=self.auth).status_code, 409)

    def test_private_revision_history_is_not_exposed_by_later_publication(self):
        private = self.publish(is_public=False)
        self.payload["caption"] = "Public caption"
        self.publish(correction_note="Published a separate public version.")
        self.assertEqual(self.client.get(self.path + "/revisions").status_code, 403)
        self.assertEqual(self.client.get(self.path + "/revisions", headers=self.other_auth).status_code, 403)
        history = self.client.get(self.path + "/revisions", headers=self.auth)
        self.assertEqual(history.status_code, 200)
        self.assertIn(private["revision_id"], [item["revision_id"] for item in history.json()])

    def test_preview_audience_and_reserved_renderer_keys_are_bound(self):
        preview = self.preview({**self.payload, "is_public": False})
        response = self.client.post(self.path + "/publish", headers=self.auth,
                                    json={**self.payload, "expected_draft_hash": preview["draft_hash"], "is_public": True})
        self.assertEqual(response.status_code, 409)
        for name in ("name", "x", "__pointDetail", "__proto__", "constructor", "prototype", "a.b", "a[0]"):
            self.chart.data = {"labels": ["A"], "series": [{"name": name, "data": [1]}]}; self.db.commit()
            self.assertTrue(self.preview()["errors"], name)

    def test_team_search_and_activity_never_disclose_unpublished_title_or_description(self):
        self.payload["caption"] = None
        self.publish(is_public=False)
        group = Team(name="Research", slug="research", owner_id=self.owner.id, is_personal=False)
        self.db.add(group); self.db.flush()
        self.db.add_all([TeamMember(team_id=group.id, user_id=self.owner.id, role="owner"),
                         TeamMember(team_id=group.id, user_id=self.other.id, role="member")]); self.db.commit()
        self.client.put(self.path + "/publish-targets", headers=self.auth, json={"team_ids": [group.id]})
        self.client.put(self.path, headers=self.auth, json={"title": "UNPUBLISHED_SECRET", "description": "UNPUBLISHED_SECRET"})
        search = self.client.get(f"/api/teams/{group.id}/charts?search=UNPUBLISHED_SECRET", headers=self.other_auth)
        self.assertEqual(search.status_code, 200, search.text)
        self.assertEqual(search.json()["total"], 0)
        activity = self.client.get(f"/api/teams/{group.id}/activity", headers=self.other_auth)
        self.assertEqual(activity.status_code, 200, activity.text)
        self.assertNotIn("UNPUBLISHED_SECRET", activity.text)
        self.assertFalse(any(event["type"] == "chart_updated" for event in activity.json()["activities"]))
        self.client.put(self.path, headers=self.auth, json={"title": "Reviewed counts", "description": "Reviewed description"})
        correction = self.publish(is_public=False, correction_note="Reviewed the updated title.")
        after_correction = self.client.get(f"/api/teams/{group.id}/activity", headers=self.other_auth).json()
        updates = [event for event in after_correction["activities"] if event["type"] == "chart_updated"]
        self.assertEqual(len(updates), 1)
        self.assertIn(correction["revision_id"], updates[0]["id"])
        self.assertEqual(updates[0]["created_at"], correction["published_at"])
        self.client.put(self.path, headers=self.auth, json={"title": "ANOTHER_PRIVATE_EDIT"})
        after_private_edit = self.client.get(f"/api/teams/{group.id}/activity", headers=self.other_auth).json()
        self.assertEqual([event for event in after_private_edit["activities"] if event["type"] == "chart_updated"], updates)

    def test_bots_create_review_drafts_never_unreviewed_public_posts(self):
        result = {"labels": ["A"], "series": [{"name": "Count", "data": [1]}], "suggestedType": "bar", "suggestedTitle": "Bot draft"}
        with patch.object(main, "verify_bot_token"), patch.object(main, "analyze_image", AsyncMock(return_value=result)), patch.object(main, "generate_chart_from_prompt", AsyncMock(return_value=result)), patch.object(main, "design_chart", AsyncMock(return_value={})), patch.object(main, "apply_design"):
            for endpoint, payload in (("analyze-and-create", {"image_base64": "test"}), ("prompt-and-create", {"prompt": "test"})):
                response = self.client.post("/api/internal/bot/" + endpoint, json=payload)
                self.assertEqual(response.status_code, 200, response.text)
                self.assertFalse(response.json()["is_public"])
                self.assertTrue(response.json()["review_required"])
                chart = self.db.get(Chart, response.json()["chart_id"])
                self.assertFalse(chart.is_public)
                self.assertIsNone(chart.publication_snapshot)
                self.assertEqual(self.client.get("/api/charts/" + chart.id).status_code, 403)

    def test_legacy_private_team_and_unlisted_snapshots_are_migrated_and_deleted_with_chart(self):
        group = Team(name="Legacy", slug="legacy", owner_id=self.owner.id, is_personal=False)
        self.db.add(group); self.db.flush()
        self.db.add(ChartPublication(chart_id=self.chart.id, team_id=group.id, published_by=self.owner.id))
        unlisted = Chart(user_id=self.owner.id, team_id=self.team.id, title="Unlisted", data=copy.deepcopy(self.chart.data), config={"type": "bar"}, is_public=False, share_token="legacy_unlisted_migration_token_123")
        self.db.add(unlisted); self.db.commit()
        init_db(); self.db.expire_all()
        self.assertTrue(self.chart.publication_snapshot["legacy_snapshot"])
        self.assertTrue(unlisted.share_snapshot["legacy_snapshot"])
        self.assertEqual(self.db.query(ChartRevision).count(), 2)
        deleted_id = self.chart.id
        self.assertEqual(self.client.delete(self.path, headers=self.auth).status_code, 200)
        self.assertEqual(self.db.query(ChartRevision).filter_by(chart_id=deleted_id).count(), 0)

    def test_share_has_complete_table_and_never_draws_a_silently_truncated_chart(self):
        labels = [str(n) for n in range(15)]
        values = [0.00000012] * 15
        self.chart.data = {"labels": labels, "series": [{"name": "Count", "data": values}]}; self.db.commit()
        self.publish(is_public=False)
        token = self.client.post(self.path + "/share", headers=self.auth).json()["token"]
        payload = self.client.get(f"/api/share/{token}").json()
        self.assertEqual(payload["labels"], labels)
        self.assertEqual(payload["series"][0]["data"], values)
        page = self.client.get(f"/s/{token}")
        self.assertIn("complete data table", page.text)
        self.assertIn("My own data", page.text)
        self.assertIn("1.2e-07", page.text)
        self.assertEqual(page.headers["Cache-Control"], "no-store")

    def test_minimal_config_gets_renderable_defaults_and_invalid_enum_cannot_publish(self):
        self.chart.config = {"type": "bar"}; self.db.commit()
        preview = self.preview()
        self.assertEqual(preview["errors"], [])
        self.assertEqual(preview["chart"]["config"]["styleVariant"], "professional")
        self.assertEqual(preview["chart"]["config"]["colorScheme"], "default")
        self.assertEqual(preview["chart"]["config"]["themeMode"], "dark")
        self.assertEqual(preview["chart"]["config"]["title"], preview["chart"]["title"])
        self.chart.config = {"type": "bar", "styleVariant": "not-a-style"}; self.db.commit()
        invalid = self.preview()
        self.assertTrue(invalid["errors"])
        self.assertEqual(invalid["chart"]["config"]["styleVariant"], "professional")
        response = self.client.post(self.path + "/publish", headers=self.auth,
                                    json={**self.payload, "expected_draft_hash": invalid["draft_hash"]})
        self.assertEqual(response.status_code, 422)
