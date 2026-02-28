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
  canvasWidth: number
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
  canvasWidth: number
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
    drawTextWatermark(ctx, canvasWidth);
  }
}

async function prepareElementForCapture(element: HTMLElement): Promise<void> {
  element.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

async function waitForFontsReady(): Promise<void> {
  if (!('fonts' in document)) return;
  try {
    await (document as Document & { fonts: FontFaceSet }).fonts.ready;
  } catch {
    // Font readiness is best-effort and should not block export.
  }
}

function resolveCaptureTarget(element: HTMLElement): HTMLElement {
  if (element.classList.contains('chart-preview')) return element;
  const preview = element.querySelector<HTMLElement>('.chart-preview');
  return preview ?? element;
}

function shouldApplyWatermarkOverlay(element: HTMLElement): boolean {
  const captureTarget = resolveCaptureTarget(element);
  // For chart previews, watermark visibility/logo is already part of rendered UI state.
  return !captureTarget.classList.contains('chart-preview');
}

async function renderElementToCanvas(element: HTMLElement): Promise<HTMLCanvasElement> {
  const captureTarget = resolveCaptureTarget(element);
  await prepareElementForCapture(captureTarget);
  await waitForFontsReady();
  const rect = captureTarget.getBoundingClientRect();
  const captureWidth = Math.ceil(Math.max(rect.width, captureTarget.scrollWidth));
  // Add a little breathing room so x-axis labels never get clipped.
  const captureHeight = Math.ceil(Math.max(rect.height, captureTarget.scrollHeight) + 28);

  captureTarget.classList.add('is-exporting');
  try {
    // Use null to preserve the chart card's rendered background colors.
    return await html2canvas(captureTarget, {
      backgroundColor: null,
      scale: 2,
      logging: false,
      useCORS: true,
      width: captureWidth,
      height: captureHeight,
      onclone: (clonedDoc, clonedElement) => {
        // Keep export layout stable even if stylesheet parsing fails in the cloned document.
        const cloneTarget = clonedElement as HTMLElement;
        cloneTarget.style.paddingBottom = '28px';
        cloneTarget.style.overflow = 'visible';
        const headerTop = cloneTarget.querySelector<HTMLElement>('.chart-header-top');
        if (headerTop) {
          headerTop.style.display = 'flex';
          headerTop.style.alignItems = 'center';
          headerTop.style.justifyContent = 'space-between';
          headerTop.style.gap = '16px';
          headerTop.style.flexWrap = 'nowrap';
        }

        const brandArea = cloneTarget.querySelector<HTMLElement>('.chart-brand-area');
        if (brandArea) {
          brandArea.style.display = 'flex';
          brandArea.style.alignItems = 'center';
          brandArea.style.gap = '6px';
          brandArea.style.flexShrink = '0';
          brandArea.style.marginLeft = 'auto';
        }

        const chartBrand = cloneTarget.querySelector<HTMLElement>('.chart-brand');
        if (chartBrand) {
          chartBrand.style.display = 'flex';
          chartBrand.style.alignItems = 'center';
          chartBrand.style.gap = '4px';
          chartBrand.style.fontStyle = 'italic';
          chartBrand.style.opacity = '0.5';
          chartBrand.style.flexShrink = '0';
          chartBrand.style.fontFamily = 'var(--font-display), Georgia, "Times New Roman", serif';
        }

        const chartMeta = cloneTarget.querySelector<HTMLElement>('.chart-meta');
        if (chartMeta) {
          chartMeta.style.display = 'none';
        }

        const chartSource = cloneTarget.querySelector<HTMLElement>('.chart-source');
        if (chartSource) {
          chartSource.style.display = 'none';
        }

        const chartContainer = cloneTarget.querySelector<HTMLElement>('.chart-container');
        if (chartContainer) {
          chartContainer.style.overflow = 'visible';
          chartContainer.style.paddingBottom = '20px';
        }

        const title = cloneTarget.querySelector<HTMLElement>('.chart-title');
        if (title) {
          title.style.fontFamily = 'var(--font-display), Georgia, "Times New Roman", serif';
        }

        const style = clonedDoc.createElement('style');
        style.textContent = `
          .chart-brand-logo {
            max-height: 16px;
            max-width: 92px;
            width: auto;
            object-fit: contain;
          }
        `;
        clonedDoc.head.appendChild(style);
      },
    });
  } finally {
    captureTarget.classList.remove('is-exporting');
  }
}

export async function exportToPNG(
  element: HTMLElement,
  filename: string = 'chart',
  watermark?: WatermarkSettings
): Promise<void> {
  const canvas = await renderElementToCanvas(element);

  // Apply watermark if enabled
  if (watermark?.enabled !== false && shouldApplyWatermarkOverlay(element)) {
    const ctx = canvas.getContext('2d');
    if (ctx) {
      if (watermark?.customLogoUrl) {
        await drawLogoWatermark(ctx, watermark.customLogoUrl, canvas.width);
      } else {
        drawTextWatermark(ctx, canvas.width);
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
  const canvas = await renderElementToCanvas(element);

  if (watermark?.enabled !== false && shouldApplyWatermarkOverlay(element)) {
    const ctx = canvas.getContext('2d');
    if (ctx) {
      if (watermark?.customLogoUrl) {
        await drawLogoWatermark(ctx, watermark.customLogoUrl, canvas.width);
      } else {
        drawTextWatermark(ctx, canvas.width);
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

export function generateEmbedCode(chartId: string, title?: string): string {
  const origin = window.location.origin;
  const src = `${origin}/embed/${chartId}`;
  const safeTitle = title
    ? title.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    : 'Chart';
  return `<iframe src="${src}" width="600" height="400" frameborder="0" title="${safeTitle}" style="border:0;border-radius:8px;" allowtransparency="true"></iframe>`;
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
