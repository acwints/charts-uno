import type { CreateChartData } from './api';

const STORAGE_KEY = 'chartsuno.pendingChart';
const DRAFT_KEY = 'chartsuno.homepageDraft';

export interface PendingChartRecord {
  v: 1;
  text: string;
  payload: CreateChartData;
}

let inflight: Promise<string | null> | null = null;

export function rememberPendingChart(text: string, payload: CreateChartData): void {
  const record: PendingChartRecord = { v: 1, text, payload };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
}

export function readPendingChart(): PendingChartRecord | null {
  try {
    return readChartRecord(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

export function forgetPendingChart(): void {
  localStorage.removeItem(STORAGE_KEY);
}

function readChartRecord(raw: string | null): PendingChartRecord | null {
  try {
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingChartRecord;
    const labels = parsed?.payload?.data?.labels;
    const series = parsed?.payload?.data?.series;
    if (parsed?.v !== 1 || typeof parsed.text !== 'string' || !Array.isArray(labels) || !Array.isArray(series) || series.length === 0) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** The chart visible on the homepage, so sign-in can reopen it. This is not a save request. */
export function rememberHomepageDraft(text: string, payload: CreateChartData): void {
  const record: PendingChartRecord = { v: 1, text, payload };
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(record));
  } catch {
    // A full disk should not block the chart on screen.
  }
}

export function readHomepageDraft(): PendingChartRecord | null {
  try {
    return readChartRecord(localStorage.getItem(DRAFT_KEY));
  } catch {
    return null;
  }
}

export function flushPendingChart(
  create: (data: CreateChartData) => Promise<{ id: string }>,
): Promise<string | null> {
  if (inflight) return inflight;
  const pending = readPendingChart();
  if (!pending) return Promise.resolve(null);
  inflight = create(pending.payload)
    .then((chart) => {
      forgetPendingChart();
      return chart.id;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}
