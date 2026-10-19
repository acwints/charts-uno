"""App Review demo sign-in.

Disabled unless the API host has both REVIEW_LOGIN_EMAIL and
REVIEW_LOGIN_PASSWORD. Unset either one and the iOS sign-in sheet stops
offering it. The password is compared in constant time and is never stored.
Deleting the demo account is allowed; the next successful sign-in creates
that user and a personal team again so charts can be saved.
"""
import os
import secrets
from datetime import datetime

from fastapi import HTTPException
from sqlalchemy.orm import Session

from models.database import REVIEW_LOGIN_GOOGLE_ID, Team, User

# Stand-ins used when the feature is off so the compare still runs.
_DISABLED_EMAIL = "review-login-disabled@invalid.example"
_DISABLED_PASSWORD = "review-login-disabled-password"


def configured_review_login() -> tuple[str, str] | None:
    email = os.environ.get("REVIEW_LOGIN_EMAIL", "").strip().lower()
    password = os.environ.get("REVIEW_LOGIN_PASSWORD", "")
    if not email or "@" not in email or not password:
        return None
    return email, password


def review_login_enabled() -> bool:
    return configured_review_login() is not None


def credentials_match(email: str, password: str) -> bool:
    """Compare email and password without returning early on a mismatch.

    When the feature is off, both fields are still compared against fixed
    stand-ins and the result is False.
    """
    configured = configured_review_login()
    expected_email, expected_password = configured or (_DISABLED_EMAIL, _DISABLED_PASSWORD)
    supplied_email = email.strip().lower() if isinstance(email, str) else ""
    supplied_password = password if isinstance(password, str) else ""
    email_ok = secrets.compare_digest(
        supplied_email.encode("utf-8"),
        expected_email.encode("utf-8"),
    )
    password_ok = secrets.compare_digest(
        supplied_password.encode("utf-8"),
        expected_password.encode("utf-8"),
    )
    return configured is not None and email_ok and password_ok


def ensure_review_user(db: Session) -> tuple[User, bool]:
    """Find or recreate the single demo user.

    Returns (user, needs_personal_team). Refuses if the configured email
    already belongs to a different account, so review sign-in cannot take
    over a real user.
    """
    configured = configured_review_login()
    if configured is None:
        raise HTTPException(status_code=404, detail="Not found")
    email, _password = configured

    user = db.query(User).filter(User.google_id == REVIEW_LOGIN_GOOGLE_ID).first()
    if user is None:
        taken = db.query(User).filter(User.email == email).first()
        if taken is not None:
            raise HTTPException(
                status_code=409,
                detail="Review login email belongs to another account. Choose a different REVIEW_LOGIN_EMAIL.",
            )
        user = User(
            google_id=REVIEW_LOGIN_GOOGLE_ID,
            email=email,
            name="App Review",
            apple_id=None,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user, True

    if user.email != email:
        taken = db.query(User).filter(User.email == email, User.id != user.id).first()
        if taken is not None:
            raise HTTPException(
                status_code=409,
                detail="Review login email belongs to another account. Choose a different REVIEW_LOGIN_EMAIL.",
            )
        user.email = email
    if not user.name:
        user.name = "App Review"
    user.last_login = datetime.utcnow()
    db.commit()
    db.refresh(user)
    needs_team = (
        db.query(Team.id)
        .filter(Team.owner_id == user.id, Team.is_personal.is_(True))
        .first()
        is None
    )
    return user, needs_team
