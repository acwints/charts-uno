import os
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    create_engine,
    Column,
    String,
    DateTime,
    Text,
    JSON,
    ForeignKey,
    Integer,
    Index,
    UniqueConstraint,
    Boolean,
)
from sqlalchemy.orm import sessionmaker, relationship, declarative_base

# Determine database URL
DATABASE_URL = os.environ.get("DATABASE_URL")

if not DATABASE_URL:
    # Try to construct from Railway PostgreSQL environment variables
    pg_host = os.environ.get("PGHOST")
    pg_port = os.environ.get("PGPORT", "5432")
    pg_user = os.environ.get("PGUSER")
    pg_password = os.environ.get("PGPASSWORD")
    pg_database = os.environ.get("PGDATABASE", "railway")

    if pg_host and pg_user and pg_password:
        DATABASE_URL = f"postgresql://{pg_user}:{pg_password}@{pg_host}:{pg_port}/{pg_database}"
    else:
        # Fallback to SQLite for local development
        DATABASE_URL = "sqlite:///./charts_agent.db"

# Configure engine based on database type
if DATABASE_URL.startswith("postgresql"):
    engine = create_engine(
        DATABASE_URL,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,
        pool_recycle=3600,
        connect_args={"options": "-c timezone=utc"}
    )
else:
    # SQLite
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False}
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def generate_uuid() -> str:
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    email = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=True)
    picture = Column(Text, nullable=True)
    google_id = Column(String(255), unique=True, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_login = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    charts = relationship("Chart", back_populates="user", cascade="all, delete-orphan")
    saved_charts = relationship("SavedChart", back_populates="user", cascade="all, delete-orphan")
    likes = relationship("Like", back_populates="user", cascade="all, delete-orphan")
    owned_teams = relationship("Team", back_populates="owner", cascade="all, delete-orphan")
    team_memberships = relationship("TeamMember", back_populates="user", cascade="all, delete-orphan")
    sent_invitations = relationship("TeamInvitation", back_populates="inviter", cascade="all, delete-orphan")


class Chart(Base):
    __tablename__ = "charts"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    team_id = Column(String(36), ForeignKey("teams.id", ondelete="CASCADE"), nullable=True, index=True)  # Optional for backward compat
    title = Column(String(500), nullable=True)
    description = Column(Text, nullable=True)

    # Chart data and configuration stored as JSON
    data = Column(JSON, nullable=False)  # ChartData object
    config = Column(JSON, nullable=False)  # ChartConfig object

    # Source information
    source_type = Column(String(50), nullable=True)  # 'upload', 'paste', 'twitter', 'url'
    source_url = Column(Text, nullable=True)

    # Metadata
    is_public = Column(Integer, default=0)  # 0 = private, 1 = public
    view_count = Column(Integer, default=0)
    like_count = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="charts")
    team = relationship("Team", back_populates="charts")
    saved_by = relationship("SavedChart", back_populates="chart", cascade="all, delete-orphan")
    likes = relationship("Like", back_populates="chart", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_charts_user_created", "user_id", "created_at"),
        Index("ix_charts_public_created", "is_public", "created_at"),
        Index("ix_charts_team_created", "team_id", "created_at"),
    )


class SavedChart(Base):
    """User's saved/bookmarked charts (can be their own or others' public charts)"""
    __tablename__ = "saved_charts"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    chart_id = Column(String(36), ForeignKey("charts.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    user = relationship("User", back_populates="saved_charts")
    chart = relationship("Chart", back_populates="saved_by")

    __table_args__ = (
        UniqueConstraint("user_id", "chart_id", name="uq_user_saved_chart"),
        Index("ix_saved_user_created", "user_id", "created_at"),
    )


class Like(Base):
    """Likes on charts"""
    __tablename__ = "likes"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    chart_id = Column(String(36), ForeignKey("charts.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    user = relationship("User", back_populates="likes")
    chart = relationship("Chart", back_populates="likes")

    __table_args__ = (
        UniqueConstraint("user_id", "chart_id", name="uq_user_like_chart"),
        Index("ix_likes_chart_created", "chart_id", "created_at"),
    )


class Team(Base):
    """Teams/Organizations for collaborative chart creation"""
    __tablename__ = "teams"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False)
    slug = Column(String(255), unique=True, nullable=False, index=True)
    owner_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    is_personal = Column(Boolean, default=False, nullable=False)  # True for auto-created personal teams
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Branding settings
    custom_logo_url = Column(Text, nullable=True)  # base64 data URL or external URL
    watermark_enabled = Column(Boolean, default=True, nullable=False)

    # Relationships
    owner = relationship("User", back_populates="owned_teams")
    members = relationship("TeamMember", back_populates="team", cascade="all, delete-orphan")
    invitations = relationship("TeamInvitation", back_populates="team", cascade="all, delete-orphan")
    subscription = relationship("Subscription", back_populates="team", uselist=False, cascade="all, delete-orphan")
    charts = relationship("Chart", back_populates="team", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_teams_owner_created", "owner_id", "created_at"),
    )


class TeamMember(Base):
    """Team membership with roles"""
    __tablename__ = "team_members"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    team_id = Column(String(36), ForeignKey("teams.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(50), default="member", nullable=False)  # "owner", "admin", "member"
    joined_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    team = relationship("Team", back_populates="members")
    user = relationship("User", back_populates="team_memberships")

    __table_args__ = (
        UniqueConstraint("team_id", "user_id", name="uq_team_user"),
        Index("ix_team_members_user", "user_id"),
    )


class TeamInvitation(Base):
    """Pending team invitations"""
    __tablename__ = "team_invitations"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    team_id = Column(String(36), ForeignKey("teams.id", ondelete="CASCADE"), nullable=False, index=True)
    email = Column(String(255), nullable=False)
    role = Column(String(50), default="member", nullable=False)
    token = Column(String(255), unique=True, nullable=False, index=True)
    invited_by = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    accepted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    team = relationship("Team", back_populates="invitations")
    inviter = relationship("User", back_populates="sent_invitations")

    __table_args__ = (
        Index("ix_invitations_team_email", "team_id", "email"),
        Index("ix_invitations_token", "token"),
    )


class Subscription(Base):
    """Team subscription/billing information (managed by Polar.sh)"""
    __tablename__ = "subscriptions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    team_id = Column(String(36), ForeignKey("teams.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    polar_subscription_id = Column(String(255), unique=True, nullable=True, index=True)  # Null for free tier
    polar_customer_id = Column(String(255), nullable=True, index=True)
    plan = Column(String(50), default="free", nullable=False)  # "free", "pro", "business"
    status = Column(String(50), default="active", nullable=False)  # "active", "canceled", "past_due"
    seat_limit = Column(Integer, default=1, nullable=False)  # 1 for free, 5 for pro, unlimited (-1) for business
    charts_per_month = Column(Integer, default=10, nullable=False)  # 10 for free, -1 (unlimited) for paid
    charts_created_this_month = Column(Integer, default=0, nullable=False)
    billing_cycle_start = Column(DateTime, nullable=True)
    current_period_start = Column(DateTime, nullable=True)
    current_period_end = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    team = relationship("Team", back_populates="subscription")

    __table_args__ = (
        Index("ix_subscriptions_polar_sub", "polar_subscription_id"),
        Index("ix_subscriptions_status", "status"),
    )


def init_db():
    """Initialize database tables"""
    Base.metadata.create_all(bind=engine)


def get_db():
    """Dependency for database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
