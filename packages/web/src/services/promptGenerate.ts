import type { ChartData, ChartType, XAxisType, YAxisFormat } from '../types';
import { fetchApiJson } from './apiBase';

interface PromptGenerateApiResponse {
  labels: string[];
  series: ChartData['series'];
  verifiedData?: boolean;
  suggestedTitle?: string;
  suggestedType?: ChartType;
  stacked?: boolean;
  barLayout?: string;
  aiReasoning?: string;
  sourceLink?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  xAxisType?: XAxisType;
  yAxisFormat?: YAxisFormat;
  yAxisPrefix?: string;
  yAxisSuffix?: string;
}

export async function generateChartFromPrompt(prompt: string): Promise<ChartData> {
  const parsed = await fetchApiJson<PromptGenerateApiResponse>('/api/ai/generate', {
    method: 'POST',
    body: { prompt },
  });

  return {
    labels: parsed.labels,
    series: parsed.series,
    sourceType: 'prompt',
    verifiedData: parsed.verifiedData === true,
    suggestedTitle: parsed.suggestedTitle,
    suggestedType: parsed.suggestedType,
    suggestedStacked: parsed.stacked ?? undefined,
    suggestedBarLayout: parsed.barLayout === 'horizontal' ? 'horizontal' : undefined,
    aiReasoning: parsed.aiReasoning,
    sourceLink: parsed.sourceLink,
    xAxisLabel: parsed.xAxisLabel,
    yAxisLabel: parsed.yAxisLabel,
    xAxisType: parsed.xAxisType,
    yAxisFormat: parsed.yAxisFormat,
    yAxisPrefix: parsed.yAxisPrefix,
    yAxisSuffix: parsed.yAxisSuffix,
  };
}
