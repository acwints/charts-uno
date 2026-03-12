import type { ChartData, ChartType } from '../types';
import { fetchApiJson } from './apiBase';

export interface PublicDatasetOption {
  id: string;
  name: string;
  description: string;
  tables: string[];
  examplePrompts: string[];
}

export async function getPublicDatasets(): Promise<PublicDatasetOption[]> {
  const parsed = await fetchApiJson<{ datasets?: PublicDatasetOption[] }>('/api/datasets/public');
  return parsed.datasets || [];
}

export async function generateChartFromPublicDataset(input: {
  datasetId: string;
  prompt: string;
  topN: number;
  chartTypeHint?: 'line' | 'bar' | 'area' | 'table' | 'auto';
}): Promise<ChartData> {
  const parsed = await fetchApiJson<{
    labels: string[];
    series: ChartData['series'];
    verifiedData?: boolean;
    suggestedTitle?: string;
    suggestedType?: ChartType;
    aiReasoning?: string;
    sourceLink?: string;
    xAxisLabel?: string;
    yAxisLabel?: string;
  }>('/api/datasets/public/generate', {
    method: 'POST',
    body: {
      dataset_id: input.datasetId,
      prompt: input.prompt,
      top_n: input.topN,
      chart_type_hint: input.chartTypeHint && input.chartTypeHint !== 'auto' ? input.chartTypeHint : null,
    },
  });

  return {
    labels: parsed.labels,
    series: parsed.series,
    sourceType: 'datasets',
    verifiedData: parsed.verifiedData === true,
    suggestedTitle: parsed.suggestedTitle,
    suggestedType: parsed.suggestedType,
    aiReasoning: parsed.aiReasoning,
    sourceLink: parsed.sourceLink,
    xAxisLabel: parsed.xAxisLabel,
    yAxisLabel: parsed.yAxisLabel,
  };
}
