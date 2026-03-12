import type { ChartData } from '../types';
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
  const parsed = await fetchApiJson<Record<string, unknown>>('/api/datasets/public/generate', {
    method: 'POST',
    body: {
      dataset_id: input.datasetId,
      prompt: input.prompt,
      top_n: input.topN,
      chart_type_hint: input.chartTypeHint && input.chartTypeHint !== 'auto' ? input.chartTypeHint : null,
    },
  });

  return {
    labels: parsed.labels as string[],
    series: parsed.series as ChartData['series'],
    sourceType: 'datasets',
    verifiedData: parsed.verifiedData === true,
    suggestedTitle: parsed.suggestedTitle as string | undefined,
    suggestedType: parsed.suggestedType as string | undefined,
    aiReasoning: parsed.aiReasoning as string | undefined,
    sourceLink: parsed.sourceLink as string | undefined,
    xAxisLabel: parsed.xAxisLabel as string | undefined,
    yAxisLabel: parsed.yAxisLabel as string | undefined,
  };
}
