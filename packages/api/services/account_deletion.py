"""Remove a user and the rows that belong to them.

Shared teams keep their other members: ownership moves to an admin, or to
the longest-standing remaining member. A personal team, and any team with
no one else in it, is deleted with the account.
"""
from sqlalchemy.orm import Session

from models.database import (
    Chart,
    ChartPublication,
    ContentReport,
    Dashboard,
    DashboardItem,
    Like,
    NativeAuthCode,
    SavedChart,
    SqlConnection,
    Subscription,
    Team,
    TeamInvitation,
    TeamMember,
    User,
    UserBlock,
)


def _ids(query) -> list[str]:
    return [row[0] for row in query.all()]


def delete_user_account(db: Session, user: User) -> None:
    user_id = user.id

    for team in db.query(Team).filter(Team.owner_id == user_id).all():
        others = (
            db.query(TeamMember)
            .filter(TeamMember.team_id == team.id, TeamMember.user_id != user_id)
            .order_by(TeamMember.joined_at.asc())
            .all()
        )
        if team.is_personal or not others:
            continue
        successor = next((member for member in others if member.role == "admin"), others[0])
        team.owner_id = successor.user_id
        successor.role = "owner"
    db.flush()

    chart_ids = _ids(db.query(Chart.id).filter(Chart.user_id == user_id))
    if chart_ids:
        db.query(DashboardItem).filter(DashboardItem.chart_id.in_(chart_ids)).delete(synchronize_session=False)
        db.query(Like).filter(Like.chart_id.in_(chart_ids)).delete(synchronize_session=False)
        db.query(SavedChart).filter(SavedChart.chart_id.in_(chart_ids)).delete(synchronize_session=False)
        db.query(ChartPublication).filter(ChartPublication.chart_id.in_(chart_ids)).delete(synchronize_session=False)
        db.query(Chart).filter(Chart.user_id == user_id).update(
            {Chart.sql_connection_id: None},
            synchronize_session=False,
        )
        db.query(Chart).filter(Chart.user_id == user_id).delete(synchronize_session=False)

    dashboard_ids = _ids(db.query(Dashboard.id).filter(Dashboard.user_id == user_id))
    if dashboard_ids:
        db.query(DashboardItem).filter(DashboardItem.dashboard_id.in_(dashboard_ids)).delete(synchronize_session=False)
        db.query(Dashboard).filter(Dashboard.user_id == user_id).delete(synchronize_session=False)

    connection_ids = _ids(db.query(SqlConnection.id).filter(SqlConnection.created_by == user_id))
    if connection_ids:
        db.query(Chart).filter(Chart.sql_connection_id.in_(connection_ids)).update(
            {Chart.sql_connection_id: None},
            synchronize_session=False,
        )
        db.query(SqlConnection).filter(SqlConnection.id.in_(connection_ids)).delete(synchronize_session=False)

    db.query(Like).filter(Like.user_id == user_id).delete(synchronize_session=False)
    db.query(SavedChart).filter(SavedChart.user_id == user_id).delete(synchronize_session=False)
    db.query(ChartPublication).filter(ChartPublication.published_by == user_id).delete(synchronize_session=False)
    db.query(ContentReport).filter(ContentReport.reporter_id == user_id).delete(synchronize_session=False)
    db.query(ContentReport).filter(ContentReport.reported_user_id == user_id).update(
        {ContentReport.reported_user_id: None},
        synchronize_session=False,
    )
    db.query(UserBlock).filter(
        (UserBlock.blocker_id == user_id) | (UserBlock.blocked_id == user_id)
    ).delete(synchronize_session=False)
    db.query(NativeAuthCode).filter(NativeAuthCode.user_id == user_id).delete(synchronize_session=False)
    db.query(TeamInvitation).filter(TeamInvitation.invited_by == user_id).delete(synchronize_session=False)
    db.query(TeamMember).filter(TeamMember.user_id == user_id).delete(synchronize_session=False)

    owned_ids = _ids(db.query(Team.id).filter(Team.owner_id == user_id))
    if owned_ids:
        leftover_charts = _ids(db.query(Chart.id).filter(Chart.team_id.in_(owned_ids)))
        if leftover_charts:
            db.query(DashboardItem).filter(DashboardItem.chart_id.in_(leftover_charts)).delete(synchronize_session=False)
            db.query(Like).filter(Like.chart_id.in_(leftover_charts)).delete(synchronize_session=False)
            db.query(SavedChart).filter(SavedChart.chart_id.in_(leftover_charts)).delete(synchronize_session=False)
            db.query(ChartPublication).filter(ChartPublication.chart_id.in_(leftover_charts)).delete(synchronize_session=False)
            db.query(Chart).filter(Chart.id.in_(leftover_charts)).delete(synchronize_session=False)
        team_dashboards = _ids(db.query(Dashboard.id).filter(Dashboard.team_id.in_(owned_ids)))
        if team_dashboards:
            db.query(DashboardItem).filter(DashboardItem.dashboard_id.in_(team_dashboards)).delete(synchronize_session=False)
            db.query(Dashboard).filter(Dashboard.id.in_(team_dashboards)).delete(synchronize_session=False)
        team_connections = _ids(db.query(SqlConnection.id).filter(SqlConnection.team_id.in_(owned_ids)))
        if team_connections:
            db.query(Chart).filter(Chart.sql_connection_id.in_(team_connections)).update(
                {Chart.sql_connection_id: None},
                synchronize_session=False,
            )
            db.query(SqlConnection).filter(SqlConnection.id.in_(team_connections)).delete(synchronize_session=False)
        db.query(Subscription).filter(Subscription.team_id.in_(owned_ids)).delete(synchronize_session=False)
        db.query(TeamInvitation).filter(TeamInvitation.team_id.in_(owned_ids)).delete(synchronize_session=False)
        db.query(TeamMember).filter(TeamMember.team_id.in_(owned_ids)).delete(synchronize_session=False)
        db.query(ChartPublication).filter(ChartPublication.team_id.in_(owned_ids)).delete(synchronize_session=False)
        db.query(Team).filter(Team.id.in_(owned_ids)).delete(synchronize_session=False)

    db.expire_all()
    fresh = db.query(User).filter(User.id == user_id).one()
    db.delete(fresh)
    db.commit()
