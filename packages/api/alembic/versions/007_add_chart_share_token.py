"""Add unlisted chart share tokens

Revision ID: 007_add_chart_share_token
Revises: 006_fix_charts_is_public_boolean
Create Date: 2026-10-31

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "007_add_chart_share_token"
down_revision: Union[str, None] = "006_fix_charts_is_public_boolean"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("charts")}
    if "share_token" not in columns:
        op.add_column("charts", sa.Column("share_token", sa.String(length=43), nullable=True))
    indexes = {index["name"] for index in inspector.get_indexes("charts")}
    if "ix_charts_share_token" not in indexes:
        op.create_index("ix_charts_share_token", "charts", ["share_token"], unique=True)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    indexes = {index["name"] for index in inspector.get_indexes("charts")}
    if "ix_charts_share_token" in indexes:
        op.drop_index("ix_charts_share_token", table_name="charts")
    columns = {column["name"] for column in inspector.get_columns("charts")}
    if "share_token" in columns:
        op.drop_column("charts", "share_token")
