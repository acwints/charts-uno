"""Invite links: https://www.chartsuno.com/?ref=<code>.

A code is created for every account. referred_by is set only when a new
account signs up with a code that already belongs to someone else.
"""
from __future__ import annotations

import re

from sqlalchemy.orm import Session

from models.database import User, generate_referral_code

# Generated codes are 8 characters. The upper bound leaves room for a longer
# code later without accepting arbitrary query strings.
REFERRAL_RE = re.compile(r"^[A-Za-z0-9_-]{8,16}$")


def normalize_referral(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    code = value.strip()
    if not REFERRAL_RE.fullmatch(code):
        return None
    return code


def allocate_referral_code(db: Session) -> str:
    for _ in range(8):
        code = generate_referral_code()
        taken = db.query(User.id).filter(User.referral_code == code).first()
        if taken is None:
            return code
    raise RuntimeError("Could not allocate a referral code")


def ensure_referral_code(db: Session, user: User) -> str:
    if user.referral_code:
        return user.referral_code
    user.referral_code = allocate_referral_code(db)
    db.commit()
    db.refresh(user)
    return user.referral_code


def attach_referral(db: Session, user: User, raw: object) -> None:
    """Record who invited this new account. Unknown codes are ignored.

    A later sign-in does not replace a code already stored. Signing up with
    your own code is ignored.
    """
    if user.referred_by:
        return
    code = normalize_referral(raw)
    if not code or code == user.referral_code:
        return
    referrer = db.query(User.id).filter(User.referral_code == code, User.id != user.id).first()
    if referrer is None:
        return
    user.referred_by = code


def backfill_referral_codes() -> None:
    """Give existing accounts a code. Safe to run more than once."""
    from models.database import SessionLocal

    db = SessionLocal()
    try:
        missing = db.query(User).filter(User.referral_code.is_(None)).all()
        if not missing:
            return
        used = {
            row[0]
            for row in db.query(User.referral_code).filter(User.referral_code.isnot(None)).all()
        }
        for user in missing:
            code = None
            for _ in range(8):
                candidate = generate_referral_code()
                if candidate not in used:
                    code = candidate
                    used.add(candidate)
                    break
            if code is None:
                raise RuntimeError("Could not allocate a referral code")
            user.referral_code = code
        db.commit()
    finally:
        db.close()
