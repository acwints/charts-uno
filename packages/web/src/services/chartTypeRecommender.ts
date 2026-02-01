import type { ChartData, ChartType } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export interface ChartRecommendation {
  type: ChartType;
  reasoning: string;
  summary: string;
}

export async function recommendChartType(
  data: ChartData,
  options: { preferredType?: ChartType } = {}
): Promise<ChartRecommendation> {
  const response = await fetch(`${API_URL}/api/ai/recommend`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({
      data: {
        labels: data.labels,
        series: data.series,
        suggestedType: data.suggestedType,
        suggestedTitle: data.suggestedTitle,
        aiReasoning: data.aiReasoning,
      },
      preferred_type: options.preferredType || null,
      user_prompt: data.userPrompt || null,
    }),
  });

  if (!response.ok) {
    // Fall back to default on error
    return {
      type: 'table',
      reasoning: 'Default recommendation for flexible data viewing.',
      summary: 'Summary unavailable for this dataset.',
    };
  }

  const result = await response.json();

  // Validate the chart type
  const validTypes: ChartType[] = ['bar', 'line', 'area', 'pie', 'radar', 'scatter', 'table'];
  const resolvedType = options.preferredType ?? result.type;

  if (!validTypes.includes(resolvedType)) {
    return {
      type: 'table',
      reasoning: 'Default recommendation for flexible data viewing.',
      summary: 'Summary unavailable for this dataset.',
    };
  }

  return {
    type: resolvedType as ChartType,
    reasoning: result.reasoning || 'AI recommendation based on data analysis.',
    summary: result.summary || 'Summary unavailable for this dataset.',
  };
}
