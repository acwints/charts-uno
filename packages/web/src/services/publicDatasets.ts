import type { ChartData } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export interface PublicDatasetOption {
  id: string;
  name: string;
  description: string;
  tables: string[];
  examplePrompts: string[];
}

export async function getPublicDatasets(): Promise<PublicDatasetOption[]> {
  const response = await fetch(`${API_URL}/api/datasets/public`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to load datasets' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  const parsed = await response.json();
  return parsed.datasets || [];
}

export async function generateChartFromPublicDataset(input: {
  datasetId: string;
  prompt: string;
  topN: number;
  chartTypeHint?: 'line' | 'bar' | 'area' | 'table' | 'auto';
}): Promise<ChartData> {
  const response = await fetch(`${API_URL}/api/datasets/public/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      dataset_id: input.datasetId,
      prompt: input.prompt,
      top_n: input.topN,
      chart_type_hint: input.chartTypeHint && input.chartTypeHint !== 'auto' ? input.chartTypeHint : null,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Dataset chart generation failed' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  const parsed = await response.json();
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
