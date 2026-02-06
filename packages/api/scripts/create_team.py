#!/usr/bin/env python3
"""
Create a new team with subscription and invitations.

Usage:
    python scripts/create_team.py

This script creates a team for College Sports Company with:
- Pro plan subscription
- Invitations for specified email addresses
"""
import os
import sys
import secrets
from datetime import datetime, timedelta

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from sqlalchemy.orm import Session
from models.database import (
    SessionLocal, User, Team, TeamMember, TeamInvitation, Subscription,
    generate_uuid
)
from services.polar_service import PLAN_CONFIG


def generate_slug(name: str, db: Session) -> str:
    """Generate a unique slug from a team name"""
    import re
    base_slug = re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')
    if not base_slug:
        base_slug = 'team'

    slug = base_slug
    counter = 1
    while db.query(Team).filter(Team.slug == slug).first():
        slug = f"{base_slug}-{counter}"
        counter += 1
    return slug


def create_team_for_company(
    db: Session,
    team_name: str,
    brand_domain: str,
    plan: str,
    owner_email: str,
    invite_emails: list[str],
) -> dict:
    """
    Create a team with subscription and invitations.

    Args:
        db: Database session
        team_name: Name of the team
        brand_domain: Company website domain
        plan: Subscription plan (free, pro, business)
        owner_email: Email of the team owner (must exist in system)
        invite_emails: List of emails to invite

    Returns:
        dict with created team info
    """
    # Find or validate owner
    owner = db.query(User).filter(User.email == owner_email).first()

    if not owner:
        # Check if any of the invite emails exist as users
        for email in invite_emails:
            potential_owner = db.query(User).filter(User.email == email).first()
            if potential_owner:
                owner = potential_owner
                owner_email = email
                print(f"Using existing user {email} as owner")
                break

    if not owner:
        print(f"\nNo existing user found for owner email: {owner_email}")
        print("Available options:")
        print("1. Have the owner sign in at the app first, then run this script again")
        print("2. Use an existing admin user as temporary owner")

        # List existing users
        existing_users = db.query(User).limit(5).all()
        if existing_users:
            print("\nExisting users in the system:")
            for u in existing_users:
                print(f"  - {u.email} (id: {u.id})")

            use_existing = input("\nUse an existing user as owner? (enter email or 'n'): ").strip()
            if use_existing and use_existing.lower() != 'n':
                owner = db.query(User).filter(User.email == use_existing).first()
                if owner:
                    owner_email = use_existing
                else:
                    print(f"User {use_existing} not found")
                    return None

        if not owner:
            print("\nCannot create team without an owner. Exiting.")
            return None

    # Check if team already exists
    existing_team = db.query(Team).filter(Team.slug == generate_slug(team_name, db)).first()
    if existing_team and existing_team.name == team_name:
        print(f"\nTeam '{team_name}' may already exist (slug: {existing_team.slug})")
        confirm = input("Create anyway? (y/n): ").strip().lower()
        if confirm != 'y':
            return None

    # Create team
    slug = generate_slug(team_name, db)
    team = Team(
        id=generate_uuid(),
        name=team_name,
        slug=slug,
        owner_id=owner.id,
        is_personal=False,
        brand_domain=brand_domain,
    )
    db.add(team)
    db.flush()

    print(f"\nCreated team: {team.name} (slug: {slug})")

    # Add owner as team member
    owner_member = TeamMember(
        id=generate_uuid(),
        team_id=team.id,
        user_id=owner.id,
        role="owner",
    )
    db.add(owner_member)
    print(f"Added {owner_email} as owner")

    # Create subscription
    plan_config = PLAN_CONFIG.get(plan, PLAN_CONFIG["free"])
    subscription = Subscription(
        id=generate_uuid(),
        team_id=team.id,
        plan=plan,
        status="active",
        seat_limit=plan_config["seat_limit"],
        charts_per_month=plan_config["charts_per_month"],
        charts_created_this_month=0,
        current_period_start=datetime.utcnow(),
        current_period_end=datetime.utcnow() + timedelta(days=365),  # 1 year for manual setup
    )
    db.add(subscription)
    print(f"Created {plan} subscription (seats: {plan_config['seat_limit']}, charts: {'unlimited' if plan_config['charts_per_month'] == -1 else plan_config['charts_per_month']}/month)")

    # Create invitations for other emails
    invitations = []
    for email in invite_emails:
        if email.lower() == owner_email.lower():
            continue  # Skip owner, already added

        # Check if already a member
        existing_user = db.query(User).filter(User.email == email).first()
        if existing_user:
            existing_member = db.query(TeamMember).filter(
                TeamMember.team_id == team.id,
                TeamMember.user_id == existing_user.id,
            ).first()
            if existing_member:
                print(f"User {email} is already a member")
                continue

            # Add directly as member
            member = TeamMember(
                id=generate_uuid(),
                team_id=team.id,
                user_id=existing_user.id,
                role="admin",
            )
            db.add(member)
            print(f"Added existing user {email} as admin")
        else:
            # Create invitation
            invitation = TeamInvitation(
                id=generate_uuid(),
                team_id=team.id,
                email=email,
                role="admin",
                token=secrets.token_urlsafe(32),
                invited_by=owner.id,
                expires_at=datetime.utcnow() + timedelta(days=30),
            )
            db.add(invitation)
            invitations.append(invitation)
            print(f"Created invitation for {email}")

    db.commit()

    # Print invitation links
    if invitations:
        print("\n" + "="*60)
        print("INVITATION LINKS (share with team members):")
        print("="*60)
        for inv in invitations:
            # Assuming frontend URL pattern
            print(f"\n{inv.email}:")
            print(f"  https://epic-charts.vercel.app/invite/{inv.token}")
        print("="*60)

    return {
        "team_id": team.id,
        "team_name": team.name,
        "slug": team.slug,
        "plan": plan,
        "owner": owner_email,
        "invitations": [(inv.email, inv.token) for inv in invitations],
    }


def main():
    # Configuration for College Sports Company
    TEAM_NAME = "College Sports Company"
    BRAND_DOMAIN = "collegesportsco.com"
    PLAN = "pro"
    INVITE_EMAILS = [
        "andrew.clark.winter@gmail.com",
        "pg@collegesportsco.com",
    ]

    print(f"\nCreating team: {TEAM_NAME}")
    print(f"Domain: {BRAND_DOMAIN}")
    print(f"Plan: {PLAN}")
    print(f"Invites: {', '.join(INVITE_EMAILS)}")
    print("-" * 40)

    db = SessionLocal()
    try:
        result = create_team_for_company(
            db=db,
            team_name=TEAM_NAME,
            brand_domain=BRAND_DOMAIN,
            plan=PLAN,
            owner_email=INVITE_EMAILS[0],  # First email as default owner
            invite_emails=INVITE_EMAILS,
        )

        if result:
            print("\n" + "="*60)
            print("SUCCESS!")
            print("="*60)
            print(f"Team ID: {result['team_id']}")
            print(f"Team Name: {result['team_name']}")
            print(f"Slug: {result['slug']}")
            print(f"Plan: {result['plan']}")
            print(f"Owner: {result['owner']}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
