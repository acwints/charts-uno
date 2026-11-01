"""Add the feedback table for improvement notes

Revision ID: 009_add_feedback
Revises: 008_add_user_referrals
Create Date: 2026-11-01

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "009_add_feedback"
down_revision: Union[str, None] = "008_add_user_referrals"
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
    if not _table_exists(conn, "feedback"):
        op.create_table(
            "feedback",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("message", sa.Text(), nullable=False),
            sa.Column("email", sa.String(255), nullable=True),
            sa.Column("page_path", sa.String(500), nullable=False),
            sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("status", sa.String(20), nullable=False, server_default="new"),
            sa.Column("public_note", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.Column("shipped_at", sa.DateTime(), nullable=True),
        )
    if _table_exists(conn, "feedback"):
        if not _index_exists(conn, "feedback", "ix_feedback_user_id"):
            op.create_index("ix_feedback_user_id", "feedback", ["user_id"])
        if not _index_exists(conn, "feedback", "ix_feedback_created"):
            op.create_index("ix_feedback_created", "feedback", ["created_at"])
        if not _index_exists(conn, "feedback", "ix_feedback_status_shipped"):
            op.create_index("ix_feedback_status_shipped", "feedback", ["status", "shipped_at"])


def downgrade() -> None:
    conn = op.get_bind()
    if not _table_exists(conn, "feedback"):
        return
    for index_name in (
        "ix_feedback_status_shipped",
        "ix_feedback_created",
        "ix_feedback_user_id",
    ):
        if _index_exists(conn, "feedback", index_name):
            op.drop_index(index_name, table_name="feedback")
    op.drop_table("feedback")
