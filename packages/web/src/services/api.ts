import { fetchApiJson } from './apiBase';
import type { ChartData } from '../types';

export type StoredChartData = Omit<ChartData, 'sourceType'>;

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
}

async function apiRequest<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  return fetchApiJson<T>(endpoint, options);
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

// Charts — config is typed loosely at the API boundary since the server
// may return fields the frontend doesn't know about yet and vice-versa.
// Consumers cast to ChartConfig from shared types as needed.
export interface ChartResponse {
  id: string;
  user_id: string;
  title: string | null;
  description: string | null;
  data: StoredChartData;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config: any;
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
  data: StoredChartData;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config: any;
  source_type?: string;
  is_public?: boolean;
  sql_connection_id?: string;
  refresh_query?: Record<string, unknown>;
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

export interface ChartPublishTargetsResponse {
  chart_id: string;
  is_public: boolean;
  team_ids: string[];
}

export interface ChartPublishTargetsUpdate {
  is_public?: boolean;
  team_ids?: string[];
}

export async function getChartPublishTargets(chartId: string): Promise<ChartPublishTargetsResponse> {
  return apiRequest(`/api/charts/${chartId}/publish-targets`);
}

export async function updateChartPublishTargets(
  chartId: string,
  data: ChartPublishTargetsUpdate,
): Promise<ChartPublishTargetsResponse> {
  return apiRequest(`/api/charts/${chartId}/publish-targets`, { method: 'PUT', body: data });
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
  await Promise.all(chartIds.map((chartId) => deleteChart(chartId)));
}

export async function batchPublishCharts(chartIds: string[], isPublic: boolean): Promise<void> {
  await Promise.all(chartIds.map((chartId) => updateChart(chartId, { is_public: isPublic })));
}

// ============================================
// Team Branding
// ============================================

export interface TeamBranding {
  custom_logo_url: string | null;
  watermark_enabled: boolean;
  can_customize: boolean;
  brand_domain: string | null;
  brand_colors: string[] | null;
  brand_theme: 'light' | 'dark' | null;
  brand_font_style: string | null;
}

export interface BrandInferResult {
  colors: string[];
  theme: 'light' | 'dark';
  font_style: string;
  reasoning: string;
}

export async function getTeamBranding(teamId: string): Promise<TeamBranding> {
  return apiRequest(`/api/teams/${teamId}/branding`);
}

export async function updateTeamBranding(
  teamId: string,
  data: {
    custom_logo_url?: string | null;
    watermark_enabled?: boolean;
    brand_domain?: string;
    brand_colors?: string[];
    brand_theme?: string;
    brand_font_style?: string;
  }
): Promise<TeamBranding> {
  return apiRequest(`/api/teams/${teamId}/branding`, { method: 'PATCH', body: data });
}

export async function deleteTeamLogo(teamId: string): Promise<void> {
  await apiRequest(`/api/teams/${teamId}/branding/logo`, { method: 'DELETE' });
}

export async function inferTeamBrand(teamId: string, domain: string): Promise<BrandInferResult> {
  return apiRequest(`/api/teams/${teamId}/branding/infer`, {
    method: 'POST',
    body: { domain },
  });
}

// Dashboards
export interface DashboardItemResponse {
  id: string;
  chart_id: string;
  position: number;
  width: number;
  height: number;
  created_at: string;
  chart: ChartResponse | null;
}

export interface DashboardResponse {
  id: string;
  user_id: string;
  team_id: string | null;
  name: string;
  description: string | null;
  is_public: boolean;
  auto_refresh: boolean;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string | null;
  item_count: number;
  items: DashboardItemResponse[] | null;
  user: User | null;
}

export interface DashboardListResponse {
  dashboards: DashboardResponse[];
  total: number;
  limit: number;
  offset: number;
}

export async function getDashboards(limit = 20, offset = 0): Promise<DashboardListResponse> {
  return apiRequest(`/api/dashboards?limit=${limit}&offset=${offset}`);
}

export async function getDashboard(dashboardId: string): Promise<DashboardResponse> {
  return apiRequest(`/api/dashboards/${dashboardId}`);
}

export async function createDashboard(data: {
  name: string;
  description?: string;
  team_id?: string;
  is_public?: boolean;
  auto_refresh?: boolean;
  config?: Record<string, unknown>;
}): Promise<DashboardResponse> {
  return apiRequest('/api/dashboards', { method: 'POST', body: data });
}

export async function updateDashboard(dashboardId: string, data: {
  name?: string;
  description?: string;
  is_public?: boolean;
  auto_refresh?: boolean;
  config?: Record<string, unknown>;
}): Promise<DashboardResponse> {
  return apiRequest(`/api/dashboards/${dashboardId}`, { method: 'PUT', body: data });
}

export async function deleteDashboard(dashboardId: string): Promise<void> {
  await apiRequest(`/api/dashboards/${dashboardId}`, { method: 'DELETE' });
}

export async function addDashboardItems(dashboardId: string, items: {
  chart_id: string;
  position?: number;
  width?: number;
  height?: number;
}[]): Promise<DashboardResponse> {
  return apiRequest(`/api/dashboards/${dashboardId}/items`, { method: 'POST', body: { items } });
}

export async function updateDashboardItems(dashboardId: string, items: {
  id: string;
  position?: number;
  width?: number;
  height?: number;
}[]): Promise<DashboardResponse> {
  return apiRequest(`/api/dashboards/${dashboardId}/items`, { method: 'PUT', body: { items } });
}

export async function removeDashboardItem(dashboardId: string, itemId: string): Promise<void> {
  await apiRequest(`/api/dashboards/${dashboardId}/items/${itemId}`, { method: 'DELETE' });
}

export async function getTeamDashboards(teamId: string, limit = 20, offset = 0): Promise<DashboardListResponse> {
  return apiRequest(`/api/teams/${teamId}/dashboards?limit=${limit}&offset=${offset}`);
}

// SQL Connections
export interface SqlConnectionResponse {
  id: string;
  team_id: string;
  name: string;
  host_masked: string;
  port: number;
  database_name_masked: string;
  username_masked: string;
  ssl_required: boolean;
  status: 'untested' | 'ok' | 'error';
  status_message: string | null;
  created_by: string;
  created_at: string;
  updated_at: string | null;
}

export interface SqlConnectionListResponse {
  connections: SqlConnectionResponse[];
  total: number;
}

export interface SqlQueryResponse {
  columns: string[];
  rows: Record<string, unknown>[];
  row_count: number;
  chart_data: {
    labels: string[];
    series: { name: string; data: Array<number | null> }[];
  };
}

export async function getSqlConnections(teamId: string): Promise<SqlConnectionListResponse> {
  return apiRequest(`/api/teams/${teamId}/sql-connections`);
}

export async function createSqlConnection(teamId: string, data: {
  name: string;
  host: string;
  port: number;
  database_name: string;
  username: string;
  password: string;
  ssl_required?: boolean;
}): Promise<SqlConnectionResponse> {
  return apiRequest(`/api/teams/${teamId}/sql-connections`, { method: 'POST', body: data });
}

export async function updateSqlConnection(teamId: string, connectionId: string, data: {
  name?: string;
  host?: string;
  port?: number;
  database_name?: string;
  username?: string;
  password?: string;
  ssl_required?: boolean;
}): Promise<SqlConnectionResponse> {
  return apiRequest(`/api/teams/${teamId}/sql-connections/${connectionId}`, { method: 'PUT', body: data });
}

export async function deleteSqlConnection(teamId: string, connectionId: string): Promise<void> {
  await apiRequest(`/api/teams/${teamId}/sql-connections/${connectionId}`, { method: 'DELETE' });
}

export async function testSqlConnection(teamId: string, connectionId: string): Promise<{ status: string; message: string }> {
  return apiRequest(`/api/teams/${teamId}/sql-connections/${connectionId}/test`, { method: 'POST' });
}

export async function querySqlConnection(teamId: string, connectionId: string, data: {
  sql: string;
  label_column?: string;
  series_columns?: string[];
}): Promise<SqlQueryResponse> {
  return apiRequest(`/api/teams/${teamId}/sql-connections/${connectionId}/query`, { method: 'POST', body: data });
}
