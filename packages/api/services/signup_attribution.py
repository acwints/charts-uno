"""First-signup source. Hostname, pathname, and five UTM fields. No identity.

Stored only when the account row is created. Later sign-ins do not call this.
The public count exposes aggregates, never one person's timestamp.
"""
import re
from typing import Optional
from urllib.parse import urlsplit

UTM_FIELDS = ("utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term")
_HOST = re.compile(r"[a-z0-9.-]+")
_UTM = re.compile(r"[A-Za-z0-9][A-Za-z0-9 ._+-]{0,63}")


def referrer_host(value: Optional[str]) -> Optional[str]:
    """Hostname only. A userinfo, path, or query is discarded, not stored."""
    if not isinstance(value, str):
        return None
    raw = value.strip()
    if not raw or "@" in raw or "\\" in raw or any(char.isspace() for char in raw):
        return None
    if "://" in raw or raw.startswith("//"):
        parsed = urlsplit(raw if "://" in raw else f"https:{raw}")
        if parsed.username or parsed.password:
            return None
        host = parsed.hostname or ""
    else:
        if any(char in raw for char in "/?#"):
            return None
        host = raw
    host = host.lower().rstrip(".")
    if not host or len(host) > 253 or not _HOST.fullmatch(host) or ".." in host:
        return None
    if host.startswith(".") or host.endswith("-") or host.startswith("-"):
        return None
    return host


def landing_path(value: Optional[str]) -> Optional[str]:
    """Pathname only. Query and fragment are dropped."""
    if not isinstance(value, str):
        return None
    raw = value.strip()
    if not raw.startswith("/") or raw.startswith("//") or "\\" in raw or "@" in raw:
        return None
    path = urlsplit(raw).path
    if not path.startswith("/") or len(path) > 200:
        return None
    return path


def utm_value(value: Optional[str]) -> Optional[str]:
    if not isinstance(value, str):
        return None
    text = " ".join(value.split())
    if not text or "@" in text or any(char in text for char in "/?#&%"):
        return None
    if not _UTM.fullmatch(text):
        return None
    return text


def clean_attribution(raw: Optional[dict]) -> dict:
    """Fields safe to put in the signed OAuth state and on the new user row."""
    if not isinstance(raw, dict):
        return {}
    cleaned = {}
    host = referrer_host(raw.get("referrer_host"))
    path = landing_path(raw.get("landing_path"))
    if host:
        cleaned["referrer_host"] = host
    if path:
        cleaned["landing_path"] = path
    for field in UTM_FIELDS:
        value = utm_value(raw.get(field))
        if value:
            cleaned[field] = value
    return cleaned


def apply_first_signup_source(user, platform: str, raw: Optional[dict] = None) -> None:
    """Set source columns on a row that has not been inserted yet.

    Callers must use this only in the branch that constructs a new user.
    A later sign-in does not call it, so an existing row is left alone.
    """
    if platform not in {"ios", "web"}:
        return
    user.signup_platform = platform
    cleaned = clean_attribution(raw)
    user.signup_referrer_host = cleaned.get("referrer_host")
    user.signup_landing_path = cleaned.get("landing_path")
    for field in UTM_FIELDS:
        setattr(user, f"signup_{field}", cleaned.get(field))
