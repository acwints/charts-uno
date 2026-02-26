import sharp from 'sharp';
import { marketingConfig } from '../config.js';
import type { SlideRole } from '../types.js';

interface OverlayOptions {
  headlineText: string;
  subText?: string;
  role: SlideRole;
}

/**
 * Apply text overlay to a slide image using Sharp SVG compositing.
 *
 * Follows the Larry methodology specs:
 * - White text, black stroke outline at 15% of font size
 * - Positioned at 28% from top for hook, centered for others
 * - Dynamic font sizing based on word count
 * - 4-6 words per line max
 */
export async function applyTextOverlay(
  imageBuffer: Buffer,
  options: OverlayOptions,
): Promise<Buffer> {
  const { headlineText, subText, role } = options;
  const { slideWidth: width, slideHeight: height } = marketingConfig.marketing;

  // Dynamic font sizing
  const wordCount = headlineText.split(/\s+/).length;
  const fontSize = wordCount <= 4 ? 72 : wordCount <= 8 ? 60 : 48;
  const strokeWidth = Math.round(fontSize * 0.15);

  // Vertical positioning
  const yCenter = role === 'hook' ? height * 0.28
    : role === 'cta' ? height * 0.45
    : height * 0.40;

  // Line wrapping (respect manual \n breaks, then wrap at 6 words)
  const lines = wrapText(headlineText, 6);
  const lineHeight = fontSize * 1.35;
  const blockHeight = lines.length * lineHeight;
  const yStart = yCenter - blockHeight / 2 + fontSize / 2;

  const linesSvg = lines.map((line, i) => {
    const y = yStart + i * lineHeight;
    return textElement(line, width / 2, y, fontSize, strokeWidth);
  }).join('');

  // Optional sub-text
  const subSvg = subText
    ? textElement(
        subText,
        width / 2,
        yStart + lines.length * lineHeight + 16,
        Math.round(fontSize * 0.42),
        Math.round(fontSize * 0.42 * 0.12),
        'rgba(255,255,255,0.8)',
      )
    : '';

  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    ${linesSvg}
    ${subSvg}
  </svg>`;

  return sharp(imageBuffer)
    .resize(width, height, { fit: 'cover' })
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toBuffer();
}

function textElement(
  text: string,
  x: number,
  y: number,
  fontSize: number,
  strokeWidth: number,
  fill = '#FFFFFF',
): string {
  return `<text
    x="${x}" y="${y}"
    text-anchor="middle"
    font-size="${fontSize}" font-weight="800"
    font-family="'SF Pro Display', -apple-system, 'Segoe UI', Roboto, sans-serif"
    stroke="#000000" stroke-width="${strokeWidth}"
    stroke-linejoin="round" paint-order="stroke"
    fill="${fill}">${escapeXml(text)}</text>`;
}

function escapeXml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * Wrap text into lines of at most `maxWordsPerLine` words.
 * Respects explicit \n line breaks in the input.
 */
function wrapText(text: string, maxWordsPerLine: number): string[] {
  const lines: string[] = [];

  for (const manualLine of text.split('\n')) {
    const words = manualLine.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) continue;

    let current: string[] = [];
    for (const word of words) {
      current.push(word);
      if (current.length >= maxWordsPerLine) {
        lines.push(current.join(' '));
        current = [];
      }
    }
    if (current.length > 0) {
      lines.push(current.join(' '));
    }
  }

  return lines;
}
