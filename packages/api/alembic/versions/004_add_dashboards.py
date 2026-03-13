"""Add dashboards and dashboard_items tables, and refresh_query to charts

Revision ID: 004_add_dashboards
Revises: 003_add_chart_publications
Create Date: 2026-03-13

"""
from datetime import datetime
from typing import Sequence, Union
import uuid

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "004_add_dashboards"
down_revision: Union[str, None] = "003_add_chart_publications"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(conn, table_name: str) -> bool:
    inspector = sa.inspect(conn)
    return table_name in inspector.get_table_names()


def _column_exists(conn, table_name: str, column_name: str) -> bool:
    inspector = sa.inspect(conn)
    columns = [c["name"] for c in inspector.get_columns(table_name)]
    return column_name in columns


def _index_exists(conn, table_name: str, index_name: str) -> bool:
    inspector = sa.inspect(conn)
    indexes = inspector.get_indexes(table_name)
    return any(idx["name"] == index_name for idx in indexes)


def upgrade() -> None:
    conn = op.get_bind()

    # Add refresh_query column to charts
    if _table_exists(conn, "charts") and not _column_exists(conn, "charts", "refresh_query"):
        op.add_column("charts", sa.Column("refresh_query", sa.JSON(), nullable=True))

    # Create dashboards table
    if not _table_exists(conn, "dashboards"):
        op.create_table(
            "dashboards",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("team_id", sa.String(36), sa.ForeignKey("teams.id", ondelete="CASCADE"), nullable=True, index=True),
            sa.Column("name", sa.String(255), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("is_public", sa.Boolean(), default=False, nullable=False),
            sa.Column("auto_refresh", sa.Boolean(), default=False, nullable=False),
            sa.Column("config", sa.JSON(), nullable=False),
            sa.Column("created_at", sa.DateTime(), default=datetime.utcnow, nullable=False),
            sa.Column("updated_at", sa.DateTime(), default=datetime.utcnow, nullable=True),
        )

    if _table_exists(conn, "dashboards"):
        if not _index_exists(conn, "dashboards", "ix_dashboards_user_created"):
            op.create_index("ix_dashboards_user_created", "dashboards", ["user_id", "created_at"])
        if not _index_exists(conn, "dashboards", "ix_dashboards_team_created"):
            op.create_index("ix_dashboards_team_created", "dashboards", ["team_id", "created_at"])

    # Create dashboard_items table
    if not _table_exists(conn, "dashboard_items"):
        op.create_table(
            "dashboard_items",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("dashboard_id", sa.String(36), sa.ForeignKey("dashboards.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("chart_id", sa.String(36), sa.ForeignKey("charts.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("position", sa.Integer(), default=0, nullable=False),
            sa.Column("width", sa.Integer(), default=2, nullable=False),
            sa.Column("height", sa.Integer(), default=1, nullable=False),
            sa.Column("created_at", sa.DateTime(), default=datetime.utcnow, nullable=False),
            sa.UniqueConstraint("dashboard_id", "chart_id", name="uq_dashboard_chart"),
        )

    if _table_exists(conn, "dashboard_items"):
        if not _index_exists(conn, "dashboard_items", "ix_dashboard_items_dashboard_pos"):
            op.create_index("ix_dashboard_items_dashboard_pos", "dashboard_items", ["dashboard_id", "position"])


def downgrade() -> None:
    op.drop_table("dashboard_items")
    op.drop_table("dashboards")
    op.drop_column("charts", "refresh_query")
