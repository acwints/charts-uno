import Papa from 'papaparse';
import html2canvas from 'html2canvas';
import type { ChartData } from '../types';

export interface WatermarkSettings {
  enabled: boolean;
  customLogoUrl: string | null;
}

const EXPORT_SCALE = 2;
const EXPORT_BOTTOM_CAPTURE_PADDING = 28;
const EXPORT_CONTAINER_BOTTOM_PADDING = 20;

type CaptureProfileId = 'clean-export' | 'wysiwyg-share';

interface CaptureProfile {
  hideMeta: boolean;
  hideSource: boolean;
  extraBottomPadding: number;
  containerBottomPadding: number;
}

const CAPTURE_PROFILES: Record<CaptureProfileId, CaptureProfile> = {
  'clean-export': {
    hideMeta: true,
    hideSource: true,
    extraBottomPadding: EXPORT_BOTTOM_CAPTURE_PADDING,
    containerBottomPadding: EXPORT_CONTAINER_BOTTOM_PADDING,
  },
  'wysiwyg-share': {
    hideMeta: false,
    hideSource: false,
    extraBottomPadding: EXPORT_BOTTOM_CAPTURE_PADDING,
    containerBottomPadding: EXPORT_CONTAINER_BOTTOM_PADDING,
  },
};

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

function getCaptureProfile(profileId: CaptureProfileId): CaptureProfile {
  return CAPTURE_PROFILES[profileId];
}

async function renderElementToCanvas(
  element: HTMLElement,
  profileId: CaptureProfileId,
): Promise<HTMLCanvasElement> {
  const profile = getCaptureProfile(profileId);
  const captureTarget = resolveCaptureTarget(element);
  await prepareElementForCapture(captureTarget);
  await waitForFontsReady();
  const rect = captureTarget.getBoundingClientRect();
  const captureWidth = Math.ceil(Math.max(rect.width, captureTarget.scrollWidth));
  // Add a little breathing room so x-axis labels never get clipped.
  const captureHeight = Math.ceil(Math.max(rect.height, captureTarget.scrollHeight) + profile.extraBottomPadding);

  captureTarget.classList.add('is-exporting');
  try {
    // Use null to preserve the chart card's rendered background colors.
    return await html2canvas(captureTarget, {
      backgroundColor: null,
      scale: EXPORT_SCALE,
      logging: false,
      useCORS: true,
      width: captureWidth,
      height: captureHeight,
      onclone: (_clonedDoc, clonedElement) => {
        // Keep export output clean while preserving original chart styling.
        const cloneTarget = clonedElement as HTMLElement;
        applyExportCloneCleanup(cloneTarget, profile);
      },
    });
  } finally {
    captureTarget.classList.remove('is-exporting');
  }
}

function applyExportCloneCleanup(cloneTarget: HTMLElement, profile: CaptureProfile): void {
  cloneTarget.style.paddingBottom = `${profile.extraBottomPadding}px`;
  cloneTarget.style.overflow = 'visible';

  if (profile.hideMeta) {
    const chartMeta = cloneTarget.querySelector<HTMLElement>('.chart-meta');
    if (chartMeta) {
      chartMeta.style.display = 'none';
    }
  }

  if (profile.hideSource) {
    const chartSource = cloneTarget.querySelector<HTMLElement>('.chart-source');
    if (chartSource) {
      chartSource.style.display = 'none';
    }
  }

  const chartContainer = cloneTarget.querySelector<HTMLElement>('.chart-container');
  if (chartContainer) {
    chartContainer.style.overflow = 'visible';
    chartContainer.style.paddingBottom = `${profile.containerBottomPadding}px`;
  }
}

async function applyWatermarkOverlay(
  canvas: HTMLCanvasElement,
  element: HTMLElement,
  watermark?: WatermarkSettings,
): Promise<void> {
  if (watermark?.enabled === false || !shouldApplyWatermarkOverlay(element)) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  if (watermark?.customLogoUrl) {
    await drawLogoWatermark(ctx, watermark.customLogoUrl, canvas.width);
    return;
  }

  drawTextWatermark(ctx, canvas.width);
}

function downloadCanvasAsPng(canvas: HTMLCanvasElement, filename: string): void {
  const url = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

async function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(createdBlob => {
      if (createdBlob) {
        resolve(createdBlob);
      } else {
        reject(new Error('Failed to create PNG blob.'));
      }
    }, 'image/png');
  });
}

export async function exportToPNG(
  element: HTMLElement,
  filename: string = 'chart',
  watermark?: WatermarkSettings
): Promise<void> {
  const canvas = await renderElementToCanvas(element, 'clean-export');
  await applyWatermarkOverlay(canvas, element, watermark);
  downloadCanvasAsPng(canvas, filename);
}

export async function copyImageToClipboard(
  element: HTMLElement,
  watermark?: WatermarkSettings
): Promise<void> {
  const canvas = await renderElementToCanvas(element, 'wysiwyg-share');
  await applyWatermarkOverlay(canvas, element, watermark);
  const blob = await canvasToPngBlob(canvas);

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
