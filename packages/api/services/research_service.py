import json
import logging
import os
import re
import time
from collections import defaultdict
from typing import Any, Dict, List, Optional

import httpx
from google import genai
from services.bigquery_auth import (
    get_bigquery_credentials_status,
    has_bigquery_credentials,
    load_bigquery_service_account_credentials,
)
from services.model_config import MODEL_RESEARCH

logger = logging.getLogger(__name__)

GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY", "")
FRED_API_KEY = os.environ.get("FRED_API_KEY", "")
FRED_BASE_URL = "https://api.stlouisfed.org/fred"
ENABLE_BIGQUERY_PUBLIC_DATA = os.environ.get("ENABLE_BIGQUERY_PUBLIC_DATA", "").lower() in {"1", "true", "yes", "on"}
BIGQUERY_PROJECT_ID = os.environ.get("BIGQUERY_PROJECT_ID", "")

_client: Optional[genai.Client] = None
_MODEL_NAME = MODEL_RESEARCH


def _get_client() -> genai.Client:
    global _client
    if not GOOGLE_API_KEY:
        raise ValueError("GOOGLE_API_KEY not configured")
    if _client is None:
        _client = genai.Client(api_key=GOOGLE_API_KEY)
    return _client


def _clean_json(content: str) -> Dict[str, Any]:
    clean = content.replace("```json\n", "").replace("\n```", "").replace("```", "").strip()
    return json.loads(clean)


async def _infer_research_intent(prompt: str) -> Dict[str, Any]:
    """Infer structured research intent from a natural-language prompt."""
    client = _get_client()
    intent_prompt = f"""Extract chart-research intent from this user prompt.

User prompt: {prompt}

Return ONLY valid JSON:
{{
  "topic": "short topic",
  "metric": "what should be measured",
  "geography": "global|usa|country|state|city|unknown",
  "timeframe_years": number | null,
  "start_year": number | null,
  "end_year": number | null,
  "frequency": "daily|monthly|quarterly|annual|unknown",
  "preferred_sources": ["fred", "bigquery", "other"],
  "keywords": ["keyword1", "keyword2"]
}}
"""
    response = client.models.generate_content(
        model=_MODEL_NAME,
        contents=intent_prompt,
    )
    text = response.text or ""
    try:
        parsed = _clean_json(text)
    except Exception:
        # Lightweight fallback parser if LLM parsing fails.
        lower = prompt.lower()
        years = None
        match = re.search(r"(\d+)\s+years?", lower)
        if match:
            years = int(match.group(1))
        return {
            "topic": prompt[:80],
            "metric": prompt,
            "geography": "usa" if any(k in lower for k in [" usa", " united states", " u.s."]) else "unknown",
            "timeframe_years": years,
            "start_year": None,
            "end_year": None,
            "frequency": "unknown",
            "preferred_sources": ["fred", "bigquery"],
            "keywords": [w for w in re.split(r"\W+", lower) if w][:10],
        }

    return {
        "topic": parsed.get("topic", ""),
        "metric": parsed.get("metric", prompt),
        "geography": parsed.get("geography", "unknown"),
        "timeframe_years": parsed.get("timeframe_years"),
        "start_year": parsed.get("start_year"),
        "end_year": parsed.get("end_year"),
        "frequency": parsed.get("frequency", "unknown"),
        "preferred_sources": parsed.get("preferred_sources", ["fred", "bigquery"]),
        "keywords": parsed.get("keywords", []),
    }


def _is_fred_candidate(prompt: str, intent: Dict[str, Any]) -> bool:
    lower = prompt.lower()
    economic_terms = [
        "price", "inflation", "gdp", "unemployment", "mortgage", "home",
        "housing", "income", "wage", "cpi", "rate", "index", "sales",
    ]
    if "fred" in intent.get("preferred_sources", []):
        return True
    return any(term in lower for term in economic_terms)


def _is_bigquery_candidate(prompt: str, intent: Dict[str, Any]) -> bool:
    lower = prompt.lower()
    trigger_terms = ["imdb", "movie", "film", "census", "bigquery", "public dataset"]
    if "bigquery" in intent.get("preferred_sources", []):
        return True
    return any(term in lower for term in trigger_terms)


async def _fred_search_and_fetch(prompt: str, intent: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    if not FRED_API_KEY:
        return None

    query_parts = [intent.get("metric", ""), intent.get("topic", ""), intent.get("geography", ""), prompt]
    search_text = " ".join(part for part in query_parts if part).strip()
    if not search_text:
        return None

    async with httpx.AsyncClient() as client:
        search_resp = await client.get(
            f"{FRED_BASE_URL}/series/search",
            params={
                "api_key": FRED_API_KEY,
                "file_type": "json",
                "search_text": search_text,
                "limit": 12,
                "sort_order": "desc",
            },
            timeout=12.0,
        )
        search_resp.raise_for_status()
        search_data = search_resp.json()

    series_list = search_data.get("seriess", []) or []
    if not series_list:
        return None

    # Simple lexical ranking to favor best match.
    keywords = [k.lower() for k in intent.get("keywords", []) if isinstance(k, str)]
    if not keywords:
        keywords = [w for w in re.split(r"\W+", prompt.lower()) if len(w) > 2][:8]

    def score(item: Dict[str, Any]) -> float:
        title = str(item.get("title", "")).lower()
        units = str(item.get("units", "")).lower()
        notes = str(item.get("notes", "")).lower()
        hay = f"{title} {units} {notes}"
        lexical = sum(1 for kw in keywords if kw in hay)
        popularity = float(item.get("popularity", 0) or 0)
        frequency = str(item.get("frequency_short", "")).lower()
        freq_bonus = 1.0 if frequency in {"a", "q", "m"} else 0.0
        return lexical * 3.0 + popularity * 0.05 + freq_bonus

    chosen = max(series_list, key=score)
    series_id = chosen.get("id")
    if not series_id:
        return None

    async with httpx.AsyncClient() as client:
        obs_resp = await client.get(
            f"{FRED_BASE_URL}/series/observations",
            params={
                "api_key": FRED_API_KEY,
                "file_type": "json",
                "series_id": series_id,
            },
            timeout=12.0,
        )
        obs_resp.raise_for_status()
        obs_data = obs_resp.json()

    observations = obs_data.get("observations", []) or []
    points: List[tuple[str, float]] = []
    for obs in observations:
        value = obs.get("value")
        date = obs.get("date")
        if not value or value == "." or not date:
            continue
        try:
            points.append((str(date), float(value)))
        except (TypeError, ValueError):
            continue

    if len(points) < 3:
        return None

    # If we have many points, downsample to annual averages for chart readability.
    if len(points) > 60:
        grouped: Dict[str, List[float]] = defaultdict(list)
        for date, value in points:
            grouped[date[:4]].append(value)
        annual = sorted((year, sum(vals) / len(vals)) for year, vals in grouped.items())
        points = annual

    timeframe_years = intent.get("timeframe_years")
    if isinstance(timeframe_years, int) and timeframe_years > 0:
        points = points[-timeframe_years:]

    labels = [p[0][:4] if len(p[0]) >= 4 and p[0][4:5] == "-" else p[0] for p in points]
    data = [round(p[1], 2) for p in points]
    if len(labels) < 3:
        return None

    title = str(chosen.get("title", "FRED Series"))
    units = str(chosen.get("units", "")).strip()
    source_link = f"https://fred.stlouisfed.org/series/{series_id}"
    reasoning = f"Retrieved real data from FRED series {series_id} ({title})."

    return {
        "labels": labels,
        "series": [{"name": units or "Value", "data": data}],
        "verifiedData": True,
        "suggestedTitle": title,
        "suggestedType": "line",
        "xAxisLabel": "Year" if all(re.match(r"^\d{4}$", lab) for lab in labels) else "Date",
        "yAxisLabel": units or "Value",
        "xAxisType": "year" if all(re.match(r"^\d{4}$", lab) for lab in labels) else "date",
        "sourceLink": source_link,
        "aiReasoning": reasoning,
        "sourceProvider": "fred",
    }


def _is_safe_bigquery_sql(sql: str) -> bool:
    sql_l = sql.lower()
    blocked = ["insert ", "update ", "delete ", "merge ", "drop ", "alter ", "create "]
    if any(token in sql_l for token in blocked):
        return False
    if ";" in sql.strip().rstrip(";"):
        return False
    if "bigquery-public-data." not in sql_l:
        return False
    return sql_l.strip().startswith("select")


def _default_bigquery_sql(prompt: str) -> Optional[str]:
    """Fallback deterministic SQL when LLM SQL generation is unavailable."""
    lower = prompt.lower()

    # IMDb-focused fallback with known-good column names.
    if any(term in lower for term in ["imdb", "movie", "film", "rating", "genre"]):
        return """
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
LIMIT 50
""".strip()

    return None


async def _generate_bigquery_sql(prompt: str) -> Optional[str]:
    # If AI key is unavailable, use deterministic fallback when possible.
    if not GOOGLE_API_KEY:
        return _default_bigquery_sql(prompt)

    client = _get_client()
    schema_prompt = f"""Write ONE BigQuery SQL query for a chart from this prompt:
"{prompt}"

Constraints:
- Use ONLY BigQuery public datasets.
- Prefer IMDb tables when the prompt is about movies:
  - `bigquery-public-data.imdb.title_basics`
  - `bigquery-public-data.imdb.title_ratings`
  - `bigquery-public-data.imdb.name_basics`
  - NOTE: valid title_basics columns include: `primary_title`, `start_year`, `genres`, `title_type`, `runtime_minutes`, `is_adult`.
  - NOTE: valid title_ratings columns include: `tconst`, `average_rating`, `num_votes`.
- Use SELECT only (no DDL/DML), no semicolons.
- Return at most 50 rows.
- Output exactly two to four columns where:
  - first column is a label/date/category
  - remaining columns are numeric metrics

Return ONLY SQL, no markdown.
"""
    try:
        resp = client.models.generate_content(model=_MODEL_NAME, contents=schema_prompt)
        sql = (resp.text or "").replace("```sql", "").replace("```", "").strip()
        return sql or _default_bigquery_sql(prompt)
    except Exception:
        return _default_bigquery_sql(prompt)


def get_research_provider_status() -> Dict[str, Any]:
    """Return provider readiness information for health/debug endpoints."""
    cred_status = get_bigquery_credentials_status()
    return {
        "googleApiConfigured": bool(GOOGLE_API_KEY),
        "fredConfigured": bool(FRED_API_KEY),
        "bigquery": {
            "enabled": ENABLE_BIGQUERY_PUBLIC_DATA,
            "projectConfigured": bool(BIGQUERY_PROJECT_ID),
            **cred_status,
        },
    }


async def probe_research_providers() -> Dict[str, Any]:
    """Run lightweight provider probes for diagnostics.

    Notes:
    - This never exposes secrets.
    - BigQuery probe uses a safe `SELECT 1` query only.
    """
    status = get_research_provider_status()
    result: Dict[str, Any] = {"status": status, "probes": {}}

    bq_status = status.get("bigquery", {})
    if not bq_status.get("enabled"):
        result["probes"]["bigquery"] = {"ok": False, "state": "skipped", "reason": "disabled"}
        return result
    if not bq_status.get("projectConfigured"):
        result["probes"]["bigquery"] = {"ok": False, "state": "misconfigured", "reason": "missing project id"}
        return result
    if not bq_status.get("credentialsConfigured"):
        result["probes"]["bigquery"] = {"ok": False, "state": "misconfigured", "reason": "missing credentials path"}
        return result
    if not bq_status.get("credentialsFileExists"):
        result["probes"]["bigquery"] = {"ok": False, "state": "misconfigured", "reason": "credentials file not found"}
        return result

    try:
        from google.cloud import bigquery  # type: ignore
    except Exception as e:
        result["probes"]["bigquery"] = {
            "ok": False,
            "state": "unavailable",
            "reason": "bigquery client import failed",
            "error": str(e)[:300],
        }
        return result

    started = time.monotonic()
    try:
        credentials = load_bigquery_service_account_credentials()
        client = bigquery.Client(project=BIGQUERY_PROJECT_ID, credentials=credentials)
        rows = list(client.query("SELECT 1 AS ok").result(max_results=1))
        elapsed_ms = int((time.monotonic() - started) * 1000)
        result["probes"]["bigquery"] = {
            "ok": bool(rows and rows[0]["ok"] == 1),
            "state": "ok",
            "project": client.project,
            "elapsedMs": elapsed_ms,
        }
    except Exception as e:
        elapsed_ms = int((time.monotonic() - started) * 1000)
        result["probes"]["bigquery"] = {
            "ok": False,
            "state": "failed",
            "project": BIGQUERY_PROJECT_ID,
            "elapsedMs": elapsed_ms,
            "error": str(e)[:500],
        }

    return result


async def _bigquery_search_and_fetch(prompt: str) -> Optional[Dict[str, Any]]:
    if not ENABLE_BIGQUERY_PUBLIC_DATA:
        return None

    if not BIGQUERY_PROJECT_ID:
        logger.info("BigQuery provider skipped: BIGQUERY_PROJECT_ID not configured")
        return None
    if not has_bigquery_credentials():
        logger.info("BigQuery provider skipped: no valid service account credentials configured")
        return None

    try:
        from google.cloud import bigquery  # type: ignore
    except Exception:
        logger.info("BigQuery provider skipped: google-cloud-bigquery not installed")
        return None

    sql = await _generate_bigquery_sql(prompt)
    if not sql or not _is_safe_bigquery_sql(sql):
        return None

    try:
        credentials = load_bigquery_service_account_credentials()
        client = bigquery.Client(project=BIGQUERY_PROJECT_ID, credentials=credentials)
        job_config = bigquery.QueryJobConfig(maximum_bytes_billed=1_000_000_000, use_query_cache=True)
        rows = list(client.query(sql, job_config=job_config).result(max_results=50))
        if not rows:
            return None

        columns = list(rows[0].keys())
        row_dicts = [{k: r[k] for k in columns} for r in rows]
    except Exception as e:
        logger.info(f"BigQuery provider failed: {e}")
        return None

    # Infer label + numeric fields from result schema.
    numeric_cols = []
    label_col = None
    for col in columns:
        sample = next((r.get(col) for r in row_dicts if r.get(col) is not None), None)
        if isinstance(sample, (int, float)):
            numeric_cols.append(col)
        elif label_col is None:
            label_col = col

    if label_col is None and columns:
        label_col = columns[0]
    if not label_col or not numeric_cols:
        return None

    labels: List[str] = []
    series_data: Dict[str, List[Optional[float]]] = {col: [] for col in numeric_cols[:3]}
    for row in row_dicts[:40]:
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

    if len(labels) < 3:
        return None

    # Keep aligned rows only.
    min_len = min([len(labels)] + [len(v) for v in series_data.values()])
    labels = labels[:min_len]
    series = [{
        "name": name,
        "data": [round(v, 3) if isinstance(v, (int, float)) else None for v in vals[:min_len]],
    } for name, vals in series_data.items()]

    source_link = "https://console.cloud.google.com/marketplace/product/bigquery-public-data"
    return {
        "labels": labels,
        "series": series,
        "verifiedData": True,
        "suggestedTitle": "Public dataset query result",
        "suggestedType": "bar",
        "xAxisLabel": label_col,
        "yAxisLabel": series[0]["name"],
        "sourceLink": source_link,
        "aiReasoning": "Retrieved data from BigQuery public datasets.",
        "sourceProvider": "bigquery",
    }


async def research_chart_from_prompt(prompt: str) -> Optional[Dict[str, Any]]:
    """Try to resolve real data for a prompt from trusted sources."""
    try:
        intent = await _infer_research_intent(prompt)
    except Exception as e:
        logger.info(f"Intent inference failed, skipping research pipeline: {e}")
        intent = {
            "topic": prompt,
            "metric": prompt,
            "geography": "unknown",
            "timeframe_years": None,
            "preferred_sources": ["fred", "bigquery"],
            "keywords": [],
        }

    if _is_fred_candidate(prompt, intent):
        try:
            result = await _fred_search_and_fetch(prompt, intent)
            if result:
                return result
        except Exception as e:
            logger.info(f"FRED provider failed: {e}")

    if _is_bigquery_candidate(prompt, intent):
        try:
            result = await _bigquery_search_and_fetch(prompt)
            if result:
                return result
        except Exception as e:
            logger.info(f"BigQuery provider failed: {e}")

    return None
