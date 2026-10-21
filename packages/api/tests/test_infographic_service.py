import unittest

from services.infographic_service import build_fallback_infographic, extract_svg
import xml.etree.ElementTree as ET


class InfographicServiceTests(unittest.TestCase):
    def test_extract_svg_accepts_fenced_model_output(self) -> None:
        content = "Here you go:\n```svg\n<svg viewBox=\"0 0 10 10\"><rect/></svg>\n```"

        root = ET.fromstring(extract_svg(content))
        self.assertEqual(root.attrib['viewBox'], '0 0 10 10')
        self.assertEqual(root[0].tag, 'rect')

    def test_model_active_content_and_remote_resources_are_removed(self):
        result = extract_svg('<svg xmlns="http://www.w3.org/2000/svg" onload="bad()"><foreignObject><img onerror="bad()"/></foreignObject><script>bad()</script><style>text{fill:red}</style><rect style="fill:red" onclick="bad()" fill="url(https://example.test/image)"/><use href="https://example.test/a#b"/><defs><linearGradient id="paint"/></defs><circle fill="url(#paint)"/></svg>')
        self.assertNotIn('bad()', result)
        self.assertNotIn('foreignObject', result)
        self.assertNotIn('https:', result)
        self.assertIn('url(#paint)', result)

    def test_model_entity_definitions_are_rejected(self):
        with self.assertRaises(ValueError):
            extract_svg('<svg><!DOCTYPE x [<!ENTITY x "bad">]><text>&x;</text></svg>')

    def test_extract_svg_rejects_incomplete_output(self) -> None:
        with self.assertRaisesRegex(ValueError, "Invalid SVG response"):
            extract_svg('<svg viewBox="0 0 10 10"><rect/>')

    def test_fallback_is_complete_and_escapes_chart_text(self) -> None:
        svg = build_fallback_infographic(
            {
                "labels": ["2024", "R&D < 2025"],
                "series": [
                    {"name": "Revenue & profit", "data": [10, 20.5]},
                ],
            },
            "Growth & outlook",
            ["#6366f1", "#22c55e"],
            "dark",
        )

        self.assertTrue(svg.startswith("<svg"))
        self.assertTrue(svg.endswith("</svg>"))
        self.assertIn('viewBox="0 0 1600 1200"', svg)
        self.assertIn('data-infographic-source="fallback"', svg)
        self.assertIn("Growth &amp; outlook", svg)
        self.assertIn("R&amp;D &lt; 2025", svg)
        self.assertIn("Revenue &amp; profit", svg)
        self.assertIn(">10<", svg)
        self.assertIn(">20.5<", svg)


if __name__ == "__main__":
    unittest.main()
