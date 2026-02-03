const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
}

async function apiRequest<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body } = options;

  const response = await fetch(`${API_URL}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // Include cookies for auth
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

// Auth
export async function getAuthUrl(target?: string): Promise<{ auth_url: string }> {
  const params = target ? `?target=${encodeURIComponent(target)}` : '';
  return apiRequest(`/auth/google${params}`);
}

export async function setAuthCookie(token: string): Promise<void> {
  await apiRequest(`/api/auth/set-cookie?token=${encodeURIComponent(token)}`, { method: 'POST' });
}

export async function logout(): Promise<void> {
  await apiRequest('/api/auth/logout', { method: 'POST' });
}

// User
export interface User {
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
  created_at: string;
}

export async function getCurrentUser(): Promise<User> {
  return apiRequest('/api/user/me');
}

// Charts
export interface ChartResponse {
  id: string;
  user_id: string;
  title: string | null;
  description: string | null;
  data: {
    labels: string[];
    series: { name: string; data: number[] }[];
    suggestedType?: string;
    suggestedTitle?: string;
  };
  config: Record<string, unknown>;
  source_type: string | null;
  is_public: boolean;
  view_count: number;
  like_count: number;
  created_at: string;
  is_liked: boolean;
  is_saved: boolean;
  user?: User;
}

export interface ChartListResponse {
  charts: ChartResponse[];
  total: number;
  limit: number;
  offset: number;
}

export interface CreateChartData {
  title?: string;
  description?: string;
  data: {
    labels: string[];
    series: { name: string; data: number[] }[];
    suggestedType?: string;
    suggestedTitle?: string;
  };
  config: Record<string, unknown>;
  source_type?: string;
  is_public?: boolean;
}

export async function createChart(data: CreateChartData): Promise<ChartResponse> {
  return apiRequest('/api/charts', { method: 'POST', body: data });
}

export async function getMyCharts(limit = 20, offset = 0): Promise<ChartListResponse> {
  return apiRequest(`/api/charts?limit=${limit}&offset=${offset}`);
}

export async function getPublicCharts(limit = 20, offset = 0): Promise<ChartListResponse> {
  return apiRequest(`/api/charts/public?limit=${limit}&offset=${offset}`);
}

export async function getChart(chartId: string): Promise<ChartResponse> {
  return apiRequest(`/api/charts/${chartId}`);
}

export async function updateChart(chartId: string, data: Partial<CreateChartData>): Promise<ChartResponse> {
  return apiRequest(`/api/charts/${chartId}`, { method: 'PUT', body: data });
}

export async function deleteChart(chartId: string): Promise<void> {
  await apiRequest(`/api/charts/${chartId}`, { method: 'DELETE' });
}

// Save/Bookmark
export async function saveChart(chartId: string): Promise<void> {
  await apiRequest(`/api/charts/${chartId}/save`, { method: 'POST' });
}

export async function unsaveChart(chartId: string): Promise<void> {
  await apiRequest(`/api/charts/${chartId}/save`, { method: 'DELETE' });
}

export async function getSavedCharts(): Promise<{ id: string; chart_id: string; chart: ChartResponse }[]> {
  return apiRequest('/api/saved');
}

// Like
export async function likeChart(chartId: string): Promise<void> {
  await apiRequest(`/api/charts/${chartId}/like`, { method: 'POST' });
}

export async function unlikeChart(chartId: string): Promise<void> {
  await apiRequest(`/api/charts/${chartId}/like`, { method: 'DELETE' });
}

export async function getLikedCharts(): Promise<ChartResponse[]> {
  return apiRequest('/api/liked');
}

// Health check
export async function checkApiHealth(): Promise<{ status: string; timestamp: string }> {
  return apiRequest('/health');
}

// ============================================
// Teams
// ============================================

export interface Team {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  is_personal: boolean;
  created_at: string;
  updated_at: string | null;
  member_count: number;
  subscription: Subscription | null;
}

export interface TeamListResponse {
  teams: Team[];
  total: number;
}

export interface TeamMember {
  id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
  user: User | null;
}

export interface TeamInvitation {
  id: string;
  team_id: string;
  email: string;
  role: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
  inviter: User | null;
  team: Team | null;
}

export interface Subscription {
  id: string;
  plan: 'free' | 'pro' | 'business';
  status: 'active' | 'canceled' | 'past_due';
  seat_limit: number;
  charts_per_month: number;
  charts_created_this_month: number;
  current_period_start: string | null;
  current_period_end: string | null;
  created_at: string;
}

export interface UsageSummary {
  charts_created_this_month: number;
  charts_limit: number;
  charts_remaining: number;
  seats_used: number;
  seats_limit: number;
  seats_remaining: number;
  can_create_chart: boolean;
  can_invite_member: boolean;
}

// Team CRUD
export async function createTeam(data: { name: string; slug?: string }): Promise<Team> {
  return apiRequest('/api/teams', { method: 'POST', body: data });
}

export async function getTeams(): Promise<TeamListResponse> {
  return apiRequest('/api/teams');
}

export async function getTeam(teamId: string): Promise<Team> {
  return apiRequest(`/api/teams/${teamId}`);
}

export async function updateTeam(teamId: string, data: { name?: string; slug?: string }): Promise<Team> {
  return apiRequest(`/api/teams/${teamId}`, { method: 'PATCH', body: data });
}

export async function deleteTeam(teamId: string): Promise<void> {
  await apiRequest(`/api/teams/${teamId}`, { method: 'DELETE' });
}

// Team Members
export async function getTeamMembers(teamId: string): Promise<TeamMember[]> {
  return apiRequest(`/api/teams/${teamId}/members`);
}

export async function addTeamMember(teamId: string, userId: string, role: 'admin' | 'member' = 'member'): Promise<TeamMember> {
  return apiRequest(`/api/teams/${teamId}/members`, { method: 'POST', body: { user_id: userId, role } });
}

export async function updateTeamMember(teamId: string, userId: string, role: 'admin' | 'member'): Promise<TeamMember> {
  return apiRequest(`/api/teams/${teamId}/members/${userId}`, { method: 'PATCH', body: { role } });
}

export async function removeTeamMember(teamId: string, userId: string): Promise<void> {
  await apiRequest(`/api/teams/${teamId}/members/${userId}`, { method: 'DELETE' });
}

// Team Invitations
export async function createInvitation(teamId: string, email: string, role: 'admin' | 'member' = 'member'): Promise<TeamInvitation> {
  return apiRequest(`/api/teams/${teamId}/invitations`, { method: 'POST', body: { email, role } });
}

export async function getInvitations(teamId: string): Promise<{ invitations: TeamInvitation[]; total: number }> {
  return apiRequest(`/api/teams/${teamId}/invitations`);
}

export async function getInvitationByToken(token: string): Promise<TeamInvitation> {
  return apiRequest(`/api/invitations/${token}`);
}

export async function cancelInvitation(token: string): Promise<void> {
  await apiRequest(`/api/invitations/${token}`, { method: 'DELETE' });
}

export async function acceptInvitation(token: string): Promise<{ status: string; team_id: string }> {
  return apiRequest(`/api/invitations/${token}/accept`, { method: 'POST' });
}

// Billing
export async function getSubscription(teamId: string): Promise<Subscription> {
  return apiRequest(`/api/teams/${teamId}/subscription`);
}

export async function getUsage(teamId: string): Promise<UsageSummary> {
  return apiRequest(`/api/teams/${teamId}/usage`);
}

export async function createCheckout(
  teamId: string,
  plan: 'pro' | 'business',
  successUrl: string,
  cancelUrl?: string
): Promise<{ checkout_url: string; checkout_id?: string }> {
  return apiRequest(`/api/teams/${teamId}/checkout`, {
    method: 'POST',
    body: { plan, success_url: successUrl, cancel_url: cancelUrl },
  });
}

export async function getPortalUrl(teamId: string): Promise<{ portal_url: string }> {
  return apiRequest(`/api/teams/${teamId}/portal`);
}

// Update createChart to support team_id
export interface CreateChartDataWithTeam extends CreateChartData {
  team_id?: string;
}

export async function createChartWithTeam(data: CreateChartDataWithTeam): Promise<ChartResponse> {
  return apiRequest('/api/charts', { method: 'POST', body: data });
}

// ============================================
// Dashboard APIs
// ============================================

export interface ChartQueryOptions {
  limit?: number;
  offset?: number;
  sort?: 'created_at' | 'updated_at' | 'title' | 'view_count';
  order?: 'asc' | 'desc';
  search?: string;
  is_public?: boolean;
}

export async function getMyChartsFiltered(options: ChartQueryOptions = {}): Promise<ChartListResponse> {
  const params = new URLSearchParams();
  if (options.limit) params.set('limit', String(options.limit));
  if (options.offset) params.set('offset', String(options.offset));
  if (options.sort) params.set('sort', options.sort);
  if (options.order) params.set('order', options.order);
  if (options.search) params.set('search', options.search);
  if (options.is_public !== undefined) params.set('is_public', String(options.is_public));
  const queryString = params.toString();
  return apiRequest(`/api/charts${queryString ? `?${queryString}` : ''}`);
}

// Team charts with filtering
export interface TeamChartQueryOptions extends ChartQueryOptions {
  memberId?: string;
}

export async function getTeamCharts(
  teamId: string,
  options: TeamChartQueryOptions = {}
): Promise<ChartListResponse> {
  const params = new URLSearchParams();
  if (options.limit) params.set('limit', String(options.limit));
  if (options.offset) params.set('offset', String(options.offset));
  if (options.memberId) params.set('member_id', options.memberId);
  if (options.sort) params.set('sort', options.sort);
  if (options.order) params.set('order', options.order);
  if (options.search) params.set('search', options.search);
  const queryString = params.toString();
  return apiRequest(`/api/teams/${teamId}/charts${queryString ? `?${queryString}` : ''}`);
}

// Team activity feed
export interface ActivityItem {
  id: string;
  type: 'chart_created' | 'chart_updated' | 'chart_published' |
        'chart_deleted' | 'member_joined' | 'member_left';
  actor: User;
  target?: { type: string; id: string; name: string };
  created_at: string;
}

export interface ActivityResponse {
  activities: ActivityItem[];
  total: number;
}

export async function getTeamActivity(
  teamId: string,
  limit = 20,
  offset = 0
): Promise<ActivityResponse> {
  return apiRequest(`/api/teams/${teamId}/activity?limit=${limit}&offset=${offset}`);
}

// User stats
export interface UserStats {
  total_charts: number;
  published_charts: number;
  draft_charts: number;
  total_views: number;
  total_likes: number;
}

export async function getUserStats(): Promise<UserStats> {
  return apiRequest('/api/user/stats');
}

// Batch operations
export async function batchDeleteCharts(chartIds: string[]): Promise<void> {
  await apiRequest('/api/charts/batch/delete', { method: 'POST', body: { chart_ids: chartIds } });
}

export async function batchPublishCharts(chartIds: string[], isPublic: boolean): Promise<void> {
  await apiRequest('/api/charts/batch/publish', { method: 'POST', body: { chart_ids: chartIds, is_public: isPublic } });
}

// Move chart to team
export async function moveChartToTeam(chartId: string, teamId: string): Promise<ChartResponse> {
  return apiRequest(`/api/charts/${chartId}/move`, { method: 'POST', body: { team_id: teamId } });
}

// Duplicate chart
export async function duplicateChart(chartId: string): Promise<ChartResponse> {
  return apiRequest(`/api/charts/${chartId}/duplicate`, { method: 'POST' });
}

// ============================================
// Team Branding
// ============================================

export interface TeamBranding {
  custom_logo_url: string | null;
  watermark_enabled: boolean;
  can_customize: boolean;
}

export async function getTeamBranding(teamId: string): Promise<TeamBranding> {
  return apiRequest(`/api/teams/${teamId}/branding`);
}

export async function updateTeamBranding(
  teamId: string,
  data: { custom_logo_url?: string | null; watermark_enabled?: boolean }
): Promise<TeamBranding> {
  return apiRequest(`/api/teams/${teamId}/branding`, { method: 'PATCH', body: data });
}

export async function deleteTeamLogo(teamId: string): Promise<void> {
  await apiRequest(`/api/teams/${teamId}/branding/logo`, { method: 'DELETE' });
}
