import type { ChartData, ColorScheme } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

function getTheme(): 'dark' | 'light' {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

export async function generateInfographic(
  data: ChartData,
  title: string,
  colorScheme: ColorScheme
): Promise<string> {
  const theme = getTheme();

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
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Infographic generation failed' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  const result = await response.json();
  return result.svg;
}
