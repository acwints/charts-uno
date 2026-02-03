import type { ChartData } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export async function analyzeImage(file: File): Promise<ChartData> {
  // Convert file to base64
  const base64 = await fileToBase64(file);
  // Remove the data URL prefix for the API
  const base64Data = base64.split(',')[1];

  const response = await fetch(`${API_URL}/api/ai/analyze-image`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({
      image_base64: base64Data,
      mime_type: file.type,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Image analysis failed' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  const parsed = await response.json();

  return {
    labels: parsed.labels,
    series: parsed.series,
    sourceType: 'image',
    suggestedTitle: parsed.suggestedTitle,
    suggestedType: parsed.suggestedType,
    xAxisLabel: parsed.xAxisLabel,
    yAxisLabel: parsed.yAxisLabel,
    sourceImage: {
      base64: base64Data,
      mimeType: file.type,
    },
  };
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
