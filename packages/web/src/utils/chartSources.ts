import type { ChartResponse } from '../services/api';

export function safeSourceUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || [...value].some(char => char.charCodeAt(0) < 32 || char === '\\')) return undefined;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : undefined;
  } catch { return undefined; }
}

export interface DisplaySource { title: string; url: string; kind: 'source' | 'reference' }

// Legacy fields are citations supplied by the author, not proof of accuracy.
// A root source_url can identify the original social post rather than a dataset.
export function collectChartSources(chart: Pick<ChartResponse, 'config' | 'data' | 'source_url' | 'source_declaration'>): DisplaySource[] {
  const sources: DisplaySource[] = [];
  const seen = new Set<string>();
  const add = (value: unknown, title: string, kind: DisplaySource['kind']) => {
    const url = safeSourceUrl(value);
    if (!url || seen.has(url)) return;
    seen.add(url);
    sources.push({ url, title: title.trim() || new URL(url).hostname, kind });
  };
  if (chart.source_declaration) add(chart.source_declaration.url, chart.source_declaration.title, 'source');
  chart.data.sources?.forEach(source => add(source.url, source.title, 'source'));
  add(chart.data.sourceLink, 'Data source', 'source');
  add(chart.config.sourceLink, 'Data source', 'source');
  add(chart.source_url, 'Original reference', 'reference');
  return sources;
}

export function chartProvenanceNote(sourceType: string | null | undefined): string | null {
  if (sourceType === 'image') return 'Reconstructed from an image. Extracted values may be approximate.';
  if (sourceType === 'prompt') return 'AI-generated data. Linked sources do not independently verify these values.';
  return null;
}
