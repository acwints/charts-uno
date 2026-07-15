import base64
import unittest

from services.branding_service import image_bytes_to_data_url, is_legacy_google_favicon_url


class BrandingServiceTests(unittest.TestCase):
    def test_recognizes_only_known_google_favicon_urls(self) -> None:
        self.assertTrue(
            is_legacy_google_favicon_url(
                "https://www.google.com/s2/favicons?domain=banteegolf.com&sz=128"
            )
        )
        self.assertFalse(is_legacy_google_favicon_url("https://example.com/logo.png"))
        self.assertFalse(is_legacy_google_favicon_url("https://www.google.com/other-path"))
        self.assertFalse(is_legacy_google_favicon_url("http://www.google.com/s2/favicons"))

    def test_converts_image_bytes_to_data_url(self) -> None:
        content = b"tiny-png"
        expected = base64.b64encode(content).decode("ascii")

        self.assertEqual(
            image_bytes_to_data_url(content, "image/png; charset=binary"),
            f"data:image/png;base64,{expected}",
        )

    def test_rejects_non_image_content(self) -> None:
        for content_type in (None, "text/html", "application/json"):
            with self.subTest(content_type=content_type):
                with self.assertRaisesRegex(ValueError, "not an image"):
                    image_bytes_to_data_url(b"not-an-image", content_type)

if __name__ == "__main__":
    unittest.main()
