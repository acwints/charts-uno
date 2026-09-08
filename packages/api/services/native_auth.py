"""Short-lived, PKCE-bound handoff from Apple's auth sheet to the app cookie jar."""
import base64
import hashlib
import secrets
import re
from datetime import datetime, timedelta
from urllib.parse import urlencode

import jwt
from fastapi import HTTPException
from sqlalchemy.orm import Session

from dependencies import JWT_SECRET_KEY, JWT_ALGORITHM
from models.database import NativeAuthCode

CALLBACK = "com.chartsuno.app://auth-callback"
AUDIENCE = "chartsuno-native-auth"




def digest(value: str) -> str:
    return hashlib.sha256(value.encode("ascii")).hexdigest()


def pkce_challenge(verifier: str) -> str:
    return base64.urlsafe_b64encode(hashlib.sha256(verifier.encode("ascii")).digest()).decode().rstrip("=")


def create_native_state(challenge: str, nonce: str) -> str:
    if not re.fullmatch(r"[A-Za-z0-9_-]{43}", challenge) or not re.fullmatch(r"[A-Za-z0-9_-]{32,128}", nonce):
        raise HTTPException(400, "Invalid native authentication request")
    return "native." + jwt.encode({
        "aud": AUDIENCE, "challenge": challenge, "nonce": nonce,
        "exp": datetime.utcnow() + timedelta(minutes=10),
    }, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def read_native_state(state: str) -> dict:
    try:
        return jwt.decode(state.removeprefix("native."), JWT_SECRET_KEY,
                          algorithms=[JWT_ALGORITHM], audience=AUDIENCE,
                          options={"require": ["exp", "aud", "challenge", "nonce"]})
    except jwt.ExpiredSignatureError:
        # Validate signature/audience before trusting a nonce from expired state.
        try:
            payload = jwt.decode(state.removeprefix("native."), JWT_SECRET_KEY,
                                 algorithms=[JWT_ALGORITHM], audience=AUDIENCE,
                                 options={"verify_exp": False, "require": ["exp", "aud", "challenge", "nonce"]})
            return {**payload, "expired": True}
        except jwt.InvalidTokenError:
            raise HTTPException(400, "Could not verify sign-in. Please try again.") from None
    except jwt.InvalidTokenError:
        raise HTTPException(400, "Sign-in expired. Please try again.") from None


def finish_native_auth(db: Session, user_id: str, state: dict) -> str:
    code = secrets.token_urlsafe(32)
    db.query(NativeAuthCode).filter(NativeAuthCode.expires_at < datetime.utcnow()).delete()
    db.add(NativeAuthCode(code_hash=digest(code), user_id=user_id,
                          challenge=state["challenge"],
                          expires_at=datetime.utcnow() + timedelta(minutes=2)))
    db.commit()
    return CALLBACK + "?" + urlencode({"code": code, "state": state["nonce"]})


def redeem_native_code(db: Session, code: str, verifier: str) -> str:
    if not re.fullmatch(r"[A-Za-z0-9_-]{43}", code) or not re.fullmatch(r"[A-Za-z0-9._~-]{43,128}", verifier):
        raise HTTPException(401, "Invalid sign-in code")
    query = db.query(NativeAuthCode).filter(
        NativeAuthCode.code_hash == digest(code),
        NativeAuthCode.challenge == pkce_challenge(verifier),
        NativeAuthCode.expires_at > datetime.utcnow(),
    )
    grant = query.first()
    if not grant:
        raise HTTPException(401, "Sign-in expired. Please try again.")
    user_id = grant.user_id
    # Conditional delete is atomic across workers; only one redemption succeeds.
    if query.delete(synchronize_session=False) != 1:
        db.rollback()
        raise HTTPException(401, "Sign-in code already used")
    db.commit()
    return user_id
