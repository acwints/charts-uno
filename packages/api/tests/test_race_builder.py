import unittest

from services.race_builder import (
    build_race,
    infer_race_columns,
    order_periods,
    parse_ordinal,
    to_number,
)


def series_by_name(chart, name):
    for series in chart["series"]:
        if series["name"] == name:
            return series
    raise AssertionError(f'series "{name}" missing')


class ParsingTests(unittest.TestCase):
    def test_parse_ordinal_reads_seasons_episodes_years_quarters_dates_numbers(self) -> None:
        self.assertEqual(parse_ordinal("Season 3"), 3)
        self.assertEqual(parse_ordinal("S12"), 12)
        self.assertEqual(parse_ordinal("Ep 7"), 7)
        self.assertEqual(parse_ordinal("2019"), 2019)
        self.assertEqual(parse_ordinal("1,200"), 1200)
        self.assertEqual(parse_ordinal("2019-Q4"), 2019 * 4 + 4)
        self.assertGreater(parse_ordinal("2020-03-01"), parse_ordinal("2020-02-01"))
        self.assertIsNone(parse_ordinal("Breaking Bad"))
        self.assertIsNone(parse_ordinal(""))
        self.assertIsNone(parse_ordinal(None))

    def test_order_periods_sorts_by_meaning_so_season_10_follows_season_9(self) -> None:
        ordered, how = order_periods(["Season 10", "Season 2", "Season 9", "Season 1"])
        self.assertEqual(ordered, ["Season 1", "Season 2", "Season 9", "Season 10"])
        self.assertEqual(how, "inferred-ordinal")

    def test_order_periods_falls_back_to_first_seen_when_any_label_is_unordered(self) -> None:
        ordered, how = order_periods(["Spring", "Summer", "3", "Autumn"])
        self.assertEqual(ordered, ["Spring", "Summer", "3", "Autumn"])
        self.assertEqual(how, "inferred-first-seen")

    def test_to_number_tolerates_currency_and_separators_but_not_labels_or_ids(self) -> None:
        self.assertEqual(to_number("$1,234.5"), 1234.5)
        self.assertEqual(to_number("42%"), 42)
        self.assertEqual(to_number(" -7 "), -7)
        self.assertIsNone(to_number("n/a"))
        self.assertIsNone(to_number("S1"))
        self.assertIsNone(to_number("tt1000"))
        self.assertIsNone(to_number(True))
        self.assertIsNone(to_number(float("nan")))


class BuildRaceTests(unittest.TestCase):
    def test_long_rows_pivot_into_periods_as_labels_entities_as_series(self) -> None:
        rows = [
            {"entity": "A", "period": "Season 2", "value": 20},
            {"entity": "A", "period": "Season 1", "value": 10},
            {"entity": "B", "period": "Season 1", "value": 5},
            {"entity": "B", "period": "Season 2", "value": 30},
        ]
        chart, report = build_race(rows)
        self.assertEqual(chart["labels"], ["Season 1", "Season 2"])
        self.assertEqual(series_by_name(chart, "A")["data"], [10, 20])
        self.assertEqual(series_by_name(chart, "B")["data"], [5, 30])
        self.assertEqual(chart["suggestedType"], "race")
        self.assertEqual(report.rows_used, 4)
        self.assertEqual(report.period_order, "inferred-ordinal")

    def test_cumulative_mean_reproduces_the_rating_after_n_episodes_formula(self) -> None:
        rows = [
            {"entity": "Show", "period": "E1", "value": 10},
            {"entity": "Show", "period": "E2", "value": 9},
            {"entity": "Show", "period": "E3", "value": 8},
        ]
        chart, _ = build_race(rows, accumulate="cumulative-mean")
        self.assertEqual(series_by_name(chart, "Show")["data"], [10, 9.5, 9])

    def test_cumulative_sum_turns_increments_into_a_running_total(self) -> None:
        rows = [
            {"entity": "Shop", "period": "2020", "value": 100},
            {"entity": "Shop", "period": "2021", "value": 50},
            {"entity": "Shop", "period": "2022", "value": 25},
        ]
        chart, _ = build_race(rows, accumulate="cumulative-sum")
        self.assertEqual(series_by_name(chart, "Shop")["data"], [100, 150, 175])

    def test_duplicates_are_aggregated_as_asked(self) -> None:
        rows = [
            {"entity": "A", "period": "1", "value": 2},
            {"entity": "A", "period": "1", "value": 4},
            {"entity": "B", "period": "1", "value": 1},
        ]
        self.assertEqual(series_by_name(build_race(rows)[0], "A")["data"][0], 6)
        self.assertEqual(series_by_name(build_race(rows, aggregate="mean")[0], "A")["data"][0], 3)
        self.assertEqual(series_by_name(build_race(rows, aggregate="max")[0], "A")["data"][0], 4)
        self.assertEqual(series_by_name(build_race(rows, aggregate="count")[0], "A")["data"][0], 2)

    def test_fill_policies(self) -> None:
        rows = [
            {"entity": "Short", "period": "1", "value": 9},
            {"entity": "Long", "period": "1", "value": 1},
            {"entity": "Long", "period": "2", "value": 2},
            {"entity": "Long", "period": "3", "value": 3},
        ]
        self.assertEqual(series_by_name(build_race(rows)[0], "Short")["data"], [9, 9, 9])
        self.assertEqual(series_by_name(build_race(rows, fill="gap")[0], "Short")["data"], [9, None, None])
        self.assertEqual(series_by_name(build_race(rows, fill="zero")[0], "Short")["data"], [9, 0, 0])
        self.assertEqual(build_race(rows)[1].cells_filled, 2)

    def test_cumulative_standing_persists_through_gaps_regardless_of_fill(self) -> None:
        rows = [
            {"entity": "A", "period": "1", "value": 5},
            {"entity": "A", "period": "3", "value": 5},
            {"entity": "B", "period": "2", "value": 1},
        ]
        chart, _ = build_race(rows, accumulate="cumulative-sum", fill="gap")
        self.assertEqual(series_by_name(chart, "A")["data"], [5, 5, 10])

    def test_min_periods_drops_and_reports(self) -> None:
        rows = [
            {"entity": "Staying", "period": "1", "value": 1},
            {"entity": "Staying", "period": "2", "value": 2},
            {"entity": "Staying", "period": "3", "value": 3},
            {"entity": "Brief", "period": "1", "value": 99},
        ]
        chart, report = build_race(rows, min_periods=3)
        self.assertEqual([s["name"] for s in chart["series"]], ["Staying"])
        self.assertEqual(report.entities_below_min_periods, ["Brief"])
        self.assertEqual(report.entities_read, 2)
        self.assertEqual(report.entities_kept, 1)

    def test_limit_ever_on_board_keeps_an_early_leader_final_drops_them(self) -> None:
        rows = [
            {"entity": "Flash", "period": "1", "value": 100},
            {"entity": "Flash", "period": "2", "value": 1},
            {"entity": "Steady", "period": "1", "value": 50},
            {"entity": "Steady", "period": "2", "value": 60},
            {"entity": "Slow", "period": "1", "value": 10},
            {"entity": "Slow", "period": "2", "value": 55},
            {"entity": "Never", "period": "1", "value": 5},
            {"entity": "Never", "period": "2", "value": 6},
        ]
        chart, report = build_race(rows, limit=2)
        self.assertEqual(sorted(s["name"] for s in chart["series"]), ["Flash", "Slow", "Steady"])
        self.assertEqual(report.entities_over_limit, ["Never"])
        chart, _ = build_race(rows, limit=2, limit_mode="final")
        self.assertEqual(sorted(s["name"] for s in chart["series"]), ["Slow", "Steady"])

    def test_bad_cells_are_reported_by_reason_not_raised(self) -> None:
        rows = [
            {"entity": "A", "period": "1", "value": 1},
            {"entity": "A", "period": "2", "value": "n/a"},
            {"entity": "", "period": "1", "value": 3},
            {"entity": "B", "period": "", "value": 4},
            {"entity": "B", "period": "1", "value": 5},
        ]
        _, report = build_race(rows)
        self.assertEqual(report.rows_read, 5)
        self.assertEqual(report.rows_used, 2)
        self.assertEqual(report.dropped, {"non-numeric-value": 1, "missing-entity": 1, "missing-period": 1})

    def test_custom_column_names_and_format_period(self) -> None:
        rows = [
            {"show": "A", "season": 2, "rating": "8.5"},
            {"show": "A", "season": 1, "rating": "9.0"},
        ]
        chart, _ = build_race(
            rows, entity="show", period="season", value="rating", format_period=lambda p: f"season {p}"
        )
        self.assertEqual(chart["labels"], ["season 1", "season 2"])
        self.assertEqual(series_by_name(chart, "A")["data"], [9.0, 8.5])

    def test_inputs_are_not_mutated(self) -> None:
        rows = [{"entity": "A", "period": "2", "value": 1}, {"entity": "A", "period": "1", "value": 2}]
        snapshot = [dict(r) for r in rows]
        order = ["1", "2"]
        build_race(rows, period_order=order)
        self.assertEqual(rows, snapshot)
        self.assertEqual(order, ["1", "2"])

    def test_impossible_options_raise(self) -> None:
        rows = [{"entity": "A", "period": "1", "value": 1}]
        with self.assertRaises(ValueError):
            build_race(rows, aggregate="median")
        with self.assertRaises(ValueError):
            build_race(rows, accumulate="running")
        with self.assertRaises(ValueError):
            build_race(rows, fill="interpolate")
        with self.assertRaises(ValueError):
            build_race(rows, limit=0)
        with self.assertRaises(ValueError):
            build_race(rows, min_periods=-1)
        with self.assertRaises(ValueError):
            build_race(rows, period_order=["1", "1"])

    def test_degenerate_inputs_warn_rather_than_fail(self) -> None:
        _, report = build_race([{"entity": "A", "period": "1", "value": 1}])
        self.assertTrue(any("Fewer than two periods" in w for w in report.warnings))
        self.assertTrue(any("Fewer than two entities" in w for w in report.warnings))
        chart, _ = build_race([])
        self.assertEqual(chart["labels"], [])
        self.assertEqual(chart["series"], [])


class InferColumnsTests(unittest.TestCase):
    def test_not_fooled_by_per_entity_attributes_that_are_numeric_and_sorted(self) -> None:
        # The real IMDb export: eleven columns, several numeric and ordered.
        # "seasons" (a per-show count), "start_year", "series_votes" and
        # "imdb_series_rating" are constant within a show and must never be
        # chosen as period or value. "marker" freezes once a show locks, so it
        # does not cover every period and must lose to "season". "show_id"
        # must lose to "show".
        rows = []
        shows = ["Bleach", "Attack on Titan", "Dark", "Breaking Bad", "Mr. Robot", "Daredevil", "Aspirants"]
        for i, show in enumerate(shows):
            run = 3 + (i % 4)
            for season in range(1, 13):
                rows.append({
                    "show_id": f"tt{1000 + i}",
                    "show": show,
                    "start_year": 2008 + i,
                    "seasons": run,
                    "episodes": 40 + i * 7,
                    "series_votes": 100000 + i * 50000,
                    "imdb_series_rating": 8 + i * 0.1,
                    "season": season,
                    "marker": f"S{min(season, run)}",
                    "running_average": 8 + i * 0.05 + min(season, run) * 0.01,
                    "locked": season > run,
                })
        inferred = infer_race_columns(rows)
        self.assertIsNotNone(inferred)
        self.assertEqual(inferred["entity"], "show")
        self.assertEqual(inferred["period"], "season")
        self.assertEqual(inferred["value"], "running_average")
        self.assertGreaterEqual(inferred["confidence"], 0.6)

    def test_returns_none_for_a_table_that_is_not_tidy(self) -> None:
        wide = [{"Show": f"Show {i}", "Season 1": i, "Season 2": i + 1} for i in range(10)]
        self.assertIsNone(infer_race_columns(wide))
        self.assertIsNone(infer_race_columns([]))


if __name__ == "__main__":
    unittest.main()
