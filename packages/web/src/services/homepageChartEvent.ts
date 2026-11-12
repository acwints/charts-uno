import { API_BASE_URL } from './apiBase';

export type HomepageChartSource = 'paste' | 'drop' | 'sample';
export type HomepageFunnelKind = 'view' | 'start' | 'save' | 'render' | 'download' | 'keep_shown' | 'keep_click' | 'keep_signin';

const DOWNLOAD_COUNTED_KEY = 'chartsuno.homepageDownloadCounted';
const KEEP_SEEN_KEY = 'chartsuno.keepPromptSeen';
const KEEP_ARMED_KEY = 'chartsuno.keepPromptArmed';

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

/** First edit, paste, drop, chart-type chip, sample dataset, Edit this example, Try with your data, or Use sample. Once per page load. */
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

/** The Keep this chart prompt is shown at most once per browser session. */
export function keepPromptAlreadyShown(): boolean {
  try {
    return sessionStorage.getItem(KEEP_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function markKeepPromptShown(): void {
  try {
    sessionStorage.setItem(KEEP_SEEN_KEY, '1');
  } catch {
    // This view can still show the prompt once.
  }
}

/** Remember that the next completed sign-in came from the prompt. Survives the redirect. */
export function armKeepPromptSignIn(): void {
  try {
    sessionStorage.setItem(KEEP_ARMED_KEY, '1');
  } catch {
    // Sign-in still proceeds. The counter is best-effort.
  }
}

export function takeKeepPromptSignIn(): boolean {
  try {
    const armed = sessionStorage.getItem(KEEP_ARMED_KEY) === '1';
    if (armed) sessionStorage.removeItem(KEEP_ARMED_KEY);
    return armed;
  } catch {
    return false;
  }
}

export function reportKeepPromptShown(): void {
  postFunnel({ kind: 'keep_shown' });
}

export function reportKeepPromptClicked(): void {
  postFunnel({ kind: 'keep_click' });
}

export function reportKeepPromptSignIn(): void {
  postFunnel({ kind: 'keep_signin' });
}

/** One user-driven chart render per page load. The automatic sample does not call this. */
export function reportHomepageChart(source: HomepageChartSource): void {
  postFunnel({ kind: 'render', source });
}

export function resetHomepageChartReport(): void {
  for (const key of Object.keys(sent)) delete sent[key as HomepageFunnelKind];
}
