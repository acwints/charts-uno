import { DEFAULT_CHART_CONFIG, type ChartConfig, type ChartData } from '../types';
import type { CreateChartData } from '../services/api';

export const SAMPLE_CHART_TITLE = 'Monthly sales';

/** Built-in first chart. Saving it through the charts API is what counts a person in users_with_a_chart. */
export function sampleMonthlySales(): { data: ChartData; config: ChartConfig } {
  const data: ChartData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    series: [{ name: 'Sales', data: [18400, 17600, 20100, 19850, 22300, 24150] }],
    sourceType: 'paste',
    suggestedTitle: SAMPLE_CHART_TITLE,
    suggestedType: 'bar',
    yAxisFormat: 'currency',
    yAxisPrefix: '$',
    xAxisLabel: 'Month',
    yAxisLabel: 'Sales',
  };
  const config: ChartConfig = {
    ...DEFAULT_CHART_CONFIG,
    type: 'bar',
    title: SAMPLE_CHART_TITLE,
    showLegend: false,
  };
  return { data, config };
}

export function sampleChartCreatePayload(): CreateChartData {
  const { data, config } = sampleMonthlySales();
  const { sourceType, ...stored } = data;
  return {
    title: SAMPLE_CHART_TITLE,
    data: stored,
    config,
    source_type: sourceType,
    is_public: false,
  };
}
