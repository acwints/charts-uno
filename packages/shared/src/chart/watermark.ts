import sharp from 'sharp';
import type { ChartLogger } from './analyzer.js';

const WATERMARK_FONT_SIZE = 14;
const WATERMARK_PADDING = 16;
const WATERMARK_OPACITY = 0.55;
const SPARKLE_SIZE = 14;

// Lucide Sparkles icon path (simplified 4-point star)
const SPARKLES_SVG = `<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></g>`;

export async function addWatermark(imageBuffer: Buffer, logger?: ChartLogger): Promise<Buffer> {
  const log = logger ?? { info: console.log, error: console.error };

  try {
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();

    const width = metadata.width || 800;
    const height = metadata.height || 600;

    const textX = width - WATERMARK_PADDING;
    const iconX = textX - 80; // approximate text width to place icon before it
    const centerY = WATERMARK_PADDING + WATERMARK_FONT_SIZE / 2 + 2;

    const svgWatermark = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <style>
          .wm-text {
            fill: rgba(255, 255, 255, ${WATERMARK_OPACITY});
            font-size: ${WATERMARK_FONT_SIZE}px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-weight: 600;
            font-style: italic;
            letter-spacing: -0.02em;
          }
        </style>
        <g transform="translate(${iconX}, ${centerY - SPARKLE_SIZE / 2})" opacity="${WATERMARK_OPACITY}">
          <svg width="${SPARKLE_SIZE}" height="${SPARKLE_SIZE}" viewBox="0 0 24 24" stroke="rgba(255,255,255,1)" fill="none">
            ${SPARKLES_SVG}
          </svg>
        </g>
        <text
          x="${textX}"
          y="${centerY + WATERMARK_FONT_SIZE * 0.35}"
          text-anchor="end"
          class="wm-text"
        >Chartsuno</text>
      </svg>
    `;

    const watermarkedImage = await image
      .composite([
        {
          input: Buffer.from(svgWatermark),
          top: 0,
          left: 0,
        },
      ])
      .png()
      .toBuffer();

    log.info({}, 'Watermark added successfully');
    return watermarkedImage;
  } catch (error) {
    log.error({ error }, 'Error adding watermark');
    throw error;
  }
}
