import type { ChartData } from '@chartsuno/shared';
import { detectMimeType } from '@chartsuno/shared/node';
import { config } from '../config.js';

interface AnalyzeAndCreateResponse {
  chart_id: string;
  chart_url: string;
  labels: string[];
  series: Array<{ name: string; data: Array<number | null> }>;
  suggestedTitle?: string;
  suggestedType?: ChartData['suggestedType'];
  stacked?: boolean;
  barLayout?: 'horizontal' | 'vertical';
  xAxisLabel?: string;
  yAxisLabel?: string;
  aiReasoning?: string;
}

export interface AnalyzeAndCreateResult {
  chartData: ChartData;
  chartUrl: string;
}

interface PromptAndCreateRequest {
  prompt: string;
  source_url?: string;
}

function toChartData(parsed: AnalyzeAndCreateResponse, sourceType: ChartData['sourceType']): ChartData {
  return {
    labels: parsed.labels,
    series: parsed.series.map((series) => ({
      name: series.name,
      data: series.data.map((value) => {
        const numeric = typeof value === 'number' ? value : Number(value);
        return Number.isFinite(numeric) ? numeric : 0;
      }),
    })),
    sourceType,
    suggestedTitle: parsed.suggestedTitle,
    suggestedType: parsed.suggestedType,
    suggestedStacked: parsed.stacked ?? undefined,
    suggestedBarLayout: parsed.barLayout === 'horizontal' ? 'horizontal' : undefined,
    aiReasoning: parsed.aiReasoning,
    xAxisLabel: parsed.xAxisLabel,
    yAxisLabel: parsed.yAxisLabel,
  };
}

export async function analyzeAndCreateChart(imageBuffer: Buffer, sourceUrl: string): Promise<AnalyzeAndCreateResult> {
  const apiUrl = config.chartsuno.apiUrl.replace(/\/$/, '');
  const response = await fetch(`${apiUrl}/api/internal/bot/analyze-and-create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-bot-token': config.chartsuno.internalToken,
    },
    body: JSON.stringify({
      image_base64: imageBuffer.toString('base64'),
      mime_type: detectMimeType(imageBuffer),
      source_url: sourceUrl,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Chartsuno API failed (${response.status}): ${errorText}`);
  }

  const parsed = (await response.json()) as AnalyzeAndCreateResponse;

  return {
    chartUrl: parsed.chart_url,
    chartData: toChartData(parsed, 'image'),
  };
}

export async function promptAndCreateChart(prompt: string, sourceUrl?: string): Promise<AnalyzeAndCreateResult> {
  const apiUrl = config.chartsuno.apiUrl.replace(/\/$/, '');
  const payload: PromptAndCreateRequest = { prompt };
  if (sourceUrl) {
    payload.source_url = sourceUrl;
  }

  const response = await fetch(`${apiUrl}/api/internal/bot/prompt-and-create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-bot-token': config.chartsuno.internalToken,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Chartsuno API failed (${response.status}): ${errorText}`);
  }

  const parsed = (await response.json()) as AnalyzeAndCreateResponse;

  return {
    chartUrl: parsed.chart_url,
    chartData: toChartData(parsed, 'prompt'),
  };
}

