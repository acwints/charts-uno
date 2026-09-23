"""
Code-driven population for leaderboard race charts, server side.

This is the Python counterpart of ``@chartsuno/shared``'s ``race.ts`` and holds
to the same semantics, so a race built by the API and one built in the browser
from the same rows come out identical. It exists because BigQuery results are
tidy rows — one per (entity, period, value) — and the existing wide conversion
would mangle them: the entity column becomes repeating labels and the period
column a series of zeros.

Rules this module holds to, matching the TypeScript builder:

- Pure and deterministic. Inputs are never mutated.
- Data problems are reported, not raised. Only impossible options raise.
- Periods are ordered by what they mean, so "Season 10" follows "Season 9" and
  "2019-Q4" precedes "2020-Q1".
- A finished entity holds its last standing rather than vanishing (fill="hold")
  unless told otherwise.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, Iterable, List, Mapping, Optional, Sequence, Tuple

AGGREGATES = {"sum", "mean", "min", "max", "count", "first", "last"}
ACCUMULATORS = {"none", "cumulative-sum", "cumulative-mean", "cumulative-max", "cumulative-min"}
FILLS = {"hold", "gap", "zero"}
LIMIT_MODES = {"ever-on-board", "final"}

_ORDINAL_LABEL = re.compile(
    r"^(?:s|season|e|ep|episode|w|week|d|day|q|quarter|r|round|game|match|year|yr|month|m|stage|lap|period|p)"
    r"\s*[-_]?\s*(\d+(?:\.\d+)?)$",
    re.IGNORECASE,
)
_YEAR_QUARTER = re.compile(r"^(\d{4})[\s-]*q([1-4])$", re.IGNORECASE)
_ID_HEADER = re.compile(r"(^|[_\s-])(id|key|code|uuid|slug)$", re.IGNORECASE)


def parse_ordinal(value: Any) -> Optional[float]:
    """Parse a label to a sortable number, or None when it carries no order."""
    text = str(value if value is not None else "").strip()
    if not text:
        return None

    match = _ORDINAL_LABEL.match(text)
    if match:
        return float(match.group(1))

    try:
        return float(text.replace(",", ""))
    except ValueError:
        pass

    match = _YEAR_QUARTER.match(text)
    if match:
        return float(match.group(1)) * 4 + float(match.group(2))

    for fmt in ("%Y-%m-%d", "%Y-%m", "%Y/%m/%d", "%d %b %Y", "%b %Y", "%B %Y", "%Y-%m-%dT%H:%M:%S"):
        try:
            return datetime.strptime(text, fmt).timestamp()
        except ValueError:
            continue
    return None


def to_number(value: Any) -> Optional[float]:
    """Lenient numeric parse: currency symbol, thousands separators, percent."""
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value) if value == value and value not in (float("inf"), float("-inf")) else None
    if not isinstance(value, str):
        return None
    cleaned = re.sub(r"^[$€£¥]", "", value.strip())
    cleaned = re.sub(r"[,%\s]", "", cleaned)
    if not cleaned:
        return None
    try:
        return float(cleaned)
    except ValueError:
        return None


def order_periods(periods: Iterable[Any]) -> Tuple[List[str], str]:
    """Order by meaning when every period parses, else by first appearance."""
    unique: List[str] = []
    seen = set()
    for period in periods:
        text = str(period)
        if text not in seen:
            seen.add(text)
            unique.append(text)

    parsed = [(period, parse_ordinal(period)) for period in unique]
    if unique and all(rank is not None for _, rank in parsed):
        ordered = [period for period, _ in sorted(parsed, key=lambda item: (item[1], unique.index(item[0])))]
        return ordered, "inferred-ordinal"
    return unique, "inferred-first-seen"


def _aggregate(values: Sequence[float], how: str) -> float:
    if how == "mean":
        return sum(values) / len(values)
    if how == "min":
        return min(values)
    if how == "max":
        return max(values)
    if how == "count":
        return float(len(values))
    if how == "first":
        return values[0]
    if how == "last":
        return values[-1]
    return float(sum(values))


@dataclass
class RaceReport:
    rows_read: int = 0
    rows_used: int = 0
    dropped: Dict[str, int] = field(default_factory=dict)
    periods: int = 0
    period_order: str = "inferred-ordinal"
    entities_read: int = 0
    entities_kept: int = 0
    entities_below_min_periods: List[str] = field(default_factory=list)
    entities_over_limit: List[str] = field(default_factory=list)
    cells_filled: int = 0
    warnings: List[str] = field(default_factory=list)

    def as_dict(self) -> Dict[str, Any]:
        return {
            "rowsRead": self.rows_read,
            "rowsUsed": self.rows_used,
            "dropped": dict(self.dropped),
            "periods": self.periods,
            "periodOrder": self.period_order,
            "entitiesRead": self.entities_read,
            "entitiesKept": self.entities_kept,
            "entitiesBelowMinPeriods": list(self.entities_below_min_periods),
            "entitiesOverLimit": list(self.entities_over_limit),
            "cellsFilled": self.cells_filled,
            "warnings": list(self.warnings),
        }


def _validate(
    aggregate: str, accumulate: str, fill: str, limit: Optional[int], limit_mode: str, min_periods: int
) -> None:
    if aggregate not in AGGREGATES:
        raise ValueError(f'Unknown race aggregate "{aggregate}"')
    if accumulate not in ACCUMULATORS:
        raise ValueError(f'Unknown race accumulator "{accumulate}"')
    if fill not in FILLS:
        raise ValueError(f'Unknown race fill "{fill}"')
    if limit_mode not in LIMIT_MODES:
        raise ValueError(f'Unknown race limit mode "{limit_mode}"')
    if limit is not None and (not isinstance(limit, int) or isinstance(limit, bool) or limit < 1):
        raise ValueError(f"Race limit must be a positive integer, got {limit!r}")
    if not isinstance(min_periods, int) or isinstance(min_periods, bool) or min_periods < 0:
        raise ValueError(f"Race min_periods must be a non-negative integer, got {min_periods!r}")


def _final_value(data: Sequence[Optional[float]]) -> float:
    for value in reversed(data):
        if value is not None:
            return value
    return float("-inf")


def _ever_on_board(series: List[Dict[str, Any]], limit: int) -> set:
    keep: set = set()
    period_count = len(series[0]["data"]) if series else 0
    for index in range(period_count):
        ranked = sorted(
            ((entry["name"], entry["data"][index]) for entry in series if entry["data"][index] is not None),
            key=lambda item: -item[1],
        )
        for name, _ in ranked[:limit]:
            keep.add(name)
    return keep


def build_race(
    rows: Iterable[Mapping[str, Any]],
    *,
    entity: str = "entity",
    period: str = "period",
    value: str = "value",
    aggregate: str = "sum",
    accumulate: str = "none",
    fill: str = "hold",
    limit: Optional[int] = None,
    limit_mode: str = "ever-on-board",
    min_periods: int = 0,
    period_order: Optional[Sequence[str]] = None,
    format_period=None,
) -> Tuple[Dict[str, Any], RaceReport]:
    """
    Build race-ready chart data from tidy rows.

    Returns ``({"labels": [...], "series": [{"name", "data"}, ...], "suggestedType": "race"}, report)``.
    Labels are the ordered periods; each series is one entity, which is the
    orientation the race renderer reads directly.
    """
    _validate(aggregate, accumulate, fill, limit, limit_mode, min_periods)
    rows = list(rows)
    report = RaceReport(rows_read=len(rows))

    def drop(reason: str) -> None:
        report.dropped[reason] = report.dropped.get(reason, 0) + 1

    if period_order is not None:
        periods = list(period_order)
        if len(set(periods)) != len(periods):
            raise ValueError("Race period_order contains duplicate periods")
        report.period_order = "given"
    else:
        periods, report.period_order = order_periods(row.get(period) for row in rows if row.get(period) is not None)
        if report.period_order == "inferred-first-seen" and len(periods) > 1:
            report.warnings.append(
                "Period labels do not all carry an order, so they are in first-seen order. Pass period_order to be explicit."
            )
    period_index = {label: index for index, label in enumerate(periods)}

    cells: Dict[str, Dict[int, List[float]]] = {}
    entity_order: List[str] = []
    for row in rows:
        name = str(row.get(entity) if row.get(entity) is not None else "").strip()
        if not name:
            drop("missing-entity")
            continue
        label = str(row.get(period) if row.get(period) is not None else "")
        if not label.strip():
            drop("missing-period")
            continue
        index = period_index.get(label)
        if index is None:
            drop("period-not-in-order")
            continue
        number = to_number(row.get(value))
        if number is None:
            drop("non-numeric-value")
            continue
        by_period = cells.setdefault(name, {})
        if name not in entity_order:
            entity_order.append(name)
        by_period.setdefault(index, []).append(number)
        report.rows_used += 1

    series: List[Dict[str, Any]] = []
    for name in entity_order:
        by_period = cells[name]
        if len(by_period) < min_periods:
            report.entities_below_min_periods.append(name)
            continue

        data: List[Optional[float]] = []
        running_total = 0.0
        running_count = 0
        running_max = float("-inf")
        running_min = float("inf")
        last_known: Optional[float] = None

        for index in range(len(periods)):
            bucket = by_period.get(index)
            if bucket is None:
                if accumulate != "none" or fill == "hold":
                    data.append(last_known)
                elif fill == "zero":
                    data.append(0.0)
                else:
                    data.append(None)
                if data[-1] is not None:
                    report.cells_filled += 1
                continue

            period_value = _aggregate(bucket, aggregate)
            if accumulate == "cumulative-sum":
                running_total += period_value
                standing = running_total
            elif accumulate == "cumulative-mean":
                running_total += period_value
                running_count += 1
                standing = running_total / running_count
            elif accumulate == "cumulative-max":
                running_max = max(running_max, period_value)
                standing = running_max
            elif accumulate == "cumulative-min":
                running_min = min(running_min, period_value)
                standing = running_min
            else:
                standing = period_value
            last_known = standing
            data.append(standing)

        series.append({"name": name, "data": data})

    report.entities_read = len(entity_order)

    kept = series
    if limit is not None and len(series) > limit:
        if limit_mode == "final":
            keep = {entry["name"] for entry in sorted(series, key=lambda s: -_final_value(s["data"]))[:limit]}
        else:
            keep = _ever_on_board(series, limit)
        kept = [entry for entry in series if entry["name"] in keep]
        report.entities_over_limit = [entry["name"] for entry in series if entry["name"] not in keep]
    report.entities_kept = len(kept)
    report.periods = len(periods)

    if len(periods) < 2:
        report.warnings.append("Fewer than two periods: there is nothing to animate between.")
    if len(kept) < 2:
        report.warnings.append("Fewer than two entities: there is nothing to race.")

    labels = [format_period(p) for p in periods] if format_period else list(periods)
    rounded = [
        {"name": entry["name"], "data": [round(v, 4) if v is not None else None for v in entry["data"]]}
        for entry in kept
    ]
    return {"labels": labels, "series": rounded, "suggestedType": "race"}, report


def _coverage_within_entity(rows: Sequence[Mapping[str, Any]], entity: str, header: str) -> float:
    """How completely a column's values run through every entity, 0-1."""
    overall = {str(row.get(header, "")) for row in rows}
    if len(overall) <= 1:
        return 0.0
    per_entity: Dict[str, set] = {}
    for row in rows:
        per_entity.setdefault(str(row.get(entity, "")), set()).add(str(row.get(header, "")))
    if not per_entity:
        return 0.0
    return sum(len(values) for values in per_entity.values()) / len(per_entity) / len(overall)


def _movement_within_entity(rows: Sequence[Mapping[str, Any]], entity: str, header: str) -> float:
    """Whether a column changes inside an entity at all, 0-1."""
    per_entity: Dict[str, List[str]] = {}
    for row in rows:
        per_entity.setdefault(str(row.get(entity, "")), []).append(str(row.get(header, "")))
    total = 0.0
    counted = 0
    for values in per_entity.values():
        if len(values) < 2:
            continue
        total += (len(set(values)) - 1) / (len(values) - 1)
        counted += 1
    return total / counted if counted else 0.0


def infer_race_columns(rows: Sequence[Mapping[str, Any]]) -> Optional[Dict[str, Any]]:
    """
    Guess which columns hold the entity, period and value of a tidy table.

    Entity first: the most distinct text column that is not an ordered
    sequence, preferring a readable name to an identifier. Then period: an
    ordered column that runs through every entity (coverage). Then value: the
    most varied numeric column that changes inside an entity (movement), so a
    per-entity attribute such as a vote count is never mistaken for the
    standing. Returns None when the table does not look tidy.
    """
    if len(rows) < 6:
        return None
    headers = list(rows[0].keys())
    if len(headers) < 3:
        return None
    # Sample the HEAD of the table, deliberately. Tidy rows arrive grouped by
    # entity, so the head holds a few entities' complete runs — and the period
    # test (coverage) and value test (movement) both need complete runs to
    # score. An even stride across the table was tried and broke this in
    # production: at ~18,000 rows the stride was 36, every show contributed
    # about three rows, coverage scored ~0.1 and the period column was
    # rejected. The one hazard of head sampling — a single numeric-named show
    # such as "24" dominating the entity column's row count — is handled
    # below by judging that column over distinct values instead.
    sample = list(rows[:1000])
    n = len(sample)

    stats = []
    for header in headers:
        values = [row.get(header) for row in sample]
        distinct_values = {str(v if v is not None else "") for v in values}
        distinct = len(distinct_values)
        numeric = sum(1 for v in values if to_number(v) is not None)
        ordered = sum(1 for v in values if parse_ordinal(v) is not None)
        # Judged over distinct values, not rows: an entity column is a column
        # of names, and one show called "24" is one name in the set however
        # many episodes it has. Row-level ratios made a single long-running
        # numeric-named show outvote every other name in the sample.
        numeric_distinct = sum(1 for v in distinct_values if to_number(v) is not None) / max(1, distinct)
        ordered_distinct = sum(1 for v in distinct_values if parse_ordinal(v) is not None) / max(1, distinct)
        stats.append({
            "header": header,
            "distinct": distinct,
            "numeric": numeric / n,
            "ordered": ordered / n,
            "numeric_distinct": numeric_distinct,
            "ordered_distinct": ordered_distinct,
        })

    entity_candidates = sorted(
        # Mostly names: fewer than half the distinct values look numeric or
        # ordered. "24", "1883" and "9-1-1" are names, not numbers.
        (s for s in stats if s["numeric_distinct"] < 0.5 and s["ordered_distinct"] < 0.5 and 3 <= s["distinct"] <= n / 2),
        key=lambda s: (1 if _ID_HEADER.search(s["header"]) else 0, -s["distinct"]),
    )
    if not entity_candidates:
        return None
    entity = entity_candidates[0]["header"]

    coverage = {s["header"]: _coverage_within_entity(sample, entity, s["header"]) for s in stats}
    movement = {s["header"]: _movement_within_entity(sample, entity, s["header"]) for s in stats}

    period_candidates = sorted(
        (
            s for s in stats
            if s["header"] != entity and s["ordered"] > 0.95 and 1 < s["distinct"] <= n / 2 and coverage[s["header"]] >= 0.8
        ),
        key=lambda s: s["distinct"],
    )
    if not period_candidates:
        return None
    period = period_candidates[0]["header"]

    value_candidates = sorted(
        (
            s for s in stats
            if s["header"] not in (entity, period) and s["numeric"] > 0.95 and movement[s["header"]] > 0.05
        ),
        key=lambda s: -s["distinct"],
    )
    if not value_candidates:
        return None
    value = value_candidates[0]["header"]

    confidence = 0.65
    confidence += 0.2 if len(value_candidates) == 1 else -0.1 * min(2, len(value_candidates) - 1)
    if period_candidates[0]["distinct"] * entity_candidates[0]["distinct"] <= n * 1.5:
        confidence += 0.1
    confidence = max(0.0, min(1.0, confidence))

    return {"entity": entity, "period": period, "value": value, "confidence": confidence}
