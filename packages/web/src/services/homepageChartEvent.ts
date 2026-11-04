import { API_BASE_URL } from './apiBase';

export type HomepageChartSource = 'paste' | 'drop' | 'sample';

let sentForThisPage = false;

/** One anonymous render per page load. No cookies and no retry. */
export function reportHomepageChart(source: HomepageChartSource): void {
  if (sentForThisPage) return;
  sentForThisPage = true;
  void fetch(`${API_BASE_URL}/api/events/homepage-chart`, {
    method: 'POST',
    credentials: 'omit',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source }),
    keepalive: true,
  }).catch(() => undefined);
}

export function resetHomepageChartReport(): void {
  sentForThisPage = false;
}
