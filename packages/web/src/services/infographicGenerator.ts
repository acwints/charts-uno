import type { ChartData, ColorScheme, ThemeMode, AiMode } from '../types';
import { API_BASE_URL } from './apiBase';

const MAX_SOURCE_IMAGE_BYTES = 1_500_000; // ~1.5MB raw image payload

function estimateBase64Bytes(base64: string): number {
  const sanitized = base64.replace(/^data:[^;]+;base64,/, '');
  const padding = sanitized.endsWith('==') ? 2 : sanitized.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((sanitized.length * 3) / 4) - padding);
}

export async function generateInfographic(
  data: ChartData,
  title: string,
  colorScheme: ColorScheme,
  themeMode: ThemeMode,
  sourceImage?: { base64: string; mimeType: string },
  aiMode: AiMode = 'chart',
  customPrompt?: string
): Promise<string> {
  const theme = themeMode;

  const hasSourceImage = Boolean(sourceImage?.base64 && sourceImage?.mimeType);
  const sourceImageBytes = hasSourceImage ? estimateBase64Bytes(sourceImage!.base64) : 0;
  const shouldAttachSourceImage = hasSourceImage && sourceImageBytes <= MAX_SOURCE_IMAGE_BYTES;
  const requestBody = {
    data: {
      labels: data.labels,
      series: data.series,
      suggestedType: data.suggestedType,
      suggestedTitle: data.suggestedTitle,
    },
    title: title || 'Data Visualization',
    color_scheme: colorScheme,
    theme: theme,
    ai_mode: aiMode,
    custom_prompt: customPrompt || null,
    ...(shouldAttachSourceImage
      ? {
          source_image_base64: sourceImage?.base64,
          source_image_mime_type: sourceImage?.mimeType,
        }
      : {}),
  };

  let response = await fetch(`${API_BASE_URL}/api/ai/infographic`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  // Retry once without source image for gateway/proxy failures.
  if (!response.ok && hasSourceImage && [502, 503, 504].includes(response.status)) {
    const retryBody = {
      data: requestBody.data,
      title: requestBody.title,
      color_scheme: requestBody.color_scheme,
      theme: requestBody.theme,
      ai_mode: requestBody.ai_mode,
      custom_prompt: requestBody.custom_prompt,
    };
    response = await fetch(`${API_BASE_URL}/api/ai/infographic`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(retryBody),
    });
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Infographic generation failed' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  const result = await response.json();
  return result.svg;
}
