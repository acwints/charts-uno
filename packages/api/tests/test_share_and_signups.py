"""Unlisted share links and the public signup count."""
import os
import struct
import tempfile
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
from models.database import Chart
from services.share_page import (
    COUNT_DEFINITION,
    CTA_TEXT,
    SHARE_LINK_WINDOW_UNSUPPORTED,
    credit_url,
    signup_census,
)


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
                "title": "Ignored column title",
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

        first = self.client.post(f"/api/charts/{self.chart_id}/share", headers=self.owner_auth)
        self.assertEqual(first.status_code, 200, first.text)
        token = first.json()["token"]
        self.assertTrue(token)
        again = self.client.post(f"/api/charts/{self.chart_id}/share", headers=self.owner_auth)
        self.assertEqual(again.json()["token"], token)

        self.assertEqual(self.client.get("/api/charts/public").json()["total"], 0)
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
            "signups_last_7d": 1,
            "count_7_days_ago": 0,
            "count_yesterday": 0,
        }
        self.assertEqual(counted.json(), expected)
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
            "signups_last_7d": 6,
            "count_7_days_ago": 1,
            "count_yesterday": 7,
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
        self.assertEqual(after.headers["cache-control"], "no-store")
        self.assertNotIn("gmail.com", after.text)

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
