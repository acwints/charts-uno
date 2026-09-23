import os
import re
from typing import Any, Dict, List, Optional
from services.bigquery_auth import has_bigquery_credentials, load_bigquery_service_account_credentials
from services.model_config import MODEL_SQL
from services.race_builder import build_race
from services.blocking import MODEL_CALL_TIMEOUT_SECONDS, query_rows, run_blocking

try:
    from google import genai  # type: ignore
except Exception:  # pragma: no cover - optional at runtime
    genai = None  # type: ignore


ENABLE_BIGQUERY_PUBLIC_DATA = os.environ.get("ENABLE_BIGQUERY_PUBLIC_DATA", "").lower() in {"1", "true", "yes", "on"}
BIGQUERY_PROJECT_ID = os.environ.get("BIGQUERY_PROJECT_ID", "")
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY", "")
MODEL_NAME = MODEL_SQL



_IMDB_RACE_BASE = """
WITH series AS (
  SELECT b.tconst, b.primary_title AS show, r.num_votes AS series_votes
  FROM `bigquery-public-data.imdb.title_basics` AS b
  JOIN `bigquery-public-data.imdb.title_ratings` AS r ON r.tconst = b.tconst
  WHERE b.title_type IN ('tvSeries', 'tvMiniSeries')
    AND r.num_votes >= 100000
),
episodes AS (
  SELECT
    s.show,
    s.series_votes,
    e.season_number,
    e.episode_number,
    r.average_rating,
    r.num_votes,
    ROW_NUMBER() OVER (PARTITION BY s.tconst ORDER BY e.season_number, e.episode_number) AS ep_index,
    -- 1 once an episode fails the vote gate. The running MAX below turns that
    -- into "everything after the first gap", which is then excluded. (Keep
    -- semicolons out of these comments: the safety guard treats one as a
    -- second statement and rejects the whole query.)
    CASE WHEN r.average_rating IS NULL OR r.num_votes < 200 THEN 1 ELSE 0 END AS gap
  FROM `bigquery-public-data.imdb.title_episode` AS e
  JOIN series AS s ON s.tconst = e.parent_tconst
  LEFT JOIN `bigquery-public-data.imdb.title_ratings` AS r ON r.tconst = e.tconst
  WHERE e.season_number >= 1 AND e.episode_number >= 1
),
prefix AS (
  SELECT *,
    MAX(gap) OVER (PARTITION BY show ORDER BY ep_index ROWS UNBOUNDED PRECEDING) AS broken
  FROM episodes
),
rated AS (
  SELECT show, series_votes, season_number, episode_number, ep_index, average_rating,
    COUNT(1) OVER (PARTITION BY show) AS rated_episodes
  FROM prefix
  WHERE broken = 0
),
eligible AS (
  SELECT DISTINCT show, series_votes
  FROM rated
  WHERE rated_episodes >= 40
  ORDER BY series_votes DESC
  LIMIT {limit}
)
"""

_IMDB_EPISODE_RACE_SQL = (_IMDB_RACE_BASE + """
SELECT
  r.show AS show,
  r.ep_index AS episode,
  AVG(r.average_rating) OVER (PARTITION BY r.show ORDER BY r.ep_index ROWS UNBOUNDED PRECEDING) AS running_average
FROM rated AS r
JOIN eligible AS g ON g.show = r.show
WHERE r.ep_index <= 100
ORDER BY r.show, r.ep_index
""").strip()

_IMDB_SEASON_RACE_SQL = (_IMDB_RACE_BASE + """
, seasons AS (
  SELECT r.show, r.season_number, AVG(r.average_rating) AS season_rating
  FROM rated AS r
  JOIN eligible AS g ON g.show = r.show
  GROUP BY r.show, r.season_number
)
SELECT
  show,
  season_number AS season,
  AVG(season_rating) OVER (PARTITION BY show ORDER BY season_number ROWS UNBOUNDED PRECEDING) AS running_average
FROM seasons
WHERE season_number <= 12
ORDER BY show, season_number
""").strip()

PUBLIC_DATASETS: Dict[str, Dict[str, Any]] = {
    "imdb_titles": {
        "id": "imdb_titles",
        "name": "IMDb Titles & Ratings",
        "description": "Movies and TV metadata with ratings and vote counts.",
        "tables": [
            "bigquery-public-data.imdb.title_basics",
            "bigquery-public-data.imdb.title_ratings",
        ],
        "examplePrompts": [
            "average IMDb rating by year",
            "movie count by genre for the last 20 years",
            "top title types by average votes",
        ],
        "defaultSql": """
SELECT
  CAST(t.start_year AS STRING) AS year,
  COUNT(1) AS title_count,
  AVG(r.average_rating) AS average_rating
FROM `bigquery-public-data.imdb.title_basics` AS t
JOIN `bigquery-public-data.imdb.title_ratings` AS r
  ON t.tconst = r.tconst
WHERE t.start_year IS NOT NULL
  AND t.start_year >= 1980
GROUP BY year
ORDER BY year
LIMIT {limit}
""".strip(),
    },
    "imdb_episode_race": {
        "id": "imdb_episode_race",
        "name": "IMDb — Best Shows, Episode by Episode",
        "description": "Leaderboard race of the running average episode rating after each episode aired.",
        "tables": [
            "bigquery-public-data.imdb.title_basics",
            "bigquery-public-data.imdb.title_ratings",
            "bigquery-public-data.imdb.title_episode",
        ],
        "examplePrompts": [
            "best shows of all time by average rating after each episode",
            "which show holds the best running average the deepest into its run",
        ],
        "raceShaped": True,
        "race": {"entity": "show", "period": "episode", "value": "running_average", "unit": "episode"},
        "defaultSql": _IMDB_EPISODE_RACE_SQL,
    },
    "imdb_season_race": {
        "id": "imdb_season_race",
        "name": "IMDb — Best Shows, Season by Season",
        "description": "Leaderboard race of the running average season rating after each season.",
        "tables": [
            "bigquery-public-data.imdb.title_basics",
            "bigquery-public-data.imdb.title_ratings",
            "bigquery-public-data.imdb.title_episode",
        ],
        "examplePrompts": [
            "best shows of all time one season at a time",
            "which shows fell apart in their final season",
        ],
        "raceShaped": True,
        "race": {"entity": "show", "period": "season", "value": "running_average", "unit": "season"},
        "defaultSql": _IMDB_SEASON_RACE_SQL,
    },
    "hacker_news": {
        "id": "hacker_news",
        "name": "Hacker News",
        "description": "Posts/comments from Hacker News with scores and timestamps.",
        "tables": [
            "bigquery-public-data.hacker_news.full",
        ],
        "examplePrompts": [
            "monthly post count over time",
            "average score by year",
            "top story domains by average score",
        ],
        "defaultSql": """
SELECT
  FORMAT_TIMESTAMP('%Y-%m', timestamp) AS month,
  COUNT(1) AS post_count,
  AVG(score) AS average_score
FROM `bigquery-public-data.hacker_news.full`
WHERE timestamp IS NOT NULL
  AND score IS NOT NULL
GROUP BY month
ORDER BY month
LIMIT {limit}
""".strip(),
    },
    "usa_names": {
        "id": "usa_names",
        "name": "USA Baby Names",
        "description": "U.S. Social Security baby names by year, state, and gender.",
        "tables": [
            "bigquery-public-data.usa_names.usa_1910_current",
        ],
        "examplePrompts": [
            "most popular names by year",
            "total births trend over time",
            "male vs female births by decade",
        ],
        "defaultSql": """
SELECT
  CAST(year AS STRING) AS year,
  SUM(number) AS births
FROM `bigquery-public-data.usa_names.usa_1910_current`
GROUP BY year
ORDER BY year
LIMIT {limit}
""".strip(),
    },
}


def get_public_datasets() -> List[Dict[str, Any]]:
    return [
        {
            "id": dataset["id"],
            "name": dataset["name"],
            "description": dataset["description"],
            "tables": dataset["tables"],
            "examplePrompts": dataset["examplePrompts"],
            "raceShaped": bool(dataset.get("raceShaped")),
        }
        for dataset in PUBLIC_DATASETS.values()
    ]


def _is_bigquery_ready() -> bool:
    return (
        ENABLE_BIGQUERY_PUBLIC_DATA
        and bool(BIGQUERY_PROJECT_ID)
        and has_bigquery_credentials()
    )


def _starts_read_only(sql_lower: str) -> bool:
    """SELECT, or a CTE (WITH ... SELECT). Read-only is enforced by the DML/DDL token check."""
    head = sql_lower.strip()
    return head.startswith("select") or head.startswith("with ")


def _is_safe_sql(sql: str, allowed_tables: List[str]) -> bool:
    sql_l = sql.lower()
    blocked = ["insert ", "update ", "delete ", "merge ", "drop ", "alter ", "create "]
    if any(token in sql_l for token in blocked):
        return False
    if ";" in sql.strip().rstrip(";"):
        return False
    if not _starts_read_only(sql_l):
        return False

    matched_tables = re.findall(r"`([^`]+)`", sql)
    if not matched_tables:
        return False
    allowed_set = {t.lower() for t in allowed_tables}
    for table in matched_tables:
        table_l = table.lower()
        if table_l.startswith("bigquery-public-data.") and table_l not in allowed_set:
            return False
    return any(t.lower() in allowed_set for t in matched_tables)


def _generate_sql_with_llm(
    dataset: Dict[str, Any],
    prompt: str,
    top_n: int,
    chart_type_hint: Optional[str],
) -> Optional[str]:
    if not GOOGLE_API_KEY or genai is None:
        return None

    client = genai.Client(api_key=GOOGLE_API_KEY)
    allowed_tables = dataset["tables"]
    hint = chart_type_hint or "auto"
    schema_prompt = f"""Write ONE BigQuery SQL query for a chart request.

Dataset: {dataset["name"]}
Allowed tables only:
{chr(10).join(f"- `{t}`" for t in allowed_tables)}

User request: "{prompt}"
Chart type hint: "{hint}"

Rules:
- Use SELECT only, no semicolons.
- Use ONLY the allowed tables above.
- Return 2-4 columns: first is label/category/date, others numeric.
- Return at most {top_n} rows.
- Order output for chart readability.

Return ONLY SQL, no markdown.
"""
    resp = client.models.generate_content(model=MODEL_NAME, contents=schema_prompt)
    sql = (resp.text or "").replace("```sql", "").replace("```", "").strip()
    return sql or None


def _get_bigquery_client():
    from google.cloud import bigquery  # type: ignore

    credentials = load_bigquery_service_account_credentials()
    return bigquery.Client(project=BIGQUERY_PROJECT_ID, credentials=credentials), bigquery


def _to_chart(rows: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not rows:
        return None
    columns = list(rows[0].keys())
    numeric_cols: List[str] = []
    label_col: Optional[str] = None

    for col in columns:
        sample = next((r.get(col) for r in rows if r.get(col) is not None), None)
        if isinstance(sample, (int, float)):
            numeric_cols.append(col)
        elif label_col is None:
            label_col = col

    if label_col is None and columns:
        label_col = columns[0]
    if not label_col or not numeric_cols:
        return None

    def _safe_float(value: Any) -> Optional[float]:
        if value is None:
            return None
        if isinstance(value, (int, float)):
            return float(value)
        if isinstance(value, str):
            cleaned = value.strip().replace(",", "")
            if not cleaned:
                return None
            try:
                return float(cleaned)
            except ValueError:
                return None
        return None

    def _is_duplicate_of_label(col: str) -> bool:
        comparable = 0
        matches = 0
        for row in rows:
            label_num = _safe_float(row.get(label_col))
            value_num = _safe_float(row.get(col))
            if label_num is None or value_num is None:
                continue
            comparable += 1
            if abs(label_num - value_num) < 1e-9:
                matches += 1

        # Treat a numeric column as duplicate if it mirrors the label values
        # for nearly all comparable rows.
        min_comparable = max(2, len(rows) // 2)
        return comparable >= min_comparable and (matches / comparable) >= 0.9

    filtered_numeric_cols = [col for col in numeric_cols if not _is_duplicate_of_label(col)]
    if not filtered_numeric_cols:
        return None

    labels: List[str] = []
    series_data: Dict[str, List[Optional[float]]] = {col: [] for col in filtered_numeric_cols[:3]}
    for row in rows:
        label_val = row.get(label_col)
        if label_val is None:
            continue
        labels.append(str(label_val))
        for col in series_data:
            val = row.get(col)
            try:
                series_data[col].append(float(val))
            except (TypeError, ValueError):
                series_data[col].append(None)

    if len(labels) < 2:
        return None

    min_len = min([len(labels)] + [len(v) for v in series_data.values()])
    labels = labels[:min_len]
    series = [{
        "name": name,
        "data": [round(v, 3) if isinstance(v, (int, float)) else None for v in vals[:min_len]],
    } for name, vals in series_data.items()]
    return {
        "labels": labels,
        "series": series,
        "xAxisLabel": label_col,
        "yAxisLabel": series[0]["name"] if series else "Value",
    }


# Largest field a race may ask for. 250 covers every show that clears the
# 100k-vote / 40-episode eligibility gate today (176) with headroom.
RACE_MAX_CONTENDERS = 250
# Enough for 100 episodes x RACE_MAX_CONTENDERS shows; well under BigQuery's
# maximum_bytes_billed guard since these are narrow rows.
RACE_MAX_ROWS = 25000


def normalize_top_n(top_n: Any, race_shaped: bool) -> int:
    """Clamp a requested top_n: 5..50 rows for a chart, 5..RACE_MAX_CONTENDERS contenders for a race."""
    ceiling = RACE_MAX_CONTENDERS if race_shaped else 50
    return max(5, min(ceiling, int(top_n)))


def build_race_chart(rows: List[Dict[str, Any]], spec: Dict[str, str]):
    """Pivot tidy BigQuery rows into race chart data using the dataset's column spec."""
    if not rows:
        return None, None
    period = spec["period"]
    unit = spec.get("unit", period)
    chart, report = build_race(
        rows,
        entity=spec["entity"],
        period=period,
        value=spec["value"],
        aggregate="last",
        fill="hold",
        # BigQuery returns integers for the period; label them on the race clock.
        format_period=lambda p: f"{unit} {p}" if str(p).isdigit() else str(p),
    )
    if len(chart["series"]) < 2 or len(chart["labels"]) < 2:
        return None, report
    return chart, report


async def generate_chart_from_public_dataset(
    dataset_id: str,
    prompt: str,
    top_n: int = 20,
    chart_type_hint: Optional[str] = None,
) -> Dict[str, Any]:
    if not _is_bigquery_ready():
        raise ValueError("BigQuery public datasets are not configured on this server.")

    dataset = PUBLIC_DATASETS.get(dataset_id)
    if not dataset:
        raise ValueError("Invalid dataset selection.")

    race_shaped = bool(dataset.get("raceShaped"))
    # For a race, top_n is how many contenders to include (the field, chosen by
    # series votes), and the row cap is a separate, much larger number: a race
    # is periods x contenders of tidy rows.
    normalized_top_n = normalize_top_n(top_n, race_shaped)
    max_rows = RACE_MAX_ROWS if race_shaped else normalized_top_n

    # The deterministic SQL is the primary path for race datasets. A model
    # rewriting it would have to reproduce the prefix and eligibility rules
    # exactly, and a wrong race is worse than no race.
    llm_sql = (
        None
        if race_shaped
        else await run_blocking(
            _generate_sql_with_llm, dataset, prompt, normalized_top_n, chart_type_hint,
            timeout=MODEL_CALL_TIMEOUT_SECONDS,
        )
    )
    fallback_sql = dataset["defaultSql"].format(limit=normalized_top_n)
    sql = llm_sql or fallback_sql
    if not _is_safe_sql(sql, dataset["tables"]):
        sql = fallback_sql

    client, bigquery = _get_bigquery_client()
    job_config = bigquery.QueryJobConfig(maximum_bytes_billed=1_000_000_000, use_query_cache=True)
    rows = await query_rows(client, sql, job_config=job_config, max_results=max_rows)
    row_dicts = [dict(r) for r in rows]

    if race_shaped:
        chart, report = build_race_chart(row_dicts, dataset["race"])
        if not chart:
            raise ValueError("Could not produce a race from this dataset query.")
        return {
            **chart,
            "verifiedData": True,
            "suggestedTitle": dataset["name"],
            "suggestedType": "race",
            "xAxisLabel": dataset["race"]["period"],
            "yAxisLabel": dataset["race"]["value"],
            "sourceLink": "https://console.cloud.google.com/marketplace/product/bigquery-public-data",
            "aiReasoning": (
                f"{report.entities_kept} shows over {report.periods} {dataset['race']['unit']}s from IMDb public data. "
                "Running mean of episode ratings — not IMDb's series score. "
                "Specials (season 0 / episode 0) excluded; a show races as far as its unbroken run of "
                "episodes with 200+ votes; 40+ rated episodes to qualify; finished shows hold their final average."
            ),
            "sourceProvider": "bigquery",
        }

    chart = _to_chart(row_dicts)
    if not chart:
        raise ValueError("Could not produce chartable data from this dataset query.")

    suggested_type = chart_type_hint if chart_type_hint in {"line", "bar", "area", "table"} else "bar"
    return {
        **chart,
        "verifiedData": True,
        "suggestedTitle": f"{dataset['name']} — {prompt[:64]}",
        "suggestedType": suggested_type,
        "sourceLink": "https://console.cloud.google.com/marketplace/product/bigquery-public-data",
        "aiReasoning": "Generated from selected BigQuery public dataset using constrained SQL.",
        "sourceProvider": "bigquery",
    }
