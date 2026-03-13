"""Add sql_connections table and sql_connection_id to charts

Revision ID: 005_add_sql_connections
Revises: 004_add_dashboards
Create Date: 2026-03-13

"""
from datetime import datetime
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "005_add_sql_connections"
down_revision: Union[str, None] = "004_add_dashboards"
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

    # Create sql_connections table
    if not _table_exists(conn, "sql_connections"):
        op.create_table(
            "sql_connections",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("team_id", sa.String(36), sa.ForeignKey("teams.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("name", sa.String(255), nullable=False),
            sa.Column("host", sa.Text(), nullable=False),
            sa.Column("port", sa.Integer(), default=5432, nullable=False),
            sa.Column("database_name", sa.Text(), nullable=False),
            sa.Column("username", sa.Text(), nullable=False),
            sa.Column("encrypted_password", sa.Text(), nullable=False),
            sa.Column("ssl_required", sa.Boolean(), default=True, nullable=False),
            sa.Column("status", sa.String(50), default="untested", nullable=False),
            sa.Column("status_message", sa.Text(), nullable=True),
            sa.Column("created_by", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("created_at", sa.DateTime(), default=datetime.utcnow, nullable=False),
            sa.Column("updated_at", sa.DateTime(), default=datetime.utcnow, nullable=True),
        )

    # Add sql_connection_id to charts
    if _table_exists(conn, "charts") and not _column_exists(conn, "charts", "sql_connection_id"):
        op.add_column(
            "charts",
            sa.Column(
                "sql_connection_id",
                sa.String(36),
                sa.ForeignKey("sql_connections.id", ondelete="SET NULL"),
                nullable=True,
                index=True,
            ),
        )


def downgrade() -> None:
    op.drop_column("charts", "sql_connection_id")
    op.drop_table("sql_connections")
