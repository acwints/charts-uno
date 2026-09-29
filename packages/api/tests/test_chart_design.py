"""The design step must turn a mixed-scale dataset into a dual-axis combo and never return an unrenderable design."""
import asyncio
import json
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from services import chart_design
from services.chart_design import apply_design, design_chart, heuristic_design

ELAD_TABLE = {
    "labels": ["1970", "1985", "2000", "2010", "2020", "Sep 2026"],
    "series": [
        {"name": "Top 5 combined market cap ($T)", "data": [0.115, 0.218, 1.6, 1.29, 7.51, 21.1]},
        {"name": "U.S. nominal GDP ($T)", "data": [1.07, 4.35, 10.25, 15.0, 21.1, 32.5]},
        {"name": "Top 5 / GDP (%)", "data": [10.7, 5.0, 15.6, 8.6, 35.7, 65.0]},
    ],
    "suggestedType": "table",
    "suggestedTitle": "Top 5 Combined Market Cap vs U.S. Nominal GDP",
}


class FakeModel:
    def __init__(self, text):
        self.text = text
        self.models = self

    def generate_content(self, **kwargs):
        return SimpleNamespace(text=self.text)


def run(coro):
    return asyncio.new_event_loop().run_until_complete(coro)


class ChartDesignTests(unittest.TestCase):
    def test_model_design_becomes_combo_config(self):
        model = FakeModel(json.dumps({
            "type": "bar", "title": "Top 5 vs GDP", "yAxisLabel": "Trillions of dollars",
            "rightYAxisLabel": "Top 5 as % of GDP", "rightYAxisSuffix": "%", "yAxisPrefix": "$", "yAxisSuffix": "T",
            "series": [
                {"name": "Top 5 combined market cap ($T)", "chartType": "bar", "axis": "left"},
                {"name": "U.S. nominal GDP ($T)", "chartType": "bar", "axis": "left"},
                {"name": "Top 5 / GDP (%)", "chartType": "line", "axis": "right"},
            ],
            "stacked": False, "barLayout": "vertical", "showValues": False, "reasoning": "Two dollar series, one ratio.",
        }))
        design = run(design_chart(dict(ELAD_TABLE), client=model))
        data, config = dict(ELAD_TABLE), {"type": "table", "title": "x"}
        apply_design(data, config, design)
        self.assertEqual(config["type"], "bar")
        self.assertEqual(config["seriesConfig"], {"Top 5 / GDP (%)": {"chartType": "line", "axis": "right"}})
        self.assertEqual(config["rightYAxisLabel"], "Top 5 as % of GDP")
        self.assertEqual(config["rightYAxisSuffix"], "%")
        self.assertEqual(data["yAxisPrefix"], "$")
        self.assertEqual(data["suggestedType"], "bar")
        self.assertEqual(config["title"], "Top 5 vs GDP")

    def test_unknown_series_and_all_right_axis_are_repaired(self):
        model = FakeModel(json.dumps({
            "type": "line",
            "series": [{"name": "nope", "chartType": "bar", "axis": "right"}] + [
                {"name": s["name"], "chartType": "line", "axis": "right"} for s in ELAD_TABLE["series"]
            ],
        }))
        design = run(design_chart(dict(ELAD_TABLE), client=model))
        self.assertEqual([s["name"] for s in design["series"]], [s["name"] for s in ELAD_TABLE["series"]])
        self.assertTrue(all(s["axis"] == "left" for s in design["series"]))

    def test_pie_never_carries_series_overrides(self):
        model = FakeModel(json.dumps({"type": "pie", "series": [{"name": "Top 5 / GDP (%)", "chartType": "line", "axis": "right"}]}))
        design = run(design_chart(dict(ELAD_TABLE), client=model))
        config = {"type": "bar", "seriesConfig": {"old": {"axis": "right"}}}
        apply_design(dict(ELAD_TABLE), config, design)
        self.assertEqual(config["type"], "pie")
        self.assertNotIn("seriesConfig", config)

    def test_model_failure_falls_back_to_scale_heuristic(self):
        model = FakeModel("not json at all")
        design = run(design_chart(dict(ELAD_TABLE), client=model))
        by_name = {s["name"]: s for s in design["series"]}
        self.assertEqual(by_name["Top 5 / GDP (%)"]["axis"], "right")
        self.assertEqual(by_name["Top 5 / GDP (%)"]["chartType"], "line")
        self.assertEqual(by_name["U.S. nominal GDP ($T)"]["axis"], "left")
        self.assertEqual(design["rightYAxisSuffix"], "%")

    def test_heuristic_leaves_similar_scales_alone(self):
        design = heuristic_design({"suggestedType": "line", "series": [
            {"name": "Revenue", "data": [10, 20, 30]}, {"name": "Profit", "data": [4, 6, 9]},
        ]})
        self.assertTrue(all(s["axis"] == "left" for s in design["series"]))
        self.assertNotIn("rightYAxisLabel", design)

    def test_heuristic_never_moves_every_series_right(self):
        design = heuristic_design({"suggestedType": "bar", "series": [
            {"name": "A (%)", "data": [1, 2]}, {"name": "B (%)", "data": [3, 4]},
        ]})
        self.assertTrue(all(s["axis"] == "left" for s in design["series"]))


if __name__ == "__main__":
    unittest.main()
