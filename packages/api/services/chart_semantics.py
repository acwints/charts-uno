import math
import re
from typing import Any, Dict, List, Optional


_YEAR_FIELD_PATTERN = re.compile(r"^(?:calendar\s+|season\s+)?years?$", re.IGNORECASE)
_YEAR_LABEL_PATTERN = re.compile(r"^\d{4}$")


def _coerce_year(value: Any) -> Optional[int]:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        numeric = float(value)
    elif isinstance(value, str):
        try:
            numeric = float(value.strip().replace(",", ""))
        except ValueError:
            return None
    else:
        return None

    if not math.isfinite(numeric):
        return None
    year = int(numeric)
    if numeric != year or year < 1800 or year > 2100:
        return None
    return year


def _labels_are_years(labels: List[str]) -> bool:
    if not labels:
        return False
    return all(
        bool(_YEAR_LABEL_PATTERN.fullmatch(label.strip()))
        and 1800 <= int(label.strip()) <= 2100
        for label in labels
    )


def _strip_redundant_year(label: str, year: int) -> str:
    cleaned = re.sub(rf"\s*\(\s*{year}\s*\)\s*$", "", label).strip()
    return cleaned or label.strip()


def _normalize_categorical_columns(chart: Dict[str, Any], label_count: int) -> None:
    columns = chart.get("categoricalColumns")
    if not isinstance(columns, list):
        chart.pop("categoricalColumns", None)
        return

    normalized: List[Dict[str, Any]] = []
    for column in columns:
        if not isinstance(column, dict):
            continue
        name = str(column.get("name") or "Details").strip() or "Details"
        values = column.get("data")
        if not isinstance(values, list):
            values = column.get("values")
        if not isinstance(values, list):
            continue
        normalized_values = [str(value) if value is not None else "" for value in values[:label_count]]
        normalized_values.extend([""] * (label_count - len(normalized_values)))
        normalized.append({"name": name, "data": normalized_values})

    if normalized:
        chart["categoricalColumns"] = normalized
    else:
        chart.pop("categoricalColumns", None)


def _sort_aligned_rows_by_year(chart: Dict[str, Any], years: List[int]) -> None:
    order = sorted(range(len(years)), key=lambda index: years[index])
    chart["labels"] = [str(years[index]) for index in order]

    for entry in chart.get("series", []):
        if not isinstance(entry, dict):
            continue
        data = entry.get("data")
        if isinstance(data, list) and len(data) >= len(years):
            entry["data"] = [data[index] for index in order]
        confidence = entry.get("confidence")
        if isinstance(confidence, list) and len(confidence) >= len(years):
            entry["confidence"] = [confidence[index] for index in order]

    for column in chart.get("categoricalColumns", []):
        if not isinstance(column, dict):
            continue
        data = column.get("data")
        if isinstance(data, list) and len(data) >= len(years):
            column["data"] = [data[index] for index in order]


def _set_temporal_chart_defaults(chart: Dict[str, Any]) -> None:
    chart["xAxisType"] = "year"
    chart["xAxisLabel"] = "Year"
    chart["suggestedType"] = "line"
    chart.pop("barLayout", None)


def _detail_name(chart: Dict[str, Any], prompt: str) -> str:
    original_axis_label = str(chart.get("xAxisLabel") or "").strip()
    detail_name = original_axis_label if original_axis_label and original_axis_label.lower() != "year" else "Label"
    if detail_name == "Label":
        if re.search(r"\b(players?|golfers?)\b", prompt, re.IGNORECASE):
            return "Player"
        if re.search(r"\bwinners?\b", prompt, re.IGNORECASE):
            return "Winner"
    return detail_name


def _add_label_detail_column(
    chart: Dict[str, Any],
    labels: List[str],
    years: List[int],
    detail_name: str,
) -> None:
    detail_values = [
        _strip_redundant_year(label, years[index])
        for index, label in enumerate(labels)
    ]
    existing_columns = chart.get("categoricalColumns")
    if not isinstance(existing_columns, list):
        existing_columns = []
    has_detail_column = any(
        isinstance(column, dict) and str(column.get("name") or "").strip().lower() == detail_name.lower()
        for column in existing_columns
    )
    if not has_detail_column and any(value and value != str(year) for value, year in zip(detail_values, years)):
        chart["categoricalColumns"] = [
            {"name": detail_name, "data": detail_values},
            *existing_columns,
        ]


def normalize_chart_semantics(chart: Dict[str, Any], prompt: str = "") -> Dict[str, Any]:
    """Promote temporal fields into the chart's primary x-axis.

    Chart generators sometimes return a layout such as Winner + Year series +
    Score series. Plotting Year as a metric creates a misleading dual-scale
    chart and formats values like 1954 with locale grouping. This normalizer
    makes Year the x-axis, preserves the original entity labels as a
    categorical detail column, and leaves only actual measures as series.
    """
    labels = [str(value).strip() for value in chart.get("labels", [])]
    series = chart.get("series")
    if not labels or not isinstance(series, list):
        return chart

    _normalize_categorical_columns(chart, len(labels))

    if _labels_are_years(labels):
        label_years = [int(label) for label in labels]
        filtered_series = []
        for entry in series:
            if not isinstance(entry, dict) or not _YEAR_FIELD_PATTERN.fullmatch(str(entry.get("name") or "").strip()):
                filtered_series.append(entry)
                continue
            values = entry.get("data")
            years = [_coerce_year(value) for value in values[:len(labels)]] if isinstance(values, list) else []
            if len(years) != len(labels) or [str(year) for year in years] != labels:
                filtered_series.append(entry)
        if filtered_series:
            chart["series"] = filtered_series
        _set_temporal_chart_defaults(chart)
        _sort_aligned_rows_by_year(chart, label_years)
        if len(labels) >= 3 and chart.get("series"):
            chart["suggestedType"] = "line"
        return chart

    categorical_columns = chart.get("categoricalColumns")
    if isinstance(categorical_columns, list):
        for index, column in enumerate(categorical_columns):
            if not isinstance(column, dict):
                continue
            name = str(column.get("name") or "").strip()
            values = column.get("data")
            if not _YEAR_FIELD_PATTERN.fullmatch(name) or not isinstance(values, list) or len(values) < len(labels):
                continue
            years = [_coerce_year(value) for value in values[:len(labels)]]
            if not all(year is not None for year in years):
                continue
            temporal_years = [year for year in years if year is not None]
            chart["categoricalColumns"] = [
                entry for column_index, entry in enumerate(categorical_columns) if column_index != index
            ]
            _add_label_detail_column(chart, labels, temporal_years, _detail_name(chart, prompt))
            _set_temporal_chart_defaults(chart)
            _sort_aligned_rows_by_year(chart, temporal_years)
            if len(series) == 1 and not str(chart.get("yAxisLabel") or "").strip():
                chart["yAxisLabel"] = str(series[0].get("name") or "Value")
            return chart

    temporal_index: Optional[int] = None
    temporal_years: List[int] = []
    for index, entry in enumerate(series):
        if not isinstance(entry, dict):
            continue
        name = str(entry.get("name") or "").strip()
        values = entry.get("data")
        if not _YEAR_FIELD_PATTERN.fullmatch(name) or not isinstance(values, list):
            continue
        if len(values) < len(labels):
            continue
        years = [_coerce_year(value) for value in values[:len(labels)]]
        if all(year is not None for year in years):
            temporal_index = index
            temporal_years = [year for year in years if year is not None]
            break

    if temporal_index is None or len(series) <= 1:
        return chart

    _add_label_detail_column(chart, labels, temporal_years, _detail_name(chart, prompt))

    remaining_series = [entry for index, entry in enumerate(series) if index != temporal_index]
    chart["series"] = remaining_series
    _set_temporal_chart_defaults(chart)
    _sort_aligned_rows_by_year(chart, temporal_years)

    if len(remaining_series) == 1 and not str(chart.get("yAxisLabel") or "").strip():
        chart["yAxisLabel"] = str(remaining_series[0].get("name") or "Value")

    semantic_note = "Year was promoted to the temporal x-axis instead of being plotted as a numeric measure."
    existing_reasoning = str(chart.get("aiReasoning") or "").strip()
    if semantic_note not in existing_reasoning:
        chart["aiReasoning"] = f"{existing_reasoning} {semantic_note}".strip()
    return chart
