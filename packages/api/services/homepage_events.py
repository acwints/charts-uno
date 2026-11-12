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
    """UTC calendar day, and the rolling 7 days ending at `now`.

    Renders, views, starts, and saves are separate. A row is only a timestamp
    and, for a render or a start, the source. A save is a chart stored on an
    account after sign-in. A download is a PNG made with no account, and it
    is also included in chart_saves_7d. Keep-prompt rows are the same shape.
    """
    moment = now or datetime.utcnow()
    start_today = moment.replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = moment - timedelta(days=7)
    totals = {
        "homepage_charts_today": 0,
        "homepage_charts_7d": 0,
        "homepage_views_today": 0,
        "homepage_views_7d": 0,
        "chart_starts_today": 0,
        "chart_starts_7d": 0,
        "chart_saves_7d": 0,
        "chart_saves_7d_signed_in": 0,
        "chart_saves_7d_anonymous": 0,
        "chart_downloads_today": 0,
        "chart_downloads_7d": 0,
        "keep_prompt_shown_today": 0,
        "keep_prompt_shown_7d": 0,
        "keep_prompt_clicked_today": 0,
        "keep_prompt_clicked_7d": 0,
        "keep_prompt_signins_today": 0,
        "keep_prompt_signins_7d": 0,
    }
    fields = {
        "render": ("homepage_charts_today", "homepage_charts_7d"),
        "view": ("homepage_views_today", "homepage_views_7d"),
        "start": ("chart_starts_today", "chart_starts_7d"),
        "save": (None, "chart_saves_7d_signed_in"),
        "download": ("chart_downloads_today", "chart_downloads_7d"),
        "keep_shown": ("keep_prompt_shown_today", "keep_prompt_shown_7d"),
        "keep_click": ("keep_prompt_clicked_today", "keep_prompt_clicked_7d"),
        "keep_signin": ("keep_prompt_signins_today", "keep_prompt_signins_7d"),
    }
    for kind, created_at in db.query(HomepageChartEvent.kind, HomepageChartEvent.created_at).all():
        created = created_at if isinstance(created_at, datetime) else datetime.min
        if created > moment:
            continue
        today_key, week_key = fields.get(kind or "render", (None, None))
        if created >= start_today and today_key:
            totals[today_key] += 1
        if created >= week_ago and week_key:
            totals[week_key] += 1
    # A download is counted as a save. The row has no account, so it cannot
    # be split into test domains, the owner, bots, or App Review.
    totals["chart_saves_7d_anonymous"] = totals["chart_downloads_7d"]
    totals["chart_saves_7d"] = totals["chart_saves_7d_signed_in"] + totals["chart_saves_7d_anonymous"]
    return totals
