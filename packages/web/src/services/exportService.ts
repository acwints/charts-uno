import Papa from 'papaparse';
import html2canvas from 'html2canvas';
import type { ChartData } from '../types';

export interface WatermarkSettings {
  enabled: boolean;
  customLogoUrl: string | null;
}

export async function exportToCSV(data: ChartData, filename: string = 'chart-data'): Promise<void> {
  // Build rows with labels as first column, series as subsequent columns
  const headers = ['Label', ...data.series.map(s => s.name)];
  const rows = data.labels.map((label, idx) => {
    const row: (string | number | null)[] = [label];
    data.series.forEach(series => {
      row.push(series.data[idx]);
    });
    return row;
  });

  const csvContent = Papa.unparse({
    fields: headers,
    data: rows,
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawTextWatermark(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  _canvasHeight: number
): void {
  const text = 'Chartsuno';
  const fontSize = 14;
  const padding = 16;

  ctx.save();
  ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';

  ctx.fillText(text, canvasWidth - padding, padding);
  ctx.restore();
}

async function drawLogoWatermark(
  ctx: CanvasRenderingContext2D,
  logoUrl: string,
  canvasWidth: number,
  canvasHeight: number
): Promise<void> {
  try {
    const img = await loadImage(logoUrl);

    const maxHeight = 30;
    const padding = 16;

    // Scale proportionally to max height
    const scale = maxHeight / img.height;
    const width = img.width * scale;
    const height = maxHeight;

    // Position in top-right corner
    const x = canvasWidth - width - padding;
    const y = padding;

    // Draw with 50% opacity
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.drawImage(img, x, y, width, height);
    ctx.restore();
  } catch (error) {
    // If logo fails to load, fall back to text watermark
    console.warn('Failed to load custom logo, falling back to text watermark:', error);
    drawTextWatermark(ctx, canvasWidth, canvasHeight);
  }
}

async function prepareElementForCapture(element: HTMLElement): Promise<void> {
  element.scrollIntoView({ block: 'center', behavior: 'instant' });
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

export async function exportToPNG(
  element: HTMLElement,
  filename: string = 'chart',
  watermark?: WatermarkSettings
): Promise<void> {
  await prepareElementForCapture(element);
  element.classList.add('is-exporting');
  // Use null to capture the element's actual background color
  const canvas = await html2canvas(element, {
    backgroundColor: null,
    scale: 2,
    logging: false,
    useCORS: true,
  });
  element.classList.remove('is-exporting');

  // Apply watermark if enabled
  if (watermark?.enabled !== false) {
    const ctx = canvas.getContext('2d');
    if (ctx) {
      if (watermark?.customLogoUrl) {
        await drawLogoWatermark(ctx, watermark.customLogoUrl, canvas.width, canvas.height);
      } else {
        drawTextWatermark(ctx, canvas.width, canvas.height);
      }
    }
  }

  const url = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function copyImageToClipboard(
  element: HTMLElement,
  watermark?: WatermarkSettings
): Promise<void> {
  await prepareElementForCapture(element);
  element.classList.add('is-exporting');
  const canvas = await html2canvas(element, {
    backgroundColor: null,
    scale: 2,
    logging: false,
    useCORS: true,
  });
  element.classList.remove('is-exporting');

  if (watermark?.enabled !== false) {
    const ctx = canvas.getContext('2d');
    if (ctx) {
      if (watermark?.customLogoUrl) {
        await drawLogoWatermark(ctx, watermark.customLogoUrl, canvas.width, canvas.height);
      } else {
        drawTextWatermark(ctx, canvas.width, canvas.height);
      }
    }
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(createdBlob => {
      if (createdBlob) {
        resolve(createdBlob);
      } else {
        reject(new Error('Failed to create PNG blob.'));
      }
    }, 'image/png');
  });

  const clipboardItem = new ClipboardItem({ 'image/png': blob });
  await navigator.clipboard.write([clipboardItem]);
}

export async function copyToClipboard(data: ChartData): Promise<void> {
  // Build tab-separated values for Excel/Sheets paste
  const headers = ['', ...data.labels].join('\t');
  const rows = data.series.map(series => {
    return [series.name, ...series.data.map(v => (v == null ? '' : v.toString()))].join('\t');
  });

  const tsvContent = [headers, ...rows].join('\n');
  await navigator.clipboard.writeText(tsvContent);
}
