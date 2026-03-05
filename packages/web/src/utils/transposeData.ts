import type { ChartData, DataSeries } from '../types';

/**
 * Transpose chart data: swap rows (labels) and columns (series).
 *
 * Before: labels = categories on X-axis, series = metrics as legend entries
 * After:  labels = old series names, series = old labels with their values
 *
 * Example:
 *   labels: ["Digital Trends", "ZDNet"], series: [{name: "Peak Traffic", data: [8M, 7M]}, ...]
 *   → labels: ["Peak Traffic", ...], series: [{name: "Digital Trends", data: [8M, ...]}, ...]
 */
export function transposeChartData(data: ChartData): ChartData {
  const newLabels = data.series.map(s => s.name);

  const newSeries: DataSeries[] = data.labels.map((label, labelIdx) => ({
    name: label,
    data: data.series.map(s => s.data[labelIdx] ?? null),
  }));

  return {
    ...data,
    labels: newLabels,
    series: newSeries,
    xAxisLabel: data.yAxisLabel,
    yAxisLabel: data.xAxisLabel,
  };
}
