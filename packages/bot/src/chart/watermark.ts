import sharp from 'sharp';
import { logger } from '../config.js';

const WATERMARK_TEXT = 'chartsuno';
const WATERMARK_FONT_SIZE = 16;
const WATERMARK_PADDING = 20;
const WATERMARK_OPACITY = 0.6;

export async function addWatermark(imageBuffer: Buffer): Promise<Buffer> {
  try {
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();

    const width = metadata.width || 800;
    const height = metadata.height || 600;

    // Create SVG watermark
    const svgWatermark = `
      <svg width="${width}" height="${height}">
        <style>
          .watermark {
            fill: rgba(255, 255, 255, ${WATERMARK_OPACITY});
            font-size: ${WATERMARK_FONT_SIZE}px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-weight: 500;
          }
        </style>
        <text
          x="${width - WATERMARK_PADDING}"
          y="${WATERMARK_PADDING + WATERMARK_FONT_SIZE}"
          text-anchor="end"
          class="watermark"
        >${WATERMARK_TEXT}</text>
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

    logger.info('Watermark added successfully');
    return watermarkedImage;
  } catch (error) {
    logger.error({ error }, 'Error adding watermark');
    throw error;
  }
}
