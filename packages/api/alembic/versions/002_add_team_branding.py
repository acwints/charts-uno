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


def upgrade() -> None:
    op.add_column('teams', sa.Column('custom_logo_url', sa.Text(), nullable=True))
    op.add_column('teams', sa.Column('watermark_enabled', sa.Boolean(), server_default=sa.text('true'), nullable=False))


def downgrade() -> None:
    op.drop_column('teams', 'watermark_enabled')
    op.drop_column('teams', 'custom_logo_url')
