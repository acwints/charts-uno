import { GoogleGenerativeAI } from '@google/generative-ai';
import type { ChartData } from '../types.js';

/** Minimal logger interface — consumers pass their own (e.g. pino). */
export interface ChartLogger {
  info: (obj: unknown, msg?: string) => void;
  error: (obj: unknown, msg?: string) => void;
  warn?: (obj: unknown, msg?: string) => void;
  debug?: (obj: unknown, msg?: string) => void;
}

const defaultLogger: ChartLogger = {
  info: (obj, msg) => console.log(msg ?? '', obj),
  error: (obj, msg) => console.error(msg ?? '', obj),
};

let genAI: GoogleGenerativeAI | null = null;

function getGeminiClient(apiKey: string): GoogleGenerativeAI {
  if (!genAI) {
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

export interface AnalyzeOptions {
  apiKey: string;
  logger?: ChartLogger;
}

export async function analyzeImageFromUrl(imageUrl: string, options: AnalyzeOptions): Promise<ChartData> {
  const log = options.logger ?? defaultLogger;
  log.info({ imageUrl }, 'Analyzing image with Gemini Vision');

  // Fetch the image and convert to base64
  const response = await fetch(imageUrl);
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  return analyzeImageFromBuffer(buffer, options);
}

export async function analyzeImageFromBuffer(imageBuffer: Buffer, options: AnalyzeOptions): Promise<ChartData> {
  const log = options.logger ?? defaultLogger;
  const client = getGeminiClient(options.apiKey);
  const base64 = imageBuffer.toString('base64');
  const mimeType = detectMimeType(imageBuffer);

  const prompt = `Analyze this image and extract any data that could be turned into a chart.

Look for:
- Tables, leaderboards, rankings
- Charts or graphs (extract the underlying data)
- Statistics, scores, numbers with labels
- Any structured numerical data

Return ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "labels": ["label1", "label2", ...],
  "series": [
    {"name": "Series Name", "data": [num1, num2, ...]}
  ],
  "suggestedTitle": "A title for the chart",
  "suggestedType": "bar" | "line" | "area" | "pie" | "radar" | "scatter" | "table"
}

Rules:
- labels array must match the length of each data array
- All data values must be numbers (convert scores like "-27" to -27)
- If there are multiple numeric columns, create multiple series
- Choose suggestedType based on the data (rankings = table, trends = line, comparisons = bar, etc.)
- If you can't find chartable data, return: {"error": "No chartable data found"}`;

  const model = client.getGenerativeModel({ model: 'gemini-2.5-pro' });

  const result = await model.generateContent([
    prompt,
    {
      inlineData: {
        mimeType,
        data: base64,
      },
    },
  ]);

  const geminiResponse = await result.response;
  const content = geminiResponse.text();

  if (!content) {
    throw new Error('No response from vision API');
  }

  // Parse the JSON response
  let parsed;
  try {
    // Remove any markdown code blocks if present
    const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
    parsed = JSON.parse(cleanContent);
  } catch {
    log.error({ content }, 'Failed to parse Gemini response');
    throw new Error('Failed to parse response: ' + content);
  }

  if (parsed.error) {
    throw new Error(parsed.error);
  }

  // Validate the response structure
  if (!parsed.labels || !parsed.series || !Array.isArray(parsed.labels) || !Array.isArray(parsed.series)) {
    throw new Error('Invalid data structure returned');
  }

  log.info(
    { labels: parsed.labels.length, series: parsed.series.length },
    'Successfully extracted chart data'
  );

  return {
    labels: parsed.labels,
    series: parsed.series,
    sourceType: 'image',
    suggestedTitle: parsed.suggestedTitle,
    suggestedType: parsed.suggestedType,
  };
}

function detectMimeType(buffer: Buffer): string {
  // Check PNG signature
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return 'image/png';
  }
  // Check JPEG signature
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  // Check GIF signature
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
    return 'image/gif';
  }
  // Check WebP signature
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
    return 'image/webp';
  }
  // Default to PNG
  return 'image/png';
}
