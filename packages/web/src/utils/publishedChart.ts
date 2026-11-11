import type { ChartResponse } from '../services/api';
import type { ChartConfig, ChartData } from '../types';
import { safeSourceUrl } from './chartSources';

/** Feed and reader must render the same data, scales and chart configuration. */
export function publishedChartPresentation(chart: ChartResponse): { data: ChartData; config: ChartConfig } {
  const data: ChartData = {
    ...chart.data,
    sourceType: (chart.source_type || 'paste') as ChartData['sourceType'],
    sourceLink: safeSourceUrl(chart.data.sourceLink),
    sources: chart.data.sources?.filter(source => safeSourceUrl(source.url)),
  };
  const config: ChartConfig = chart.revision_id && !chart.legacy_snapshot
    ? { ...chart.config, animate: false }
    : { ...chart.config, title: chart.title || chart.config.title || 'Untitled Chart', showAxisLabels: true, showAxisTitles: true, showLegend: true, showValues: false, animate: false };
  // Saved records do not contain generated artwork. Never regenerate on read.
  if (config.type === 'infographic') config.type = 'table';
  config.sourceLink = safeSourceUrl(config.sourceLink);
  return { data, config };
}
