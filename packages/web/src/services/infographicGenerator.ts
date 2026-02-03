import type { ChartData, ColorScheme } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

function getTheme(): 'dark' | 'light' {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

export async function generateInfographic(
  data: ChartData,
  title: string,
  colorScheme: ColorScheme,
  sourceImage?: { base64: string; mimeType: string }
): Promise<string> {
  const theme = getTheme();

  const hasSourceImage = Boolean(sourceImage?.base64 && sourceImage?.mimeType);

  const response = await fetch(`${API_URL}/api/ai/infographic`, {
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
      },
      title: title || 'Data Visualization',
      color_scheme: colorScheme,
      theme: theme,
      ...(hasSourceImage
        ? {
            source_image_base64: sourceImage?.base64,
            source_image_mime_type: sourceImage?.mimeType,
          }
        : {}),
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Infographic generation failed' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  const result = await response.json();
  return result.svg;
}
