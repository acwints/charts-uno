"""Reviewed, immutable reader snapshots. Drafts are never the published document."""
from __future__ import annotations

import copy
import hashlib
import json
import math
from datetime import datetime
from types import SimpleNamespace

from fastapi import HTTPException
from models.database import ChartRevision, generate_uuid
from services.public_chart import public_chart_data, public_chart_config, public_source_url

RENDERER_VERSION = "chartsuno-1"


def finite_number(value):
    try:
        return math.isfinite(value)
    except (OverflowError, TypeError, ValueError):
        return False


def digest(value: dict) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":"), default=str).encode()).hexdigest()


def draft_document(chart) -> dict:
    return {"title": chart.title, "description": chart.description, "data": chart.data,
            "config": chart.config, "source_type": chart.source_type, "source_url": chart.source_url}


def reader_document(chart, *, shared=False) -> dict:
    snapshot = (chart.share_snapshot if shared else None) or chart.publication_snapshot
    if snapshot:
        return snapshot
    return {**draft_document(chart), "legacy_snapshot": bool(chart.is_public or chart.share_token)}


def reader_chart(chart, *, shared=False):
    """Non-ORM view so renderers cannot accidentally mutate or read a draft."""
    doc = reader_document(chart, shared=shared)
    return SimpleNamespace(**{**doc, "data": public_chart_data(doc.get("data")),
                              "config": public_chart_config(doc.get("config")),
                              "user": chart.user, "id": chart.id})


def freeze_legacy(chart, db) -> None:
    if chart.publication_snapshot:
        return
    if not (chart.is_public or chart.share_token or chart.publications):
        return
    doc = draft_document(chart)
    doc["data"] = public_chart_data(doc["data"])
    doc["config"] = public_chart_config(doc["config"])
    doc["source_url"] = public_source_url(doc["source_url"])
    doc.update(legacy_snapshot=True, source_declaration=None, renderer_version=RENDERER_VERSION)
    revision_id = generate_uuid()
    doc.update(revision_id=revision_id, published_at=datetime.utcnow().isoformat())
    db.add(ChartRevision(id=revision_id, chart_id=chart.id, content_hash=digest(doc), snapshot=doc))
    chart.publication_snapshot = doc
    chart.publication_revision_id = revision_id
    if chart.share_token:
        chart.share_snapshot = copy.deepcopy(doc)


def candidate(chart, request):
    raw = chart.data if isinstance(chart.data, dict) else {}
    data = public_chart_data(raw)
    config = {"type": "bar", "colorScheme": "default", "styleVariant": "professional", "themeMode": "dark",
              "showGrid": True, "showLegend": True, "showValues": False, "showPoints": True,
              "showBorder": True, "showAxisTitles": True, "showAxisLabels": True,
              "animate": False, "stacked": False, "yAxisBaselineMode": "auto",
              **public_chart_config(chart.config)}
    config_errors = []
    for key, allowed, fallback in (
        ("colorScheme", {"default", "monochrome", "warm", "cool", "editorial", "muted"}, "default"),
        ("styleVariant", {"professional", "playful", "editorial", "minimalist", "bold", "brand"}, "professional"),
        ("themeMode", {"light", "dark"}, "dark"),
    ):
        if config[key] not in allowed:
            config_errors.append(f"Choose a supported {key} in the web editor before posting.")
            config[key] = fallback  # The rejected preview must still be safe to render.
    if request.chart_type:
        config["type"] = request.chart_type
        # An explicit simple-chart selection must not inherit hidden combo axes.
        for key in ("seriesConfig", "rightYAxisLabel", "rightYAxisPrefix", "rightYAxisSuffix"):
            config.pop(key, None)
    source = request.source.model_dump()
    source = {key: value.strip() if isinstance(value, str) else value for key, value in source.items()}
    source["url"] = public_source_url(source.get("url"))
    if source["kind"] == "own_data":
        source["title"] = "My own data"
    errors = list(config_errors)
    if not source["title"] or not source["description"]:
        errors.append("Describe the source and how these data were collected.")
    if request.source.url and not source["url"]:
        errors.append("Use a valid https:// or http:// source URL without embedded credentials.")
    if source["kind"] == "external" and not source["url"]:
        errors.append("Add a link to the external data source.")
    origin = raw.get("sourceType") or chart.source_type
    if origin in ("image", "prompt") or raw.get("sourceImage") or raw.get("sourcePrompt"):
        errors.append("Image-extracted and AI-generated data need a dedicated reconstruction review before posting. Choose a chart created from a data table.")
    labels, series = raw.get("labels"), raw.get("series")
    if not isinstance(labels, list) or not 1 <= len(labels) <= 10000:
        errors.append("The table must contain between 1 and 10,000 labeled rows.")
        labels = []
    if any(not isinstance(label, str) or not label.strip() or len(label) > 1000 for label in labels):
        errors.append("Every row needs a nonempty label of at most 1,000 characters.")
    if not isinstance(series, list) or not 1 <= len(series) <= 20:
        errors.append("Choose between 1 and 20 numeric series.")
        series = []
    if len(labels) * len(series) > 100000:
        errors.append("The public table may contain at most 100,000 numeric cells.")
    names = set()
    actual = 0
    for item in series:
        if not isinstance(item, dict):
            errors.append("Each series must have a name and numeric values.")
            continue
        name, values = item.get("name"), item.get("data")
        if not isinstance(name, str) or not name.strip() or len(name) > 300 or name.strip().casefold() in names:
            errors.append("Series names must be nonempty, unique, and at most 300 characters.")
        else:
            names.add(name.strip().casefold())
            if name in {"name", "x", "__pointDetail", "__proto__", "constructor", "prototype"} or any(char in name for char in ".[]"):
                errors.append("Rename series on web: names cannot be name, x, __pointDetail, __proto__, constructor, prototype, or contain periods or square brackets.")
        if not isinstance(values, list) or len(values) != len(labels):
            errors.append("Every numeric series must have exactly one value or null for each row.")
            continue
        for value in values:
            if value is None:
                continue
            if isinstance(value, bool) or not isinstance(value, (float, int)) or not finite_number(value):
                errors.append("Values must be finite numbers or null for missing observations.")
                break
            actual += 1
    if not actual:
        errors.append("The table needs at least one numeric observation.")
    columns = raw.get("categoricalColumns") or []
    if not isinstance(columns, list) or len(columns) > 20:
        errors.append("Use at most 20 context columns.")
        columns = []
    for column in columns:
        if not isinstance(column, dict) or not isinstance(column.get("name"), str) or not column["name"].strip():
            errors.append("Every context column needs a name.")
            continue
        name = column["name"].strip().casefold()
        if name in names:
            errors.append("Numeric and context column names must be unique.")
        names.add(name)
        values = column.get("data")
        if not isinstance(values, list) or len(values) != len(labels) or any(not isinstance(v, str) for v in values):
            errors.append("Every context column must have one text value for each row.")
    kind = config.get("type")
    if kind not in {"bar", "line", "area", "pie", "table"}:
        errors.append("Choose a bar, line, area, pie, or table presentation before posting.")
    if any(item.get("axis") == "right" for item in (public_chart_config(chart.config).get("seriesConfig") or {}).values()):
        errors.append("This draft uses a secondary axis. Resolve its units and series on web before posting; changing chart type cannot merge different units.")
    if kind == "pie":
        values = series[0].get("data", []) if len(series) == 1 and isinstance(series[0], dict) else []
        if len(series) != 1 or not values or any(v is None or isinstance(v, bool) or not isinstance(v, (int, float)) or not finite_number(v) or v < 0 for v in values) or not finite_number(sum(v for v in values if isinstance(v, (int, float)))) or sum(v for v in values if isinstance(v, (int, float))) <= 0:
            errors.append("A pie chart needs one complete, nonnegative series with a positive total.")
    title = chart.title or config.get("title") or "Untitled chart"
    config["title"] = title
    doc = {"title": title, "description": request.caption if request.caption is not None else chart.description,
           "data": data, "config": config, "source_type": chart.source_type,
           "source_url": source["url"], "source_declaration": source,
           "renderer_version": RENDERER_VERSION, "legacy_snapshot": False}
    # Hash the original draft too: private draft changes invalidate its review.
    fingerprint = digest({"draft": draft_document(chart), "candidate": doc, "is_public": request.is_public})
    doc["_review_fingerprint"] = fingerprint
    content_hash = digest({"fingerprint": fingerprint, "base_revision_id": chart.publication_revision_id,
                           "visibility_version": chart.publication_visibility_version or 0, "is_public": bool(chart.is_public)})
    return doc, content_hash, list(dict.fromkeys(errors))


def publish(chart, request, db):
    doc, content_hash, errors = candidate(chart, request)
    previous = db.query(ChartRevision).filter_by(chart_id=chart.id, content_hash=request.expected_draft_hash).first()
    if previous and previous.snapshot.get("_review_fingerprint") == doc["_review_fingerprint"]:
        # An exact response-lost retry is safe, but cannot roll back a later revision.
        if (chart.publication_revision_id != previous.id
                or previous.snapshot.get("_visibility_version", 0) != (chart.publication_visibility_version or 0)
                or previous.snapshot.get("_is_public") != request.is_public
                or bool(chart.is_public) != request.is_public):
            raise HTTPException(409, "The publication or visibility changed. Review the current draft again.")
        return previous.snapshot
    if content_hash != request.expected_draft_hash:
        raise HTTPException(409, "This draft or its published revision changed after review. Review the latest table and preview again.")
    if errors:
        raise HTTPException(422, {"message": "This chart is not ready to publish.", "errors": errors})
    current = chart.publication_snapshot
    # Fresh review of identical published content is a no-op, not a correction.
    if current and current.get("_review_fingerprint") == doc["_review_fingerprint"] and bool(chart.is_public) == request.is_public:
        return current
    correction = (request.correction_note or "").strip()
    if current and not correction:
        raise HTTPException(422, "Describe what changed before publishing a correction.")
    revision_id = generate_uuid()
    if chart.is_public and not request.is_public:
        revoke_public(chart)
    doc.update(revision_id=revision_id, parent_revision_id=chart.publication_revision_id,
               correction_note=correction or None, published_at=datetime.utcnow().isoformat(),
               _visibility_version=chart.publication_visibility_version or 0, _is_public=request.is_public)
    db.add(ChartRevision(id=revision_id, chart_id=chart.id, content_hash=content_hash, snapshot=doc))
    chart.publication_snapshot = copy.deepcopy(doc)
    chart.publication_revision_id = revision_id
    chart.is_public = request.is_public
    return doc


def require_reviewed(chart):
    if not chart.publication_snapshot or chart.publication_snapshot.get("legacy_snapshot"):
        raise HTTPException(409, "Review the table and source in the posting flow before publishing or sharing this chart.")


def revoke_public(chart):
    chart.publication_visibility_version = (chart.publication_visibility_version or 0) + 1
    chart.is_public = False
    chart.share_token = None
    chart.share_snapshot = None
