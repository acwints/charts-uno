import os
import re
from typing import Any, Dict, List, Optional
from services.bigquery_auth import has_bigquery_credentials, load_bigquery_service_account_credentials

try:
    from google import genai  # type: ignore
except Exception:  # pragma: no cover - optional at runtime
    genai = None  # type: ignore


ENABLE_BIGQUERY_PUBLIC_DATA = os.environ.get("ENABLE_BIGQUERY_PUBLIC_DATA", "").lower() in {"1", "true", "yes", "on"}
BIGQUERY_PROJECT_ID = os.environ.get("BIGQUERY_PROJECT_ID", "")
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY", "")
MODEL_NAME = "gemini-2.5-flash"


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
        }
        for dataset in PUBLIC_DATASETS.values()
    ]


def _is_bigquery_ready() -> bool:
    return (
        ENABLE_BIGQUERY_PUBLIC_DATA
        and bool(BIGQUERY_PROJECT_ID)
        and has_bigquery_credentials()
    )


def _is_safe_sql(sql: str, allowed_tables: List[str]) -> bool:
    sql_l = sql.lower()
    blocked = ["insert ", "update ", "delete ", "merge ", "drop ", "alter ", "create "]
    if any(token in sql_l for token in blocked):
        return False
    if ";" in sql.strip().rstrip(";"):
        return False
    if not sql_l.strip().startswith("select"):
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

    normalized_top_n = max(5, min(50, int(top_n)))
    llm_sql = _generate_sql_with_llm(dataset, prompt, normalized_top_n, chart_type_hint)
    fallback_sql = dataset["defaultSql"].format(limit=normalized_top_n)
    sql = llm_sql or fallback_sql
    if not _is_safe_sql(sql, dataset["tables"]):
        sql = fallback_sql

    client, bigquery = _get_bigquery_client()
    job_config = bigquery.QueryJobConfig(maximum_bytes_billed=1_000_000_000, use_query_cache=True)
    rows = list(client.query(sql, job_config=job_config).result(max_results=normalized_top_n))
    row_dicts = [dict(r) for r in rows]
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
