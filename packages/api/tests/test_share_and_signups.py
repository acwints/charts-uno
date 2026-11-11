"""Unlisted share links and the public signup count."""
import logging
import os
import struct
import tempfile
import time
import unittest
import zlib
from datetime import datetime, timedelta

_fd, _path = tempfile.mkstemp(prefix="chartsuno_share_test_", suffix=".db")
os.close(_fd)
os.environ.setdefault("DATABASE_URL", "sqlite:///" + _path)

from fastapi.testclient import TestClient
import main
from dependencies import create_access_token
from models.database import REVIEW_LOGIN_GOOGLE_ID, Base, SessionLocal, User, engine
from models.database import Chart, HomepageChartEvent
from services.share_page import (
    COUNT_DEFINITION,
    CTA_TEXT,
    SHARE_LINK_WINDOW_UNSUPPORTED,
    chart_daily_stats,
    credit_url,
    signup_census,
)


def _empty_day(date: str) -> dict:
    return {"date": date, "google": 0, "apple": 0, "both": 0, "total": 0}


def _window_days(moment: datetime, fills: dict) -> list:
    start = (moment - timedelta(days=7)).date()
    day = start
    rows = []
    while day <= moment.date():
        row = _empty_day(day.isoformat())
        extra = fills.get(day.isoformat(), {})
        row.update(extra)
        rows.append(row)
        day += timedelta(days=1)
    return rows


def _days_ending_today(google_today: int = 0) -> list:
    moment = datetime.utcnow()
    fills = {}
    if google_today:
        fills[moment.date().isoformat()] = {"google": google_today, "total": google_today}
    return _window_days(moment, fills)


def _png_pixels(data: bytes) -> bytes:
    if not data.startswith(b"\x89PNG\r\n\x1a\n"):
        raise AssertionError("not a png")
    pos = 8
    width = height = None
    idat = b""
    while pos + 8 <= len(data):
        length = struct.unpack(">I", data[pos:pos + 4])[0]
        tag = data[pos + 4:pos + 8]
        chunk = data[pos + 8:pos + 8 + length]
        if tag == b"IHDR":
            width, height = struct.unpack(">II", chunk[:8])
        elif tag == b"IDAT":
            idat += chunk
        elif tag == b"IEND":
            break
        pos += 12 + length
    raw = zlib.decompress(idat)
    stride = width * 3
    pixels = bytearray()
    offset = 0
    for _ in range(height):
        if raw[offset] != 0:
            raise AssertionError("unexpected png filter")
        offset += 1
        pixels.extend(raw[offset:offset + stride])
        offset += stride
    return bytes(pixels)


class ShareAndSignupTests(unittest.TestCase):
    def setUp(self):
        if engine.dialect.name != "sqlite":
            self.fail("Share tests require the disposable SQLite database")
        Base.metadata.drop_all(engine)
        Base.metadata.create_all(engine)
        self.db = SessionLocal()
        self.addCleanup(self.db.close)
        self.owner = User(email="ada@studio.test", google_id="ada", name="Ada")
        self.other = User(email="other@studio.test", google_id="other", name="Other")
        self.db.add_all([self.owner, self.other])
        self.db.commit()
        self.client = TestClient(main.app)
        self.addCleanup(self.client.close)
        main.limiter.reset()
        self.owner_auth = {"Authorization": "Bearer " + create_access_token(self.owner.id)}
        self.other_auth = {"Authorization": "Bearer " + create_access_token(self.other.id)}
        created = self.client.post(
            "/api/charts",
            headers=self.owner_auth,
            json={
                "title": "Q3 signups <doubled>",
                "data": {"labels": ["Jan", "Feb"], "series": [{"name": "Signups", "data": [3, 9]}]},
                "config": {"type": "bar", "title": "Q3 signups <doubled>"},
            },
        )
        self.assertEqual(created.status_code, 200, created.text)
        self.chart_id = created.json()["id"]

    def test_share_link_is_public_read_only_and_not_the_feed(self):
        self.assertEqual(self.client.get(f"/api/charts/{self.chart_id}").status_code, 403)
        denied = self.client.post(f"/api/charts/{self.chart_id}/share", headers=self.other_auth)
        self.assertEqual(denied.status_code, 403)

        # Sharing now requires a reviewed data/source snapshot, but need not list in the feed.
        publication = {"is_public": False, "source": {"kind": "own_data", "title": "My own data", "description": "Counted signups each month"}, "chart_type": "bar"}
        preview = self.client.post(f"/api/charts/{self.chart_id}/publication-preview", headers=self.owner_auth, json=publication)
        reviewed = self.client.post(f"/api/charts/{self.chart_id}/publish", headers=self.owner_auth,
                                   json={**publication, "expected_draft_hash": preview.json()["draft_hash"], "is_public": False})
        self.assertEqual(reviewed.status_code, 200, reviewed.text)
        first = self.client.post(f"/api/charts/{self.chart_id}/share", headers=self.owner_auth)
        self.assertEqual(first.status_code, 200, first.text)
        token = first.json()["token"]
        self.assertTrue(token)
        again = self.client.post(f"/api/charts/{self.chart_id}/share", headers=self.owner_auth)
        self.assertEqual(again.json()["token"], token)

        self.assertEqual(self.client.get("/api/charts/public", headers=self.owner_auth).json()["total"], 0)
        self.assertEqual(self.client.get(f"/api/charts/{self.chart_id}").status_code, 403)

        page = self.client.get(f"/s/{token}")
        self.assertEqual(page.status_code, 200, page.text)
        self.assertIn("text/html", page.headers["content-type"])
        self.assertIn("Q3 signups &lt;doubled&gt;", page.text)
        self.assertNotIn("<script>", page.text)
        self.assertIn(CTA_TEXT, page.text)
        self.assertRegex(
            page.text,
            r'class="share-credit" href="https://www.chartsuno.com/\?ref=[A-Za-z0-9_-]{8,16}"',
        )
        self.assertIn("Made with Chartsuno", page.text)
        self.assertIn(f"/s/{token}/og.png", page.text)
        self.assertIn('property="og:title"', page.text)
        self.assertIn("noindex", page.text)
        self.assertNotIn(self.owner.email, page.text)

        payload = self.client.get(f"/api/share/{token}")
        self.assertEqual(payload.status_code, 200, payload.text)
        self.assertEqual(payload.json()["title"], "Q3 signups <doubled>")
        self.assertNotIn("email", payload.json())
        self.assertEqual(payload.json()["series"][0]["data"], [3, 9])

        image = self.client.get(f"/s/{token}/og.png")
        self.assertEqual(image.status_code, 200, image.content[:20])
        self.assertEqual(image.headers["content-type"], "image/png")
        self.assertIn(bytes((0x7A, 0xA2, 0xFF)), _png_pixels(image.content))

        missing = self.client.get("/s/not-a-real-token")
        self.assertEqual(missing.status_code, 404)
        self.assertIn(CTA_TEXT, missing.text)
        self.assertIn('class="share-credit" href="https://www.chartsuno.com/"', missing.text)
        self.assertNotIn("?ref=", missing.text)

        turned_off = self.client.delete(f"/api/charts/{self.chart_id}/share", headers=self.owner_auth)
        self.assertEqual(turned_off.status_code, 200, turned_off.text)
        self.assertFalse(turned_off.json()["enabled"])
        self.assertEqual(self.client.get(f"/s/{token}").status_code, 404)
        self.assertEqual(self.client.get(f"/api/charts/{self.chart_id}", headers=self.owner_auth).status_code, 200)

    def test_signup_count_excludes_test_and_review_accounts(self):
        self.db.add_all([
            User(email="person@gmail.com", google_id="real-person", name="Real"),
            User(email="sample@example.com", google_id="example", name="Sample"),
            User(email="bot@chartsuno.local", google_id="bot", name="Bot"),
            User(email="reviewer@gmail.com", google_id=REVIEW_LOGIN_GOOGLE_ID, name="App Review"),
        ])
        self.db.commit()
        counted = self.client.get("/api/stats/signups")
        self.assertEqual(counted.status_code, 200, counted.text)
        expected = {
            "count": 1,
            "definition": COUNT_DEFINITION,
            "accounts_total": 6,
            "users_with_a_chart": 0,
            "users_with_a_chart_24h": 0,
            "first_chart_saves_today": 0,
            "first_chart_saves_7d": 0,
            "template_picks_today": 0,
            "template_picks_7d": 0,
            "users_with_a_chart_7_days_ago": 0,
            "users_with_a_chart_yesterday": 0,
            "signups_last_7d": 1,
            "count_7_days_ago": 0,
            "count_yesterday": 0,
            "homepage_charts_today": 0,
            "homepage_charts_7d": 0,
            "homepage_views_today": 0,
            "homepage_views_7d": 0,
            "chart_starts_today": 0,
            "chart_starts_7d": 0,
            "chart_saves_7d": 0,
            "chart_saves_7d_signed_in": 0,
            "chart_saves_7d_anonymous": 0,
            "chart_downloads_today": 0,
            "chart_downloads_7d": 0,
            "keep_prompt_shown_today": 0,
            "keep_prompt_shown_7d": 0,
            "keep_prompt_clicked_today": 0,
            "keep_prompt_clicked_7d": 0,
            "keep_prompt_signins_today": 0,
            "keep_prompt_signins_7d": 0,
            "signup_providers": {"google": 1, "apple": 0, "both": 0},
            "signups_last_7d_by_day": _days_ending_today(google_today=1),
            "signup_attribution": {
                "platforms": {"ios": 0, "web": 0, "unknown": 1},
                "with_referrer_host": 0,
                "with_utm": 0,
            },
        }
        self.assertEqual(counted.json(), expected)
        self.assertNotIn("created_at", counted.text)
        self.assertEqual(counted.headers["cache-control"], "no-store")
        self.assertNotIn("gmail.com", counted.text)
        self.assertNotIn("@", counted.headers.get("x-signup-audit", ""))
        public = self.client.get("/api/count")
        self.assertEqual(public.status_code, 200, public.text)
        self.assertEqual(public.json(), expected)
        self.assertEqual(public.headers["cache-control"], "no-store")
        self.assertEqual(public.json(), counted.json())
        self.assertIn("test_or_demo=", public.headers["x-signup-audit"])
        me = self.client.get("/api/user/me", headers=self.owner_auth)
        self.assertEqual(me.status_code, 200, me.text)
        self.assertRegex(me.json()["referral_code"], r"^[A-Za-z0-9_-]{8}$")
        self.assertNotIn("referred_by", me.json())

    def test_count_is_distinct_people_and_names_bulk_seeds(self):
        now = datetime(2026, 11, 1, 12, 0, 0)
        person = User(
            email="Ada.Person@gmail.com",
            google_id="ada-person",
            name="Ada Person",
            created_at=now - timedelta(days=10),
            referral_code="Person01",
        )
        self.db.add(person)
        self.db.commit()
        self.db.add(Chart(
            user_id=person.id,
            title="Points",
            data={"labels": ["2", "5"], "series": [{"name": "Y", "data": [4, 7]}]},
            config={"type": "scatter", "title": "Points"},
            created_at=now - timedelta(days=9),
        ))
        bulk_at = now - timedelta(days=8)
        same_second = now - timedelta(days=3)
        rows = [
            User(email="ada.person@gmail.com", google_id="ada-case", created_at=now - timedelta(days=1)),
            User(email="adaperson+news@gmail.com", google_id="ada-plus", created_at=now - timedelta(hours=1)),
            User(email="acwints78@gmail.com", google_id="site-owner", created_at=now - timedelta(days=20)),
            User(email="acwints78+team@gmail.com", google_id="site-owner-alias", created_at=now - timedelta(days=2)),
            User(email="ghost@gmail.com", google_id=None, apple_id=None, created_at=now - timedelta(days=4)),
            User(email="demo@gmail.com", google_id="demo-kept", created_at=now - timedelta(days=2)),
        ]
        rows.extend(
            User(email=f"user{i}@gmail.com", google_id=f"bulk-{i}", created_at=bulk_at)
            for i in range(1, 6)
        )
        rows.extend(
            User(email=f"{name}@gmail.com", google_id=f"kept-{name}", created_at=same_second)
            for name in ("alice", "bob", "carol", "dave", "erin")
        )
        self.db.add_all(rows)
        self.db.commit()

        census = signup_census(self.db, now)
        self.assertEqual(census["public"], {
            "count": 7,
            "definition": COUNT_DEFINITION,
            "accounts_total": 19,
            "users_with_a_chart": 1,
            "users_with_a_chart_24h": 0,
            "first_chart_saves_today": 0,
            "first_chart_saves_7d": 0,
            "template_picks_today": 0,
            "template_picks_7d": 0,
            "users_with_a_chart_7_days_ago": 1,
            "users_with_a_chart_yesterday": 1,
            "signups_last_7d": 6,
            "count_7_days_ago": 1,
            "count_yesterday": 7,
            "homepage_charts_today": 0,
            "homepage_charts_7d": 0,
            "homepage_views_today": 0,
            "homepage_views_7d": 0,
            "chart_starts_today": 0,
            "chart_starts_7d": 0,
            "chart_saves_7d": 0,
            "chart_saves_7d_signed_in": 0,
            "chart_saves_7d_anonymous": 0,
            "chart_downloads_today": 0,
            "chart_downloads_7d": 0,
            "keep_prompt_shown_today": 0,
            "keep_prompt_shown_7d": 0,
            "keep_prompt_clicked_today": 0,
            "keep_prompt_clicked_7d": 0,
            "keep_prompt_signins_today": 0,
            "keep_prompt_signins_7d": 0,
            "signup_providers": {"google": 7, "apple": 0, "both": 0},
            "signups_last_7d_by_day": _window_days(now, {
                "2026-10-29": {"google": 5, "total": 5},
                "2026-10-30": {"google": 1, "total": 1},
            }),
            "signup_attribution": {
                "platforms": {"ios": 0, "web": 0, "unknown": 7},
                "with_referrer_host": 0,
                "with_utm": 0,
            },
        })
        self.assertEqual(census["public"]["count"], census["public"]["count_7_days_ago"] + census["public"]["signups_last_7d"])
        self.assertEqual(census["audit"], {
            "test_or_demo": 2,
            "internal": 2,
            "no_provider": 1,
            "bulk_seeded": 5,
            "duplicate_rows": 2,
            "case_extra": 1,
            "alias_extra": 1,
            "largest_same_second": 5,
            "same_second_rows": 10,
            "seed_like_kept": 1,
            "email_verified_stored": 0,
        })
        self.assertNotIn("@", census["audit_header"])
        self.assertEqual(credit_url(None), "https://www.chartsuno.com/")
        self.assertEqual(credit_url("short"), "https://www.chartsuno.com/")
        self.assertEqual(credit_url("Person01"), "https://www.chartsuno.com/?ref=Person01")

    def test_signup_source_aggregates_use_the_count_filters_and_no_identity(self):
        now = datetime(2026, 11, 10, 15, 0, 0)
        self.db.add_all([
            User(email="web.maker@gmail.com", google_id="web-maker", name="Web Maker", created_at=now - timedelta(days=1),
                 signup_platform="web", signup_referrer_host="google.com", signup_landing_path="/csv-to-chart",
                 signup_utm_source="newsletter"),
            User(email="phone.maker@gmail.com", apple_id="apple-maker", google_id=None, name="Phone",
                 created_at=now - timedelta(hours=3), signup_platform="ios"),
            User(email="both.maker@gmail.com", google_id="both-google", apple_id="both-apple", name="Both",
                 created_at=now - timedelta(days=8)),
            User(email="sample@example.com", google_id="sample-source", name="Sample", signup_platform="web"),
            User(email="reviewer@gmail.com", google_id=REVIEW_LOGIN_GOOGLE_ID, name="App Review", signup_platform="ios"),
        ])
        self.db.commit()
        census = signup_census(self.db, now)
        public = census["public"]
        self.assertEqual(public["count"], 3)
        self.assertEqual(public["signup_providers"], {"google": 1, "apple": 1, "both": 1})
        self.assertEqual(public["signup_providers"]["google"] + public["signup_providers"]["apple"] + public["signup_providers"]["both"], public["count"])
        self.assertEqual(public["signup_attribution"]["platforms"]["web"], 1)
        self.assertEqual(public["signup_attribution"]["platforms"]["ios"], 1)
        self.assertEqual(public["signup_attribution"]["platforms"]["unknown"], public["count"] - 2)
        self.assertEqual(
            public["signup_attribution"]["platforms"]["ios"]
            + public["signup_attribution"]["platforms"]["web"]
            + public["signup_attribution"]["platforms"]["unknown"],
            public["count"],
        )
        self.assertEqual(public["signup_attribution"]["with_referrer_host"], 1)
        self.assertEqual(public["signup_attribution"]["with_utm"], 1)
        recent = [day for day in public["signups_last_7d_by_day"] if day["total"]]
        self.assertEqual(recent, [
            {"date": "2026-11-09", "google": 1, "apple": 0, "both": 0, "total": 1},
            {"date": "2026-11-10", "google": 0, "apple": 1, "both": 0, "total": 1},
        ])
        self.assertEqual(sum(day["total"] for day in public["signups_last_7d_by_day"]), public["signups_last_7d"])
        body = self.client.get("/api/count")
        self.assertEqual(body.status_code, 200, body.text)
        self.assertNotIn("created_at", body.text)
        self.assertNotIn("@", body.text)
        self.assertNotIn("gmail.com", body.text)
        self.assertNotIn("google.com", body.text)
        self.assertNotIn("Web Maker", body.text)
        self.assertNotIn("apple-maker", body.text)
        self.assertNotIn("newest_signup", body.text)
        signup = self.client.get("/api/stats/signups")
        self.assertEqual(signup.json().keys(), body.json().keys())

    def test_template_picks_count_real_people_only(self):
        now = datetime(2026, 11, 10, 15, 0, 0)
        person = User(email="maker.templates@gmail.com", google_id="template-maker", name="Maker", created_at=now - timedelta(days=2))
        sample = User(email="sample@example.com", google_id="template-sample", name="Sample")
        self.db.add_all([person, sample])
        self.db.commit()
        self.db.add_all([
            Chart(user_id=person.id, title="Sales", data={"labels": ["Jan"], "series": [{"name": "S", "data": [1]}]},
                  config={"type": "bar", "title": "Sales"}, source_type="template:sales", created_at=now - timedelta(hours=2)),
            Chart(user_id=person.id, title="Old", data={"labels": ["Jan"], "series": [{"name": "S", "data": [1]}]},
                  config={"type": "bar", "title": "Old"}, source_type="template:traffic", created_at=now - timedelta(days=9)),
            Chart(user_id=sample.id, title="Ignored", data={"labels": ["Jan"], "series": [{"name": "S", "data": [1]}]},
                  config={"type": "pie", "title": "Ignored"}, source_type="template:survey", created_at=now - timedelta(hours=1)),
            Chart(user_id=person.id, title="Paste", data={"labels": ["Jan"], "series": [{"name": "S", "data": [1]}]},
                  config={"type": "bar", "title": "Paste"}, source_type="paste", created_at=now - timedelta(hours=1)),
        ])
        self.db.commit()
        public = signup_census(self.db, now)["public"]
        self.assertEqual(public["template_picks_today"], 1)
        self.assertEqual(public["template_picks_7d"], 1)
        self.assertNotIn("gmail.com", str(public["template_picks_today"]))
        self.assertNotIn("@", str(public["template_picks_7d"]))

    def test_public_count_includes_users_with_a_chart_after_a_real_save(self):
        """A chart saved through POST /api/charts is what users_with_a_chart counts."""
        before = self.client.get("/api/count")
        self.assertEqual(before.status_code, 200, before.text)
        self.assertIn("users_with_a_chart", before.json())
        self.assertEqual(before.json()["users_with_a_chart"], 0)

        maker = User(email="sales@gmail.com", google_id="monthly-sales", name="Sales")
        self.db.add(maker)
        self.db.commit()
        signed_up = self.client.get("/api/count").json()
        self.assertEqual(signed_up["users_with_a_chart"], 0)
        self.assertEqual(signed_up["count"], before.json()["count"] + 1)

        saved = self.client.post(
            "/api/charts",
            headers={"Authorization": "Bearer " + create_access_token(maker.id)},
            json={
                "title": "Monthly sales",
                "data": {
                    "labels": ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
                    "series": [{"name": "Sales", "data": [18400, 17600, 20100, 19850, 22300, 24150]}],
                },
                "config": {"type": "bar", "title": "Monthly sales"},
                "source_type": "paste",
                "is_public": False,
            },
        )
        self.assertEqual(saved.status_code, 200, saved.text)
        self.assertTrue(saved.json()["id"])
        after = self.client.get("/api/count")
        self.assertEqual(after.status_code, 200, after.text)
        self.assertEqual(after.json()["users_with_a_chart"], 1)
        self.assertEqual(after.json()["users_with_a_chart_24h"], 1)
        self.assertEqual(after.json()["users_with_a_chart_yesterday"], 0)
        self.assertEqual(after.json()["users_with_a_chart_7_days_ago"], 0)
        self.assertEqual(after.headers["cache-control"], "no-store")
        self.assertNotIn("gmail.com", after.text)

    def test_users_with_a_chart_24h_is_the_first_saved_chart_only(self):
        now = datetime(2026, 11, 4, 15, 0, 0)
        recent = User(email="New.Maker@gmail.com", google_id="new-maker", name="New", created_at=now - timedelta(hours=3))
        alias = User(email="new.maker+news@gmail.com", google_id="new-alias", name="New Alias", created_at=now - timedelta(hours=1))
        veteran = User(email="old.maker@gmail.com", google_id="old-maker", name="Old", created_at=now - timedelta(days=30))
        sample = User(email="sample@example.com", google_id="sample-24h", name="Sample")
        self.db.add_all([recent, alias, veteran, sample])
        self.db.commit()

        def chart(user, hours_ago, title):
            return Chart(
                user_id=user.id,
                title=title,
                data={"labels": ["A"], "series": [{"name": "S", "data": [1]}]},
                config={"type": "bar", "title": title},
                created_at=now - timedelta(hours=hours_ago),
            )

        self.db.add_all([
            chart(recent, 2, "First"),
            chart(alias, 0.5, "Alias later"),
            chart(veteran, 24 * 9, "Old first"),
            chart(veteran, 1, "Old again"),
            chart(sample, 1, "Ignored"),
        ])
        self.db.commit()

        counted = signup_census(self.db, now)["public"]
        self.assertEqual(counted["users_with_a_chart_24h"], 1)
        self.assertEqual(counted["users_with_a_chart"], 2)
        self.assertEqual(counted["first_chart_saves_today"], 1)
        self.assertEqual(counted["first_chart_saves_7d"], 1)
        self.assertNotIn("gmail.com", str(counted["users_with_a_chart_24h"]))

        public = self.client.get("/api/count")
        self.assertEqual(public.status_code, 200, public.text)
        self.assertIn("users_with_a_chart_24h", public.json())
        self.assertNotIn("New.Maker", public.text)
        self.assertNotIn("gmail.com", public.text)

    def test_chart_stats_are_a_30_day_series_without_private_data(self):
        now = datetime(2026, 11, 4, 15, 0, 0)
        ada = User(email="Ada.Person@gmail.com", google_id="ada-series", name="Ada", created_at=now - timedelta(days=20))
        alias = User(email="ada.person+news@gmail.com", google_id="ada-alias", name="Ada Alias", created_at=now - timedelta(days=2))
        bao = User(email="bao@gmail.com", google_id="bao-series", name="Bao", created_at=now - timedelta(days=3))
        sample = User(email="sample@example.com", google_id="sample-series", name="Sample")
        self.db.add_all([ada, alias, bao, sample])
        self.db.commit()
        self.db.add_all([
            Chart(
                user_id=ada.id,
                title="Older",
                data={"labels": ["A"], "series": [{"name": "S", "data": [1]}]},
                config={"type": "bar", "title": "Older"},
                created_at=datetime(2026, 11, 1, 9, 0, 0),
            ),
            Chart(
                user_id=alias.id,
                title="Same person later",
                data={"labels": ["A"], "series": [{"name": "S", "data": [2]}]},
                config={"type": "line", "title": "Later"},
                created_at=datetime(2026, 11, 4, 8, 0, 0),
            ),
            Chart(
                user_id=bao.id,
                title="Today",
                data={"labels": ["A"], "series": [{"name": "S", "data": [3]}]},
                config={"type": "bar", "title": "Today"},
                created_at=datetime(2026, 11, 4, 10, 0, 0),
            ),
            Chart(
                user_id=sample.id,
                title="Ignored",
                data={"labels": ["A"], "series": [{"name": "S", "data": [9]}]},
                config={"type": "bar", "title": "Ignored"},
                created_at=datetime(2026, 11, 4, 11, 0, 0),
            ),
        ])
        self.db.commit()

        census = signup_census(self.db, now)
        self.assertEqual(census["public"]["users_with_a_chart"], 2)
        self.assertEqual(census["public"]["users_with_a_chart_24h"], 1)
        self.assertEqual(census["public"]["users_with_a_chart_yesterday"], 1)
        self.assertEqual(census["public"]["users_with_a_chart_7_days_ago"], 0)
        days = chart_daily_stats(self.db, now)["days"]
        self.assertEqual(len(days), 30)
        self.assertEqual(days[0]["date"], "2026-10-06")
        self.assertEqual(days[-1]["date"], "2026-11-04")
        by_date = {day["date"]: day for day in days}
        self.assertEqual(by_date["2026-10-31"], {"date": "2026-10-31", "users_with_a_chart": 0, "charts_created": 0})
        self.assertEqual(by_date["2026-11-01"], {"date": "2026-11-01", "users_with_a_chart": 1, "charts_created": 1})
        self.assertEqual(by_date["2026-11-03"], {"date": "2026-11-03", "users_with_a_chart": 1, "charts_created": 0})
        self.assertEqual(by_date["2026-11-04"], {"date": "2026-11-04", "users_with_a_chart": 2, "charts_created": 2})

        response = self.client.get("/api/stats/charts")
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.headers["cache-control"], "no-store")
        self.assertNotIn("gmail.com", response.text)
        self.assertNotIn("example.com", response.text)
        self.assertNotIn("Ada", response.text)
        self.assertNotIn("Bao", response.text)
        live = response.json()["days"]
        self.assertEqual(len(live), 30)
        self.assertTrue(all(set(day) == {"date", "users_with_a_chart", "charts_created"} for day in live))
        counted = self.client.get("/api/count")
        self.assertEqual(counted.status_code, 200, counted.text)
        self.assertEqual(live[-1]["users_with_a_chart"], counted.json()["users_with_a_chart"])
        self.assertNotIn("gmail.com", counted.text)
        self.assertIn("users_with_a_chart_yesterday", counted.json())
        self.assertIn("users_with_a_chart_7_days_ago", counted.json())

    def test_activity_stats_are_counts_only_and_skip_unsupported_share_window(self):
        now = datetime.utcnow()
        real = User(email="maker@gmail.com", google_id="maker", name="Maker", referred_by="Abcd1234")
        quiet = User(email="quiet@gmail.com", google_id="quiet", name="Quiet")
        sample = User(email="sample@example.com", google_id="sample", name="Sample", referred_by="Abcd1234")
        self.db.add_all([real, quiet, sample])
        self.db.commit()
        recent = Chart(
            user_id=real.id,
            title="Recent",
            data={"labels": ["A"], "series": [{"name": "S", "data": [1]}]},
            config={"type": "bar", "title": "Recent"},
            share_token="recent-share-token-value-ok",
            created_at=now - timedelta(days=1),
        )
        older = Chart(
            user_id=real.id,
            title="Older",
            data={"labels": ["A"], "series": [{"name": "S", "data": [1]}]},
            config={"type": "bar", "title": "Older"},
            created_at=now - timedelta(days=8),
        )
        also_recent = Chart(
            user_id=real.id,
            title="Also recent",
            data={"labels": ["A"], "series": [{"name": "S", "data": [2]}]},
            config={"type": "line", "title": "Also recent"},
            created_at=now - timedelta(days=2),
        )
        example_recent = Chart(
            user_id=sample.id,
            title="Example recent",
            data={"labels": ["A"], "series": [{"name": "S", "data": [3]}]},
            config={"type": "bar", "title": "Example"},
            share_token="example-share-token-value",
            created_at=now - timedelta(hours=1),
        )
        self.db.add_all([recent, older, also_recent, example_recent])
        self.db.commit()

        response = self.client.get("/api/stats/activity")
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.headers["cache-control"], "no-store")
        body = response.json()
        self.assertEqual(body["signups"], 2)
        self.assertEqual(body["referred_signups"], 1)
        self.assertEqual(body["chart_creators_7d"], 1)
        self.assertEqual(body["charts_created_7d"], 2)
        self.assertIsNone(body["share_link_enablers_7d"])
        self.assertIn("share_token", body["unsupported"]["share_link_enablers_7d"])
        self.assertEqual(body["unsupported"]["share_link_enablers_7d"], SHARE_LINK_WINDOW_UNSUPPORTED)
        self.assertNotIn("gmail.com", response.text)
        self.assertNotIn("example.com", response.text)
        self.assertNotIn("Maker", response.text)

    def test_referral_attach_ignores_unknown_self_and_later_codes(self):
        from services.referrals import attach_referral

        self.owner.referral_code = "owner1234"
        self.owner.referred_by = None
        friend = User(email="friend@gmail.com", google_id="friend", name="Friend", referral_code="Abcd1234")
        self.db.add(friend)
        self.db.commit()

        attach_referral(self.db, self.owner, "owner1234")
        self.assertIsNone(self.owner.referred_by)
        attach_referral(self.db, self.owner, "bad")
        self.assertIsNone(self.owner.referred_by)
        attach_referral(self.db, self.owner, "no-such-1")
        self.assertIsNone(self.owner.referred_by)
        attach_referral(self.db, self.owner, "Abcd1234")
        self.assertEqual(self.owner.referred_by, "Abcd1234")
        other = User(email="second@gmail.com", google_id="second", name="Second", referral_code="zzzzzzzz")
        self.db.add(other)
        self.db.commit()
        attach_referral(self.db, self.owner, "zzzzzzzz")
        self.assertEqual(self.owner.referred_by, "Abcd1234")

    def test_homepage_chart_event_stores_source_and_time_only(self):
        from services.access_log import SkipHomepageChartAccess
        from services.homepage_events import LIMIT_PER_MINUTE, reset_homepage_event_limit
        import services.homepage_events as homepage_events

        reset_homepage_event_limit()
        now = datetime(2026, 11, 4, 15, 0, 0)
        self.db.add_all([
            HomepageChartEvent(source="paste", created_at=now - timedelta(days=8)),
            HomepageChartEvent(source="drop", created_at=now - timedelta(days=2)),
            HomepageChartEvent(source="sample", created_at=now.replace(hour=1)),
        ])
        self.db.commit()
        counted = signup_census(self.db, now)["public"]
        self.assertEqual(counted["homepage_charts_today"], 1)
        self.assertEqual(counted["homepage_charts_7d"], 2)

        before = self.client.get("/api/count").json()
        posted = self.client.post(
            "/api/events/homepage-chart",
            json={"source": "paste"},
            headers={
                "User-Agent": "SecretAgent/9",
                "X-Forwarded-For": "203.0.113.50",
                "Cookie": "auth_token=secret-cookie",
            },
        )
        self.assertEqual(posted.status_code, 204, posted.text)
        self.assertEqual(posted.content, b"")
        self.db.expire_all()
        fresh = (
            self.db.query(HomepageChartEvent)
            .filter(HomepageChartEvent.source == "paste", HomepageChartEvent.created_at >= now)
            .one()
        )
        stored = f"{fresh.source} {fresh.created_at}"
        self.assertNotIn("203.0.113.50", stored)
        self.assertNotIn("SecretAgent", stored)
        self.assertNotIn("secret-cookie", stored)
        self.assertEqual(
            {column.name for column in HomepageChartEvent.__table__.columns},
            {"id", "kind", "source", "created_at"},
        )
        self.assertEqual(fresh.kind, "render")
        after = self.client.get("/api/count").json()
        self.assertEqual(after["homepage_charts_today"], before["homepage_charts_today"] + 1)
        self.assertEqual(after["homepage_charts_7d"], before["homepage_charts_7d"] + 1)
        self.assertNotIn("@", str(after["homepage_charts_today"]))
        self.assertEqual(self.client.post("/api/events/homepage-chart", json={"source": "email"}).status_code, 422)

        homepage_events._window["count"] = LIMIT_PER_MINUTE
        homepage_events._window["start"] = time.monotonic()
        limited = self.client.post("/api/events/homepage-chart", json={"source": "drop"})
        self.assertEqual(limited.status_code, 429)
        self.assertNotIn("203.0.113.50", limited.text)
        reset_homepage_event_limit()

        access = SkipHomepageChartAccess()
        hidden = logging.LogRecord(
            "uvicorn.access", logging.INFO, __file__, 1,
            '%s - "%s %s HTTP/%s" %d',
            ("203.0.113.50:9", "POST", "/api/events/homepage-chart", "1.1", 204),
            None,
        )
        visible = logging.LogRecord(
            "uvicorn.access", logging.INFO, __file__, 1,
            '%s - "%s %s HTTP/%s" %d',
            ("203.0.113.50:9", "GET", "/api/count", "1.1", 200),
            None,
        )
        self.assertFalse(access.filter(hidden))
        self.assertTrue(access.filter(visible))

    def test_homepage_funnel_counts_views_starts_and_saves_without_personal_data(self):
        from services.homepage_events import reset_homepage_event_limit

        reset_homepage_event_limit()
        now = datetime(2026, 11, 4, 15, 0, 0)
        self.db.add_all([
            HomepageChartEvent(kind="view", created_at=now - timedelta(days=8)),
            HomepageChartEvent(kind="view", created_at=now - timedelta(days=2)),
            HomepageChartEvent(kind="view", created_at=now.replace(hour=1)),
            HomepageChartEvent(kind="start", source="paste", created_at=now - timedelta(hours=3)),
            HomepageChartEvent(kind="save", created_at=now - timedelta(days=3)),
            HomepageChartEvent(kind="save", created_at=now - timedelta(days=9)),
            HomepageChartEvent(kind="download", created_at=now - timedelta(hours=2)),
            HomepageChartEvent(kind="download", created_at=now - timedelta(days=8)),
        ])
        self.db.commit()
        counted = signup_census(self.db, now)["public"]
        self.assertEqual(counted["homepage_views_today"], 1)
        self.assertEqual(counted["homepage_views_7d"], 2)
        self.assertEqual(counted["chart_starts_today"], 1)
        self.assertEqual(counted["chart_starts_7d"], 1)
        self.assertEqual(counted["chart_downloads_today"], 1)
        self.assertEqual(counted["chart_downloads_7d"], 1)
        self.assertEqual(counted["chart_saves_7d_signed_in"], 1)
        self.assertEqual(counted["chart_saves_7d_anonymous"], 1)
        self.assertEqual(counted["chart_saves_7d"], 2)
        self.assertEqual(counted["keep_prompt_shown_7d"], 0)

        viewed = self.client.post(
            "/api/events/homepage-chart",
            json={"kind": "view"},
            headers={"User-Agent": "SecretAgent/9", "X-Forwarded-For": "203.0.113.50"},
        )
        self.assertEqual(viewed.status_code, 204, viewed.text)
        self.assertEqual(viewed.content, b"")
        started = self.client.post("/api/events/homepage-chart", json={"kind": "start", "source": "drop"})
        self.assertEqual(started.status_code, 204, started.text)
        saved = self.client.post("/api/events/homepage-chart", json={"kind": "save"})
        self.assertEqual(saved.status_code, 204, saved.text)
        self.assertEqual(self.client.post("/api/events/homepage-chart", json={"kind": "start"}).status_code, 422)
        self.db.expire_all()
        view_row = (
            self.db.query(HomepageChartEvent)
            .filter(HomepageChartEvent.kind == "view", HomepageChartEvent.created_at >= now)
            .one()
        )
        self.assertIsNone(view_row.source)
        stored = f"{view_row.kind} {view_row.source} {view_row.created_at}"
        self.assertNotIn("203.0.113.50", stored)
        self.assertNotIn("SecretAgent", stored)
        after = self.client.get("/api/count").json()
        self.assertGreaterEqual(after["homepage_views_today"], 1)
        self.assertGreaterEqual(after["chart_starts_7d"], 1)
        self.assertGreaterEqual(after["chart_saves_7d"], 1)
        downloaded = self.client.post(
            "/api/events/homepage-chart",
            json={"kind": "download"},
            headers={"User-Agent": "SecretAgent/9", "X-Forwarded-For": "203.0.113.50"},
        )
        self.assertEqual(downloaded.status_code, 204, downloaded.text)
        self.assertEqual(downloaded.content, b"")
        self.db.expire_all()
        download_row = (
            self.db.query(HomepageChartEvent)
            .filter(HomepageChartEvent.kind == "download", HomepageChartEvent.created_at >= datetime.utcnow() - timedelta(minutes=5))
            .one()
        )
        self.assertIsNone(download_row.source)
        download_stored = f"{download_row.kind} {download_row.source} {download_row.created_at}"
        self.assertNotIn("203.0.113.50", download_stored)
        self.assertNotIn("SecretAgent", download_stored)
        after_download = self.client.get("/api/count").json()
        self.assertEqual(after_download["chart_downloads_today"], after["chart_downloads_today"] + 1)
        self.assertEqual(after_download["chart_downloads_7d"], after["chart_downloads_7d"] + 1)
        self.assertEqual(after_download["chart_saves_7d_anonymous"], after["chart_saves_7d_anonymous"] + 1)
        self.assertEqual(after_download["chart_saves_7d"], after["chart_saves_7d"] + 1)
        shown = self.client.post(
            "/api/events/homepage-chart",
            json={"kind": "keep_shown"},
            headers={"User-Agent": "SecretAgent/9", "X-Forwarded-For": "203.0.113.50"},
        )
        self.assertEqual(shown.status_code, 204, shown.text)
        clicked = self.client.post("/api/events/homepage-chart", json={"kind": "keep_click"})
        self.assertEqual(clicked.status_code, 204, clicked.text)
        signed = self.client.post("/api/events/homepage-chart", json={"kind": "keep_signin"})
        self.assertEqual(signed.status_code, 204, signed.text)
        self.db.expire_all()
        keep_row = (
            self.db.query(HomepageChartEvent)
            .filter(HomepageChartEvent.kind == "keep_shown")
            .one()
        )
        keep_stored = f"{keep_row.kind} {keep_row.source} {keep_row.created_at}"
        self.assertIsNone(keep_row.source)
        self.assertNotIn("203.0.113.50", keep_stored)
        self.assertNotIn("SecretAgent", keep_stored)
        self.assertEqual(
            {column.name for column in HomepageChartEvent.__table__.columns},
            {"id", "kind", "source", "created_at"},
        )
        after_keep = self.client.get("/api/count").json()
        self.assertEqual(after_keep["keep_prompt_shown_today"], after_download["keep_prompt_shown_today"] + 1)
        self.assertEqual(after_keep["keep_prompt_shown_7d"], after_download["keep_prompt_shown_7d"] + 1)
        self.assertEqual(after_keep["keep_prompt_clicked_today"], after_download["keep_prompt_clicked_today"] + 1)
        self.assertEqual(after_keep["keep_prompt_clicked_7d"], after_download["keep_prompt_clicked_7d"] + 1)
        self.assertEqual(after_keep["keep_prompt_signins_today"], after_download["keep_prompt_signins_today"] + 1)
        self.assertEqual(after_keep["keep_prompt_signins_7d"], after_download["keep_prompt_signins_7d"] + 1)
        self.assertEqual(after_keep["count"], after_download["count"])
        self.assertNotIn("gmail.com", str(after_keep))
        self.assertNotIn("@", str(after_keep["keep_prompt_signins_7d"]))
        reset_homepage_event_limit()
