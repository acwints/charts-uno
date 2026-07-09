#!/usr/bin/env python3
import argparse
import asyncio
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CASES_PATH = ROOT / "evals" / "chart-generation-cases.json"


def load_cases(path: Path) -> List[Dict[str, Any]]:
    with path.open("r", encoding="utf-8") as handle:
        cases = json.load(handle)
    if not isinstance(cases, list):
        raise ValueError("Eval cases file must contain a JSON array")
    return cases


def validate_case_shape(case: Dict[str, Any]) -> List[str]:
    errors: List[str] = []
    case_id = case.get("id")
    if not isinstance(case_id, str) or not case_id.strip():
        errors.append("case.id must be a non-empty string")
    if not isinstance(case.get("prompt"), str) or not case["prompt"].strip():
        errors.append(f"{case_id or '<missing id>'}: prompt must be a non-empty string")
    expect = case.get("expect")
    if not isinstance(expect, dict):
        errors.append(f"{case_id or '<missing id>'}: expect must be an object")
        return errors
    if not isinstance(expect.get("minLabels"), int) or expect["minLabels"] < 1:
        errors.append(f"{case_id}: expect.minLabels must be a positive integer")
    if not isinstance(expect.get("minSeries"), int) or expect["minSeries"] < 1:
        errors.append(f"{case_id}: expect.minSeries must be a positive integer")
    suggested_types = expect.get("suggestedTypes")
    if not isinstance(suggested_types, list) or not all(isinstance(value, str) for value in suggested_types):
        errors.append(f"{case_id}: expect.suggestedTypes must be a string array")
    return errors


def validate_chart_output(case: Dict[str, Any], chart: Dict[str, Any]) -> List[str]:
    errors: List[str] = []
    case_id = case["id"]
    expect = case["expect"]
    labels = chart.get("labels")
    series = chart.get("series")

    if not isinstance(labels, list):
        return [f"{case_id}: labels must be an array"]
    if not isinstance(series, list):
        return [f"{case_id}: series must be an array"]
    if len(labels) < expect["minLabels"]:
        errors.append(f"{case_id}: expected at least {expect['minLabels']} labels, got {len(labels)}")
    if len(series) < expect["minSeries"]:
        errors.append(f"{case_id}: expected at least {expect['minSeries']} series, got {len(series)}")

    for index, entry in enumerate(series):
        if not isinstance(entry, dict):
            errors.append(f"{case_id}: series[{index}] must be an object")
            continue
        data = entry.get("data")
        if not isinstance(entry.get("name"), str) or not entry["name"].strip():
            errors.append(f"{case_id}: series[{index}].name must be a non-empty string")
        if not isinstance(data, list):
            errors.append(f"{case_id}: series[{index}].data must be an array")
            continue
        if len(data) != len(labels):
            errors.append(f"{case_id}: series[{index}].data length {len(data)} does not match labels length {len(labels)}")
        if not all(isinstance(value, (int, float)) or value is None for value in data):
            errors.append(f"{case_id}: series[{index}].data must contain numbers or nulls")

    suggested_type = chart.get("suggestedType")
    if suggested_type and suggested_type not in expect["suggestedTypes"]:
        errors.append(f"{case_id}: suggestedType {suggested_type!r} not in {expect['suggestedTypes']}")

    label_names_any = expect.get("labelNamesAny", [])
    if label_names_any:
        normalized_labels = {str(label).lower() for label in labels}
        missing = [label for label in label_names_any if label.lower() not in normalized_labels]
        if missing:
            errors.append(f"{case_id}: missing expected labels: {', '.join(missing)}")

    series_names_any = expect.get("seriesNamesAny", [])
    if series_names_any:
        normalized_series = {str(entry.get("name", "")).lower() for entry in series if isinstance(entry, dict)}
        missing = [name for name in series_names_any if name.lower() not in normalized_series]
        if missing:
            errors.append(f"{case_id}: missing expected series: {', '.join(missing)}")

    return errors


async def run_live_eval(cases: List[Dict[str, Any]]) -> List[str]:
    if not os.environ.get("GOOGLE_API_KEY"):
        return ["GOOGLE_API_KEY must be set for --live evals"]

    sys.path.insert(0, str(ROOT / "packages" / "api"))
    from services.ai_service import generate_chart_from_prompt  # pylint: disable=import-outside-toplevel

    errors: List[str] = []
    for case in cases:
        chart = await generate_chart_from_prompt(case["prompt"])
        errors.extend(validate_chart_output(case, chart))
    return errors


async def main() -> int:
    parser = argparse.ArgumentParser(description="Validate chart-generation eval fixtures and optionally run live model evals.")
    parser.add_argument("--cases", default=str(DEFAULT_CASES_PATH), help="Path to chart generation eval cases JSON.")
    parser.add_argument("--live", action="store_true", help="Run live model evals using GOOGLE_API_KEY.")
    args = parser.parse_args()

    cases = load_cases(Path(args.cases))
    errors: List[str] = []
    for case in cases:
        errors.extend(validate_case_shape(case))

    if not errors and args.live:
        errors.extend(await run_live_eval(cases))

    if errors:
        print("Chart generation eval failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    mode = "live" if args.live else "fixture"
    print(f"Chart generation {mode} eval passed ({len(cases)} cases).")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
