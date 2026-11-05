import { API_BASE_URL } from './apiBase';

export type HomepageChartSource = 'paste' | 'drop' | 'sample';
export type HomepageFunnelKind = 'view' | 'start' | 'save' | 'render';

const sent: Partial<Record<HomepageFunnelKind, boolean>> = {};

function postFunnel(body: { kind: HomepageFunnelKind; source?: HomepageChartSource }): void {
  if (sent[body.kind]) return;
  sent[body.kind] = true;
  void fetch(`${API_BASE_URL}/api/events/homepage-chart`, {
    method: 'POST',
    credentials: 'omit',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    keepalive: true,
  }).catch(() => undefined);
}

/** One homepage load. No cookies and no retry. */
export function reportHomepageView(): void {
  postFunnel({ kind: 'view' });
}

/** First paste, drop, or sample click on this page load. */
export function reportHomepageStart(source: HomepageChartSource): void {
  postFunnel({ kind: 'start', source });
}

/** Pending homepage chart saved after sign-in. */
export function reportHomepageSave(): void {
  postFunnel({ kind: 'save' });
}

/** One user-driven chart render per page load. The automatic sample does not call this. */
export function reportHomepageChart(source: HomepageChartSource): void {
  postFunnel({ kind: 'render', source });
}

export function resetHomepageChartReport(): void {
  for (const key of Object.keys(sent)) delete sent[key as HomepageFunnelKind];
}
