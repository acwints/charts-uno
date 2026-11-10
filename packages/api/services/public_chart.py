"""Public chart projections, separate from the owner's private editor document.

Only deliberately supported display fields cross this boundary. Adding an editor
field must not silently publish an upload, prompt, query, or provider response.
This is a privacy projection, not a claim that the data or its source is true.
"""
from __future__ import annotations

import math
from typing import Any
from urllib.parse import urlsplit, urlunsplit


def public_source_url(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    value = value.strip()
    if not value or any(ord(char) < 32 for char in value) or "\\" in value:
        return None
    try:
        url = urlsplit(value)
        if url.scheme.lower() not in {"http", "https"} or not url.hostname:
            return None
        if url.username is not None or url.password is not None:
            return None
        _ = url.port  # Reject malformed ports rather than returning unusable URLs.
        return urlunsplit((url.scheme.lower(), url.netloc, url.path, url.query, url.fragment))
    except ValueError:
        return None


def _object(value: Any) -> dict:
    return value if isinstance(value, dict) else {}


def _list(value: Any) -> list:
    return value if isinstance(value, list) else []


def _number(value: Any) -> int | float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    try:
        return value if math.isfinite(value) else None
    except OverflowError:
        return None


def _strings(source: dict, names: tuple[str, ...]) -> dict:
    return {key: source[key] for key in names if isinstance(source.get(key), str)}


def public_chart_data(value: Any) -> dict:
    source = _object(value)
    result = _strings(source, (
        "sourceType", "suggestedTitle", "suggestedType", "suggestedBarLayout",
        "xAxisLabel", "yAxisLabel", "xAxisType", "yAxisFormat", "yAxisPrefix",
        "yAxisSuffix", "mapScope",
    ))
    if isinstance(source.get("suggestedStacked"), bool):
        result["suggestedStacked"] = source["suggestedStacked"]
    result["labels"] = [label if isinstance(label, str) else "" for label in _list(source.get("labels"))]
    result["series"] = []
    for raw in _list(source.get("series")):
        item = _object(raw)
        if not isinstance(item.get("name"), str):
            continue
        series = {"name": item["name"], "data": [_number(number) for number in _list(item.get("data"))]}
        if isinstance(item.get("confidence"), list):
            series["confidence"] = [number if number is not None and 0 <= number <= 1 else None
                                    for number in map(_number, item["confidence"])]
        result["series"].append(series)
    if isinstance(source.get("categoricalColumns"), list):
        result["categoricalColumns"] = [
            {"name": item["name"], "data": [cell if isinstance(cell, str) else "" for cell in _list(item.get("data"))]}
            for item in source["categoricalColumns"] if isinstance(item, dict) and isinstance(item.get("name"), str)
        ]
    if isinstance(source.get("mapRegions"), list):
        result["mapRegions"] = [
            {"id": item["id"], "name": item["name"], "value": _number(item.get("value"))}
            for item in source["mapRegions"] if isinstance(item, dict)
            and isinstance(item.get("id"), str) and isinstance(item.get("name"), str)
            and _number(item.get("value")) is not None
        ]
    source_link = public_source_url(source.get("sourceLink"))
    if source_link:
        result["sourceLink"] = source_link
    if isinstance(source.get("sources"), list):
        result["sources"] = [
            {"title": item["title"], "url": url}
            for item in source["sources"] if isinstance(item, dict) and isinstance(item.get("title"), str)
            and (url := public_source_url(item.get("url")))
        ]
    return result


def public_chart_config(value: Any) -> dict:
    source = _object(value)
    result = _strings(source, (
        "type", "colorScheme", "styleVariant", "themeMode", "title", "barLayout",
        "yAxisBaselineMode", "mapVariant", "mapScope", "fillStyle", "backgroundPattern",
        "raceMark", "rightYAxisLabel", "rightYAxisPrefix", "rightYAxisSuffix",
    ))
    for key in ("showGrid", "showLegend", "showValues", "showPoints", "showBorder",
                "showAxisTitles", "showAxisLabels", "animate", "stacked", "glow",
                "raceHoldLast", "raceLoop"):
        if isinstance(source.get(key), bool):
            result[key] = source[key]
    for key in ("raceTopN", "raceFrameMs"):
        if (number := _number(source.get(key))) is not None:
            result[key] = number
    if isinstance(source.get("customColors"), dict):
        colors = source["customColors"]
        result["customColors"] = _strings(colors, ("background", "cardBackground", "text", "textMuted", "grid", "border"))
        if isinstance(colors.get("seriesColors"), list):
            result["customColors"]["seriesColors"] = [color for color in colors["seriesColors"] if isinstance(color, str)]
    if isinstance(source.get("seriesConfig"), dict):
        result["seriesConfig"] = {}
        for name, raw in source["seriesConfig"].items():
            if not isinstance(name, str) or not isinstance(raw, dict):
                continue
            entry = {}
            if raw.get("chartType") in ("bar", "line", "area"):
                entry["chartType"] = raw["chartType"]
            if raw.get("axis") in ("left", "right"):
                entry["axis"] = raw["axis"]
            if entry:
                result["seriesConfig"][name] = entry
    source_link = public_source_url(source.get("sourceLink"))
    if source_link:
        result["sourceLink"] = source_link
    return result
