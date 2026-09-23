import unittest
from unittest.mock import patch

from services import public_dataset_service as pds
from services import research_service as rs


def tidy_rows(shows=6, periods=8):
    """Tidy (show, episode, running_average) rows shaped like the race SQL output."""
    rows = []
    for i in range(shows):
        for ep in range(1, periods + 1):
            rows.append({"show": f"Show {i}", "episode": ep, "running_average": 8 + i * 0.05 + ep * 0.01 * (i % 3)})
    return rows


class RaceDatasetRegistryTests(unittest.TestCase):
    def test_both_race_datasets_are_listed_without_leaking_sql(self) -> None:
        listed = {d["id"]: d for d in pds.get_public_datasets()}
        for dataset_id in ("imdb_episode_race", "imdb_season_race"):
            self.assertIn(dataset_id, listed)
            self.assertIn("bigquery-public-data.imdb.title_episode", listed[dataset_id]["tables"])
            self.assertNotIn("defaultSql", listed[dataset_id])
            self.assertTrue(listed[dataset_id]["examplePrompts"])
            # The client uses this to relabel top_n as a field size and lift its cap.
            self.assertIs(listed[dataset_id]["raceShaped"], True)
        for dataset_id in ("imdb_titles", "hacker_news", "usa_names"):
            self.assertIs(listed[dataset_id]["raceShaped"], False)

    def test_race_sql_is_safe_against_its_own_allow_list(self) -> None:
        for dataset_id in ("imdb_episode_race", "imdb_season_race"):
            dataset = pds.PUBLIC_DATASETS[dataset_id]
            sql = dataset["defaultSql"].format(limit=50)
            self.assertTrue(pds._is_safe_sql(sql, dataset["tables"]), dataset_id)
            # And the general research-path guard accepts it too.
            self.assertTrue(rs._is_safe_bigquery_sql(sql), dataset_id)

    def test_race_sql_encodes_the_pipeline_rules(self) -> None:
        sql = pds._IMDB_EPISODE_RACE_SQL.format(limit=50)
        # Broadcast order and specials excluded.
        self.assertIn("ORDER BY e.season_number, e.episode_number", sql)
        self.assertIn("e.season_number >= 1 AND e.episode_number >= 1", sql)
        # Vote gates, eligibility, and the unbroken-prefix rule.
        self.assertIn("r.num_votes >= 100000", sql)
        self.assertIn("r.num_votes < 200", sql)
        self.assertIn("rated_episodes >= 40", sql)
        self.assertIn("MAX(gap) OVER (PARTITION BY show ORDER BY ep_index ROWS UNBOUNDED PRECEDING)", sql)
        # The running mean is a window over the prefix, and the limit is shows.
        self.assertIn("AVG(r.average_rating) OVER (PARTITION BY r.show ORDER BY r.ep_index ROWS UNBOUNDED PRECEDING)", sql)
        self.assertIn("LIMIT 50", sql)
        self.assertEqual(sql.count("{limit}"), 0)
        # The guard reads any semicolon as a second statement, comments included.
        for dataset_id in ("imdb_episode_race", "imdb_season_race"):
            self.assertNotIn(";", pds.PUBLIC_DATASETS[dataset_id]["defaultSql"], dataset_id)

    def test_season_sql_averages_seasons_then_runs_a_mean_over_them(self) -> None:
        sql = pds._IMDB_SEASON_RACE_SQL.format(limit=50)
        self.assertIn("AVG(r.average_rating) AS season_rating", sql)
        self.assertIn("AVG(season_rating) OVER (PARTITION BY show ORDER BY season_number ROWS UNBOUNDED PRECEDING)", sql)

    def test_both_races_cap_their_axis(self) -> None:
        # Without a cap a long-runner in the field (South Park, 28 seasons)
        # stretches the season race through ~17 frames in which nothing moves.
        # The episode race already caps at 100; the season race caps at 12,
        # where the board has long since settled.
        self.assertIn("WHERE r.ep_index <= 100", pds._IMDB_EPISODE_RACE_SQL)
        self.assertIn("WHERE season_number <= 12", pds._IMDB_SEASON_RACE_SQL)

    def test_top_n_is_the_field_for_a_race_and_rows_for_a_chart(self) -> None:
        # Bleach is #158 of 176 eligible shows by votes; a 50 ceiling drops it.
        self.assertGreaterEqual(pds.RACE_MAX_CONTENDERS, 176)
        self.assertEqual(pds.normalize_top_n(176, race_shaped=True), 176)
        self.assertEqual(pds.normalize_top_n(10_000, race_shaped=True), pds.RACE_MAX_CONTENDERS)
        self.assertEqual(pds.normalize_top_n(1, race_shaped=True), 5)
        # Ordinary charts keep their existing 5..50 clamp unchanged.
        self.assertEqual(pds.normalize_top_n(176, race_shaped=False), 50)
        self.assertEqual(pds.normalize_top_n(20, race_shaped=False), 20)
        self.assertEqual(pds.normalize_top_n(1, race_shaped=False), 5)
        # The row cap must hold the largest race the field ceiling allows.
        self.assertGreaterEqual(pds.RACE_MAX_ROWS, 100 * pds.RACE_MAX_CONTENDERS)

    def test_build_race_chart_pivots_tidy_rows_and_labels_periods(self) -> None:
        spec = pds.PUBLIC_DATASETS["imdb_episode_race"]["race"]
        chart, report = pds.build_race_chart(tidy_rows(), spec)
        self.assertIsNotNone(chart)
        self.assertEqual(chart["suggestedType"], "race")
        self.assertEqual(chart["labels"][:2], ["episode 1", "episode 2"])
        self.assertEqual(len(chart["series"]), 6)
        self.assertEqual(report.entities_kept, 6)
        self.assertEqual(report.periods, 8)

    def test_build_race_chart_refuses_degenerate_input(self) -> None:
        spec = pds.PUBLIC_DATASETS["imdb_episode_race"]["race"]
        self.assertEqual(pds.build_race_chart([], spec), (None, None))
        one_show = [r for r in tidy_rows() if r["show"] == "Show 0"]
        chart, _ = pds.build_race_chart(one_show, spec)
        self.assertIsNone(chart)


class SqlGuardTests(unittest.TestCase):
    TABLES = ["bigquery-public-data.imdb.title_basics"]

    def test_cte_is_accepted_as_read_only(self) -> None:
        sql = "WITH t AS (SELECT 1 AS x FROM `bigquery-public-data.imdb.title_basics`) SELECT x FROM t"
        self.assertTrue(pds._is_safe_sql(sql, self.TABLES))
        self.assertTrue(rs._is_safe_bigquery_sql(sql))

    def test_dml_inside_a_cte_is_still_rejected(self) -> None:
        sql = "WITH t AS (SELECT 1 FROM `bigquery-public-data.imdb.title_basics`) DELETE FROM t"
        self.assertFalse(pds._is_safe_sql(sql, self.TABLES))
        self.assertFalse(rs._is_safe_bigquery_sql(sql))

    def test_other_leading_statements_and_semicolons_are_rejected(self) -> None:
        self.assertFalse(pds._is_safe_sql("SHOW TABLES", self.TABLES))
        self.assertFalse(rs._is_safe_bigquery_sql("SHOW TABLES"))
        two = "SELECT 1 FROM `bigquery-public-data.imdb.title_basics`; SELECT 2"
        self.assertFalse(pds._is_safe_sql(two, self.TABLES))
        self.assertFalse(rs._is_safe_bigquery_sql(two))


class ResearchRacePathTests(unittest.TestCase):
    def test_race_intent_detection(self) -> None:
        for prompt in (
            "best shows of all time by average rating after each episode",
            "bar chart race of streaming subscribers",
            "leaderboard of countries by cumulative medals",
            "running average rating season by season",
        ):
            self.assertTrue(rs._is_race_intent(prompt), prompt)
        for prompt in ("average imdb rating by year", "movie count by genre", "quarterly sales by region"):
            self.assertFalse(rs._is_race_intent(prompt), prompt)

    def test_tv_prompts_now_route_to_bigquery(self) -> None:
        intent = {"preferred_sources": []}
        self.assertTrue(rs._is_bigquery_candidate("best tv shows by rating after each episode", intent))
        self.assertTrue(rs._is_bigquery_candidate("which show has the best rating after 40 episodes", intent))
        self.assertTrue(rs._is_bigquery_candidate("top anime by episode rating", intent))
        # Common words alone must not hijack unrelated prompts.
        self.assertFalse(rs._is_bigquery_candidate("show me sales by season", intent))
        self.assertFalse(rs._is_bigquery_candidate("series of quarterly revenue figures", intent))

    def test_deterministic_fallback_returns_the_race_sql_for_a_race_prompt(self) -> None:
        sql = rs._default_bigquery_sql("best shows of all time by average rating after each episode")
        self.assertIsNotNone(sql)
        self.assertIn("title_episode", sql)
        self.assertTrue(rs._is_safe_bigquery_sql(sql))
        self.assertEqual(sql, pds._IMDB_EPISODE_RACE_SQL.format(limit=50))
        # Non-race IMDb prompts keep the original by-year fallback.
        self.assertIn("GROUP BY year", rs._default_bigquery_sql("average imdb rating by year"))

    def test_race_from_rows_pivots_tidy_results(self) -> None:
        chart = rs._race_from_rows(tidy_rows())
        self.assertIsNotNone(chart)
        self.assertEqual(chart["suggestedType"], "race")
        self.assertEqual(chart["xAxisLabel"], "episode")
        self.assertEqual(chart["yAxisLabel"], "running_average")
        self.assertEqual(len(chart["series"]), 6)
        self.assertEqual(chart["labels"][0], "episode 1")

    def test_deterministic_race_sql_is_recognised_and_uses_known_columns(self) -> None:
        sql = pds._IMDB_EPISODE_RACE_SQL.format(limit=50)
        self.assertTrue(rs._is_deterministic_race_sql(sql))
        self.assertTrue(rs._is_deterministic_race_sql("  " + sql + "\n"))
        self.assertFalse(rs._is_deterministic_race_sql("SELECT 1"))
        # With known columns, inference is bypassed entirely — even rows that
        # would confuse it (a single contender) pivot on the named columns.
        rows = [{"show": "24", "episode": ep, "running_average": 8 + ep * 0.01} for ep in range(1, 50)]
        rows += [{"show": "Dark", "episode": ep, "running_average": 8.5 + ep * 0.01} for ep in range(1, 50)]
        with patch.object(rs, "infer_race_columns", side_effect=AssertionError("must not infer")):
            chart = rs._race_from_rows(rows, columns=rs._IMDB_RACE_COLUMNS)
        self.assertIsNotNone(chart)
        self.assertEqual(chart["suggestedType"], "race")
        self.assertEqual(sorted(s["name"] for s in chart["series"]), ["24", "Dark"])

    def test_race_from_rows_declines_wide_results(self) -> None:
        wide = [{"year": str(1980 + i), "title_count": i, "average_rating": 7 + i * 0.01} for i in range(20)]
        self.assertIsNone(rs._race_from_rows(wide))


if __name__ == "__main__":
    unittest.main()
