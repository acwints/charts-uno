import { API_BASE_URL } from './apiBase';

export type HomepageChartSource = 'paste' | 'drop' | 'sample';
export type HomepageFunnelKind = 'view' | 'start' | 'save' | 'render' | 'download';

const DOWNLOAD_COUNTED_KEY = 'chartsuno.homepageDownloadCounted';

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

/** First edit, paste, drop, Try with your data, or Use sample on this page load. */
export function reportHomepageStart(source: HomepageChartSource): void {
  postFunnel({ kind: 'start', source });
}

/** Pending homepage chart saved after sign-in. */
export function reportHomepageSave(): void {
  postFunnel({ kind: 'save' });
}

/** PNG downloaded with no account. Counted once per page, and counted as a save. */
export function reportHomepageDownload(): void {
  postFunnel({ kind: 'download' });
  try {
    sessionStorage.setItem(DOWNLOAD_COUNTED_KEY, '1');
  } catch {
    // The count already went out. Remembering it only avoids a second save event.
  }
}

export function homepageDownloadCounted(): boolean {
  try {
    return sessionStorage.getItem(DOWNLOAD_COUNTED_KEY) === '1';
  } catch {
    return false;
  }
}

/** One user-driven chart render per page load. The automatic sample does not call this. */
export function reportHomepageChart(source: HomepageChartSource): void {
  postFunnel({ kind: 'render', source });
}

export function resetHomepageChartReport(): void {
  for (const key of Object.keys(sent)) delete sent[key as HomepageFunnelKind];
}
