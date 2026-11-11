"""Provider account exhaustion must be recoverable and not leak billing details."""
import unittest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
import main


class ProviderUnavailable(Exception):
    def __init__(self, code):
        self.code = code
        super().__init__("Private provider billing details")


class GenerationAvailabilityTests(unittest.TestCase):
    def test_exhausted_provider_returns_actionable_unavailable_response(self):
        for code in (402, 429):
            with self.subTest(code=code), patch.object(main.limiter, "enabled", False), patch.object(
                main, "generate_chart_from_prompt", new=AsyncMock(side_effect=ProviderUnavailable(code))
            ):
                response = TestClient(main.app).post("/api/ai/generate", json={"prompt": "Compare Super Bowl scores"})
                self.assertEqual(response.status_code, 503)
                self.assertIn("upload a CSV", response.json()["detail"])
                self.assertNotIn("billing", response.text)

    def test_success_still_returns_chart_data(self):
        with patch.object(main.limiter, "enabled", False), patch.object(main, "generate_chart_from_prompt", new=AsyncMock(return_value={
            "labels": ["A"], "series": [{"name": "Score", "data": [3]}]
        })):
            response = TestClient(main.app).post("/api/ai/generate", json={"prompt": "Compare scores"})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["series"][0]["data"], [3])
