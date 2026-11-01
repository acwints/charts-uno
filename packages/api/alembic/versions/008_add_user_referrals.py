"""Add user referral codes

Revision ID: 008_add_user_referrals
Revises: 007_add_chart_share_token
Create Date: 2026-11-01

"""
from typing import Sequence, Union

import secrets

from alembic import op
import sqlalchemy as sa


revision: str = "008_add_user_referrals"
down_revision: Union[str, None] = "007_add_chart_share_token"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("users")}
    if "referral_code" not in columns:
        op.add_column("users", sa.Column("referral_code", sa.String(length=16), nullable=True))
    if "referred_by" not in columns:
        op.add_column("users", sa.Column("referred_by", sa.String(length=16), nullable=True))
    indexes = {index["name"] for index in inspector.get_indexes("users")}
    if "ix_users_referral_code" not in indexes:
        op.create_index("ix_users_referral_code", "users", ["referral_code"], unique=True)
    if "ix_users_referred_by" not in indexes:
        op.create_index("ix_users_referred_by", "users", ["referred_by"], unique=False)

    rows = bind.execute(sa.text("SELECT id FROM users WHERE referral_code IS NULL")).fetchall()
    used = {
        row[0]
        for row in bind.execute(sa.text("SELECT referral_code FROM users WHERE referral_code IS NOT NULL"))
    }
    for (user_id,) in rows:
        code = None
        for _ in range(8):
            candidate = secrets.token_urlsafe(6)
            if candidate not in used:
                code = candidate
                used.add(candidate)
                break
        if code is None:
            raise RuntimeError("Could not allocate a referral code")
        bind.execute(
            sa.text("UPDATE users SET referral_code = :code WHERE id = :id"),
            {"code": code, "id": user_id},
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    indexes = {index["name"] for index in inspector.get_indexes("users")}
    if "ix_users_referred_by" in indexes:
        op.drop_index("ix_users_referred_by", table_name="users")
    if "ix_users_referral_code" in indexes:
        op.drop_index("ix_users_referral_code", table_name="users")
    columns = {column["name"] for column in inspector.get_columns("users")}
    if "referred_by" in columns:
        op.drop_column("users", "referred_by")
    if "referral_code" in columns:
        op.drop_column("users", "referral_code")
