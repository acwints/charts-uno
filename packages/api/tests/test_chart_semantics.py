import unittest

from services.chart_semantics import normalize_chart_semantics


class NormalizeChartSemanticsTests(unittest.TestCase):
    def test_promotes_year_series_and_preserves_winner_details(self) -> None:
        chart = {
            "labels": ["Peter Thomson (1954)", "Arnold Palmer (1961)", "Peter Thomson (1965)"],
            "series": [
                {"name": "Year", "data": [1954.0, 1961.0, 1965.0]},
                {"name": "Total Score", "data": [283.0, 284.0, 285.0]},
            ],
            "xAxisLabel": "Winner",
            "suggestedType": "bar",
        }

        normalized = normalize_chart_semantics(
            chart,
            "past open championship winners at royal birkdale with their year and total score",
        )

        self.assertEqual(normalized["labels"], ["1954", "1961", "1965"])
        self.assertEqual(normalized["xAxisType"], "year")
        self.assertEqual(normalized["xAxisLabel"], "Year")
        self.assertEqual(normalized["suggestedType"], "line")
        self.assertEqual([series["name"] for series in normalized["series"]], ["Total Score"])
        self.assertEqual(
            normalized["categoricalColumns"],
            [{"name": "Winner", "data": ["Peter Thomson", "Arnold Palmer", "Peter Thomson"]}],
        )

    def test_marks_year_labels_as_temporal(self) -> None:
        chart = {
            "labels": ["2022", "2023", "2024"],
            "series": [{"name": "Revenue", "data": [10, 12, 15]}],
            "xAxisType": "category",
            "suggestedType": "bar",
        }

        normalized = normalize_chart_semantics(chart)

        self.assertEqual(normalized["xAxisType"], "year")
        self.assertEqual(normalized["xAxisLabel"], "Year")
        self.assertEqual(normalized["suggestedType"], "line")

    def test_removes_redundant_year_series_when_labels_are_already_years(self) -> None:
        chart = {
            "labels": ["2022", "2023", "2024"],
            "series": [
                {"name": "Year", "data": [2022, 2023, 2024]},
                {"name": "Revenue", "data": [10, 12, 15]},
            ],
        }

        normalized = normalize_chart_semantics(chart)

        self.assertEqual([series["name"] for series in normalized["series"]], ["Revenue"])

    def test_does_not_promote_non_year_numeric_series(self) -> None:
        chart = {
            "labels": ["A", "B", "C"],
            "series": [
                {"name": "Rank", "data": [1, 2, 3]},
                {"name": "Score", "data": [80, 90, 85]},
            ],
        }

        normalized = normalize_chart_semantics(chart)

        self.assertEqual(normalized["labels"], ["A", "B", "C"])
        self.assertEqual(len(normalized["series"]), 2)


if __name__ == "__main__":
    unittest.main()
