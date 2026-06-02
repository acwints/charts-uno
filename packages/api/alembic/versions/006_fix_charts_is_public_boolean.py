"""Convert charts.is_public to boolean

Revision ID: 006_fix_charts_is_public_boolean
Revises: 005_add_sql_connections
Create Date: 2026-06-02

"""
from typing import Sequence, Union

from alembic import op


revision: str = "006_fix_charts_is_public_boolean"
down_revision: Union[str, None] = "005_add_sql_connections"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    if conn.dialect.name != "postgresql":
        return

    op.execute(
        """
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = 'charts'
              AND column_name = 'is_public'
              AND data_type IN ('integer', 'smallint', 'bigint')
          ) THEN
            ALTER TABLE charts
              ALTER COLUMN is_public DROP DEFAULT,
              ALTER COLUMN is_public TYPE boolean
                USING CASE WHEN is_public IS NULL THEN false ELSE is_public <> 0 END,
              ALTER COLUMN is_public SET DEFAULT false;
          END IF;
        END $$;
        """
    )


def downgrade() -> None:
    conn = op.get_bind()
    if conn.dialect.name != "postgresql":
        return

    op.execute(
        """
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = 'charts'
              AND column_name = 'is_public'
              AND data_type = 'boolean'
          ) THEN
            ALTER TABLE charts
              ALTER COLUMN is_public DROP DEFAULT,
              ALTER COLUMN is_public TYPE integer
                USING CASE WHEN is_public THEN 1 ELSE 0 END,
              ALTER COLUMN is_public SET DEFAULT 0;
          END IF;
        END $$;
        """
    )
