import type { ChartData } from '@chartsuno/shared';
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
    chartData: {
      labels: parsed.labels,
      series: parsed.series.map((series) => ({
        name: series.name,
        data: series.data.map((value) => {
          const numeric = typeof value === 'number' ? value : Number(value);
          return Number.isFinite(numeric) ? numeric : 0;
        }),
      })),
      sourceType: 'image',
      suggestedTitle: parsed.suggestedTitle,
      suggestedType: parsed.suggestedType,
      suggestedStacked: parsed.stacked ?? undefined,
      suggestedBarLayout: parsed.barLayout === 'horizontal' ? 'horizontal' : undefined,
      aiReasoning: parsed.aiReasoning,
      xAxisLabel: parsed.xAxisLabel,
      yAxisLabel: parsed.yAxisLabel,
    },
  };
}

function detectMimeType(buffer: Buffer): string {
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return 'image/png';
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
    return 'image/gif';
  }
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
    return 'image/webp';
  }
  return 'image/png';
}
