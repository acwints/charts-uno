"""Browser-owned PKCE handoff: URLs contain only expiring one-use codes."""
import re
from datetime import datetime, timedelta
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import jwt
from fastapi import HTTPException

from dependencies import JWT_SECRET_KEY, JWT_ALGORITHM

AUDIENCE = "chartsuno-web-auth"


def create_web_state(challenge: str, nonce: str, frontend: str, ref: str | None = None) -> str:
    if not re.fullmatch(r"[A-Za-z0-9_-]{43}", challenge) or not re.fullmatch(r"[A-Za-z0-9_-]{43}", nonce):
        raise HTTPException(400, "Invalid browser sign-in request. Reload and try again.")
    payload = {
        "aud": AUDIENCE, "challenge": challenge, "nonce": nonce, "frontend": frontend,
        "exp": datetime.utcnow() + timedelta(minutes=10),
    }
    from services.referrals import normalize_referral
    code = normalize_referral(ref)
    if code:
        payload["ref"] = code
    return "web." + jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def read_web_state(state: str) -> dict:
    if not state.startswith("web."):
        raise HTTPException(400, "Could not verify sign-in. Please try again.")
    try:
        return jwt.decode(state[4:], JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM], audience=AUDIENCE,
                          options={"require": ["exp", "aud", "challenge", "nonce", "frontend"]})
    except jwt.InvalidTokenError:
        raise HTTPException(400, "Sign-in expired or could not be verified. Please try again.") from None


def callback_url(frontend: str, code: str, nonce: str) -> str:
    target = urlsplit(frontend)
    params = [(k, v) for k, v in parse_qsl(target.query, keep_blank_values=True)
              if k not in {"auth_token", "auth_code", "auth_state", "auth_error"}]
    params.extend([("auth_code", code), ("auth_state", nonce)])
    return urlunsplit((target.scheme, target.netloc, target.path, urlencode(params), target.fragment))
