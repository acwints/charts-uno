"""Add chart publications table for team-space visibility

Revision ID: 003_add_chart_publications
Revises: 99235959d9ef
Create Date: 2026-02-19

"""
from datetime import datetime
from typing import Sequence, Union
import uuid

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "003_add_chart_publications"
down_revision: Union[str, None] = "99235959d9ef"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def generate_uuid() -> str:
    return str(uuid.uuid4())


def _table_exists(conn, table_name: str) -> bool:
    inspector = sa.inspect(conn)
    return table_name in inspector.get_table_names()


def _index_exists(conn, table_name: str, index_name: str) -> bool:
    inspector = sa.inspect(conn)
    indexes = inspector.get_indexes(table_name)
    return any(idx["name"] == index_name for idx in indexes)


def upgrade() -> None:
    conn = op.get_bind()

    if not _table_exists(conn, "chart_publications"):
        op.create_table(
            "chart_publications",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("chart_id", sa.String(36), sa.ForeignKey("charts.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("team_id", sa.String(36), sa.ForeignKey("teams.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("published_by", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("created_at", sa.DateTime(), default=datetime.utcnow, nullable=False),
            sa.UniqueConstraint("chart_id", "team_id", name="uq_chart_publication_team"),
        )

    if not _index_exists(conn, "chart_publications", "ix_chart_publications_team_created"):
        op.create_index("ix_chart_publications_team_created", "chart_publications", ["team_id", "created_at"])

    # Backfill existing non-personal team-owned charts into publication links.
    # This preserves legacy team visibility while the app moves to explicit targets.
    rows = conn.execute(
        sa.text(
            """
            SELECT c.id, c.team_id, c.user_id, c.created_at
            FROM charts c
            JOIN teams t ON t.id = c.team_id
            WHERE c.team_id IS NOT NULL AND t.is_personal = false
            """
        )
    ).fetchall()

    for chart_id, team_id, user_id, created_at in rows:
        exists = conn.execute(
            sa.text(
                """
                SELECT 1
                FROM chart_publications
                WHERE chart_id = :chart_id AND team_id = :team_id
                """
            ),
            {"chart_id": chart_id, "team_id": team_id},
        ).fetchone()
        if exists:
            continue

        conn.execute(
            sa.text(
                """
                INSERT INTO chart_publications (id, chart_id, team_id, published_by, created_at)
                VALUES (:id, :chart_id, :team_id, :published_by, :created_at)
                """
            ),
            {
                "id": generate_uuid(),
                "chart_id": chart_id,
                "team_id": team_id,
                "published_by": user_id,
                "created_at": created_at,
            },
        )


def downgrade() -> None:
    op.drop_table("chart_publications")
