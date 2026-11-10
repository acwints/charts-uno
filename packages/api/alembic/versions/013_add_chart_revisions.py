"""Freeze published chart content independently of editable drafts.

Revision ID: 013_add_chart_revisions
Revises: 012_add_signup_attribution
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.orm import Session

revision = "013_add_chart_revisions"
down_revision = "012_add_signup_attribution"
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    columns = {item["name"] for item in sa.inspect(conn).get_columns("charts")}
    for name, kind in (("publication_snapshot", sa.JSON()), ("publication_revision_id", sa.String(36)), ("share_snapshot", sa.JSON())):
        if name not in columns:
            op.add_column("charts", sa.Column(name, kind, nullable=True))
    if "publication_visibility_version" not in columns:
        op.add_column("charts", sa.Column("publication_visibility_version", sa.Integer(), nullable=False, server_default="0"))
    if "chart_revisions" not in sa.inspect(conn).get_table_names():
        op.create_table("chart_revisions",
                        sa.Column("id", sa.String(36), primary_key=True),
                        sa.Column("chart_id", sa.String(36), sa.ForeignKey("charts.id", ondelete="CASCADE"), nullable=False),
                        sa.Column("content_hash", sa.String(64), nullable=False),
                        sa.Column("snapshot", sa.JSON(), nullable=False),
                        sa.Column("created_at", sa.DateTime(), nullable=False),
                        sa.UniqueConstraint("chart_id", "content_hash", name="uq_chart_revision_hash"))
        op.create_index("ix_chart_revisions_chart_id", "chart_revisions", ["chart_id"])
    from models.database import Chart
    from services.publication import freeze_legacy
    db = Session(bind=conn)
    try:
        for chart in db.query(Chart).filter(Chart.publication_snapshot.is_(None)).yield_per(100):
            freeze_legacy(chart, db)
        db.flush()
    finally:
        db.close()


def downgrade():
    op.drop_table("chart_revisions")
    for name in ("share_snapshot", "publication_revision_id", "publication_snapshot", "publication_visibility_version"):
        op.drop_column("charts", name)
