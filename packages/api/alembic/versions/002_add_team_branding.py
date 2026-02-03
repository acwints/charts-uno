"""Add branding columns to teams table

Revision ID: 002_add_branding
Revises: 001_add_teams
Create Date: 2026-02-03

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '002_add_branding'
down_revision: Union[str, None] = '001_add_teams'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(conn, table_name: str, column_name: str) -> bool:
    inspector = sa.inspect(conn)
    columns = [c['name'] for c in inspector.get_columns(table_name)]
    return column_name in columns


def upgrade() -> None:
    conn = op.get_bind()
    if not _column_exists(conn, 'teams', 'custom_logo_url'):
        op.add_column('teams', sa.Column('custom_logo_url', sa.Text(), nullable=True))
    if not _column_exists(conn, 'teams', 'watermark_enabled'):
        op.add_column('teams', sa.Column('watermark_enabled', sa.Boolean(), server_default=sa.text('true'), nullable=False))


def downgrade() -> None:
    op.drop_column('teams', 'watermark_enabled')
    op.drop_column('teams', 'custom_logo_url')
