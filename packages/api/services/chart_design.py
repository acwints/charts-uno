"""Decide how a dataset should be drawn.

This is the "think" step between extraction and rendering. The extractor
(image analysis, prompt generation, CSV) only has to get the numbers right;
this step looks at the whole dataset and chooses the chart: type, which
series are bars vs lines, which axis each series belongs on, stacking,
orientation, axis titles and number formats.

One model call with the full dataset. The prompt describes the job, not a
rule book; the model is trusted to design. Validation only guarantees the
answer is renderable, and a small scale heuristic covers the model being
unavailable.
"""
from __future__ import annotations

import json
import logging
import math
import re
from typing import Any, Dict, List, Optional

from services.blocking import generate_content
from services.model_config import MODEL_CHART

logger = logging.getLogger(__name__)

CHART_TYPES = {"bar", "line", "area", "pie", "radar", "scatter", "table", "race"}
COMBO_BASE_TYPES = {"bar", "line", "area"}
SERIES_TYPES = {"bar", "line", "area"}
AXES = {"left", "right"}
Y_FORMATS = {"currency", "percentage", "number"}
BAR_LAYOUTS = {"vertical", "horizontal"}

PERCENT_NAME = re.compile(
    r"%|\bpercent(age)?\b|\bpct\b|\bratio\b|\brate\b|\bshare\b|\bmargin\b|\byield\b|\bgrowth\b|"
    r"\bchange\b|\breturn\b|\bproportion\b|\bmix\b|\bpenetration\b|\bconversion\b|\butili[sz]ation\b|"
    r"\S\s*/\s*\S",
    re.IGNORECASE,
)


def _numbers(values: Any) -> List[float]:
    out: List[float] = []
    for value in values if isinstance(values, list) else []:
        if isinstance(value, bool):
            continue
        if isinstance(value, (int, float)) and math.isfinite(float(value)):
            out.append(float(value))
    return out


def _series_names(chart: Dict[str, Any]) -> List[str]:
    return [str(s.get("name") or "") for s in (chart.get("series") or []) if isinstance(s, dict)]


def heuristic_design(chart: Dict[str, Any]) -> Dict[str, Any]:
    """Fallback when the model is unavailable: separate wildly different scales.

    A series is sent to a right-hand line axis when its magnitude is at least
    50x smaller than the largest series, or when its name reads as a percentage
    or ratio and it sits inside -100..100 while another series does not.
    """
    base = chart.get("suggestedType") if chart.get("suggestedType") in COMBO_BASE_TYPES else "bar"
    series = [s for s in (chart.get("series") or []) if isinstance(s, dict)]
    stats = []
    for entry in series:
        nums = _numbers(entry.get("data"))
        abs_max = max((abs(v) for v in nums), default=0.0)
        stats.append({"name": str(entry.get("name") or ""), "abs_max": abs_max, "pct_name": bool(PERCENT_NAME.search(str(entry.get("name") or "")))})
    design: Dict[str, Any] = {"type": base, "series": [], "reasoning": "Scale-based fallback."}
    if len(stats) < 2:
        design["series"] = [{"name": s["name"], "chartType": None, "axis": "left"} for s in stats]
        return design
    largest = max(s["abs_max"] for s in stats)
    has_non_pct = any(not s["pct_name"] for s in stats)
    right: List[str] = []
    for s in stats:
        small_scale = largest > 0 and s["abs_max"] > 0 and largest / s["abs_max"] >= 50
        # A percentage/ratio beside a quantity is a different unit, whatever the magnitudes.
        pct_like = s["pct_name"] and has_non_pct and s["abs_max"] <= 1000
        if (small_scale or pct_like) and len(right) < len(stats) - 1:
            right.append(s["name"])
    design["series"] = [
        {"name": s["name"], "chartType": "line" if s["name"] in right else None, "axis": "right" if s["name"] in right else "left"}
        for s in stats
    ]
    if right:
        design["rightYAxisLabel"] = right[0] if len(right) == 1 else "Percentage"
        if all(bool(PERCENT_NAME.search(name)) for name in right):
            design["rightYAxisSuffix"] = "%"
    return design


def _clean(design: Any, chart: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Keep only a renderable design; return None if it is unusable."""
    if not isinstance(design, dict):
        return None
    names = _series_names(chart)
    chart_type = design.get("type")
    if chart_type not in CHART_TYPES:
        return None
    out: Dict[str, Any] = {"type": chart_type}
    for key in ("title", "xAxisLabel", "yAxisLabel", "rightYAxisLabel", "yAxisPrefix", "yAxisSuffix", "rightYAxisPrefix", "rightYAxisSuffix", "reasoning"):
        value = design.get(key)
        if isinstance(value, str) and value.strip():
            out[key] = value.strip()[:200]
    if design.get("yAxisFormat") in Y_FORMATS:
        out["yAxisFormat"] = design["yAxisFormat"]
    if design.get("barLayout") in BAR_LAYOUTS:
        out["barLayout"] = design["barLayout"]
    for key in ("stacked", "showValues"):
        if isinstance(design.get(key), bool):
            out[key] = design[key]
    cleaned_series: List[Dict[str, Any]] = []
    raw_series = design.get("series") if isinstance(design.get("series"), list) else []
    by_name = {str(s.get("name")): s for s in raw_series if isinstance(s, dict)}
    for name in names:
        entry = by_name.get(name, {})
        series_type = entry.get("chartType") if entry.get("chartType") in SERIES_TYPES else None
        axis = entry.get("axis") if entry.get("axis") in AXES else "left"
        cleaned_series.append({"name": name, "chartType": series_type, "axis": axis})
    # A combo only makes sense on a cartesian base type, and never with every series on the right.
    if chart_type not in COMBO_BASE_TYPES or all(s["axis"] == "right" for s in cleaned_series):
        for s in cleaned_series:
            s["axis"] = "left"
            if chart_type not in COMBO_BASE_TYPES:
                s["chartType"] = None
    out["series"] = cleaned_series
    return out


def _describe(chart: Dict[str, Any], intent: Optional[str]) -> str:
    payload = {
        "intent": intent or None,
        "labels": chart.get("labels") or [],
        "xAxisType": chart.get("xAxisType"),
        "xAxisLabel": chart.get("xAxisLabel"),
        "yAxisLabel": chart.get("yAxisLabel"),
        "yAxisFormat": chart.get("yAxisFormat"),
        "suggestedTitle": chart.get("suggestedTitle"),
        "extractorSuggestedType": chart.get("suggestedType"),
        "extractorReasoning": chart.get("aiReasoning"),
        "categoricalColumns": [
            {"name": c.get("name"), "data": (c.get("data") or [])[:60]}
            for c in chart.get("categoricalColumns") or [] if isinstance(c, dict)
        ],
        "series": [
            {"name": s.get("name"), "data": (s.get("data") or [])[:200]}
            for s in (chart.get("series") or []) if isinstance(s, dict)
        ],
    }
    return json.dumps(payload, ensure_ascii=False)


async def design_chart(chart: Dict[str, Any], intent: Optional[str] = None, client: Any = None) -> Dict[str, Any]:
    """Return a validated design for ``chart``. Never raises; falls back to the heuristic."""
    if client is None:
        from services.ai_service import get_client
        client = get_client()
    prompt = f"""You are the chart designer at a data-visualization studio. A dataset has been extracted and it is your job to decide how it should be drawn so a reader gets the point in one glance.

Think about what the numbers are (units, scales, whether they are counts, money, percentages, ratios), how they relate to each other, what the x-axis is (time, categories, ranking), and what the one obvious story is. Then decide the chart. You may put series on different axes and draw some as bars and others as lines when that is the honest way to show them together. Prefer the simplest chart that shows the story; a table is only right when the values are not comparable at all.

Return ONLY JSON:
{{
  "type": "bar" | "line" | "area" | "pie" | "radar" | "scatter" | "table" | "race",
  "title": "short chart title",
  "xAxisLabel": "string or null",
  "yAxisLabel": "left axis title including units, or null",
  "rightYAxisLabel": "right axis title including units, or null",
  "series": [{{"name": "exact series name", "chartType": "bar" | "line" | "area" | null, "axis": "left" | "right"}}],
  "stacked": true | false,
  "barLayout": "vertical" | "horizontal",
  "yAxisFormat": "currency" | "percentage" | "number" | null,
  "yAxisPrefix": "e.g. $ or null", "yAxisSuffix": "e.g. T or % or null",
  "rightYAxisPrefix": "or null", "rightYAxisSuffix": "or null",
  "showValues": true | false,
  "reasoning": "one sentence a reader would find convincing"
}}

Use "race" only for an ordered sequence with 3+ contenders whose ranking changes. Keep every series name exactly as given.

Dataset:
{_describe(chart, intent)}"""
    try:
        response = await generate_content(client, model=MODEL_CHART, contents=prompt, timeout=40.0)
        content = (response.text or "").replace("```json\n", "").replace("\n```", "").replace("```", "").strip()
        design = _clean(json.loads(content), chart)
        if design is not None:
            return design
        logger.warning("Chart design was not renderable; using heuristic")
    except Exception as exc:  # model outage, timeout, malformed JSON
        logger.warning("Chart design step failed (%s); using heuristic", exc)
    return heuristic_design(chart)


def apply_design(chart: Dict[str, Any], config: Dict[str, Any], design: Dict[str, Any]) -> None:
    """Write a design into the chart data + config dicts that get stored and rendered."""
    config["type"] = design["type"]
    if design.get("title"):
        config["title"] = design["title"]
        chart["suggestedTitle"] = design["title"]
    chart["suggestedType"] = design["type"]
    for key in ("xAxisLabel", "yAxisLabel", "yAxisFormat", "yAxisPrefix", "yAxisSuffix"):
        if design.get(key):
            chart[key] = design[key]
    if "stacked" in design:
        config["stacked"] = design["stacked"]
    if design.get("barLayout"):
        config["barLayout"] = design["barLayout"]
        chart["barLayout"] = design["barLayout"]
    if "showValues" in design:
        config["showValues"] = design["showValues"]
    if design.get("reasoning"):
        chart["designReasoning"] = design["reasoning"]
    overrides: Dict[str, Dict[str, str]] = {}
    for entry in design.get("series", []):
        override: Dict[str, str] = {}
        if entry.get("chartType") and entry["chartType"] != design["type"]:
            override["chartType"] = entry["chartType"]
        if entry.get("axis") == "right":
            override["axis"] = "right"
        if override:
            overrides[entry["name"]] = override
    if overrides:
        config["seriesConfig"] = overrides
        if design.get("rightYAxisLabel"):
            config["rightYAxisLabel"] = design["rightYAxisLabel"]
        for key in ("rightYAxisPrefix", "rightYAxisSuffix"):
            if design.get(key):
                config[key] = design[key]
    else:
        config.pop("seriesConfig", None)
        config.pop("rightYAxisLabel", None)
