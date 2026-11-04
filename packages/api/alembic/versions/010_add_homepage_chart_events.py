"""Anonymous homepage chart renders: timestamp and source only.

Revision ID: 010_add_homepage_chart_events
Revises: 009_add_feedback
Create Date: 2026-11-04

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "010_add_homepage_chart_events"
down_revision: Union[str, None] = "009_add_feedback"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(conn, table_name: str) -> bool:
    inspector = sa.inspect(conn)
    return table_name in inspector.get_table_names()


def _index_exists(conn, table_name: str, index_name: str) -> bool:
    inspector = sa.inspect(conn)
    return any(index["name"] == index_name for index in inspector.get_indexes(table_name))


def upgrade() -> None:
    conn = op.get_bind()
    if not _table_exists(conn, "homepage_chart_events"):
        op.create_table(
            "homepage_chart_events",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("source", sa.String(16), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
        )
    if _table_exists(conn, "homepage_chart_events") and not _index_exists(
        conn, "homepage_chart_events", "ix_homepage_chart_events_created_at"
    ):
        op.create_index(
            "ix_homepage_chart_events_created_at",
            "homepage_chart_events",
            ["created_at"],
        )


def downgrade() -> None:
    conn = op.get_bind()
    if not _table_exists(conn, "homepage_chart_events"):
        return
    if _index_exists(conn, "homepage_chart_events", "ix_homepage_chart_events_created_at"):
        op.drop_index("ix_homepage_chart_events_created_at", table_name="homepage_chart_events")
    op.drop_table("homepage_chart_events")
