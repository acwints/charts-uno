#!/usr/bin/env python3
"""Seed script to create demo teams with favicon logos."""

import os
import sys
from datetime import datetime
from uuid import uuid4

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models.database import Team, TeamMember, Subscription

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    print("DATABASE_URL not set")
    sys.exit(1)

engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)
db = Session()

# Teams to create with their domains for favicon
TEAMS = [
    {"name": "Winter Advisory", "slug": "winter-advisory", "domain": "winteradvisory.llc"},
    {"name": "Bantee Golf", "slug": "bantee-golf", "domain": "banteegolf.com"},
    {"name": "TBPN", "slug": "tbpn", "domain": "tbpn.com"},
    {"name": "Not Boring", "slug": "not-boring", "domain": "notboring.co"},
]

# Get the first user to be the owner (you)
from models.database import User
owner = db.query(User).first()
if not owner:
    print("No users found in database. Please log in first.")
    sys.exit(1)

print(f"Using owner: {owner.email}")

for team_data in TEAMS:
    # Check if team already exists
    existing = db.query(Team).filter(Team.slug == team_data["slug"]).first()
    if existing:
        print(f"Team '{team_data['name']}' already exists, skipping...")
        continue

    team_id = str(uuid4())

    # Use Google's favicon service for logo
    logo_url = f"https://www.google.com/s2/favicons?domain={team_data['domain']}&sz=128"

    # Create team
    team = Team(
        id=team_id,
        name=team_data["name"],
        slug=team_data["slug"],
        owner_id=owner.id,
        is_personal=False,
        custom_logo_url=logo_url,
        watermark_enabled=True,
        created_at=datetime.utcnow(),
    )
    db.add(team)

    # Add owner as team member
    member = TeamMember(
        id=str(uuid4()),
        team_id=team_id,
        user_id=owner.id,
        role="owner",
        joined_at=datetime.utcnow(),
    )
    db.add(member)

    # Create free subscription
    subscription = Subscription(
        id=str(uuid4()),
        team_id=team_id,
        plan="free",
        status="active",
        seat_limit=1,
        charts_per_month=10,
        charts_created_this_month=0,
        created_at=datetime.utcnow(),
    )
    db.add(subscription)

    print(f"Created team: {team_data['name']} with logo from {team_data['domain']}")

db.commit()
print("\nDone! Teams created successfully.")
db.close()
