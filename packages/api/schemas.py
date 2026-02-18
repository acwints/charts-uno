from datetime import datetime
from typing import Optional, List, Any, Dict
from pydantic import BaseModel, Field


# User schemas
class UserBase(BaseModel):
    email: str
    name: Optional[str] = None
    picture: Optional[str] = None


class UserResponse(UserBase):
    id: str
    created_at: datetime
    last_login: Optional[datetime] = None

    class Config:
        from_attributes = True


# Chart schemas
class ChartDataSeries(BaseModel):
    name: str
    data: List[Optional[float]]
    confidence: Optional[List[Optional[float]]] = None


class ChartData(BaseModel):
    model_config = {"extra": "allow"}

    labels: List[str]
    series: List[ChartDataSeries]
    suggestedType: Optional[str] = None
    suggestedTitle: Optional[str] = None
    aiReasoning: Optional[str] = None


class CustomColors(BaseModel):
    model_config = {"extra": "allow"}

    background: Optional[str] = None
    cardBackground: Optional[str] = None
    text: Optional[str] = None
    textMuted: Optional[str] = None
    grid: Optional[str] = None
    border: Optional[str] = None
    seriesColors: Optional[List[str]] = None


class ChartConfig(BaseModel):
    model_config = {"extra": "allow"}

    type: str = "bar"
    colorScheme: str = "default"
    styleVariant: str = "professional"
    themeMode: str = "dark"
    showGrid: bool = True
    showLegend: bool = True
    showValues: bool = False
    showPoints: bool = True
    showBorder: bool = True
    animate: bool = True
    stacked: bool = False
    yAxisBaselineMode: Optional[str] = "auto"
    title: Optional[str] = None
    sourceLink: Optional[str] = None
    customColors: Optional[CustomColors] = None


class ChartCreate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    data: ChartData
    config: ChartConfig
    source_type: Optional[str] = None
    source_url: Optional[str] = None
    is_public: bool = False


class ChartUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    data: Optional[ChartData] = None
    config: Optional[ChartConfig] = None
    is_public: Optional[bool] = None


class ChartResponse(BaseModel):
    id: str
    user_id: str
    title: Optional[str] = None
    description: Optional[str] = None
    data: Dict[str, Any]
    config: Dict[str, Any]
    source_type: Optional[str] = None
    source_url: Optional[str] = None
    is_public: bool
    view_count: int
    like_count: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    # Computed fields (populated by API)
    is_liked: bool = False
    is_saved: bool = False
    user: Optional[UserResponse] = None

    class Config:
        from_attributes = True


class ChartListResponse(BaseModel):
    charts: List[ChartResponse]
    total: int
    limit: int
    offset: int


# Saved charts
class SavedChartResponse(BaseModel):
    id: str
    chart_id: str
    created_at: datetime
    chart: ChartResponse

    class Config:
        from_attributes = True


# Like
class LikeResponse(BaseModel):
    id: str
    chart_id: str
    created_at: datetime

    class Config:
        from_attributes = True


# Auth
class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


# AI Service schemas
class ImageAnalysisRequest(BaseModel):
    image_base64: str
    mime_type: str = "image/png"
    user_prompt: Optional[str] = None


class ImageAnalysisResponse(BaseModel):
    labels: List[str]
    series: List[ChartDataSeries]
    verifiedData: Optional[bool] = None
    suggestedTitle: Optional[str] = None
    suggestedType: Optional[str] = None
    stacked: Optional[bool] = None
    xAxisLabel: Optional[str] = None
    yAxisLabel: Optional[str] = None
    barLayout: Optional[str] = None
    aiReasoning: Optional[str] = None
    sourceLink: Optional[str] = None
    xAxisType: Optional[str] = None
    yAxisFormat: Optional[str] = None
    yAxisPrefix: Optional[str] = None
    yAxisSuffix: Optional[str] = None


class BotAnalyzeAndCreateRequest(BaseModel):
    image_base64: str
    mime_type: str = "image/png"
    source_url: Optional[str] = None
    user_prompt: Optional[str] = None


class BotPromptAndCreateRequest(BaseModel):
    prompt: str
    source_url: Optional[str] = None


class BotAnalyzeAndCreateResponse(BaseModel):
    chart_id: str
    chart_url: str
    labels: List[str]
    series: List[ChartDataSeries]
    suggestedTitle: Optional[str] = None
    suggestedType: Optional[str] = None
    stacked: Optional[bool] = None
    xAxisLabel: Optional[str] = None
    yAxisLabel: Optional[str] = None
    barLayout: Optional[str] = None
    aiReasoning: Optional[str] = None


class PromptGenerateRequest(BaseModel):
    prompt: str


class StockPriceRequest(BaseModel):
    ticker: str
    ticker2: str | None = None  # Optional second ticker for comparison
    range: str = "3M"  # 1W, 1M, 3M, 6M, 1Y, YTD


class StockSearchRequest(BaseModel):
    query: str


class StockInsightsRequest(BaseModel):
    labels: list[str]
    series: list[dict]
    title: str


class PublicDatasetOption(BaseModel):
    id: str
    name: str
    description: str
    tables: List[str]
    examplePrompts: List[str] = []


class PublicDatasetsResponse(BaseModel):
    datasets: List[PublicDatasetOption]


class PublicDatasetGenerateRequest(BaseModel):
    dataset_id: str
    prompt: str
    top_n: int = 20
    chart_type_hint: Optional[str] = None


class ChatMessageHistory(BaseModel):
    role: str  # 'user' or 'assistant'
    content: str


class ChatRequest(BaseModel):
    message: str
    current_data: ChartData
    current_config: ChartConfig
    chat_history: List[ChatMessageHistory] = []


class ChatChanges(BaseModel):
    dataModified: bool
    configModified: bool
    summary: str


class ChatResponse(BaseModel):
    message: str
    updatedData: Optional[Dict[str, Any]] = None
    updatedConfig: Optional[Dict[str, Any]] = None
    changes: ChatChanges


class ChartRecommendRequest(BaseModel):
    data: ChartData
    preferred_type: Optional[str] = None
    user_prompt: Optional[str] = None


class ChartRecommendResponse(BaseModel):
    type: str
    reasoning: str
    summary: str


class InfographicRequest(BaseModel):
    data: ChartData
    title: str
    color_scheme: str
    theme: str = "dark"  # 'dark' or 'light'
    source_image_base64: Optional[str] = None
    source_image_mime_type: Optional[str] = None
    ai_mode: str = "infographic"  # 'chart', 'infographic', or 'custom'
    custom_prompt: Optional[str] = None


class InfographicResponse(BaseModel):
    svg: str


# ============================================
# Team and SaaS Schemas
# ============================================

# Team schemas
class TeamCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    slug: Optional[str] = Field(None, min_length=1, max_length=255, pattern=r'^[a-z0-9-]+$')


class TeamUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    slug: Optional[str] = Field(None, min_length=1, max_length=255, pattern=r'^[a-z0-9-]+$')


class TeamMemberResponse(BaseModel):
    id: str
    user_id: str
    role: str
    joined_at: datetime
    user: Optional[UserResponse] = None

    class Config:
        from_attributes = True


class SubscriptionResponse(BaseModel):
    id: str
    plan: str
    status: str
    seat_limit: int
    charts_per_month: int
    charts_created_this_month: int
    current_period_start: Optional[datetime] = None
    current_period_end: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class TeamResponse(BaseModel):
    id: str
    name: str
    slug: str
    owner_id: str
    is_personal: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    member_count: int = 0
    subscription: Optional[SubscriptionResponse] = None

    class Config:
        from_attributes = True


class TeamListResponse(BaseModel):
    teams: List[TeamResponse]
    total: int


# Team member management
class TeamMemberAdd(BaseModel):
    user_id: str
    role: str = Field(default="member", pattern=r'^(admin|member)$')


class TeamMemberUpdate(BaseModel):
    role: str = Field(..., pattern=r'^(admin|member)$')


# Team invitation schemas
class InvitationCreate(BaseModel):
    email: str = Field(..., pattern=r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$')
    role: str = Field(default="member", pattern=r'^(admin|member)$')


class InvitationResponse(BaseModel):
    id: str
    team_id: str
    email: str
    role: str
    expires_at: datetime
    accepted_at: Optional[datetime] = None
    created_at: datetime
    inviter: Optional[UserResponse] = None
    team: Optional[TeamResponse] = None

    class Config:
        from_attributes = True


class InvitationListResponse(BaseModel):
    invitations: List[InvitationResponse]
    total: int


# Billing schemas
class CheckoutRequest(BaseModel):
    plan: str = Field(..., pattern=r'^(pro|business)$')
    success_url: str
    cancel_url: Optional[str] = None


class CheckoutResponse(BaseModel):
    checkout_url: str
    checkout_id: Optional[str] = None


class PortalResponse(BaseModel):
    portal_url: str


class UsageSummaryResponse(BaseModel):
    charts_created_this_month: int
    charts_limit: int  # -1 for unlimited
    charts_remaining: int  # -1 for unlimited
    seats_used: int
    seats_limit: int  # -1 for unlimited
    seats_remaining: int  # -1 for unlimited
    can_create_chart: bool
    can_invite_member: bool


# Update ChartCreate to include team_id
class ChartCreateWithTeam(ChartCreate):
    team_id: Optional[str] = None


# Update ChartResponse to include team_id
class ChartResponseWithTeam(ChartResponse):
    team_id: Optional[str] = None


# ============================================
# Team Branding Schemas
# ============================================

class TeamBrandingUpdate(BaseModel):
    custom_logo_url: Optional[str] = None
    watermark_enabled: Optional[bool] = None
    brand_domain: Optional[str] = None
    brand_colors: Optional[List[str]] = None
    brand_theme: Optional[str] = None
    brand_font_style: Optional[str] = None


class TeamBrandingResponse(BaseModel):
    custom_logo_url: Optional[str] = None
    watermark_enabled: bool = True
    can_customize: bool = False  # True for pro/business plans
    brand_domain: Optional[str] = None
    brand_colors: Optional[List[str]] = None
    brand_theme: Optional[str] = None
    brand_font_style: Optional[str] = None

    class Config:
        from_attributes = True


class BrandInferRequest(BaseModel):
    domain: str


class BrandInferResponse(BaseModel):
    colors: List[str]
    theme: str
    font_style: str
    reasoning: str
