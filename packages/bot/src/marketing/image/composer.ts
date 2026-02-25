import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { marketingConfig, logger } from '../config.js';
import type { SlideContent, GeneratedSlide } from '../types.js';
import { generateImage } from './imagen.js';
import { applyTextOverlay } from './overlay.js';
import { generateScreenshot } from './screenshot.js';

const IMAGEN_DELAY_MS = 4000;

/**
 * Compose a full 6-slide carousel deck.
 * For each slide: generate base image → apply text overlay → save to disk.
 */
export async function composeDeck(
  deckId: string,
  slides: SlideContent[],
  options: { dryRun?: boolean } = {},
): Promise<GeneratedSlide[]> {
  const outputDir = resolve(marketingConfig.marketing.slidesDir, deckId);
  await mkdir(outputDir, { recursive: true });

  const results: GeneratedSlide[] = [];
  let lastImagenCall = 0;

  for (const slide of slides) {
    logger.info({ slideNumber: slide.slideNumber, role: slide.role, imageSource: slide.imageSource },
      `Composing slide ${slide.slideNumber}/6`);

    let baseImage: Buffer;

    if (options.dryRun) {
      // In dry-run mode, generate a placeholder dark image
      baseImage = await createPlaceholder(slide.slideNumber);
    } else if (slide.imageSource === 'ai-generated' && slide.imagePrompt) {
      // Rate-limit Imagen calls
      const elapsed = Date.now() - lastImagenCall;
      if (lastImagenCall > 0 && elapsed < IMAGEN_DELAY_MS) {
        await delay(IMAGEN_DELAY_MS - elapsed);
      }

      baseImage = await generateImage(slide.imagePrompt);
      lastImagenCall = Date.now();
    } else if (slide.imageSource === 'screenshot' && slide.screenshotConfig) {
      baseImage = await generateScreenshot(slide.screenshotConfig);
    } else {
      baseImage = await createPlaceholder(slide.slideNumber);
    }

    // Apply text overlay
    const finalImage = await applyTextOverlay(baseImage, {
      headlineText: slide.headlineText,
      subText: slide.subText,
      role: slide.role,
    });

    // Save to disk
    const imagePath = join(outputDir, `slide-${slide.slideNumber}.png`);
    await writeFile(imagePath, finalImage);

    results.push({
      slideNumber: slide.slideNumber,
      imagePath,
      overlayApplied: true,
    });

    logger.info({ imagePath }, `Slide ${slide.slideNumber} saved`);
  }

  return results;
}

async function createPlaceholder(slideNumber: number): Promise<Buffer> {
  const { slideWidth, slideHeight } = marketingConfig.marketing;

  const svg = `<svg width="${slideWidth}" height="${slideHeight}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#0f0f0f"/>
    <text x="50%" y="50%" text-anchor="middle" fill="#333" font-size="48"
          font-family="sans-serif">Slide ${slideNumber}</text>
  </svg>`;

  return sharp(Buffer.from(svg))
    .png()
    .toBuffer();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
