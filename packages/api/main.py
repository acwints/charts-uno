import os
from dotenv import load_dotenv

# Load environment variables BEFORE other imports
load_dotenv()

import json
import base64
import secrets
import logging
from datetime import datetime, timedelta
from typing import Optional, List
import re

import httpx
from fastapi import FastAPI, Depends, HTTPException, Request, Response, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from models.database import (
    init_db, get_db, User, Chart, SavedChart, Like,
    Team, TeamMember, TeamInvitation, Subscription, generate_uuid,
)
from dependencies import (
    get_current_user,
    get_optional_user,
    create_access_token,
    IS_PRODUCTION,
)
from schemas import (
    UserResponse,
    ChartCreate,
    ChartUpdate,
    ChartResponse,
    ChartListResponse,
    SavedChartResponse,
    LikeResponse,
    TokenResponse,
    ImageAnalysisRequest,
    ImageAnalysisResponse,
    PromptGenerateRequest,
    StockPriceRequest,
    StockSearchRequest,
    StockInsightsRequest,
    ChatRequest,
    ChatResponse,
    ChartRecommendRequest,
    ChartRecommendResponse,
    InfographicRequest,
    InfographicResponse,
    # Team schemas
    TeamCreate,
    TeamUpdate,
    TeamResponse,
    TeamListResponse,
    TeamMemberResponse,
    TeamMemberAdd,
    TeamMemberUpdate,
    InvitationCreate,
    InvitationResponse,
    InvitationListResponse,
    SubscriptionResponse,
    CheckoutRequest,
    CheckoutResponse,
    PortalResponse,
    UsageSummaryResponse,
    ChartCreateWithTeam,
    # Branding schemas
    TeamBrandingUpdate,
    TeamBrandingResponse,
    BrandInferRequest,
    BrandInferResponse,
)
from services.ai_service import analyze_image, chat_with_chart, recommend_chart_type, generate_infographic, generate_chart_from_prompt, infer_brand_from_website
from services.stock_service import fetch_stock_prices, search_tickers, generate_stock_insights
from services.polar_service import polar_service, PolarServiceError, PLAN_CONFIG

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Rate limiter
limiter = Limiter(key_func=get_remote_address)

# Environment configuration
DEFAULT_PROD_FRONTEND = "https://chartsuno.vercel.app"
DEFAULT_DEV_FRONTEND = "http://localhost:5173"
FRONTEND_URL = os.environ.get(
    "FRONTEND_URL",
    DEFAULT_PROD_FRONTEND if IS_PRODUCTION else DEFAULT_DEV_FRONTEND,
)
ALLOWED_FRONTEND_DOMAINS = [
    d.strip()
    for d in os.environ.get("ALLOWED_FRONTEND_DOMAINS", "").split(",")
    if d.strip()
]
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.environ.get("GOOGLE_REDIRECT_URI", "http://localhost:8080/auth/callback")

# Initialize FastAPI app
app = FastAPI(
    title="Charts Agent API",
    description="Backend API for Charts Agent - AI-powered chart visualization",
    version="1.0.0",
)

# Add rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS configuration
allowed_origins = [FRONTEND_URL]
if ALLOWED_FRONTEND_DOMAINS:
    allowed_origins.extend(ALLOWED_FRONTEND_DOMAINS)

# Always allow the deployed frontend URLs to prevent env misconfig CORS failures
PROD_ORIGINS = [
    DEFAULT_PROD_FRONTEND,
    "https://www.chartsuno.vercel.app",
    "https://www.chartsuno.com",
    "https://chartsuno.com",
]
for origin in PROD_ORIGINS:
    if origin not in allowed_origins:
        allowed_origins.append(origin)

# Add common development origins
if not IS_PRODUCTION:
    allowed_origins.extend([
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ])

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(GZipMiddleware, minimum_size=1000)


# Initialize database on startup
@app.on_event("startup")
async def startup_event():
    logger.info("Initializing database...")
    init_db()
    logger.info("Database initialized")


# Health check
@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}


# ============================================================================
# Authentication Endpoints
# ============================================================================

def _safe_frontend_target(target: Optional[str]) -> str:
    """Validate and return a safe frontend redirect URL"""
    if not target:
        return FRONTEND_URL

    # Check against allowed domains (includes CORS prod origins)
    allowed = (
        [FRONTEND_URL]
        + [d.strip() for d in ALLOWED_FRONTEND_DOMAINS if d.strip()]
        + PROD_ORIGINS
    )

    # Allow localhost in development
    if not IS_PRODUCTION:
        if target.startswith("http://localhost:") or target.startswith("http://127.0.0.1:"):
            return target

    for domain in allowed:
        if target.startswith(domain):
            return target

    logger.warning(f"Blocked redirect to untrusted domain: {target}")
    return FRONTEND_URL


@app.get("/auth/google")
async def google_auth(target: Optional[str] = None):
    """Initiate Google OAuth flow"""
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Google OAuth not configured")

    # Generate state with nonce and optional frontend target
    nonce = secrets.token_urlsafe(32)
    state_data = {"nonce": nonce}
    if target:
        state_data["frontend"] = target

    state = base64.urlsafe_b64encode(json.dumps(state_data).encode()).decode()

    # Build authorization URL
    auth_url = (
        "https://accounts.google.com/o/oauth2/v2/auth?"
        f"client_id={GOOGLE_CLIENT_ID}&"
        f"redirect_uri={GOOGLE_REDIRECT_URI}&"
        "scope=openid%20email%20profile&"
        "response_type=code&"
        "access_type=offline&"
        f"state={state}"
    )

    return {"auth_url": auth_url}


@app.get("/auth/callback")
async def google_callback(
    code: str,
    state: str,
    db: Session = Depends(get_db),
):
    """Handle Google OAuth callback"""
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="Google OAuth not configured")

    # Decode state
    try:
        state_data = json.loads(base64.urlsafe_b64decode(state).decode())
        frontend_target = _safe_frontend_target(state_data.get("frontend"))
    except Exception:
        frontend_target = FRONTEND_URL

    # Exchange code for tokens
    async with httpx.AsyncClient() as client:
        token_response = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": GOOGLE_REDIRECT_URI,
            },
        )

        if token_response.status_code != 200:
            logger.error(f"Token exchange failed: {token_response.text}")
            raise HTTPException(status_code=400, detail="Failed to exchange code for token")

        tokens = token_response.json()
        access_token = tokens.get("access_token")

        # Get user info
        user_response = await client.get(
            f"https://www.googleapis.com/oauth2/v2/userinfo?access_token={access_token}"
        )

        if user_response.status_code != 200:
            logger.error(f"Failed to get user info: {user_response.text}")
            raise HTTPException(status_code=400, detail="Failed to get user info")

        user_info = user_response.json()

    # Find or create user
    google_id = user_info.get("id")
    email = user_info.get("email")
    name = user_info.get("name")
    picture = user_info.get("picture")

    user = db.query(User).filter(User.google_id == google_id).first()
    is_new_user = False

    if user:
        # Update existing user
        user.email = email
        user.name = name
        user.picture = picture
        user.last_login = datetime.utcnow()
    else:
        # Create new user
        user = User(
            google_id=google_id,
            email=email,
            name=name,
            picture=picture,
        )
        db.add(user)
        is_new_user = True

    db.commit()
    db.refresh(user)

    # Create personal team for new users
    if is_new_user:
        _create_personal_team(db, user)

    # Generate JWT token
    jwt_token = create_access_token(user.id)

    # Redirect to frontend with token
    redirect_url = f"{frontend_target}?auth_token={jwt_token}"

    return Response(
        status_code=302,
        headers={"Location": redirect_url},
    )


@app.post("/api/auth/set-cookie")
async def set_auth_cookie(
    response: Response,
    token: str = Query(..., description="JWT token to set as cookie"),
    db: Session = Depends(get_db),
):
    """Exchange a URL token for an httpOnly cookie"""
    from dependencies import decode_token

    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")

    # Verify user exists
    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    # Set httpOnly cookie
    response.set_cookie(
        key="auth_token",
        value=token,
        httponly=True,
        secure=IS_PRODUCTION,
        samesite="lax" if not IS_PRODUCTION else "none",
        max_age=7 * 24 * 60 * 60,  # 7 days
        path="/",
    )

    return {"status": "ok"}


@app.post("/api/auth/logout")
async def logout(response: Response):
    """Clear the authentication cookie"""
    response.delete_cookie(
        key="auth_token",
        httponly=True,
        secure=IS_PRODUCTION,
        samesite="lax" if not IS_PRODUCTION else "none",
        path="/",
    )
    return {"status": "ok"}


# ============================================================================
# User Endpoints
# ============================================================================

@app.get("/api/user/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_user),
):
    """Get current authenticated user info"""
    return current_user


# ============================================================================
# Chart Endpoints
# ============================================================================

def _get_user_interactions(
    db: Session,
    user_id: str,
    chart_ids: List[str],
) -> tuple[set, set]:
    """Batch fetch user's likes and saves for a list of charts.

    Returns (liked_chart_ids, saved_chart_ids) as sets for O(1) lookup.
    """
    if not chart_ids:
        return set(), set()

    # Single query for all likes
    liked_ids = {
        row[0] for row in db.query(Like.chart_id)
        .filter(Like.user_id == user_id, Like.chart_id.in_(chart_ids))
        .all()
    }

    # Single query for all saves
    saved_ids = {
        row[0] for row in db.query(SavedChart.chart_id)
        .filter(SavedChart.user_id == user_id, SavedChart.chart_id.in_(chart_ids))
        .all()
    }

    return liked_ids, saved_ids


def _chart_to_response(
    chart: Chart,
    current_user: Optional[User] = None,
    db: Optional[Session] = None,
    liked_ids: Optional[set] = None,
    saved_ids: Optional[set] = None,
) -> ChartResponse:
    """Convert a Chart model to a ChartResponse with computed fields.

    If liked_ids/saved_ids are provided (from batch fetch), use those.
    Otherwise fall back to individual queries (for single chart lookups).
    """
    is_liked = False
    is_saved = False

    if current_user:
        if liked_ids is not None and saved_ids is not None:
            # Use pre-computed sets (batch mode)
            is_liked = chart.id in liked_ids
            is_saved = chart.id in saved_ids
        elif db:
            # Fall back to individual queries (single chart mode)
            is_liked = db.query(Like).filter(
                Like.user_id == current_user.id,
                Like.chart_id == chart.id,
            ).first() is not None

            is_saved = db.query(SavedChart).filter(
                SavedChart.user_id == current_user.id,
                SavedChart.chart_id == chart.id,
            ).first() is not None

    return ChartResponse(
        id=chart.id,
        user_id=chart.user_id,
        title=chart.title,
        description=chart.description,
        data=chart.data,
        config=chart.config,
        source_type=chart.source_type,
        source_url=chart.source_url,
        is_public=bool(chart.is_public),
        view_count=chart.view_count,
        like_count=chart.like_count,
        created_at=chart.created_at,
        updated_at=chart.updated_at,
        is_liked=is_liked,
        is_saved=is_saved,
        user=UserResponse.model_validate(chart.user) if chart.user else None,
    )


@app.post("/api/charts", response_model=ChartResponse)
async def create_chart(
    chart_data: ChartCreateWithTeam,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new chart"""
    # Determine which team to use
    team_id = chart_data.team_id

    if team_id:
        # Verify user is a member of the specified team
        team, _ = _get_team_with_access(db, team_id, current_user)
    else:
        # Use user's personal team
        membership = db.query(TeamMember).filter(
            TeamMember.user_id == current_user.id,
        ).join(Team).filter(Team.is_personal == True).first()

        if membership:
            team_id = membership.team_id
            team = membership.team
        else:
            # Create personal team if it doesn't exist (shouldn't happen normally)
            team = _create_personal_team(db, current_user)
            team_id = team.id

    # Check chart creation limit
    if not _check_can_create_chart(db, team):
        raise HTTPException(
            status_code=403,
            detail="Monthly chart limit reached. Upgrade your plan to create more charts."
        )

    chart = Chart(
        user_id=current_user.id,
        team_id=team_id,
        title=chart_data.title,
        description=chart_data.description,
        data=chart_data.data.model_dump(),
        config=chart_data.config.model_dump(),
        source_type=chart_data.source_type,
        source_url=chart_data.source_url,
        is_public=1 if chart_data.is_public else 0,
    )

    db.add(chart)

    # Increment chart count atomically to avoid race conditions under concurrency
    if team.subscription:
        db.query(Subscription).filter(
            Subscription.id == team.subscription.id
        ).update(
            {Subscription.charts_created_this_month: Subscription.charts_created_this_month + 1},
            synchronize_session="fetch",
        )

    db.commit()
    db.refresh(chart)

    return _chart_to_response(chart, current_user, db)


@app.get("/api/charts", response_model=ChartListResponse)
async def list_my_charts(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List current user's charts"""
    query = db.query(Chart).filter(Chart.user_id == current_user.id)
    total = query.count()

    charts = query.order_by(Chart.created_at.desc()).offset(offset).limit(limit).all()

    # Batch fetch user interactions (2 queries instead of 2*N)
    chart_ids = [c.id for c in charts]
    liked_ids, saved_ids = _get_user_interactions(db, current_user.id, chart_ids)

    return ChartListResponse(
        charts=[
            _chart_to_response(c, current_user, db, liked_ids, saved_ids)
            for c in charts
        ],
        total=total,
        limit=limit,
        offset=offset,
    )


@app.get("/api/charts/public", response_model=ChartListResponse)
async def list_public_charts(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    """List public charts (discover page)"""
    query = db.query(Chart).filter(Chart.is_public == 1)
    total = query.count()

    charts = query.order_by(Chart.created_at.desc()).offset(offset).limit(limit).all()

    # Batch fetch user interactions if user is logged in
    liked_ids: set = set()
    saved_ids: set = set()
    if current_user:
        chart_ids = [c.id for c in charts]
        liked_ids, saved_ids = _get_user_interactions(db, current_user.id, chart_ids)

    return ChartListResponse(
        charts=[
            _chart_to_response(c, current_user, db, liked_ids, saved_ids)
            for c in charts
        ],
        total=total,
        limit=limit,
        offset=offset,
    )


@app.get("/api/charts/{chart_id}", response_model=ChartResponse)
async def get_chart(
    chart_id: str,
    current_user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    """Get a single chart by ID"""
    chart = db.query(Chart).filter(Chart.id == chart_id).first()

    if not chart:
        raise HTTPException(status_code=404, detail="Chart not found")

    # Check access
    if not chart.is_public:
        if not current_user or chart.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")

    # Increment view count
    chart.view_count += 1
    db.commit()

    return _chart_to_response(chart, current_user, db)


@app.put("/api/charts/{chart_id}", response_model=ChartResponse)
async def update_chart(
    chart_id: str,
    chart_data: ChartUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a chart"""
    chart = db.query(Chart).filter(Chart.id == chart_id).first()

    if not chart:
        raise HTTPException(status_code=404, detail="Chart not found")

    if chart.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Update fields
    if chart_data.title is not None:
        chart.title = chart_data.title
    if chart_data.description is not None:
        chart.description = chart_data.description
    if chart_data.data is not None:
        chart.data = chart_data.data.model_dump()
    if chart_data.config is not None:
        chart.config = chart_data.config.model_dump()
    if chart_data.is_public is not None:
        chart.is_public = 1 if chart_data.is_public else 0

    db.commit()
    db.refresh(chart)

    return _chart_to_response(chart, current_user, db)


@app.delete("/api/charts/{chart_id}")
async def delete_chart(
    chart_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a chart"""
    chart = db.query(Chart).filter(Chart.id == chart_id).first()

    if not chart:
        raise HTTPException(status_code=404, detail="Chart not found")

    if chart.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    db.delete(chart)
    db.commit()

    return {"status": "ok"}


# ============================================================================
# Save/Bookmark Endpoints
# ============================================================================

@app.post("/api/charts/{chart_id}/save", response_model=SavedChartResponse)
async def save_chart(
    chart_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Save/bookmark a chart"""
    chart = db.query(Chart).filter(Chart.id == chart_id).first()

    if not chart:
        raise HTTPException(status_code=404, detail="Chart not found")

    # Check if already saved
    existing = db.query(SavedChart).filter(
        SavedChart.user_id == current_user.id,
        SavedChart.chart_id == chart_id,
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Chart already saved")

    saved = SavedChart(user_id=current_user.id, chart_id=chart_id)
    db.add(saved)
    db.commit()
    db.refresh(saved)

    return SavedChartResponse(
        id=saved.id,
        chart_id=saved.chart_id,
        created_at=saved.created_at,
        chart=_chart_to_response(chart, current_user, db),
    )


@app.delete("/api/charts/{chart_id}/save")
async def unsave_chart(
    chart_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Remove a saved chart"""
    saved = db.query(SavedChart).filter(
        SavedChart.user_id == current_user.id,
        SavedChart.chart_id == chart_id,
    ).first()

    if not saved:
        raise HTTPException(status_code=404, detail="Saved chart not found")

    db.delete(saved)
    db.commit()

    return {"status": "ok"}


@app.get("/api/saved", response_model=List[SavedChartResponse])
async def list_saved_charts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List user's saved charts"""
    saved_charts = (
        db.query(SavedChart)
        .filter(SavedChart.user_id == current_user.id)
        .order_by(SavedChart.created_at.desc())
        .all()
    )

    # Batch fetch user interactions
    chart_ids = [s.chart_id for s in saved_charts]
    liked_ids, saved_ids = _get_user_interactions(db, current_user.id, chart_ids)

    return [
        SavedChartResponse(
            id=s.id,
            chart_id=s.chart_id,
            created_at=s.created_at,
            chart=_chart_to_response(s.chart, current_user, db, liked_ids, saved_ids),
        )
        for s in saved_charts
    ]


# ============================================================================
# Like Endpoints
# ============================================================================

@app.post("/api/charts/{chart_id}/like", response_model=LikeResponse)
async def like_chart(
    chart_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Like a chart"""
    chart = db.query(Chart).filter(Chart.id == chart_id).first()

    if not chart:
        raise HTTPException(status_code=404, detail="Chart not found")

    # Check if already liked
    existing = db.query(Like).filter(
        Like.user_id == current_user.id,
        Like.chart_id == chart_id,
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Chart already liked")

    like = Like(user_id=current_user.id, chart_id=chart_id)
    db.add(like)

    # Update like count
    chart.like_count += 1

    db.commit()
    db.refresh(like)

    return LikeResponse(
        id=like.id,
        chart_id=like.chart_id,
        created_at=like.created_at,
    )


@app.delete("/api/charts/{chart_id}/like")
async def unlike_chart(
    chart_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Unlike a chart"""
    like = db.query(Like).filter(
        Like.user_id == current_user.id,
        Like.chart_id == chart_id,
    ).first()

    if not like:
        raise HTTPException(status_code=404, detail="Like not found")

    # Update like count
    chart = db.query(Chart).filter(Chart.id == chart_id).first()
    if chart and chart.like_count > 0:
        chart.like_count -= 1

    db.delete(like)
    db.commit()

    return {"status": "ok"}


@app.get("/api/liked", response_model=List[ChartResponse])
async def list_liked_charts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List user's liked charts"""
    likes = (
        db.query(Like)
        .filter(Like.user_id == current_user.id)
        .order_by(Like.created_at.desc())
        .all()
    )

    # Batch fetch user interactions
    chart_ids = [like.chart_id for like in likes if like.chart]
    liked_ids, saved_ids = _get_user_interactions(db, current_user.id, chart_ids)

    return [
        _chart_to_response(like.chart, current_user, db, liked_ids, saved_ids)
        for like in likes
        if like.chart
    ]


# ============================================================================
# AI Service Endpoints
# ============================================================================

@app.post("/api/ai/analyze-image", response_model=ImageAnalysisResponse)
@limiter.limit("10/minute")
async def analyze_image_endpoint(
    request: Request,
    data: ImageAnalysisRequest,
):
    """Analyze an image and extract chart data using AI."""
    try:
        result = await analyze_image(data.image_base64, data.mime_type, data.user_prompt)
        return ImageAnalysisResponse(
            labels=result["labels"],
            series=result["series"],
            suggestedTitle=result.get("suggestedTitle"),
            suggestedType=result.get("suggestedType"),
            stacked=result.get("stacked"),
            xAxisLabel=result.get("xAxisLabel"),
            yAxisLabel=result.get("yAxisLabel"),
            barLayout=result.get("barLayout"),
            aiReasoning=result.get("aiReasoning"),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Image analysis failed: {e}")
        raise HTTPException(status_code=500, detail="Image analysis failed")


@app.post("/api/ai/chat", response_model=ChatResponse)
@limiter.limit("20/minute")
async def chat_endpoint(
    request: Request,
    data: ChatRequest,
):
    """Chat with AI about chart data."""
    try:
        result = await chat_with_chart(
            message=data.message,
            current_data=data.current_data.model_dump(),
            current_config=data.current_config.model_dump(),
            chat_history=[h.model_dump() for h in data.chat_history],
        )
        return ChatResponse(
            message=result["message"],
            updatedData=result.get("updatedData"),
            updatedConfig=result.get("updatedConfig"),
            changes=result["changes"],
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Chat failed: {e}")
        raise HTTPException(status_code=500, detail="Chat processing failed")


@app.post("/api/ai/recommend", response_model=ChartRecommendResponse)
@limiter.limit("20/minute")
async def recommend_chart_endpoint(
    request: Request,
    data: ChartRecommendRequest,
):
    """Get AI recommendation for the best chart type."""
    try:
        result = await recommend_chart_type(
            data=data.data.model_dump(),
            preferred_type=data.preferred_type,
            user_prompt=data.user_prompt,
        )
        return ChartRecommendResponse(
            type=result["type"],
            reasoning=result["reasoning"],
            summary=result["summary"],
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Recommendation failed: {e}")
        raise HTTPException(status_code=500, detail="Recommendation failed")


@app.post("/api/ai/infographic", response_model=InfographicResponse)
@limiter.limit("5/minute")
async def infographic_endpoint(
    request: Request,
    data: InfographicRequest,
):
    """Generate an SVG infographic for chart data."""
    try:
        svg = await generate_infographic(
            data=data.data.model_dump(),
            title=data.title,
            color_scheme=data.color_scheme,
            theme=data.theme,
            source_image_base64=data.source_image_base64,
            source_image_mime_type=data.source_image_mime_type,
            ai_mode=data.ai_mode,
            custom_prompt=data.custom_prompt,
        )
        return InfographicResponse(svg=svg)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Infographic generation failed: {e}")
        raise HTTPException(status_code=500, detail="Infographic generation failed")


@app.post("/api/ai/generate", response_model=ImageAnalysisResponse)
@limiter.limit("10/minute")
async def generate_from_prompt_endpoint(
    request: Request,
    data: PromptGenerateRequest,
):
    """Generate chart data from a natural language prompt using AI."""
    try:
        result = await generate_chart_from_prompt(data.prompt)
        return ImageAnalysisResponse(
            labels=result["labels"],
            series=result["series"],
            suggestedTitle=result.get("suggestedTitle"),
            suggestedType=result.get("suggestedType"),
            stacked=result.get("stacked"),
            xAxisLabel=result.get("xAxisLabel"),
            yAxisLabel=result.get("yAxisLabel"),
            barLayout=result.get("barLayout"),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Prompt generation failed: {e}")
        raise HTTPException(status_code=500, detail="Chart generation failed")


# ============================================================================
# Stock Data Endpoints
# ============================================================================

@app.post("/api/stocks/prices", response_model=ImageAnalysisResponse)
@limiter.limit("20/minute")
async def stock_prices_endpoint(
    request: Request,
    data: StockPriceRequest,
):
    """Fetch stock price data for charting."""
    try:
        result = await fetch_stock_prices(data.ticker, data.range, data.ticker2)
        return ImageAnalysisResponse(
            labels=result["labels"],
            series=result["series"],
            suggestedTitle=result.get("suggestedTitle"),
            suggestedType=result.get("suggestedType"),
            xAxisLabel=result.get("xAxisLabel"),
            yAxisLabel=result.get("yAxisLabel"),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Stock price fetch failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch stock data")


@app.post("/api/stocks/search")
@limiter.limit("30/minute")
async def stock_search_endpoint(
    request: Request,
    data: StockSearchRequest,
):
    """Search for ticker symbols."""
    try:
        results = await search_tickers(data.query)
        return results
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Stock search failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to search tickers")


@app.post("/api/stocks/insights")
@limiter.limit("20/minute")
async def stock_insights_endpoint(
    request: Request,
    data: StockInsightsRequest,
):
    """Generate AI insights for stock data."""
    try:
        insight = await generate_stock_insights(data.labels, data.series, data.title)
        return {"insight": insight}
    except Exception as e:
        logger.error(f"Stock insights generation failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate insights")


# ============================================================================
# Team Helper Functions
# ============================================================================

def _generate_slug(name: str, db: Session) -> str:
    """Generate a unique slug from a team name"""
    base_slug = re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')
    if not base_slug:
        base_slug = 'team'

    slug = base_slug
    counter = 1
    while db.query(Team).filter(Team.slug == slug).first():
        slug = f"{base_slug}-{counter}"
        counter += 1
    return slug


def _create_personal_team(db: Session, user: User) -> Team:
    """Create a personal team for a new user"""
    display_name = user.name or user.email.split('@')[0]
    slug = _generate_slug(f"{display_name}-personal", db)

    team = Team(
        name=f"{display_name}'s Team",
        slug=slug,
        owner_id=user.id,
        is_personal=True,
    )
    db.add(team)
    db.flush()  # Get the team ID

    # Add user as owner member
    member = TeamMember(
        team_id=team.id,
        user_id=user.id,
        role="owner",
    )
    db.add(member)

    # Create free subscription
    subscription = Subscription(
        team_id=team.id,
        plan="free",
        status="active",
        seat_limit=1,
        charts_per_month=10,
        charts_created_this_month=0,
    )
    db.add(subscription)

    db.commit()
    db.refresh(team)
    return team


def _get_team_with_access(
    db: Session,
    team_id: str,
    user: User,
    require_admin: bool = False,
    require_owner: bool = False,
) -> tuple[Team, TeamMember]:
    """Get a team and verify user has access. Returns (team, membership)."""
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    membership = db.query(TeamMember).filter(
        TeamMember.team_id == team_id,
        TeamMember.user_id == user.id,
    ).first()

    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this team")

    if require_owner and membership.role != "owner":
        raise HTTPException(status_code=403, detail="Only team owner can perform this action")

    if require_admin and membership.role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Admin access required")

    return team, membership


def _team_to_response(team: Team, db: Session) -> TeamResponse:
    """Convert a Team model to a TeamResponse"""
    member_count = db.query(TeamMember).filter(TeamMember.team_id == team.id).count()

    subscription_response = None
    if team.subscription:
        subscription_response = SubscriptionResponse(
            id=team.subscription.id,
            plan=team.subscription.plan,
            status=team.subscription.status,
            seat_limit=team.subscription.seat_limit,
            charts_per_month=team.subscription.charts_per_month,
            charts_created_this_month=team.subscription.charts_created_this_month,
            current_period_start=team.subscription.current_period_start,
            current_period_end=team.subscription.current_period_end,
            created_at=team.subscription.created_at,
        )

    return TeamResponse(
        id=team.id,
        name=team.name,
        slug=team.slug,
        owner_id=team.owner_id,
        is_personal=team.is_personal,
        created_at=team.created_at,
        updated_at=team.updated_at,
        member_count=member_count,
        subscription=subscription_response,
    )


def _enforce_subscription_status(db: Session, subscription: Subscription) -> None:
    """
    Enforce subscription status: if a canceled subscription has passed its
    period end, downgrade it to free tier limits. This handles the case where
    no scheduled job exists to process expired subscriptions.
    """
    if (
        subscription.status == "canceled"
        and subscription.current_period_end
        and datetime.utcnow() > subscription.current_period_end
    ):
        free_config = PLAN_CONFIG["free"]
        subscription.plan = "free"
        subscription.status = "active"
        subscription.seat_limit = free_config["seat_limit"]
        subscription.charts_per_month = free_config["charts_per_month"]
        subscription.polar_subscription_id = None
        subscription.polar_customer_id = None
        subscription.current_period_start = None
        subscription.current_period_end = None
        subscription.billing_cycle_start = None
        subscription.charts_created_this_month = 0
        db.commit()


def _check_can_create_chart(db: Session, team: Team) -> bool:
    """Check if a team can create another chart based on their subscription"""
    if not team.subscription:
        return False

    _enforce_subscription_status(db, team.subscription)

    # Unlimited charts
    if team.subscription.charts_per_month == -1:
        return True

    return team.subscription.charts_created_this_month < team.subscription.charts_per_month


def _check_can_invite_member(db: Session, team: Team) -> bool:
    """Check if a team can invite another member based on their subscription"""
    if not team.subscription:
        return False

    _enforce_subscription_status(db, team.subscription)

    # Unlimited seats
    if team.subscription.seat_limit == -1:
        return True

    current_members = db.query(TeamMember).filter(TeamMember.team_id == team.id).count()
    pending_invites = db.query(TeamInvitation).filter(
        TeamInvitation.team_id == team.id,
        TeamInvitation.accepted_at.is_(None),
        TeamInvitation.expires_at > datetime.utcnow(),
    ).count()

    return (current_members + pending_invites) < team.subscription.seat_limit


# ============================================================================
# Team Endpoints
# ============================================================================

@app.post("/api/teams", response_model=TeamResponse)
async def create_team(
    team_data: TeamCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new team"""
    slug = team_data.slug or _generate_slug(team_data.name, db)

    # Check if slug already exists
    existing = db.query(Team).filter(Team.slug == slug).first()
    if existing:
        raise HTTPException(status_code=400, detail="Team slug already exists")

    team = Team(
        name=team_data.name,
        slug=slug,
        owner_id=current_user.id,
        is_personal=False,
    )
    db.add(team)
    db.flush()

    # Add creator as owner
    member = TeamMember(
        team_id=team.id,
        user_id=current_user.id,
        role="owner",
    )
    db.add(member)

    # Create free subscription (they can upgrade later)
    subscription = Subscription(
        team_id=team.id,
        plan="free",
        status="active",
        seat_limit=1,
        charts_per_month=10,
        charts_created_this_month=0,
    )
    db.add(subscription)

    db.commit()
    db.refresh(team)

    return _team_to_response(team, db)


@app.get("/api/teams", response_model=TeamListResponse)
async def list_teams(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all teams the user is a member of"""
    memberships = db.query(TeamMember).filter(TeamMember.user_id == current_user.id).all()
    team_ids = [m.team_id for m in memberships]

    teams = db.query(Team).filter(Team.id.in_(team_ids)).order_by(Team.created_at).all()

    return TeamListResponse(
        teams=[_team_to_response(t, db) for t in teams],
        total=len(teams),
    )


@app.get("/api/teams/{team_id}", response_model=TeamResponse)
async def get_team(
    team_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get team details"""
    team, _ = _get_team_with_access(db, team_id, current_user)
    return _team_to_response(team, db)


@app.patch("/api/teams/{team_id}", response_model=TeamResponse)
async def update_team(
    team_id: str,
    team_data: TeamUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update team details (admin/owner only)"""
    team, _ = _get_team_with_access(db, team_id, current_user, require_admin=True)

    if team_data.name is not None:
        team.name = team_data.name

    if team_data.slug is not None:
        # Check if new slug is available
        existing = db.query(Team).filter(Team.slug == team_data.slug, Team.id != team_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Team slug already exists")
        team.slug = team_data.slug

    db.commit()
    db.refresh(team)

    return _team_to_response(team, db)


@app.delete("/api/teams/{team_id}")
async def delete_team(
    team_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a team (owner only, cannot delete personal team)"""
    team, _ = _get_team_with_access(db, team_id, current_user, require_owner=True)

    if team.is_personal:
        raise HTTPException(status_code=400, detail="Cannot delete personal team")

    db.delete(team)
    db.commit()

    return {"status": "ok"}


# ============================================================================
# Team Member Endpoints
# ============================================================================

@app.get("/api/teams/{team_id}/members", response_model=List[TeamMemberResponse])
async def list_team_members(
    team_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all members of a team"""
    team, _ = _get_team_with_access(db, team_id, current_user)

    members = db.query(TeamMember).filter(TeamMember.team_id == team_id).all()

    return [
        TeamMemberResponse(
            id=m.id,
            user_id=m.user_id,
            role=m.role,
            joined_at=m.joined_at,
            user=UserResponse.model_validate(m.user) if m.user else None,
        )
        for m in members
    ]


@app.post("/api/teams/{team_id}/members", response_model=TeamMemberResponse)
async def add_team_member(
    team_id: str,
    member_data: TeamMemberAdd,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Add a member directly to a team (admin/owner only)"""
    team, _ = _get_team_with_access(db, team_id, current_user, require_admin=True)

    # Check seat limit
    if not _check_can_invite_member(db, team):
        raise HTTPException(status_code=403, detail="Team has reached seat limit. Upgrade plan to add more members.")

    # Check user exists
    user = db.query(User).filter(User.id == member_data.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check if already a member
    existing = db.query(TeamMember).filter(
        TeamMember.team_id == team_id,
        TeamMember.user_id == member_data.user_id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="User is already a team member")

    member = TeamMember(
        team_id=team_id,
        user_id=member_data.user_id,
        role=member_data.role,
    )
    db.add(member)
    db.commit()
    db.refresh(member)

    return TeamMemberResponse(
        id=member.id,
        user_id=member.user_id,
        role=member.role,
        joined_at=member.joined_at,
        user=UserResponse.model_validate(user),
    )


@app.patch("/api/teams/{team_id}/members/{user_id}", response_model=TeamMemberResponse)
async def update_team_member(
    team_id: str,
    user_id: str,
    member_data: TeamMemberUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a member's role (admin/owner only)"""
    team, _ = _get_team_with_access(db, team_id, current_user, require_admin=True)

    member = db.query(TeamMember).filter(
        TeamMember.team_id == team_id,
        TeamMember.user_id == user_id,
    ).first()

    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    # Cannot change owner's role
    if member.role == "owner":
        raise HTTPException(status_code=400, detail="Cannot change owner's role")

    member.role = member_data.role
    db.commit()
    db.refresh(member)

    return TeamMemberResponse(
        id=member.id,
        user_id=member.user_id,
        role=member.role,
        joined_at=member.joined_at,
        user=UserResponse.model_validate(member.user) if member.user else None,
    )


@app.delete("/api/teams/{team_id}/members/{user_id}")
async def remove_team_member(
    team_id: str,
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Remove a member from a team (admin/owner only, or self-removal)"""
    team, current_membership = _get_team_with_access(db, team_id, current_user)

    # Users can remove themselves
    is_self_removal = user_id == current_user.id

    # Check permissions
    if not is_self_removal and current_membership.role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Admin access required to remove others")

    member = db.query(TeamMember).filter(
        TeamMember.team_id == team_id,
        TeamMember.user_id == user_id,
    ).first()

    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    # Cannot remove owner
    if member.role == "owner":
        raise HTTPException(status_code=400, detail="Cannot remove team owner. Transfer ownership first.")

    db.delete(member)
    db.commit()

    return {"status": "ok"}


# ============================================================================
# Team Branding Endpoints
# ============================================================================

@app.get("/api/teams/{team_id}/branding", response_model=TeamBrandingResponse)
async def get_team_branding(
    team_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get team branding settings"""
    team, _ = _get_team_with_access(db, team_id, current_user)

    # Check if team can customize (pro/business plan)
    can_customize = False
    if team.subscription and team.subscription.plan in ("pro", "business"):
        can_customize = True

    return TeamBrandingResponse(
        custom_logo_url=team.custom_logo_url,
        watermark_enabled=team.watermark_enabled if team.watermark_enabled is not None else True,
        can_customize=can_customize,
        brand_domain=team.brand_domain,
        brand_colors=team.brand_colors,
        brand_theme=team.brand_theme,
        brand_font_style=team.brand_font_style,
    )


@app.patch("/api/teams/{team_id}/branding", response_model=TeamBrandingResponse)
async def update_team_branding(
    team_id: str,
    branding_data: TeamBrandingUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update team branding settings (requires pro/business plan)"""
    team, _ = _get_team_with_access(db, team_id, current_user, require_admin=True)

    # Check if team has a paid plan
    if not team.subscription or team.subscription.plan == "free":
        raise HTTPException(
            status_code=403,
            detail="Branding customization requires a Pro or Business plan"
        )

    # Validate logo if provided (check size for base64)
    if branding_data.custom_logo_url:
        # If it's a base64 data URL, check size (max ~500KB = ~666KB base64)
        if branding_data.custom_logo_url.startswith("data:"):
            # Rough size check: base64 is ~4/3 of original
            base64_size = len(branding_data.custom_logo_url)
            if base64_size > 700000:  # ~500KB image
                raise HTTPException(
                    status_code=400,
                    detail="Logo image is too large. Maximum size is 500KB."
                )

    # Update branding settings
    if branding_data.custom_logo_url is not None:
        team.custom_logo_url = branding_data.custom_logo_url
    if branding_data.watermark_enabled is not None:
        team.watermark_enabled = branding_data.watermark_enabled
    if branding_data.brand_domain is not None:
        team.brand_domain = branding_data.brand_domain
    if branding_data.brand_colors is not None:
        team.brand_colors = branding_data.brand_colors
    if branding_data.brand_theme is not None:
        team.brand_theme = branding_data.brand_theme
    if branding_data.brand_font_style is not None:
        team.brand_font_style = branding_data.brand_font_style

    db.commit()
    db.refresh(team)

    return TeamBrandingResponse(
        custom_logo_url=team.custom_logo_url,
        watermark_enabled=team.watermark_enabled if team.watermark_enabled is not None else True,
        can_customize=True,
        brand_domain=team.brand_domain,
        brand_colors=team.brand_colors,
        brand_theme=team.brand_theme,
        brand_font_style=team.brand_font_style,
    )


@app.delete("/api/teams/{team_id}/branding/logo")
async def delete_team_logo(
    team_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Remove custom logo from team branding"""
    team, _ = _get_team_with_access(db, team_id, current_user, require_admin=True)

    team.custom_logo_url = None
    db.commit()

    return {"status": "ok"}


@app.post("/api/teams/{team_id}/branding/infer", response_model=BrandInferResponse)
@limiter.limit("5/minute")
async def infer_team_brand(
    request: Request,
    team_id: str,
    data: BrandInferRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Infer brand colors and style from a website domain"""
    team, _ = _get_team_with_access(db, team_id, current_user, require_admin=True)

    # Check if team has a paid plan
    if not team.subscription or team.subscription.plan == "free":
        raise HTTPException(
            status_code=403,
            detail="Brand inference requires a Pro or Business plan"
        )

    try:
        result = await infer_brand_from_website(data.domain)

        # Auto-save the inferred brand to the team
        team.brand_domain = data.domain
        team.brand_colors = result["colors"]
        team.brand_theme = result["theme"]
        team.brand_font_style = result["fontStyle"]

        # Also update the logo from favicon
        logo_url = f"https://www.google.com/s2/favicons?domain={data.domain}&sz=128"
        team.custom_logo_url = logo_url

        db.commit()

        return BrandInferResponse(
            colors=result["colors"],
            theme=result["theme"],
            font_style=result["fontStyle"],
            reasoning=result["reasoning"],
        )
    except Exception as e:
        logger.error(f"Brand inference failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to analyze website")


# ============================================================================
# Team Invitation Endpoints
# ============================================================================

@app.post("/api/teams/{team_id}/invitations", response_model=InvitationResponse)
async def create_invitation(
    team_id: str,
    invitation_data: InvitationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Send an invitation to join a team (admin/owner only)"""
    team, _ = _get_team_with_access(db, team_id, current_user, require_admin=True)

    # Check seat limit
    if not _check_can_invite_member(db, team):
        raise HTTPException(status_code=403, detail="Team has reached seat limit. Upgrade plan to add more members.")

    # Check if user with this email is already a member
    existing_user = db.query(User).filter(User.email == invitation_data.email).first()
    if existing_user:
        existing_member = db.query(TeamMember).filter(
            TeamMember.team_id == team_id,
            TeamMember.user_id == existing_user.id,
        ).first()
        if existing_member:
            raise HTTPException(status_code=400, detail="User is already a team member")

    # Check for existing pending invitation
    existing_invite = db.query(TeamInvitation).filter(
        TeamInvitation.team_id == team_id,
        TeamInvitation.email == invitation_data.email,
        TeamInvitation.accepted_at.is_(None),
        TeamInvitation.expires_at > datetime.utcnow(),
    ).first()
    if existing_invite:
        raise HTTPException(status_code=400, detail="Invitation already sent to this email")

    # Create invitation
    invitation = TeamInvitation(
        team_id=team_id,
        email=invitation_data.email,
        role=invitation_data.role,
        token=secrets.token_urlsafe(32),
        invited_by=current_user.id,
        expires_at=datetime.utcnow() + timedelta(days=7),
    )
    db.add(invitation)
    db.commit()
    db.refresh(invitation)

    # TODO: Send invitation email

    return InvitationResponse(
        id=invitation.id,
        team_id=invitation.team_id,
        email=invitation.email,
        role=invitation.role,
        expires_at=invitation.expires_at,
        accepted_at=invitation.accepted_at,
        created_at=invitation.created_at,
        inviter=UserResponse.model_validate(current_user),
        team=_team_to_response(team, db),
    )


@app.get("/api/teams/{team_id}/invitations", response_model=InvitationListResponse)
async def list_invitations(
    team_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List pending invitations for a team (admin/owner only)"""
    team, _ = _get_team_with_access(db, team_id, current_user, require_admin=True)

    invitations = db.query(TeamInvitation).filter(
        TeamInvitation.team_id == team_id,
        TeamInvitation.accepted_at.is_(None),
    ).order_by(TeamInvitation.created_at.desc()).all()

    return InvitationListResponse(
        invitations=[
            InvitationResponse(
                id=inv.id,
                team_id=inv.team_id,
                email=inv.email,
                role=inv.role,
                expires_at=inv.expires_at,
                accepted_at=inv.accepted_at,
                created_at=inv.created_at,
                inviter=UserResponse.model_validate(inv.inviter) if inv.inviter else None,
            )
            for inv in invitations
        ],
        total=len(invitations),
    )


@app.delete("/api/invitations/{token}")
async def cancel_invitation(
    token: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Cancel a pending invitation (admin/owner only)"""
    invitation = db.query(TeamInvitation).filter(TeamInvitation.token == token).first()

    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found")

    # Verify access to team
    _, _ = _get_team_with_access(db, invitation.team_id, current_user, require_admin=True)

    if invitation.accepted_at:
        raise HTTPException(status_code=400, detail="Invitation already accepted")

    db.delete(invitation)
    db.commit()

    return {"status": "ok"}


@app.get("/api/invitations/{token}", response_model=InvitationResponse)
async def get_invitation(
    token: str,
    db: Session = Depends(get_db),
):
    """Get invitation details by token (public endpoint for viewing invite)"""
    invitation = db.query(TeamInvitation).filter(TeamInvitation.token == token).first()

    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found")

    if invitation.accepted_at:
        raise HTTPException(status_code=400, detail="Invitation already accepted")

    if invitation.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Invitation has expired")

    return InvitationResponse(
        id=invitation.id,
        team_id=invitation.team_id,
        email=invitation.email,
        role=invitation.role,
        expires_at=invitation.expires_at,
        accepted_at=invitation.accepted_at,
        created_at=invitation.created_at,
        team=_team_to_response(invitation.team, db) if invitation.team else None,
    )


@app.post("/api/invitations/{token}/accept")
async def accept_invitation(
    token: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Accept a team invitation"""
    invitation = db.query(TeamInvitation).filter(TeamInvitation.token == token).first()

    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found")

    if invitation.accepted_at:
        raise HTTPException(status_code=400, detail="Invitation already accepted")

    if invitation.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Invitation has expired")

    # Verify email matches (optional - you might want to allow any user to accept)
    if invitation.email.lower() != current_user.email.lower():
        raise HTTPException(status_code=403, detail="This invitation was sent to a different email address")

    # Check if already a member
    existing_member = db.query(TeamMember).filter(
        TeamMember.team_id == invitation.team_id,
        TeamMember.user_id == current_user.id,
    ).first()

    if existing_member:
        raise HTTPException(status_code=400, detail="Already a member of this team")

    # Add as member
    member = TeamMember(
        team_id=invitation.team_id,
        user_id=current_user.id,
        role=invitation.role,
    )
    db.add(member)

    # Mark invitation as accepted
    invitation.accepted_at = datetime.utcnow()

    db.commit()

    return {"status": "ok", "team_id": invitation.team_id}


# ============================================================================
# Billing Endpoints
# ============================================================================

@app.get("/api/teams/{team_id}/subscription", response_model=SubscriptionResponse)
async def get_subscription(
    team_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get team's subscription details"""
    team, _ = _get_team_with_access(db, team_id, current_user)

    if not team.subscription:
        raise HTTPException(status_code=404, detail="No subscription found")

    _enforce_subscription_status(db, team.subscription)

    return SubscriptionResponse(
        id=team.subscription.id,
        plan=team.subscription.plan,
        status=team.subscription.status,
        seat_limit=team.subscription.seat_limit,
        charts_per_month=team.subscription.charts_per_month,
        charts_created_this_month=team.subscription.charts_created_this_month,
        current_period_start=team.subscription.current_period_start,
        current_period_end=team.subscription.current_period_end,
        created_at=team.subscription.created_at,
    )


@app.get("/api/teams/{team_id}/usage", response_model=UsageSummaryResponse)
async def get_usage(
    team_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get team's usage summary"""
    team, _ = _get_team_with_access(db, team_id, current_user)

    if not team.subscription:
        raise HTTPException(status_code=404, detail="No subscription found")

    _enforce_subscription_status(db, team.subscription)
    sub = team.subscription
    seats_used = db.query(TeamMember).filter(TeamMember.team_id == team_id).count()

    charts_remaining = -1 if sub.charts_per_month == -1 else max(0, sub.charts_per_month - sub.charts_created_this_month)
    seats_remaining = -1 if sub.seat_limit == -1 else max(0, sub.seat_limit - seats_used)

    return UsageSummaryResponse(
        charts_created_this_month=sub.charts_created_this_month,
        charts_limit=sub.charts_per_month,
        charts_remaining=charts_remaining,
        seats_used=seats_used,
        seats_limit=sub.seat_limit,
        seats_remaining=seats_remaining,
        can_create_chart=_check_can_create_chart(db, team),
        can_invite_member=_check_can_invite_member(db, team),
    )


@app.post("/api/teams/{team_id}/checkout", response_model=CheckoutResponse)
async def create_checkout(
    team_id: str,
    checkout_data: CheckoutRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a Polar checkout session for upgrading the plan"""
    team, _ = _get_team_with_access(db, team_id, current_user, require_admin=True)

    try:
        result = await polar_service.create_checkout_session(
            team_id=team_id,
            plan=checkout_data.plan,
            customer_email=current_user.email,
            success_url=checkout_data.success_url,
            cancel_url=checkout_data.cancel_url,
        )

        return CheckoutResponse(
            checkout_url=result["checkout_url"],
            checkout_id=result.get("checkout_id"),
        )
    except PolarServiceError as e:
        logger.error(f"Polar checkout failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/teams/{team_id}/portal", response_model=PortalResponse)
async def get_portal_url(
    team_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get Polar customer portal URL for managing subscription"""
    team, _ = _get_team_with_access(db, team_id, current_user, require_admin=True)

    if not team.subscription or not team.subscription.polar_customer_id:
        raise HTTPException(status_code=400, detail="No active paid subscription")

    try:
        portal_url = await polar_service.create_customer_portal_url(
            team.subscription.polar_customer_id
        )
        return PortalResponse(portal_url=portal_url)
    except PolarServiceError as e:
        logger.error(f"Polar portal failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Polar Webhook Handler
# ============================================================================

@app.post("/api/webhooks/polar")
async def polar_webhook(
    request: Request,
    db: Session = Depends(get_db),
):
    """Handle Polar.sh webhook events"""
    # Get raw body and Standard Webhooks headers
    body = await request.body()
    signature = request.headers.get("webhook-signature", "")
    msg_id = request.headers.get("webhook-id", "")
    timestamp = request.headers.get("webhook-timestamp", "")

    # Verify signature using Standard Webhooks format
    try:
        if not polar_service.verify_webhook_signature(body, signature, msg_id, timestamp):
            logger.warning("Invalid Polar webhook signature")
            raise HTTPException(status_code=401, detail="Invalid signature")
    except PolarServiceError as e:
        logger.error(f"Webhook signature verification failed: {e}")
        raise HTTPException(status_code=500, detail="Webhook verification error")

    # Parse event
    try:
        payload = json.loads(body)
        event_type = payload.get("type", "")
        event_data = polar_service.parse_webhook_event(event_type, payload)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    logger.info(f"Processing Polar webhook: {event_type}")

    # Handle events
    if event_type == "checkout.completed":
        await _handle_checkout_completed(db, event_data)
    elif event_type == "subscription.created":
        await _handle_subscription_created(db, event_data)
    elif event_type == "subscription.updated":
        await _handle_subscription_updated(db, event_data)
    elif event_type == "subscription.canceled":
        await _handle_subscription_canceled(db, event_data)
    else:
        logger.info(f"Ignoring unhandled webhook event: {event_type}")

    return {"status": "ok"}


async def _handle_checkout_completed(db: Session, event_data: dict):
    """Handle checkout.completed event"""
    team_id = event_data.get("team_id")
    plan = event_data.get("plan")
    polar_subscription_id = event_data.get("polar_subscription_id")
    polar_customer_id = event_data.get("polar_customer_id")

    if not team_id:
        logger.error("checkout.completed missing team_id in metadata")
        return

    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        logger.error(f"checkout.completed: team {team_id} not found")
        return

    if not team.subscription:
        logger.error(f"checkout.completed: team {team_id} has no subscription record")
        return

    # Update subscription with Polar IDs and new plan
    plan_config = PLAN_CONFIG.get(plan, PLAN_CONFIG["free"])

    now = datetime.utcnow()
    team.subscription.polar_subscription_id = polar_subscription_id
    team.subscription.polar_customer_id = polar_customer_id
    team.subscription.plan = plan
    team.subscription.status = "active"
    team.subscription.seat_limit = plan_config["seat_limit"]
    team.subscription.charts_per_month = plan_config["charts_per_month"]
    team.subscription.charts_created_this_month = 0

    # Try to use period dates from the event, fall back to calculated dates
    period_start = event_data.get("current_period_start")
    period_end = event_data.get("current_period_end")

    if period_start:
        try:
            team.subscription.current_period_start = datetime.fromisoformat(
                period_start.replace("Z", "+00:00")
            )
        except (ValueError, AttributeError):
            team.subscription.current_period_start = now
    else:
        team.subscription.current_period_start = now

    if period_end:
        try:
            team.subscription.current_period_end = datetime.fromisoformat(
                period_end.replace("Z", "+00:00")
            )
        except (ValueError, AttributeError):
            team.subscription.current_period_end = now + timedelta(days=30)
    else:
        team.subscription.current_period_end = now + timedelta(days=30)

    # Set billing_cycle_start so chart count reset logic works
    team.subscription.billing_cycle_start = team.subscription.current_period_start

    db.commit()
    logger.info(f"Team {team_id} upgraded to {plan}")


async def _handle_subscription_created(db: Session, event_data: dict):
    """Handle subscription.created event as a fallback if checkout.completed didn't fire"""
    polar_subscription_id = event_data.get("polar_subscription_id")
    polar_customer_id = event_data.get("polar_customer_id")
    team_id = event_data.get("team_id")
    plan = event_data.get("plan")
    status = event_data.get("status")

    if not polar_subscription_id:
        return

    # Check if already processed (checkout.completed sets polar_subscription_id)
    existing = db.query(Subscription).filter(
        Subscription.polar_subscription_id == polar_subscription_id
    ).first()

    if existing:
        logger.info(f"Subscription {polar_subscription_id} already linked")
        return

    # If we have a team_id and plan from metadata, update the team's subscription
    if team_id and plan:
        team = db.query(Team).filter(Team.id == team_id).first()
        if team and team.subscription and not team.subscription.polar_subscription_id:
            plan_config = PLAN_CONFIG.get(plan, PLAN_CONFIG["free"])
            now = datetime.utcnow()

            team.subscription.polar_subscription_id = polar_subscription_id
            team.subscription.polar_customer_id = polar_customer_id
            team.subscription.plan = plan
            team.subscription.status = status or "active"
            team.subscription.seat_limit = plan_config["seat_limit"]
            team.subscription.charts_per_month = plan_config["charts_per_month"]
            team.subscription.charts_created_this_month = 0

            # Use period dates from event data if available
            period_start = event_data.get("current_period_start")
            period_end = event_data.get("current_period_end")

            if period_start:
                try:
                    team.subscription.current_period_start = datetime.fromisoformat(
                        period_start.replace("Z", "+00:00")
                    )
                except (ValueError, AttributeError):
                    team.subscription.current_period_start = now
            else:
                team.subscription.current_period_start = now

            if period_end:
                try:
                    team.subscription.current_period_end = datetime.fromisoformat(
                        period_end.replace("Z", "+00:00")
                    )
                except (ValueError, AttributeError):
                    team.subscription.current_period_end = now + timedelta(days=30)
            else:
                team.subscription.current_period_end = now + timedelta(days=30)

            team.subscription.billing_cycle_start = team.subscription.current_period_start
            db.commit()
            logger.info(f"subscription.created: team {team_id} linked to {polar_subscription_id}")
            return

    logger.info(f"subscription.created for polar subscription {polar_subscription_id} (no team link)")


async def _handle_subscription_updated(db: Session, event_data: dict):
    """Handle subscription.updated event"""
    polar_subscription_id = event_data.get("polar_subscription_id")
    status = event_data.get("status")
    current_period_start = event_data.get("current_period_start")
    current_period_end = event_data.get("current_period_end")

    if not polar_subscription_id:
        return

    subscription = db.query(Subscription).filter(
        Subscription.polar_subscription_id == polar_subscription_id
    ).first()

    if not subscription:
        logger.warning(f"subscription.updated: subscription {polar_subscription_id} not found")
        return

    if status:
        subscription.status = status

    if current_period_start:
        try:
            subscription.current_period_start = datetime.fromisoformat(current_period_start.replace('Z', '+00:00'))
        except (ValueError, AttributeError):
            pass

    if current_period_end:
        try:
            subscription.current_period_end = datetime.fromisoformat(current_period_end.replace('Z', '+00:00'))
        except (ValueError, AttributeError):
            pass

    # Reset chart count on new billing period
    if subscription.current_period_start:
        if not subscription.billing_cycle_start:
            # Initialize billing_cycle_start if it was never set
            subscription.billing_cycle_start = subscription.current_period_start
            subscription.charts_created_this_month = 0
        elif subscription.current_period_start > subscription.billing_cycle_start:
            # New billing period started - reset chart count
            subscription.charts_created_this_month = 0
            subscription.billing_cycle_start = subscription.current_period_start

    db.commit()
    logger.info(f"Subscription {polar_subscription_id} updated")


async def _handle_subscription_canceled(db: Session, event_data: dict):
    """Handle subscription.canceled event"""
    polar_subscription_id = event_data.get("polar_subscription_id")

    if not polar_subscription_id:
        return

    subscription = db.query(Subscription).filter(
        Subscription.polar_subscription_id == polar_subscription_id
    ).first()

    if not subscription:
        logger.warning(f"subscription.canceled: subscription {polar_subscription_id} not found")
        return

    subscription.status = "canceled"
    # Don't downgrade immediately - let them use until period end.
    # _enforce_subscription_status() handles lazy downgrade on next API access
    # after current_period_end has passed.

    db.commit()
    logger.info(f"Subscription {polar_subscription_id} canceled")


# ============================================================================
# Admin Endpoints (protected by secret)
# ============================================================================

ADMIN_SECRET = os.environ.get("ADMIN_SECRET", "")


def _verify_admin_secret(request: Request) -> bool:
    """Verify admin secret from Authorization header using constant-time comparison"""
    auth = request.headers.get("Authorization", "")
    if not ADMIN_SECRET:
        return False
    if auth.startswith("Bearer "):
        import hmac as _hmac
        return _hmac.compare_digest(auth[7:], ADMIN_SECRET)
    return False


@app.post("/api/admin/create-team")
async def admin_create_team(
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Admin endpoint to create a team with subscription and invitations.

    Requires Authorization: Bearer <ADMIN_SECRET>

    Body JSON:
    {
        "team_name": "Company Name",
        "brand_domain": "example.com",
        "plan": "pro",
        "owner_email": "owner@example.com",
        "invite_emails": ["user1@example.com", "user2@example.com"]
    }
    """
    if not _verify_admin_secret(request):
        raise HTTPException(status_code=401, detail="Invalid admin credentials")

    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    team_name = body.get("team_name")
    brand_domain = body.get("brand_domain")
    plan = body.get("plan", "pro")
    owner_email = body.get("owner_email")
    invite_emails = body.get("invite_emails", [])

    if not team_name:
        raise HTTPException(status_code=400, detail="team_name is required")
    if not owner_email:
        raise HTTPException(status_code=400, detail="owner_email is required")
    if plan not in ("free", "pro", "business"):
        raise HTTPException(status_code=400, detail="plan must be free, pro, or business")

    # Find owner user
    owner = db.query(User).filter(User.email == owner_email).first()

    if not owner:
        # Try to find any of the invite emails as potential owner
        for email in invite_emails:
            potential_owner = db.query(User).filter(User.email == email).first()
            if potential_owner:
                owner = potential_owner
                owner_email = email
                break

    if not owner:
        # List existing users for debugging
        existing_users = db.query(User).limit(10).all()
        user_list = [{"email": u.email, "id": u.id} for u in existing_users]
        raise HTTPException(
            status_code=400,
            detail=f"No user found with email {owner_email}. Available users: {user_list}"
        )

    # Check if team already exists with this name
    existing_slug = _generate_slug(team_name, db)
    existing_team = db.query(Team).filter(Team.name == team_name).first()
    if existing_team:
        raise HTTPException(
            status_code=400,
            detail=f"Team '{team_name}' already exists with id {existing_team.id}"
        )

    # Create team
    slug = _generate_slug(team_name, db)
    team = Team(
        name=team_name,
        slug=slug,
        owner_id=owner.id,
        is_personal=False,
        brand_domain=brand_domain,
    )
    db.add(team)
    db.flush()

    # Add owner as team member
    owner_member = TeamMember(
        team_id=team.id,
        user_id=owner.id,
        role="owner",
    )
    db.add(owner_member)

    # Create subscription
    plan_config = PLAN_CONFIG.get(plan, PLAN_CONFIG["free"])
    subscription = Subscription(
        team_id=team.id,
        plan=plan,
        status="active",
        seat_limit=plan_config["seat_limit"],
        charts_per_month=plan_config["charts_per_month"],
        charts_created_this_month=0,
        current_period_start=datetime.utcnow(),
        current_period_end=datetime.utcnow() + timedelta(days=365),
    )
    db.add(subscription)

    # Create invitations for other emails
    invitations_created = []
    members_added = []

    for email in invite_emails:
        if email.lower() == owner_email.lower():
            continue

        existing_user = db.query(User).filter(User.email == email).first()
        if existing_user:
            # Add directly as member
            member = TeamMember(
                team_id=team.id,
                user_id=existing_user.id,
                role="admin",
            )
            db.add(member)
            members_added.append(email)
        else:
            # Create invitation
            invitation = TeamInvitation(
                team_id=team.id,
                email=email,
                role="admin",
                token=secrets.token_urlsafe(32),
                invited_by=owner.id,
                expires_at=datetime.utcnow() + timedelta(days=30),
            )
            db.add(invitation)
            invitations_created.append({
                "email": email,
                "token": invitation.token,
                "invite_url": f"https://chartsuno.vercel.app/invite/{invitation.token}",
            })

    db.commit()
    db.refresh(team)

    return {
        "status": "ok",
        "team": {
            "id": team.id,
            "name": team.name,
            "slug": team.slug,
            "brand_domain": team.brand_domain,
        },
        "subscription": {
            "plan": plan,
            "seat_limit": plan_config["seat_limit"],
            "charts_per_month": plan_config["charts_per_month"],
        },
        "owner": owner_email,
        "members_added": members_added,
        "invitations": invitations_created,
    }


# ============================================================================
# Run server
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)
