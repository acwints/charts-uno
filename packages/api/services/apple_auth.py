"""Verify a Sign in with Apple identity token and attach it to a user.

The native app sends the identity token from AuthenticationServices. The
audience is the iOS bundle id. No Apple client secret is required for that
check. Web Sign in with Apple is a separate Services ID setup and is not
accepted here.
"""
import logging
import os
from datetime import datetime

import jwt
from fastapi import HTTPException
from jwt import PyJWKClient
from sqlalchemy.orm import Session

from models.database import User

logger = logging.getLogger(__name__)

APPLE_ISSUER = "https://appleid.apple.com"
APPLE_KEYS_URL = "https://appleid.apple.com/auth/keys"
# Change this only if the Xcode bundle id changes. See docs/ios-release.md.
APPLE_BUNDLE_ID = os.environ.get("APPLE_BUNDLE_ID", "com.chartsuno.app")

_jwk_client = PyJWKClient(APPLE_KEYS_URL, cache_keys=True, lifespan=60 * 60)


def verify_apple_identity_token(identity_token: str, audience: str = APPLE_BUNDLE_ID) -> dict:
    try:
        signing_key = _jwk_client.get_signing_key_from_jwt(identity_token)
        claims = jwt.decode(
            identity_token,
            signing_key.key,
            algorithms=["RS256"],
            audience=audience,
            issuer=APPLE_ISSUER,
            options={"require": ["exp", "iss", "aud", "sub"]},
        )
    except jwt.PyJWTError as exc:
        logger.warning("Apple identity token rejected: %s", type(exc).__name__)
        raise HTTPException(status_code=401, detail="Could not verify Sign in with Apple. Please try again.") from None
    if not isinstance(claims.get("sub"), str) or not claims["sub"]:
        raise HTTPException(status_code=401, detail="Could not verify Sign in with Apple. Please try again.")
    return claims


def _email_verified(claims: dict) -> bool:
    value = claims.get("email_verified", False)
    return value is True or value == "true"


def _clean_name(full_name: str | None) -> str | None:
    if not full_name:
        return None
    cleaned = " ".join(full_name.split())
    return cleaned[:255] or None


def upsert_apple_user(db: Session, claims: dict, full_name: str | None) -> tuple[User, bool]:
    """Find or create the account for an Apple subject. Returns (user, is_new)."""
    apple_id = claims["sub"]
    raw_email = claims.get("email")
    email = raw_email.strip().lower() if isinstance(raw_email, str) and raw_email.strip() else None
    name = _clean_name(full_name)

    user = db.query(User).filter(User.apple_id == apple_id).first()
    if user:
        if email and _email_verified(claims):
            taken = db.query(User).filter(User.email == email, User.id != user.id).first()
            if not taken:
                user.email = email
        if name and not user.name:
            user.name = name
        user.last_login = datetime.utcnow()
        db.commit()
        db.refresh(user)
        return user, False

    if email and _email_verified(claims):
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            if existing.apple_id and existing.apple_id != apple_id:
                raise HTTPException(
                    status_code=409,
                    detail="This email is already linked to a different Apple ID.",
                )
            existing.apple_id = apple_id
            if name and not existing.name:
                existing.name = name
            existing.last_login = datetime.utcnow()
            db.commit()
            db.refresh(existing)
            return existing, False

    if not email:
        raise HTTPException(
            status_code=400,
            detail=(
                "Apple did not share an email for this account. In iOS Settings, "
                "open Apple ID, Sign in with Apple, and stop using Apple ID for "
                "Chartsuno, then try again."
            ),
        )

    user = User(apple_id=apple_id, email=email, name=name, google_id=None)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user, True
