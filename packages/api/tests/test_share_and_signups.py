"""Unlisted share links and the public signup count."""
import os
import struct
import tempfile
import unittest
import zlib

_fd, _path = tempfile.mkstemp(prefix="chartsuno_share_test_", suffix=".db")
os.close(_fd)
os.environ.setdefault("DATABASE_URL", "sqlite:///" + _path)

from fastapi.testclient import TestClient
import main
from dependencies import create_access_token
from models.database import REVIEW_LOGIN_GOOGLE_ID, Base, SessionLocal, User, engine
from services.share_page import CTA_TEXT


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

        self.assertEqual(self.client.get("/s/not-a-real-token").status_code, 404)
        self.assertIn(CTA_TEXT, self.client.get("/s/not-a-real-token").text)

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
        self.assertEqual(counted.json(), {"count": 1})
        self.assertEqual(counted.headers["cache-control"], "no-store")
        self.assertNotIn("gmail.com", counted.text)
