import type { ChartConfig, ChartData, ChartType, SeriesChartType, AxisSide, SeriesOverride } from './types.js';

interface ResolvedSeriesConfig {
  chartType: SeriesChartType;
  axis: AxisSide;
}

export interface ComboSuggestion {
  seriesConfig: Record<string, SeriesOverride>;
  rightYAxisLabel: string;
}

/** Returns true when any series has a per-series override that differs from defaults. */
export function isComboChart(config: ChartConfig): boolean {
  const sc = config.seriesConfig;
  if (!sc) return false;
  return Object.values(sc).some(
    (override) =>
      (override.chartType !== undefined && override.chartType !== config.type) ||
      (override.axis !== undefined && override.axis !== 'left'),
  );
}

/** Effective chart type + axis for a series, falling back to global type + left. */
export function resolveSeriesConfig(
  seriesName: string,
  config: ChartConfig,
): ResolvedSeriesConfig {
  const override: SeriesOverride | undefined = config.seriesConfig?.[seriesName];
  const baseType = (config.type === 'bar' || config.type === 'line' || config.type === 'area')
    ? config.type
    : 'bar';
  return {
    chartType: override?.chartType ?? baseType,
    axis: override?.axis ?? 'left',
  };
}

/** Return series names assigned to the given axis side. */
export function getSeriesForAxis(
  data: ChartData,
  config: ChartConfig,
  side: AxisSide,
): string[] {
  return data.series
    .map((s) => s.name)
    .filter((name) => resolveSeriesConfig(name, config).axis === side);
}

const COMBO_ELIGIBLE: Set<ChartType> = new Set(['bar', 'line', 'area']);

const PERCENTAGE_NAME_RE =
  /\b(savings?|percent(age)?|rates?|ratio|share|proportion|margin|efficiency|utilization|growth|change|returns?|yield)\b/i;

/**
 * Heuristic: detect series that look like percentages among series that don't.
 * Returns a suggested combo config if the data looks like it should be dual-axis,
 * or null if no suggestion.
 */
export function suggestComboConfig(
  data: ChartData,
  baseType: ChartType,
): ComboSuggestion | null {
  if (!COMBO_ELIGIBLE.has(baseType)) return null;
  if (data.series.length < 2) return null;

  // Compute per-series stats
  const stats = data.series.map((s) => {
    const nums = s.data.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
    const min = nums.length > 0 ? Math.min(...nums) : 0;
    const max = nums.length > 0 ? Math.max(...nums) : 0;
    const nameHintsPct = PERCENTAGE_NAME_RE.test(s.name);
    const rangeIs0To100 = nums.length > 0 && min >= 0 && max <= 100;
    return { name: s.name, min, max, nameHintsPct, rangeIs0To100, count: nums.length };
  });

  // Find candidate percentage series: name hints + values in 0-100
  const pctCandidates = stats.filter((s) => s.nameHintsPct && s.rangeIs0To100 && s.count > 0);
  const otherSeries = stats.filter((s) => !pctCandidates.includes(s));

  if (pctCandidates.length === 0 || otherSeries.length === 0) return null;

  // Only suggest if the non-pct series have a meaningfully larger max value
  const otherMax = Math.max(...otherSeries.map((s) => s.max));
  if (otherMax <= 100) return null; // Scales are similar, no need

  const seriesConfig: Record<string, SeriesOverride> = {};
  for (const s of pctCandidates) {
    seriesConfig[s.name] = { chartType: 'line', axis: 'right' };
  }

  const rightLabel = pctCandidates.length === 1
    ? pctCandidates[0].name
    : 'Percentage (%)';

  return { seriesConfig, rightYAxisLabel: rightLabel };
}
