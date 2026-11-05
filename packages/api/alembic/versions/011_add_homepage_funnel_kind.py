"""Add a kind to anonymous homepage events.

Revision ID: 011_add_homepage_funnel_kind
Revises: 010_add_homepage_chart_events
Create Date: 2026-11-05

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "011_add_homepage_funnel_kind"
down_revision: Union[str, None] = "010_add_homepage_chart_events"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _columns(conn) -> dict:
    inspector = sa.inspect(conn)
    if "homepage_chart_events" not in inspector.get_table_names():
        return {}
    return {column["name"]: column for column in inspector.get_columns("homepage_chart_events")}


def upgrade() -> None:
    conn = op.get_bind()
    columns = _columns(conn)
    if not columns:
        return
    if "kind" not in columns:
        op.add_column(
            "homepage_chart_events",
            sa.Column("kind", sa.String(16), nullable=False, server_default="render"),
        )
    source = columns.get("source")
    if source is not None and source.get("nullable") is False and conn.dialect.name == "postgresql":
        op.alter_column("homepage_chart_events", "source", existing_type=sa.String(16), nullable=True)


def downgrade() -> None:
    conn = op.get_bind()
    columns = _columns(conn)
    if "kind" in columns:
        op.drop_column("homepage_chart_events", "kind")
