import os
import json
import logging
import base64
import re
import asyncio
import time
from datetime import date
from typing import Optional, Dict, Any, List

from google import genai
from google.genai import types
from services.chart_semantics import normalize_chart_semantics
from services.infographic_service import build_fallback_infographic, extract_svg
from services.model_config import MODEL_CHART
from services.research_service import research_chart_from_prompt

logger = logging.getLogger(__name__)

# Configure Gemini
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY", "")

# Create client
_client: Optional[genai.Client] = None


def get_client() -> genai.Client:
    """Get the Gemini client instance."""
    global _client
    if not GOOGLE_API_KEY:
        raise ValueError("GOOGLE_API_KEY not configured")
    if _client is None:
        _client = genai.Client(api_key=GOOGLE_API_KEY)
    return _client


MODEL_NAME = MODEL_CHART

try:
    INFOGRAPHIC_MODEL_TIMEOUT_SECONDS = max(
        10.0,
        min(75.0, float(os.environ.get("INFOGRAPHIC_MODEL_TIMEOUT_SECONDS", "35"))),
    )
except ValueError:
    INFOGRAPHIC_MODEL_TIMEOUT_SECONDS = 35.0


def _coerce_numeric_value(value: Any) -> Optional[float]:
    """Parse numeric-like values, including compact suffixes like 70b."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if not isinstance(value, str):
        return None

    text = value.strip().lower().replace(",", "")
    if not text:
        return None

    # Strip common currency symbols/codes.
    text = re.sub(r"^(usd|eur|gbp)\s*", "", text)
    text = re.sub(r"^[\$€£]\s*", "", text)

    multiplier = 1.0
    suffix_match = re.search(r"(k|m|b|t)$", text)
    if suffix_match:
        suffix = suffix_match.group(1)
        if suffix == "k":
            multiplier = 1_000.0
        elif suffix == "m":
            multiplier = 1_000_000.0
        elif suffix == "b":
            multiplier = 1_000_000_000.0
        elif suffix == "t":
            multiplier = 1_000_000_000_000.0
        text = text[:-1].strip()

    try:
        return float(text) * multiplier
    except ValueError:
        return None


def _extract_relative_year_window(prompt: str, today: Optional[date] = None) -> Optional[Dict[str, int]]:
    """Infer relative year windows like 'past decade' or 'last 10 years'."""
    lower = prompt.lower()
    now = today or date.today()
    years: Optional[int] = None

    if re.search(r"\b(past|last)\s+decade\b", lower):
        years = 10
    else:
        match = re.search(r"\b(past|last)\s+(\d{1,2})\s+years?\b", lower)
        if match:
            parsed = int(match.group(2))
            if 2 <= parsed <= 50:
                years = parsed

    if not years:
        return None

    end_year = now.year
    start_year = end_year - years + 1
    return {
        "count": years,
        "startYear": start_year,
        "endYear": end_year,
    }


def _labels_match_year_window(labels: List[str], window: Optional[Dict[str, int]]) -> bool:
    """Check if labels exactly match an expected contiguous year window."""
    if not window:
        return True
    expected = [str(year) for year in range(window["startYear"], window["endYear"] + 1)]
    return labels == expected


def _has_missing_series_points(chart: Dict[str, Any]) -> bool:
    """Return True when any series has missing/null points for known labels."""
    labels = chart.get("labels")
    series = chart.get("series")
    if not isinstance(labels, list) or not isinstance(series, list):
        return False
    expected_len = len(labels)
    if expected_len == 0:
        return False

    for entry in series:
        if not isinstance(entry, dict):
            continue
        data = entry.get("data")
        if not isinstance(data, list):
            return True
        if len(data) < expected_len:
            return True
        if any(point is None for point in data[:expected_len]):
            return True
    return False


async def _plan_prompt_output(prompt: str) -> Dict[str, Any]:
    """Plan output structure and fact-preservation constraints."""
    client = get_client()
    planning_prompt = f"""You are a chart-orchestration planner.

Given user input, infer the most useful table/chart structure and extract explicit facts.

User prompt:
{prompt}

Return ONLY valid JSON (no markdown):
{{
  "outputShape": "entity_comparison" | "time_series" | "distribution" | "geographic" | "synthetic",
  "reasoning": "1-2 sentence rationale",
  "explicitFacts": [
    {{"entity": "name", "metric": "metric name", "value": "raw value string from prompt"}}
  ],
  "closedEntitySet": true | false,
  "preferredLabelField": "Entity" | null,
  "preferredMetrics": ["Metric A", "Metric B"],
  "preferredType": "bar" | "line" | "area" | "pie" | "radar" | "scatter" | "table" | null
}}

Rules:
- Extract explicit facts when entities and values are directly stated.
- Set closedEntitySet=true when the text reads like a fixed, explicit list.
- Prefer table/bar for entity comparisons and line for time trends.
- If facts are sparse, set outputShape to synthetic.
"""
    response = client.models.generate_content(
        model=MODEL_NAME,
        contents=planning_prompt,
    )
    content = response.text or ""
    if not content:
        return {"outputShape": "synthetic", "reasoning": "No planning response"}

    try:
        clean_content = content.replace("```json\n", "").replace("\n```", "").replace("```", "").strip()
        parsed = json.loads(clean_content)
        if isinstance(parsed, dict):
            return parsed
    except Exception:
        pass

    return {"outputShape": "synthetic", "reasoning": "Planning parse failed"}


async def _generate_candidate_from_plan(
    prompt: str,
    plan: Dict[str, Any],
    year_window: Optional[Dict[str, int]] = None,
    force_year_window: bool = False,
    force_full_coverage: bool = False,
) -> Dict[str, Any]:
    """Generate a candidate chart using the orchestration plan."""
    client = get_client()
    output_shape = str(plan.get("outputShape") or "synthetic")
    reasoning = str(plan.get("reasoning") or "").strip()
    explicit_facts = plan.get("explicitFacts", [])
    closed_entity_set = bool(plan.get("closedEntitySet", False))
    preferred_label_field = plan.get("preferredLabelField")
    preferred_metrics = plan.get("preferredMetrics", [])
    preferred_type = plan.get("preferredType")
    today_iso = date.today().isoformat()
    year_window_line = "none"
    year_window_rules = ""
    if year_window:
        year_window_line = f"{year_window['startYear']}..{year_window['endYear']} ({year_window['count']} years)"
        strictness = "REQUIRED" if force_year_window else "required when applicable"
        year_window_rules = f"""
- Relative year window: {year_window_line}
- This is {strictness}. If the prompt asks for "past/last N years" or "past decade", labels MUST be yearly strings from {year_window['startYear']} to {year_window['endYear']} in ascending order.
- Do not return older ranges unless the user explicitly asks for a fixed historical period."""
    full_coverage_rules = ""
    if force_full_coverage:
        full_coverage_rules = """
- Full series coverage is REQUIRED: do not leave null/missing values for the returned labels.
- If data is unavailable, choose a fully sourced subset window instead of returning nulls."""

    generation_prompt = f"""You are a data-visualization generator for a chart app.

Use this orchestration plan:
- outputShape: {output_shape}
- plannerReasoning: {reasoning or "n/a"}
- explicitFacts: {json.dumps(explicit_facts, ensure_ascii=False)}
- closedEntitySet: {closed_entity_set}
- preferredLabelField: {preferred_label_field}
- preferredMetrics: {json.dumps(preferred_metrics, ensure_ascii=False)}
- preferredType: {preferred_type}
- currentDate: {today_iso}
- expectedRelativeYearWindow: {year_window_line}

User prompt:
{prompt}

Return ONLY valid JSON in this exact format (no markdown, no explanation):
{{
  "labels": ["label1", "label2", ...],
  "categoricalColumns": [
    {{"name": "Optional non-numeric detail such as Winner", "data": ["value1", "value2", ...]}}
  ],
  "series": [
    {{"name": "Series Name", "data": [num1 | null, num2 | null, ...]}}
  ],
  "suggestedTitle": "A clear, descriptive title for the chart",
  "suggestedType": "bar" | "line" | "area" | "pie" | "radar" | "scatter" | "table",
  "stacked": true | false,
  "barLayout": "horizontal" | "vertical",
  "xAxisLabel": "Label for the x-axis",
  "yAxisLabel": "Label for the y-axis",
  "xAxisType": "year" | "date" | "category" | "number",
  "yAxisFormat": "currency" | "percentage" | "number",
  "yAxisPrefix": "" | "$" | "€" | "£" | etc,
  "yAxisSuffix": "" | "%" | " units" | etc,
  "aiReasoning": "Brief user-facing explanation"
}}

Rules:
- Keep labels length aligned with every series data length.
- Keep labels length aligned with every categoricalColumns data length.
- Preserve explicit facts when they are present and numeric.
- If closedEntitySet=true, avoid introducing extra entities unless required to make chartable output.
- Prefer practical output over clever output: table/bar for entity comparisons, line for temporal trends.
- A year/date is a temporal dimension, not a numeric measure. When rows contain a year/date field, put those values in labels, set xAxisType accordingly, and do not return Year/Date as a numeric series.
- Preserve aligned non-numeric fields (for example, a winner or event name for each year) in categoricalColumns.
- If facts are sparse, infer a useful but plausible dataset.
- For time-sensitive factual prompts, prefer up-to-date real-world values over stale templates.
{year_window_rules}
{full_coverage_rules}
"""
    response = client.models.generate_content(model=MODEL_NAME, contents=generation_prompt)
    content = (response.text or "").replace("```json\n", "").replace("\n```", "").replace("```", "").strip()
    parsed = json.loads(content)
    if not parsed.get("labels") or not parsed.get("series"):
        raise ValueError("Invalid data structure returned")
    return parsed


async def _self_critique_candidate(
    prompt: str,
    plan: Dict[str, Any],
    candidate: Dict[str, Any],
    year_window: Optional[Dict[str, int]] = None,
    require_full_coverage: bool = False,
) -> Dict[str, Any]:
    """Run a model-side quality check and optional repair pass."""
    client = get_client()
    critique_prompt = f"""You are a chart-output critic. Evaluate whether candidate JSON is useful and faithful to the prompt.

Prompt:
{prompt}

Plan:
{json.dumps(plan, ensure_ascii=False)}

Current date: {date.today().isoformat()}
Expected relative year window: {json.dumps(year_window) if year_window else "none"}
Require full coverage: {require_full_coverage}

Candidate chart JSON:
{json.dumps(candidate, ensure_ascii=False)}

Return ONLY valid JSON:
{{
  "verdict": "accept" | "repair",
  "issues": ["short issue"],
  "repaired": <full chart JSON object or null>,
  "reasoning": "brief"
}}

Checks:
- Explicit facts preserved when present (entity, metric, value).
- No unnecessary invented entities when closedEntitySet=true.
- Practical chart structure for the user intent.
- labels/series alignment remains valid.
- Year/date fields are used as the temporal labels and are not plotted as numeric series.
- Requested non-numeric row details are preserved in categoricalColumns.
- For relative-time prompts (e.g. past decade/last N years), year labels must match the expected recent window.
- When full coverage is required, do not leave null/missing values across the returned labels.
"""
    response = client.models.generate_content(model=MODEL_NAME, contents=critique_prompt)
    content = (response.text or "").replace("```json\n", "").replace("\n```", "").replace("```", "").strip()
    parsed = json.loads(content)
    if parsed.get("verdict") == "repair" and isinstance(parsed.get("repaired"), dict):
        repaired = parsed["repaired"]
        if repaired.get("labels") and repaired.get("series"):
            return repaired
    return candidate


def _apply_explicit_fact_guardrails(plan: Dict[str, Any], chart: Dict[str, Any]) -> Dict[str, Any]:
    """Lightweight deterministic guardrails for explicit prompt facts."""
    explicit_facts = plan.get("explicitFacts")
    if not isinstance(explicit_facts, list) or not explicit_facts:
        return chart

    labels = [str(v) for v in chart.get("labels", [])]
    series = chart.get("series", [])
    if not labels or not isinstance(series, list):
        return chart

    label_idx = {label.lower(): idx for idx, label in enumerate(labels)}
    series_idx = {
        str(s.get("name", "")).strip().lower(): idx
        for idx, s in enumerate(series)
        if isinstance(s, dict)
    }

    closed_entity_set = bool(plan.get("closedEntitySet", False))
    fact_entities: List[str] = []

    for fact in explicit_facts:
        if not isinstance(fact, dict):
            continue
        entity = str(fact.get("entity") or "").strip()
        metric = str(fact.get("metric") or "").strip()
        value = _coerce_numeric_value(fact.get("value"))
        if not entity or not metric or value is None:
            continue

        fact_entities.append(entity)
        row = label_idx.get(entity.lower())
        col = series_idx.get(metric.lower())
        if row is None or col is None:
            continue

        data = series[col].get("data")
        if not isinstance(data, list):
            continue
        while len(data) < len(labels):
            data.append(None)
        data[row] = value
        series[col]["data"] = data

    if closed_entity_set and fact_entities:
        keep = {name.lower() for name in fact_entities}
        keep_indices = [idx for idx, label in enumerate(labels) if label.lower() in keep]
        if keep_indices:
            chart["labels"] = [labels[idx] for idx in keep_indices]
            for s in series:
                data = s.get("data")
                if isinstance(data, list):
                    s["data"] = [data[idx] if idx < len(data) else None for idx in keep_indices]

    chart["series"] = series
    return chart


async def analyze_image(image_base64: str, mime_type: str, user_prompt: Optional[str] = None) -> Dict[str, Any]:
    """Analyze an image and extract chart data."""
    client = get_client()
    user_prompt_block = f"\nUser instructions: {user_prompt}\n" if user_prompt else ""

    prompt = f"""Analyze this image and reverse-engineer the most likely source table used to create the chart.

Look for:
- Tables, leaderboards, rankings
- Charts or graphs (extract the underlying data)
- Statistics, scores, numbers with labels
- Any structured numerical data
{user_prompt_block}

Return ONLY valid JSON in this exact format (no markdown, no explanation):
{{
  "labels": ["label1", "label2", ...],
  "series": [
    {{"name": "Series Name", "data": [num1 | null, num2 | null, ...], "confidence": [0.0-1.0 | null, ...]}}
  ],
  "suggestedTitle": "A title for the chart",
  "suggestedType": "bar" | "line" | "area" | "pie" | "radar" | "scatter" | "table",
  "stacked": true | false,
  "barLayout": "horizontal" | "vertical",
  "xAxisLabel": "Label for the x-axis (if visible)",
  "yAxisLabel": "Label for the y-axis (if visible)",
  "aiReasoning": "Brief explanation (1-3 sentences) of how you reconstructed the table"
}}

Rules:
- labels array must match the length of each data array
- Data values must be numbers or null (convert scores like "-27" to -27)
- confidence is optional; when present it must align with labels and data lengths
- confidence values must be between 0 and 1 (higher = more certain)
- If there are multiple numeric columns, create multiple series
- Choose suggestedType based on the data (rankings = table, trends = line, comparisons = bar, etc.)
- If you can't find chartable data, return: {{"error": "No chartable data found"}}
- Extract the PRIMARY PLOTTED DATA — bar heights, line points, area values. Use annotations/callouts to help infer row labels or context, and summarize that in aiReasoning.
- Preserve the original axis orientation — if the x-axis shows time periods (years, dates, quarters, months), those MUST become the labels[] array. Categories or groups become separate series. Never pivot time values into series names.
- If the chart has a time-based x-axis (years, months, dates), labels MUST be the time values and each category/group must be a separate series.
- Recognize chart structure — for stacked or grouped bar charts, each color/segment = a series, each x-axis position = a label. Estimate segment values from visual proportions if exact numbers aren't labeled.
- Set "stacked" to true if the bars are stacked on top of each other, false if they are grouped side-by-side or not applicable.
- Never fabricate missing history. If a series is not visibly plotted for some labels, use null for those labels (not 0 and not inferred values).
- Use 0 only when the plotted mark is visibly at the zero baseline.
- Be conservative: when uncertain between a specific value and missing, use null.
- IMPORTANT: Always assign axis labels SEMANTICALLY, not positionally:
  - "xAxisLabel" must describe the CATEGORIES (what each bar/point represents)
  - "yAxisLabel" must describe the NUMERICAL VALUES (what is being measured)
  - If the source is a horizontal bar chart (bars extending left-to-right), the visual y-axis shows categories but that label goes in "xAxisLabel", and the visual x-axis shows values but that label goes in "yAxisLabel".
- If the source chart has horizontal bars (bars extending left-to-right), set "barLayout" to "horizontal". Otherwise set "barLayout" to "vertical".
- aiReasoning must be concise and user-facing. Do not include step-by-step internal thinking."""

    # Decode base64 to bytes for the new API
    image_bytes = base64.b64decode(image_base64)

    response = client.models.generate_content(
        model=MODEL_NAME,
        contents=[
            prompt,
            types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
        ],
    )

    content = response.text
    if not content:
        raise ValueError("No response from vision API")

    # Parse JSON response
    clean_content = content.replace("```json\n", "").replace("\n```", "").replace("```", "").strip()
    parsed = json.loads(clean_content)

    if "error" in parsed:
        raise ValueError(parsed["error"])

    if not parsed.get("labels") or not parsed.get("series"):
        raise ValueError("Invalid data structure returned")

    labels = parsed.get("labels", [])
    series_list = parsed.get("series", [])
    if not isinstance(labels, list) or not isinstance(series_list, list):
        raise ValueError("Invalid data structure returned")

    # Coerce labels to strings — Gemini sometimes returns numeric labels as ints
    parsed["labels"] = [str(label) for label in labels]
    label_count = len(parsed["labels"])

    # Normalize/validate series data:
    # - preserve null for unknown points
    # - coerce numeric strings to float
    # - normalize optional confidence (0..1) per point
    # - pad/truncate to labels length
    normalized_series = []
    for series in series_list:
        if not isinstance(series, dict):
            continue
        name = str(series.get("name") or "Series")
        raw_data = series.get("data") or []
        raw_confidence = series.get("confidence") or []
        if not isinstance(raw_data, list):
            raw_data = []
        if not isinstance(raw_confidence, list):
            raw_confidence = []

        normalized_data: List[Optional[float]] = []
        normalized_confidence: List[Optional[float]] = []
        for idx in range(label_count):
            value = raw_data[idx] if idx < len(raw_data) else None
            if value is None:
                normalized_data.append(None)
            elif isinstance(value, (int, float)):
                normalized_data.append(float(value))
            elif isinstance(value, str):
                cleaned = value.strip().replace(",", "")
                if cleaned.lower() in {"", "na", "n/a", "null", "none", "missing", "-", "—"}:
                    normalized_data.append(None)
                else:
                    try:
                        normalized_data.append(float(cleaned))
                    except ValueError:
                        normalized_data.append(None)
            else:
                normalized_data.append(None)

            conf = raw_confidence[idx] if idx < len(raw_confidence) else None
            if normalized_data[idx] is None or conf is None:
                normalized_confidence.append(None)
                continue

            if isinstance(conf, (int, float)):
                normalized_confidence.append(max(0.0, min(1.0, float(conf))))
                continue
            if isinstance(conf, str):
                conf_cleaned = conf.strip()
                if conf_cleaned.lower() in {"", "na", "n/a", "null", "none", "missing", "-", "—"}:
                    normalized_confidence.append(None)
                    continue
                try:
                    parsed_conf = float(conf_cleaned)
                    # Permit both 0..1 and 0..100 scales from model output.
                    if parsed_conf > 1.0:
                        parsed_conf = parsed_conf / 100.0
                    normalized_confidence.append(max(0.0, min(1.0, parsed_conf)))
                    continue
                except ValueError:
                    normalized_confidence.append(None)
                    continue
            normalized_confidence.append(None)

        series_payload: Dict[str, Any] = {"name": name, "data": normalized_data}
        if any(c is not None for c in normalized_confidence):
            series_payload["confidence"] = normalized_confidence
        normalized_series.append(series_payload)

    if not normalized_series:
        raise ValueError("No valid series returned from image analysis")

    parsed["series"] = normalized_series

    return parsed


async def chat_with_chart(
    message: str,
    current_data: Dict[str, Any],
    current_config: Dict[str, Any],
    chat_history: List[Dict[str, str]],
) -> Dict[str, Any]:
    """Process a chat message about chart data."""
    client = get_client()

    # Calculate stats
    stats = []
    for series in current_data.get("series", []):
        data = series.get("data", [])
        numeric_points = [(idx, float(v)) for idx, v in enumerate(data) if isinstance(v, (int, float))]
        if numeric_points:
            numeric_values = [v for _, v in numeric_points]
            sum_val = sum(numeric_values)
            avg = sum_val / len(numeric_values)
            min_val = min(numeric_values)
            max_val = max(numeric_values)
            min_idx = next((idx for idx, v in numeric_points if v == min_val), 0)
            max_idx = next((idx for idx, v in numeric_points if v == max_val), 0)
            labels = current_data.get("labels", [])
            stats.append({
                "name": series.get("name"),
                "sum": round(sum_val, 2),
                "average": round(avg, 2),
                "min": min_val,
                "max": max_val,
                "minLabel": labels[min_idx] if min_idx < len(labels) else None,
                "maxLabel": labels[max_idx] if max_idx < len(labels) else None,
                "count": len(numeric_values),
                "missingCount": max(0, len(data) - len(numeric_values)),
            })

    recent_history = chat_history[-6:] if chat_history else []
    history_text = ""
    if recent_history:
        history_text = "\nRECENT CONVERSATION:\n" + "\n".join(
            f"{m['role']}: {m['content']}" for m in recent_history
        ) + "\n"

    prompt = f"""You are an AI data analyst and visualization assistant. You can:

1. **Answer questions about the data** - Analyze trends, find insights, compare values, identify patterns
2. **Modify the underlying data** - Add columns, compute values, rename series, filter data, add summary rows
3. **Modify chart settings** - Change chart type, colors, style, toggles, title

CURRENT DATA:
- Labels: {json.dumps(current_data.get('labels', []))}
- Series: {json.dumps([{{'name': s.get('name'), 'data': s.get('data')}} for s in current_data.get('series', [])])}

PRE-COMPUTED STATS:
{json.dumps(stats, indent=2)}

CURRENT CONFIG:
- Type: {current_config.get('type')}
- Color Scheme: {current_config.get('colorScheme')}
- Style: {current_config.get('styleVariant')}
- Title: {current_config.get('title') or '(none)'}
- Show Grid: {current_config.get('showGrid')}, Legend: {current_config.get('showLegend')}, Values: {current_config.get('showValues')}, Stacked: {current_config.get('stacked', False)}
- Bar Layout: {current_config.get('barLayout', 'vertical')}

Available chart types: bar, line, area, pie, radar, scatter, table
Available color schemes: default, cool, warm, editorial, monochrome, muted
Available styles: professional, playful, editorial, minimalist, bold
{history_text}
USER MESSAGE: {message}

Respond with JSON only (no markdown):
{{
  "message": "Your response - answer questions conversationally, explain changes you made, or provide insights",
  "intent": "question" | "modification" | "both",
  "dataChanges": {{
    "labels": ["new", "labels"] | null,
    "series": [{{"name": "Series Name", "data": [1,2,3]}}] | null,
    "newColumns": [{{"name": "Total", "formula": "sum"}}] | null
  }},
  "configChanges": {{
    "type": "bar" | null,
    "colorScheme": "warm" | null,
    "styleVariant": "bold" | null,
    "title": "New Title" | null,
    "showGrid": true | null,
    "showLegend": true | null,
    "showValues": true | null,
    "stacked": true | null,
    "barLayout": "horizontal" | "vertical" | null
  }},
  "reasoning": "Brief explanation (only for modifications)"
}}

Guidelines:
- Set intent to "question" if the user is asking about their data (no changes needed)
- Set intent to "modification" if the user wants to change something
- Set intent to "both" if answering a question AND making changes
- For questions: provide insightful, specific answers using the actual data values
- For modifications: only include fields you're changing (use null or omit unchanged fields)
- For newColumns with formula "sum", calculate the sum across all numeric series for each row
- For newColumns with formula "average", calculate the average across all numeric series
- Be conversational, specific, and reference actual values from the data
- If the request is unclear, ask for clarification"""

    response = client.models.generate_content(
        model=MODEL_NAME,
        contents=prompt,
    )
    content = response.text

    if not content:
        raise ValueError("No response from AI")

    # Parse response
    clean_content = content.replace("```json\n", "").replace("\n```", "").replace("```", "").strip()

    try:
        parsed = json.loads(clean_content)
    except json.JSONDecodeError:
        return {
            "message": content,
            "updatedData": None,
            "updatedConfig": None,
            "changes": {
                "dataModified": False,
                "configModified": False,
                "summary": "Response received",
            },
        }

    # Process data changes
    updated_data = None
    data_modified = False

    if parsed.get("dataChanges"):
        data_changes = parsed["dataChanges"]
        updated_data = dict(current_data)

        if data_changes.get("labels"):
            updated_data["labels"] = data_changes["labels"]
            data_modified = True

        if data_changes.get("series"):
            updated_data["series"] = data_changes["series"]
            data_modified = True

        if data_changes.get("newColumns"):
            for col in data_changes["newColumns"]:
                new_data = []
                labels = current_data.get("labels", [])
                series = current_data.get("series", [])

                for i in range(len(labels)):
                    values = []
                    for s in series:
                        series_data = s.get("data", [])
                        if i < len(series_data):
                            value = series_data[i]
                            if isinstance(value, (int, float)):
                                values.append(float(value))
                    formula = col.get("formula", "sum")

                    if formula == "sum":
                        new_data.append(sum(values))
                    elif formula in ("average", "avg"):
                        new_data.append(sum(values) / len(values) if values else 0)
                    elif formula == "min":
                        new_data.append(min(values) if values else 0)
                    elif formula == "max":
                        new_data.append(max(values) if values else 0)
                    else:
                        new_data.append(sum(values))

                if "series" not in updated_data:
                    updated_data["series"] = list(series)
                updated_data["series"].append({"name": col["name"], "data": new_data})
                data_modified = True

    # Process config changes
    updated_config = None
    config_modified = False

    if parsed.get("configChanges"):
        config_changes = parsed["configChanges"]
        updated_config = {}

        for key in ["type", "colorScheme", "styleVariant", "title", "showGrid", "showLegend", "showValues", "animate", "stacked", "barLayout"]:
            if config_changes.get(key) is not None:
                updated_config[key] = config_changes[key]
                config_modified = True

    change_summary = []
    if data_modified:
        change_summary.append("data updated")
    if config_modified:
        change_summary.append("chart settings changed")

    return {
        "message": parsed.get("message", ""),
        "updatedData": updated_data if data_modified else None,
        "updatedConfig": updated_config if config_modified else None,
        "changes": {
            "dataModified": data_modified,
            "configModified": config_modified,
            "summary": ", ".join(change_summary) if change_summary else "no changes made",
        },
    }


async def recommend_chart_type(
    data: Dict[str, Any],
    preferred_type: Optional[str] = None,
    user_prompt: Optional[str] = None,
) -> Dict[str, str]:
    """Recommend the best chart type for the given data."""
    client = get_client()

    labels = data.get("labels", [])
    series = data.get("series", [])
    categorical_columns = data.get("categoricalColumns", [])

    data_description = {
        "labels": labels,
        "xAxisType": data.get("xAxisType"),
        "xAxisLabel": data.get("xAxisLabel"),
        "yAxisLabel": data.get("yAxisLabel"),
        "categoricalColumns": [
            {
                "name": column.get("name"),
                "sampleData": column.get("data", [])[:10],
            }
            for column in categorical_columns
            if isinstance(column, dict)
        ],
        "series": [
            {
                "name": s.get("name"),
                "sampleData": s.get("data", [])[:10],
                "min": min([float(v) for v in s.get("data", []) if isinstance(v, (int, float))], default=0),
                "max": max([float(v) for v in s.get("data", []) if isinstance(v, (int, float))], default=0),
                "count": len([v for v in s.get("data", []) if isinstance(v, (int, float))]),
                "missingCount": len([v for v in s.get("data", []) if v is None]),
            }
            for s in series
        ],
        "labelCount": len(labels),
        "seriesCount": len(series),
    }

    preferred_type_line = (
        f"Preferred chart type: {preferred_type} (use this type and justify it)"
        if preferred_type
        else "No preferred chart type provided"
    )

    user_prompt_line = (
        f"\nUser instructions: {user_prompt}\nConsider these instructions when analyzing the data and making your recommendation."
        if user_prompt
        else ""
    )

    prompt = f"""You are a data visualization expert and analyst. Analyze the provided data and recommend the best chart type. Consider:
- Data relationships and patterns
- Number of data points and series
- Whether labels are categorical, temporal, or ordinal
- What story the data is trying to tell
- Readability and clarity for the end user

Available chart types: bar, line, area, pie, radar, scatter, table
{preferred_type_line}{user_prompt_line}

Respond with JSON only (no markdown):
{{
  "type": "chartType",
  "reasoning": "A clear 1-2 sentence explanation of why this chart type is best for this data",
  "summary": "3-5 sentences that: (1) highlight the most interesting pattern, (2) explain why it matters, (3) note any bias or potential chart crime, and (4) state what the data does not answer"
}}

Analyze this data and recommend the best chart type:

{json.dumps(data_description, indent=2)}"""

    response = client.models.generate_content(
        model=MODEL_NAME,
        contents=prompt,
    )
    content = response.text

    if not content:
        raise ValueError("No response from AI")

    try:
        clean_content = content.replace("```json\n", "").replace("\n```", "").replace("```", "").strip()
        parsed = json.loads(clean_content)

        resolved_type = preferred_type or parsed.get("type", "table")

        valid_types = ["bar", "line", "area", "pie", "radar", "scatter", "table"]
        if resolved_type not in valid_types:
            resolved_type = "table"

        return {
            "type": resolved_type,
            "reasoning": parsed.get("reasoning", "AI recommendation based on data analysis."),
            "summary": parsed.get("summary", "Summary unavailable for this dataset."),
        }
    except json.JSONDecodeError:
        return {
            "type": "table",
            "reasoning": "Default recommendation for flexible data viewing.",
            "summary": "Summary unavailable for this dataset.",
        }


async def generate_chart_from_prompt(prompt: str) -> Dict[str, Any]:
    """Generate chart data from a natural language prompt.

    Pipeline:
    1) Try real-data research providers (FRED, BigQuery public datasets)
    2) Plan the most useful output shape
    3) Generate + self-critique/repair
    4) Apply lightweight explicit-fact guardrails
    """
    # First pass: attempt grounded research from external datasets.
    researched = await research_chart_from_prompt(prompt)
    if researched and researched.get("labels") and researched.get("series"):
        return normalize_chart_semantics(researched, prompt)

    # Second pass: orchestration + generation.
    plan = await _plan_prompt_output(prompt)
    year_window = _extract_relative_year_window(prompt, date.today())
    candidate = await _generate_candidate_from_plan(prompt, plan, year_window=year_window)
    reviewed = await _self_critique_candidate(prompt, plan, candidate, year_window=year_window)

    # One retry with strict temporal anchoring for relative-year prompts.
    if year_window:
        reviewed_labels = [str(label) for label in reviewed.get("labels", [])]
        needs_retry = (
            not _labels_match_year_window(reviewed_labels, year_window)
            or _has_missing_series_points(reviewed)
        )
        if needs_retry:
            retry_candidate = await _generate_candidate_from_plan(
                prompt,
                plan,
                year_window=year_window,
                force_year_window=True,
                force_full_coverage=True,
            )
            reviewed = await _self_critique_candidate(
                prompt,
                plan,
                retry_candidate,
                year_window=year_window,
                require_full_coverage=True,
            )
    guarded = _apply_explicit_fact_guardrails(plan, reviewed)

    if "error" in guarded:
        raise ValueError(guarded["error"])
    if not guarded.get("labels") or not guarded.get("series"):
        raise ValueError("Invalid data structure returned")

    labels = [str(label) for label in guarded.get("labels", [])]
    label_count = len(labels)
    series_list = guarded.get("series", [])
    normalized_series: List[Dict[str, Any]] = []
    for raw_series in series_list:
        if not isinstance(raw_series, dict):
            continue
        name = str(raw_series.get("name") or "Series")
        raw_data = raw_series.get("data")
        if not isinstance(raw_data, list):
            raw_data = []

        normalized_data: List[Optional[float]] = []
        for idx in range(label_count):
            value = raw_data[idx] if idx < len(raw_data) else None
            normalized_data.append(_coerce_numeric_value(value))
        normalized_series.append({"name": name, "data": normalized_data})

    if not normalized_series:
        raise ValueError("Invalid data structure returned")

    guarded["labels"] = labels
    guarded["series"] = normalized_series
    return normalize_chart_semantics(guarded, prompt)


# Color palettes matching the frontend
COLOR_PALETTES = {
    "default": ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"],
    "warm": ["#f97316", "#ef4444", "#ec4899", "#f59e0b", "#eab308", "#84cc16"],
    "cool": ["#3b82f6", "#06b6d4", "#8b5cf6", "#6366f1", "#0ea5e9", "#14b8a6"],
    "editorial": ["#1a1a2e", "#16213e", "#0f3460", "#e94560", "#533483", "#4a0e4e"],
    "monochrome": ["#18181b", "#3f3f46", "#52525b", "#71717a", "#a1a1aa", "#d4d4d8"],
    "muted": ["#78716c", "#a8a29e", "#64748b", "#94a3b8", "#6b7280", "#9ca3af"],
}


async def generate_infographic(
    data: Dict[str, Any],
    title: str,
    color_scheme: str,
    theme: str = "dark",
    source_image_base64: Optional[str] = None,
    source_image_mime_type: Optional[str] = None,
    ai_mode: str = "infographic",
    custom_prompt: Optional[str] = None,
) -> str:
    """Generate an SVG visualization for the given data.

    ai_mode can be:
    - 'chart': AI-enhanced chart (clean data visualization)
    - 'infographic': Visual infographic design (more creative)
    - 'custom': Use custom_prompt for generation guidance
    """
    max_reference_image_bytes = 2_000_000

    colors = COLOR_PALETTES.get(color_scheme, COLOR_PALETTES["default"])

    labels = data.get("labels", [])
    series = data.get("series", [])

    data_json = json.dumps(
        {
            "labels": labels,
            "series": [
                {"name": s.get("name"), "data": s.get("data", [])}
                for s in series
            ],
        },
        indent=2,
    )

    theme_colors = {
        "light": {
            "background": "#ffffff",
            "primaryText": "#0f172a",
            "secondaryText": "#64748b",
        },
        "dark": {
            "background": "#0a0a0f",
            "primaryText": "#f0f0f5",
            "secondaryText": "#8888a0",
        },
    }.get(theme, {
        "background": "#0a0a0f",
        "primaryText": "#f0f0f5",
        "secondaryText": "#8888a0",
    })

    image_guidance = ""
    if source_image_base64 and source_image_mime_type:
        image_guidance = """
REFERENCE IMAGE: A source image is attached. Use it ONLY as a loose visual reference for layout inspiration. Do NOT copy text, labels, or values from the image. The JSON data below is the ONLY source of truth for all numbers and labels."""

    # Customize prompt based on AI mode
    if ai_mode == "chart":
        mode_guidance = """STYLE: Create a clean, professional chart visualization. Focus on clarity and readability.
- Use simple, elegant chart elements (bars, lines, areas)
- Prioritize data accuracy and legibility
- Minimal decorative elements
- Professional, publication-ready appearance"""
    elif ai_mode == "custom" and custom_prompt:
        mode_guidance = f"""USER INSTRUCTIONS: {custom_prompt}

Follow these instructions while ensuring all data is accurately represented."""
    else:  # infographic (default)
        mode_guidance = """STYLE: Create a visually engaging infographic design.
- Use creative layouts and visual metaphors
- Add icons or simple illustrations where appropriate
- Make it visually memorable and shareable
- Balance aesthetics with data clarity"""

    prompt = f"""You are an expert data visualization designer. Create a clean, polished SVG visualization.

{mode_guidance}

STRICT RULES:
1. Use FLAT 2D design only. No 3D effects, no isometric perspective, no skewing, no perspective transforms.
2. The title "{title or 'Data Visualization'}" must appear EXACTLY ONCE at the top of the SVG. Do not repeat it.
3. Every data value from the JSON must be represented accurately. Do not invent or omit data.
4. All text must be horizontal and legible (minimum 14px for labels, 20px for title).
5. Use clean geometric shapes: rectangles, circles, arcs, lines. No organic/blob shapes.
6. Fixed viewBox="0 0 1600 1200". The SVG must be self-contained with no external dependencies.
7. Use font-family 'Manrope', sans-serif for ALL text elements.
8. Every numeric SVG attribute MUST be a final numeric literal (e.g., y="742.5"). Never output arithmetic expressions like y="800 - (x * 3)" or height="value * scale".

LAYOUT GUIDELINES:
- Title at top (28-36px, bold, color: {theme_colors["primaryText"]})
- Clear visual hierarchy: title > data values > labels > secondary info
- Use one of these layouts: horizontal bars, vertical bars, donut/ring chart, proportional circles, icon array, or grid cards
- Include a subtle legend if there are multiple series
- Add adequate spacing between elements (no cramped layouts)

COLOR PALETTE (use these exact colors in order):
{chr(10).join(f"  {i + 1}. {c}" for i, c in enumerate(colors))}

THEME: {theme.upper()} MODE
- Background: {theme_colors["background"]}
- Primary text: {theme_colors["primaryText"]}
- Secondary text: {theme_colors["secondaryText"]}
- Use the palette colors above for data elements (bars, segments, circles, etc.)
- Subtle gradients within palette colors are OK, but keep them flat (no 3D shading)
{image_guidance}

DATA (use this as the ONLY source of truth):
{data_json}

Return ONLY valid SVG code. No markdown, no explanation, no code blocks. Start with <svg and end with </svg>."""

    model_contents: Any = prompt
    reference_image_attached = False
    if source_image_base64 and source_image_mime_type:
        try:
            image_bytes = base64.b64decode(source_image_base64, validate=True)
            if len(image_bytes) > max_reference_image_bytes:
                logger.info(
                    "Skipping reference image for infographic generation: image too large (%s bytes)",
                    len(image_bytes),
                )
            else:
                model_contents = [
                    prompt,
                    types.Part.from_bytes(data=image_bytes, mime_type=source_image_mime_type),
                ]
                reference_image_attached = True
        except Exception as e:
            logger.warning("Skipping reference image for infographic generation: %s", e)

    started_at = time.monotonic()
    logger.info(
        "Infographic model request started model=%s mode=%s labels=%s series=%s reference_image=%s timeout_seconds=%s",
        MODEL_NAME,
        ai_mode,
        len(labels),
        len(series),
        reference_image_attached,
        INFOGRAPHIC_MODEL_TIMEOUT_SECONDS,
    )

    try:
        client = get_client()
        response = await asyncio.wait_for(
            client.aio.models.generate_content(
                model=MODEL_NAME,
                contents=model_contents,
                config=types.GenerateContentConfig(
                    candidate_count=1,
                    temperature=0.25,
                    max_output_tokens=8192,
                    thinking_config=types.ThinkingConfig(thinking_level="minimal"),
                    http_options=types.HttpOptions(
                        timeout=int(INFOGRAPHIC_MODEL_TIMEOUT_SECONDS * 1000),
                    ),
                ),
            ),
            timeout=INFOGRAPHIC_MODEL_TIMEOUT_SECONDS + 2.0,
        )
        content = response.text
        if not content:
            raise ValueError("No response from AI")
        svg = extract_svg(content)
        logger.info(
            "Infographic model request completed elapsed_ms=%s svg_bytes=%s",
            round((time.monotonic() - started_at) * 1000),
            len(svg.encode("utf-8")),
        )
        return svg
    except Exception as exc:
        logger.warning(
            "Infographic model request failed; using deterministic fallback elapsed_ms=%s error_type=%s error=%s",
            round((time.monotonic() - started_at) * 1000),
            type(exc).__name__,
            exc,
            exc_info=True,
        )
        return build_fallback_infographic(data, title, colors, theme)


async def infer_brand_from_website(domain: str) -> Dict[str, Any]:
    """Analyze a website and extract brand colors, theme, and style.

    Uses Google's favicon service to get the logo, then analyzes it along with
    the domain name to infer brand colors and style preferences.
    """
    import httpx

    client = get_client()

    # Fetch the favicon at high resolution
    favicon_url = f"https://www.google.com/s2/favicons?domain={domain}&sz=128"

    try:
        async with httpx.AsyncClient() as http_client:
            response = await http_client.get(favicon_url)
            if response.status_code == 200:
                favicon_base64 = base64.b64encode(response.content).decode('utf-8')
                favicon_mime = response.headers.get('content-type', 'image/png')
            else:
                favicon_base64 = None
                favicon_mime = None
    except Exception as e:
        logger.warning(f"Failed to fetch favicon for {domain}: {e}")
        favicon_base64 = None
        favicon_mime = None

    prompt = f"""Analyze the brand identity for the website "{domain}".

Based on the domain name and logo image (if provided), extract the brand's visual identity.

Return ONLY valid JSON (no markdown):
{{
  "colors": ["#hex1", "#hex2", "#hex3", "#hex4", "#hex5"],
  "theme": "light" | "dark",
  "fontStyle": "modern" | "classic" | "playful" | "technical" | "elegant",
  "reasoning": "Brief explanation of why you chose these colors and style"
}}

Guidelines:
- "colors" should be 5 hex colors in order of importance:
  1. Primary brand color (most prominent in logo/brand)
  2. Secondary brand color
  3. Accent color
  4. Background color (for charts - usually dark or light neutral)
  5. Text color (contrasting with background)
- "theme" should be "dark" if the brand feels modern/tech/bold, "light" if it feels clean/minimal/corporate
- "fontStyle":
  - "modern": clean sans-serif, tech companies, startups
  - "classic": serif or traditional, established brands, finance
  - "playful": rounded, fun brands, consumer products
  - "technical": monospace vibes, developer tools, engineering
  - "elegant": refined, luxury, high-end services
- Extract colors directly from the logo if visible
- If the domain suggests a specific industry, consider typical color conventions
- Make educated guesses based on the domain name if no logo is available

Example for "notboring.co":
{{
  "colors": ["#FF6B35", "#1A1A2E", "#F5F5DC", "#0D0D0D", "#FAFAFA"],
  "theme": "dark",
  "fontStyle": "modern",
  "reasoning": "Not Boring is a tech/VC newsletter known for bold, energetic content. Orange represents energy and creativity, with dark backgrounds for a modern tech feel."
}}"""

    if favicon_base64 and favicon_mime:
        image_bytes = base64.b64decode(favicon_base64)
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=[
                prompt,
                types.Part.from_bytes(data=image_bytes, mime_type=favicon_mime),
            ],
        )
    else:
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=prompt,
        )

    content = response.text
    if not content:
        raise ValueError("No response from AI")

    clean_content = content.replace("```json\n", "").replace("\n```", "").replace("```", "").strip()
    parsed = json.loads(clean_content)

    # Validate colors are hex format
    colors = parsed.get("colors", [])
    validated_colors = []
    for color in colors:
        if isinstance(color, str) and color.startswith("#") and len(color) in (4, 7):
            validated_colors.append(color.upper())

    if len(validated_colors) < 5:
        # Pad with defaults if needed
        defaults = ["#6366F1", "#22C55E", "#F59E0B", "#0A0A0F", "#F0F0F5"]
        validated_colors.extend(defaults[len(validated_colors):5])

    return {
        "colors": validated_colors[:5],
        "theme": parsed.get("theme", "dark"),
        "fontStyle": parsed.get("fontStyle", "modern"),
        "reasoning": parsed.get("reasoning", ""),
    }
