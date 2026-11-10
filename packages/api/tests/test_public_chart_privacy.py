"""Request-level privacy boundary for shared chart documents.

Run only via scripts/test_api.py, which removes inherited provider credentials
and binds this app's engine to a disposable database before importing tests.
"""
import copy
import json
import unittest

from fastapi.testclient import TestClient
import main
from dependencies import create_access_token
from models.database import (
    Base, Chart, ChartPublication, Dashboard, DashboardItem, SessionLocal,
    TeamMember, User, engine,
)

SECRET = "PRIVATE_EDITOR_ONLY"


class PublicChartPrivacyTests(unittest.TestCase):
    def setUp(self):
        if engine.dialect.name != "sqlite" or "chartsuno_api_test_" not in str(engine.url):
            self.fail("Use scripts/test_api.py with its disposable database")
        Base.metadata.drop_all(engine)
        Base.metadata.create_all(engine)
        self.db = SessionLocal()
        self.addCleanup(self.db.close)
        self.owner = User(email="privacy-owner@example.test", google_id="privacy-owner", name="Owner")
        self.viewer = User(email="privacy-viewer@example.test", google_id="privacy-viewer", name="Reader")
        self.db.add_all([self.owner, self.viewer])
        self.db.commit()
        self.team = main._create_personal_team(self.db, self.owner)
        self.client = TestClient(main.app)
        self.addCleanup(self.client.close)
        main.limiter.reset()
        self.owner_auth = {"Authorization": "Bearer " + create_access_token(self.owner.id)}
        self.viewer_auth = {"Authorization": "Bearer " + create_access_token(self.viewer.id)}
        self.original_data = {
            "labels": ["2024", "2025"],
            "series": [{"name": "Revenue", "data": [1.23456789, None], "confidence": [0.8, None], "private": {"sql": SECRET}}],
            "categoricalColumns": [{"name": "Region", "data": ["North", "South"], "raw": SECRET}],
            "mapRegions": [{"id": "USA", "name": "United States", "value": 12, "raw": SECRET}],
            "mapScope": "world", "xAxisLabel": "Year", "yAxisLabel": "Revenue",
            "xAxisType": "year", "yAxisFormat": "currency", "yAxisPrefix": "$", "yAxisSuffix": "million",
            "sourceImage": {"base64": SECRET, "mimeType": "image/png"},
            "sourcePrompt": SECRET, "userPrompt": SECRET, "sqlQuery": SECRET,
            "sqlConnectionId": SECRET, "refresh_query": {"sql": SECRET},
            "providerResponse": {"nested": [{"secret": SECRET}]},
            "aiReasoning": SECRET, "aiSummary": SECRET, "verifiedData": True,
            "sourceLink": "javascript:" + SECRET,
            "sources": [{"title": "Published data", "url": "https://data.example.test/releases?year=2024", "internal": SECRET},
                        {"title": "Unsafe", "url": "https://" + SECRET + ":password@example.test"}],
        }
        self.original_config = {
            "type": "bar", "title": "Revenue", "colorScheme": "default", "themeMode": "light",
            "showGrid": True, "stacked": False, "showAxisLabels": True,
            "customColors": {"text": "#123456", "seriesColors": ["#abcdef"], "private": SECRET},
            "seriesConfig": {"Revenue": {"chartType": "line", "axis": "right", "private": SECRET}},
            "rightYAxisLabel": "Revenue", "raceTopN": 8, "raceFrameMs": 900,
            "aiMode": "custom", "aiCustomPrompt": SECRET, "aiReadyToGenerate": True,
            "internal": {"secret": SECRET}, "sourceLink": "file:///" + SECRET,
        }
        self.chart = Chart(user_id=self.owner.id, team_id=self.team.id, title="Revenue",
                           data=copy.deepcopy(self.original_data), config=copy.deepcopy(self.original_config),
                           source_type="image", source_url="https://" + SECRET + ":password@example.test",
                           is_public=True)
        self.db.add(self.chart)
        self.db.commit()

    def assert_public_chart(self, payload):
        self.assertNotIn(SECRET, json.dumps(payload))
        self.assertNotIn("verifiedData", payload["data"])
        self.assertEqual(payload["data"]["series"], [{"name": "Revenue", "data": [1.23456789, None], "confidence": [0.8, None]}])
        self.assertEqual(payload["data"]["categoricalColumns"], [{"name": "Region", "data": ["North", "South"]}])
        self.assertEqual(payload["data"]["mapRegions"], [{"id": "USA", "name": "United States", "value": 12}])
        self.assertEqual(payload["data"]["sources"], [{"title": "Published data", "url": "https://data.example.test/releases?year=2024"}])
        self.assertEqual(payload["config"]["customColors"], {"text": "#123456", "seriesColors": ["#abcdef"]})
        self.assertEqual(payload["config"]["seriesConfig"], {"Revenue": {"chartType": "line", "axis": "right"}})
        self.assertEqual(payload["config"]["raceFrameMs"], 900)
        self.assertIsNone(payload["source_url"])

    def test_public_detail_is_projected_but_owner_editor_get_is_lossless(self):
        for headers in ({}, self.viewer_auth):
            response = self.client.get(f"/api/charts/{self.chart.id}", headers=headers)
            self.assertEqual(response.status_code, 200)
            self.assert_public_chart(response.json())
        owner = self.client.get(f"/api/charts/{self.chart.id}", headers=self.owner_auth)
        self.assertEqual(owner.status_code, 200)
        self.assertEqual(owner.json()["data"], self.original_data)
        self.assertEqual(owner.json()["config"], self.original_config)
        self.db.refresh(self.chart)
        self.assertEqual(self.chart.data, self.original_data)
        self.assertEqual(self.chart.config, self.original_config)

    def test_feed_personal_saved_liked_and_write_responses_do_not_return_editor_metadata(self):
        for headers in (self.viewer_auth, self.owner_auth):
            feed = self.client.get("/api/charts/public", headers=headers)
            self.assertEqual(feed.status_code, 200)
            self.assert_public_chart(feed.json()["charts"][0])
            save = self.client.post(f"/api/charts/{self.chart.id}/save", headers=headers)
            self.assertEqual(save.status_code, 200)
            self.assert_public_chart(save.json()["chart"])
            saved = self.client.get("/api/saved", headers=headers)
            self.assert_public_chart(saved.json()[0]["chart"])
            self.assertEqual(self.client.post(f"/api/charts/{self.chart.id}/like", headers=headers).status_code, 200)
            self.assert_public_chart(self.client.get("/api/liked", headers=headers).json()[0])
        self.assert_public_chart(self.client.get("/api/charts", headers=self.owner_auth).json()["charts"][0])
        updated = self.client.put(f"/api/charts/{self.chart.id}", headers=self.owner_auth, json={"title": "Updated"})
        self.assertEqual(updated.status_code, 200)
        self.assert_public_chart(updated.json())

    def test_team_only_chart_is_projected_and_revocation_still_denies_read(self):
        self.chart.is_public = False
        member = TeamMember(team_id=self.team.id, user_id=self.viewer.id, role="member")
        self.db.add(member)
        self.db.add(ChartPublication(chart_id=self.chart.id, team_id=self.team.id, published_by=self.owner.id))
        self.db.commit()
        self.assertEqual(self.client.get(f"/api/charts/{self.chart.id}").status_code, 403)
        self.assert_public_chart(self.client.get(f"/api/charts/{self.chart.id}", headers=self.viewer_auth).json())
        team_charts = self.client.get(f"/api/teams/{self.team.id}/charts", headers=self.viewer_auth)
        self.assertEqual(team_charts.status_code, 200)
        self.assert_public_chart(team_charts.json()["charts"][0])
        self.db.delete(member)
        self.db.commit()
        self.assertEqual(self.client.get(f"/api/charts/{self.chart.id}", headers=self.viewer_auth).status_code, 403)

    def test_dashboard_and_unlisted_share_are_public_projections_even_for_owner(self):
        dashboard = Dashboard(user_id=self.owner.id, name="Shared", is_public=True)
        self.db.add(dashboard)
        self.db.flush()
        self.db.add(DashboardItem(dashboard_id=dashboard.id, chart_id=self.chart.id))
        self.db.commit()
        for headers in ({}, self.viewer_auth, self.owner_auth):
            response = self.client.get(f"/api/dashboards/{dashboard.id}", headers=headers)
            self.assertEqual(response.status_code, 200)
            self.assert_public_chart(response.json()["items"][0]["chart"])
        self.chart.is_public = False
        # A pre-existing unlisted legacy link remains readable without new publication.
        self.chart.share_token = "legacy_privacy_token_1234567890"
        self.db.commit()
        share = self.client.post(f"/api/charts/{self.chart.id}/share", headers=self.owner_auth)
        self.assertEqual(share.status_code, 200)
        token = share.json()["token"]
        response = self.client.get(f"/api/share/{token}")
        self.assertEqual(response.status_code, 200)
        self.assertNotIn(SECRET, response.text)
        self.assertEqual(response.json()["series"][0]["data"], [1.23456789, None])
        html = self.client.get(f"/s/{token}")
        self.assertEqual(html.status_code, 200)
        self.assertNotIn(SECRET, html.text)
        self.assertEqual(self.client.get(f"/api/charts/{self.chart.id}", headers=self.viewer_auth).status_code, 403)
        self.assertEqual(self.client.get(f"/s/{token}/og.png").status_code, 200)
        self.db.refresh(self.chart)
        self.assertEqual(self.chart.data, self.original_data)

    def test_nested_objects_in_display_slots_are_not_stringified_into_shared_content(self):
        self.chart.data = {
            "labels": [{"secret": SECRET}, "Known"],
            "series": [{"name": "Revenue", "data": [{"secret": SECRET}, 3], "confidence": [{"secret": SECRET}, 0.5]},
                       {"name": {"secret": SECRET}, "data": [1, 2]}],
            "categoricalColumns": [{"name": "Group", "data": [{"secret": SECRET}, "Known"]}],
            "mapRegions": [{"id": "USA", "name": {"secret": SECRET}, "value": 1}],
            "xAxisLabel": {"secret": SECRET},
        }
        self.chart.config = {"type": "bar", "title": {"secret": SECRET}, "customColors": {"seriesColors": [{"secret": SECRET}]}}
        self.db.commit()
        payload = self.client.get(f"/api/charts/{self.chart.id}", headers=self.viewer_auth).json()
        self.assertNotIn(SECRET, json.dumps(payload))
        self.assertEqual(payload["data"]["labels"], ["", "Known"])
        self.assertEqual(payload["data"]["series"][0]["data"], [None, 3])
        self.chart.share_token = "legacy_nested_token_1234567890"
        self.db.commit()
        token = self.client.post(f"/api/charts/{self.chart.id}/share", headers=self.owner_auth).json()["token"]
        for path in (f"/api/share/{token}", f"/s/{token}"):
            response = self.client.get(path)
            self.assertEqual(response.status_code, 200)
            self.assertNotIn(SECRET, response.text)
        self.db.refresh(self.chart)
        self.assertEqual(self.chart.data["labels"][0], {"secret": SECRET})
