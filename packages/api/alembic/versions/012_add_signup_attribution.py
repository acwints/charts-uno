"""Add nullable first-signup source columns. Existing rows stay null.

Revision ID: 012_add_signup_attribution
Revises: 011_add_homepage_funnel_kind
Create Date: 2026-11-10

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "012_add_signup_attribution"
down_revision: Union[str, None] = "011_add_homepage_funnel_kind"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_COLUMNS = {
    "signup_platform": sa.String(8),
    "signup_referrer_host": sa.String(253),
    "signup_landing_path": sa.String(200),
    "signup_utm_source": sa.String(64),
    "signup_utm_medium": sa.String(64),
    "signup_utm_campaign": sa.String(64),
    "signup_utm_content": sa.String(64),
    "signup_utm_term": sa.String(64),
}


def _present(conn) -> set:
    inspector = sa.inspect(conn)
    if "users" not in inspector.get_table_names():
        return set()
    return {column["name"] for column in inspector.get_columns("users")}


def upgrade() -> None:
    present = _present(op.get_bind())
    if not present:
        return
    for name, sql_type in _COLUMNS.items():
        if name not in present:
            op.add_column("users", sa.Column(name, sql_type, nullable=True))


def downgrade() -> None:
    present = _present(op.get_bind())
    for name in _COLUMNS:
        if name in present:
            op.drop_column("users", name)
