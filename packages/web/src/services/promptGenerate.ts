import type { ChartData } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export async function generateChartFromPrompt(prompt: string): Promise<ChartData> {
  const response = await fetch(`${API_URL}/api/ai/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Chart generation failed' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  const parsed = await response.json();

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
