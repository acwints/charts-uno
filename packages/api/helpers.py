"""Shared helpers to eliminate repeated patterns across API routes."""
import logging
import secrets
from functools import wraps
from typing import Optional

from fastapi import HTTPException, Request
from sqlalchemy.orm import Session

from models.database import Chart, Dashboard, User, TeamMember

logger = logging.getLogger(__name__)


def get_chart_or_404(db: Session, chart_id: str) -> Chart:
    """Fetch a chart by ID or raise 404."""
    chart = db.query(Chart).filter(Chart.id == chart_id).first()
    if not chart:
        raise HTTPException(status_code=404, detail="Chart not found")
    return chart


def assert_chart_owner(chart: Chart, user: User) -> None:
    """Raise 403 if the user does not own the chart."""
    if chart.user_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied")


def get_dashboard_or_404(db: Session, dashboard_id: str) -> Dashboard:
    """Fetch a dashboard by ID or raise 404."""
    dashboard = db.query(Dashboard).filter(Dashboard.id == dashboard_id).first()
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    return dashboard


def assert_dashboard_access(db: Session, dashboard: Dashboard, user: User) -> None:
    """Raise 403 if user doesn't own dashboard and isn't a team member."""
    if dashboard.user_id == user.id:
        return
    if dashboard.team_id:
        member = db.query(TeamMember).filter(
            TeamMember.team_id == dashboard.team_id,
            TeamMember.user_id == user.id,
        ).first()
        if member:
            return
    raise HTTPException(status_code=403, detail="Access denied")


def get_cookie_domain(request: Request) -> Optional[str]:
    """Return the cookie domain for the current request."""
    request_host = request.url.hostname or ""
    return ".chartsuno.com" if request_host.endswith("chartsuno.com") else None


def verify_bot_token(request: Request, bot_token_env: str) -> None:
    """Verify the x-bot-token header against the configured secret."""
    if not bot_token_env:
        raise HTTPException(status_code=503, detail="Bot internal API token is not configured")
    token = request.headers.get("x-bot-token", "")
    if not token or not secrets.compare_digest(token, bot_token_env):
        raise HTTPException(status_code=401, detail="Unauthorized")


def build_bot_chart_config(result: dict) -> dict:
    """Build a default chart config dict from AI analysis result."""
    suggested_type = result.get("suggestedType") or "bar"
    show_legend = len(result.get("series", [])) > 1
    config = {
        "type": suggested_type,
        "colorScheme": "default",
        "styleVariant": "professional",
        "themeMode": "dark",
        "showGrid": True,
        "showLegend": show_legend,
        "showValues": False,
        "showPoints": True,
        "showBorder": False,
        "animate": False,
        "title": result.get("suggestedTitle") or "AI Chart",
        "stacked": bool(result.get("stacked")),
    }
    if result.get("barLayout") in {"horizontal", "vertical"}:
        config["barLayout"] = result["barLayout"]
    return config


def handle_ai_errors(operation_name: str):
    """Decorator to standardize error handling for AI service endpoints."""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            try:
                return await func(*args, **kwargs)
            except HTTPException:
                raise
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e))
            except Exception as e:
                logger.error(f"{operation_name} failed: {e}")
                raise HTTPException(status_code=500, detail=f"{operation_name} failed")
        return wrapper
    return decorator
