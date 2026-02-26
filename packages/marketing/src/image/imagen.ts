import { marketingConfig, logger } from '../config.js';

const IMAGEN_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

interface ImagenResponse {
  predictions?: Array<{
    bytesBase64Encoded: string;
    mimeType: string;
  }>;
  error?: { message: string; code: number };
}

/**
 * Generate an image using Gemini Imagen 4 via REST API.
 * Uses the same GOOGLE_API_KEY already configured for the bot.
 */
export async function generateImage(prompt: string): Promise<Buffer> {
  const { imagenModel, imagenAspectRatio } = marketingConfig.marketing;
  const apiKey = marketingConfig.google.apiKey;

  if (!apiKey) {
    throw new Error('GOOGLE_API_KEY is required for Imagen');
  }

  const url = `${IMAGEN_BASE_URL}/${imagenModel}:predict?key=${apiKey}`;

  const body = {
    instances: [{ prompt }],
    parameters: {
      sampleCount: 1,
      aspectRatio: imagenAspectRatio,
    },
  };

  logger.info({ model: imagenModel }, 'Generating image with Imagen');

  const response = await fetchWithRetry(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Imagen API failed (${response.status}): ${errorText}`);
  }

  const result = (await response.json()) as ImagenResponse;

  if (result.error) {
    throw new Error(`Imagen API error: ${result.error.message}`);
  }

  const imageData = result.predictions?.[0]?.bytesBase64Encoded;
  if (!imageData) {
    throw new Error('Imagen returned no image data');
  }

  logger.info('Image generated successfully');
  return Buffer.from(imageData, 'base64');
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  retries = 2,
): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, init);

      // Retry on 429 (rate limit) or 5xx
      if ((response.status === 429 || response.status >= 500) && attempt < retries) {
        const delay = 4000 * (attempt + 1);
        logger.warn({ status: response.status, attempt }, `Imagen request failed, retrying in ${delay}ms`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      return response;
    } catch (error) {
      if (attempt < retries) {
        const delay = 4000 * (attempt + 1);
        logger.warn({ error, attempt }, `Imagen fetch error, retrying in ${delay}ms`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw error;
    }
  }

  // Unreachable, but satisfies TypeScript
  throw new Error('Imagen: exhausted retries');
}
