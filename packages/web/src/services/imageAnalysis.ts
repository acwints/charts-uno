import type { ChartData } from '../types';
import { fetchApiJson } from './apiBase';

interface ImageAnalysisApiResponse {
  labels: string[];
  series: ChartData['series'];
  suggestedTitle?: string;
  suggestedType?: string;
  stacked?: boolean;
  barLayout?: string;
  aiReasoning?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
}

function toChartData(
  parsed: ImageAnalysisApiResponse,
  sourceImage: { base64: string; mimeType: string },
): ChartData {
  return {
    labels: parsed.labels,
    series: parsed.series,
    sourceType: 'image',
    suggestedTitle: parsed.suggestedTitle,
    suggestedType: parsed.suggestedType,
    suggestedStacked: parsed.stacked ?? undefined,
    suggestedBarLayout: parsed.barLayout === 'horizontal' ? 'horizontal' : undefined,
    aiReasoning: parsed.aiReasoning,
    xAxisLabel: parsed.xAxisLabel,
    yAxisLabel: parsed.yAxisLabel,
    sourceImage,
  };
}

export async function analyzeImage(file: File): Promise<ChartData> {
  const base64 = await fileToBase64(file);
  const base64Data = base64.split(',')[1];

  const parsed = await fetchApiJson<ImageAnalysisApiResponse>('/api/ai/analyze-image', {
    method: 'POST',
    body: {
      image_base64: base64Data,
      mime_type: file.type,
    },
  });

  return toChartData(parsed, { base64: base64Data, mimeType: file.type });
}

export async function reanalyzeImageWithNotes(
  sourceImage: { base64: string; mimeType: string },
  userPrompt: string
): Promise<ChartData> {
  const parsed = await fetchApiJson<ImageAnalysisApiResponse>('/api/ai/analyze-image', {
    method: 'POST',
    body: {
      image_base64: sourceImage.base64,
      mime_type: sourceImage.mimeType,
      user_prompt: userPrompt,
    },
  });

  return toChartData(parsed, sourceImage);
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
