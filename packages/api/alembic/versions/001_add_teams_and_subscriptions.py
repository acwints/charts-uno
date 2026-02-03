"""Add teams and subscriptions tables

Revision ID: 001_add_teams
Revises:
Create Date: 2026-02-01

"""
from typing import Sequence, Union
from datetime import datetime
import uuid

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '001_add_teams'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def generate_uuid() -> str:
    return str(uuid.uuid4())


def _table_exists(conn, table_name: str) -> bool:
    inspector = sa.inspect(conn)
    return table_name in inspector.get_table_names()


def _column_exists(conn, table_name: str, column_name: str) -> bool:
    inspector = sa.inspect(conn)
    columns = [c['name'] for c in inspector.get_columns(table_name)]
    return column_name in columns


def _index_exists(conn, table_name: str, index_name: str) -> bool:
    inspector = sa.inspect(conn)
    indexes = inspector.get_indexes(table_name)
    return any(idx['name'] == index_name for idx in indexes)


def upgrade() -> None:
    conn = op.get_bind()

    # Create teams table
    if not _table_exists(conn, 'teams'):
        op.create_table(
            'teams',
            sa.Column('id', sa.String(36), primary_key=True),
            sa.Column('name', sa.String(255), nullable=False),
            sa.Column('slug', sa.String(255), unique=True, nullable=False, index=True),
            sa.Column('owner_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
            sa.Column('is_personal', sa.Boolean(), default=False, nullable=False),
            sa.Column('created_at', sa.DateTime(), default=datetime.utcnow, nullable=False),
            sa.Column('updated_at', sa.DateTime(), default=datetime.utcnow, onupdate=datetime.utcnow),
        )
    if not _index_exists(conn, 'teams', 'ix_teams_owner_created'):
        op.create_index('ix_teams_owner_created', 'teams', ['owner_id', 'created_at'])

    # Create team_members table
    if not _table_exists(conn, 'team_members'):
        op.create_table(
            'team_members',
            sa.Column('id', sa.String(36), primary_key=True),
            sa.Column('team_id', sa.String(36), sa.ForeignKey('teams.id', ondelete='CASCADE'), nullable=False, index=True),
            sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
            sa.Column('role', sa.String(50), default='member', nullable=False),
            sa.Column('joined_at', sa.DateTime(), default=datetime.utcnow, nullable=False),
            sa.UniqueConstraint('team_id', 'user_id', name='uq_team_user'),
        )
    if not _index_exists(conn, 'team_members', 'ix_team_members_user'):
        op.create_index('ix_team_members_user', 'team_members', ['user_id'])

    # Create team_invitations table
    if not _table_exists(conn, 'team_invitations'):
        op.create_table(
            'team_invitations',
            sa.Column('id', sa.String(36), primary_key=True),
            sa.Column('team_id', sa.String(36), sa.ForeignKey('teams.id', ondelete='CASCADE'), nullable=False, index=True),
            sa.Column('email', sa.String(255), nullable=False),
            sa.Column('role', sa.String(50), default='member', nullable=False),
            sa.Column('token', sa.String(255), unique=True, nullable=False, index=True),
            sa.Column('invited_by', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
            sa.Column('expires_at', sa.DateTime(), nullable=False),
            sa.Column('accepted_at', sa.DateTime(), nullable=True),
            sa.Column('created_at', sa.DateTime(), default=datetime.utcnow, nullable=False),
        )
    if not _index_exists(conn, 'team_invitations', 'ix_invitations_team_email'):
        op.create_index('ix_invitations_team_email', 'team_invitations', ['team_id', 'email'])
    if not _index_exists(conn, 'team_invitations', 'ix_invitations_token'):
        op.create_index('ix_invitations_token', 'team_invitations', ['token'])

    # Create subscriptions table
    if not _table_exists(conn, 'subscriptions'):
        op.create_table(
            'subscriptions',
            sa.Column('id', sa.String(36), primary_key=True),
            sa.Column('team_id', sa.String(36), sa.ForeignKey('teams.id', ondelete='CASCADE'), nullable=False, unique=True, index=True),
            sa.Column('polar_subscription_id', sa.String(255), unique=True, nullable=True, index=True),
            sa.Column('polar_customer_id', sa.String(255), nullable=True, index=True),
            sa.Column('plan', sa.String(50), default='free', nullable=False),
            sa.Column('status', sa.String(50), default='active', nullable=False),
            sa.Column('seat_limit', sa.Integer(), default=1, nullable=False),
            sa.Column('charts_per_month', sa.Integer(), default=10, nullable=False),
            sa.Column('charts_created_this_month', sa.Integer(), default=0, nullable=False),
            sa.Column('billing_cycle_start', sa.DateTime(), nullable=True),
            sa.Column('current_period_start', sa.DateTime(), nullable=True),
            sa.Column('current_period_end', sa.DateTime(), nullable=True),
            sa.Column('created_at', sa.DateTime(), default=datetime.utcnow, nullable=False),
            sa.Column('updated_at', sa.DateTime(), default=datetime.utcnow, onupdate=datetime.utcnow),
        )
    if not _index_exists(conn, 'subscriptions', 'ix_subscriptions_polar_sub'):
        op.create_index('ix_subscriptions_polar_sub', 'subscriptions', ['polar_subscription_id'])
    if not _index_exists(conn, 'subscriptions', 'ix_subscriptions_status'):
        op.create_index('ix_subscriptions_status', 'subscriptions', ['status'])

    # Add team_id column to charts table
    if not _column_exists(conn, 'charts', 'team_id'):
        op.add_column('charts', sa.Column('team_id', sa.String(36), sa.ForeignKey('teams.id', ondelete='CASCADE'), nullable=True, index=True))
    if not _index_exists(conn, 'charts', 'ix_charts_team_created'):
        op.create_index('ix_charts_team_created', 'charts', ['team_id', 'created_at'])

    # Create personal teams for existing users and migrate their charts
    connection = op.get_bind()

    # Get all existing users
    users = connection.execute(sa.text("SELECT id, email, name FROM users")).fetchall()

    for user in users:
        user_id = user[0]
        email = user[1]
        name = user[2] or email.split('@')[0]

        # Check if this user already has a personal team (idempotent)
        existing = connection.execute(
            sa.text("SELECT id FROM teams WHERE owner_id = :owner_id AND is_personal = true"),
            {"owner_id": user_id}
        ).fetchone()
        if existing:
            # Already has a personal team, just make sure charts are assigned
            team_id = existing[0]
            connection.execute(
                sa.text("UPDATE charts SET team_id = :team_id WHERE user_id = :user_id AND team_id IS NULL"),
                {"team_id": team_id, "user_id": user_id}
            )
            continue

        # Create slug from email (before @, sanitized)
        slug_base = email.split('@')[0].lower().replace('.', '-').replace('+', '-')
        slug = f"{slug_base}-personal"

        # Ensure unique slug
        counter = 1
        original_slug = slug
        while connection.execute(sa.text("SELECT 1 FROM teams WHERE slug = :slug"), {"slug": slug}).fetchone():
            slug = f"{original_slug}-{counter}"
            counter += 1

        team_id = generate_uuid()
        now = datetime.utcnow()

        # Create personal team
        connection.execute(
            sa.text("""
                INSERT INTO teams (id, name, slug, owner_id, is_personal, created_at, updated_at)
                VALUES (:id, :name, :slug, :owner_id, :is_personal, :created_at, :updated_at)
            """),
            {
                "id": team_id,
                "name": f"{name}'s Team",
                "slug": slug,
                "owner_id": user_id,
                "is_personal": True,
                "created_at": now,
                "updated_at": now,
            }
        )

        # Add user as owner member
        connection.execute(
            sa.text("""
                INSERT INTO team_members (id, team_id, user_id, role, joined_at)
                VALUES (:id, :team_id, :user_id, :role, :joined_at)
            """),
            {
                "id": generate_uuid(),
                "team_id": team_id,
                "user_id": user_id,
                "role": "owner",
                "joined_at": now,
            }
        )

        # Create free subscription for team
        connection.execute(
            sa.text("""
                INSERT INTO subscriptions (id, team_id, plan, status, seat_limit, charts_per_month, charts_created_this_month, created_at, updated_at)
                VALUES (:id, :team_id, :plan, :status, :seat_limit, :charts_per_month, :charts_created_this_month, :created_at, :updated_at)
            """),
            {
                "id": generate_uuid(),
                "team_id": team_id,
                "plan": "free",
                "status": "active",
                "seat_limit": 1,
                "charts_per_month": 10,
                "charts_created_this_month": 0,
                "created_at": now,
                "updated_at": now,
            }
        )

        # Update user's existing charts to belong to their personal team
        connection.execute(
            sa.text("UPDATE charts SET team_id = :team_id WHERE user_id = :user_id AND team_id IS NULL"),
            {"team_id": team_id, "user_id": user_id}
        )


def downgrade() -> None:
    # Remove team_id from charts
    op.drop_index('ix_charts_team_created', 'charts')
    op.drop_column('charts', 'team_id')

    # Drop tables in reverse order
    op.drop_table('subscriptions')
    op.drop_table('team_invitations')
    op.drop_table('team_members')
    op.drop_table('teams')
