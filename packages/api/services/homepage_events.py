"""Anonymous counts of charts rendered on the homepage before sign-up.

A row is a timestamp and a source (paste, drop, or sample). It is not tied
to a person, address, or browser.
"""
import time
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from models.database import HomepageChartEvent

SOURCES = frozenset({"paste", "drop", "sample"})
LIMIT_PER_MINUTE = 300

_window = {"start": 0.0, "count": 0}


def reset_homepage_event_limit() -> None:
    _window["start"] = 0.0
    _window["count"] = 0


def allow_homepage_event(now: Optional[float] = None) -> bool:
    """Process-wide cap. The key is not a client address."""
    moment = time.monotonic() if now is None else now
    if moment - _window["start"] >= 60:
        _window["start"] = moment
        _window["count"] = 0
    if _window["count"] >= LIMIT_PER_MINUTE:
        return False
    _window["count"] += 1
    return True


def homepage_chart_counts(db: Session, now: Optional[datetime] = None) -> dict:
    """UTC calendar day, and the rolling 7 days ending at `now`."""
    moment = now or datetime.utcnow()
    start_today = moment.replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = moment - timedelta(days=7)
    today = 0
    week = 0
    for (created_at,) in db.query(HomepageChartEvent.created_at).all():
        created = created_at if isinstance(created_at, datetime) else datetime.min
        if created > moment:
            continue
        if created >= week_ago:
            week += 1
        if created >= start_today:
            today += 1
    return {"homepage_charts_today": today, "homepage_charts_7d": week}
