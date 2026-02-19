import type { ChartConfig, ChartData, SeriesChartType, AxisSide, SeriesOverride } from './types.js';

interface ResolvedSeriesConfig {
  chartType: SeriesChartType;
  axis: AxisSide;
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
