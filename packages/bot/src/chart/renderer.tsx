import puppeteer, { Browser } from 'puppeteer';
import { accessSync, constants } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { ChartData, ChartConfig, ChartType } from '@chartsuno/shared';
import { COLOR_PALETTES } from '@chartsuno/shared';
import { logger } from '../config.js';

let browser: Browser | null = null;
const require = createRequire(import.meta.url);

function resolveChartJsUmdPath(): string {
  const chartJsEntryPath = require.resolve('chart.js');
  const chartJsDistDir = dirname(chartJsEntryPath);
  const candidates = [join(chartJsDistDir, 'chart.umd.js'), join(chartJsDistDir, 'chart.umd.min.js')];

  for (const candidate of candidates) {
    try {
      accessSync(candidate, constants.R_OK);
      return candidate;
    } catch {
      continue;
    }
  }

  throw new Error(`Unable to locate Chart.js UMD bundle from entry "${chartJsEntryPath}"`);
}

const CHART_JS_UMD_PATH = resolveChartJsUmdPath();

function isExecutable(path: string): boolean {
  try {
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function resolveExecutablePath(): Promise<string | undefined> {
  const configuredPath = process.env.PUPPETEER_EXECUTABLE_PATH?.trim();
  if (configuredPath) {
    if (isExecutable(configuredPath)) {
      return configuredPath;
    }

    logger.warn(
      { configuredPath },
      'Configured PUPPETEER_EXECUTABLE_PATH is not executable; falling back to auto-detection'
    );
  }

  return findChromium();
}

async function getBrowser(): Promise<Browser> {
  if (!browser) {
    const executablePath = await resolveExecutablePath();

    browser = await puppeteer.launch({
      headless: true,
      executablePath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process',
      ],
    });
    logger.info({ executablePath }, 'Puppeteer browser launched');
  }
  return browser;
}

async function findChromium(): Promise<string | undefined> {
  const { execSync } = await import('child_process');
  const paths = [
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
  ];

  for (const p of paths) {
    try {
      execSync(`test -x ${p}`);
      return p;
    } catch {
      continue;
    }
  }

  // Try which
  try {
    const result = execSync('which chromium || which chromium-browser || which google-chrome').toString().trim();
    if (result) return result;
  } catch {
    // Ignore
  }

  return undefined;
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
    logger.info('Puppeteer browser closed');
  }
}

interface ChartPreviewServerProps {
  data: ChartData;
  config: ChartConfig;
}

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }
  return value;
}

function getChartHeight(config: ChartConfig): number {
  return config.title ? 480 : 520;
}

function hasRenderableSeries(data: ChartData): boolean {
  return (
    data.series.length > 0 &&
    data.series.some((series) => series.data.some((value) => toFiniteNumber(value) !== undefined))
  );
}

function hasAnyNonZeroValue(data: ChartData): boolean {
  return data.series.some((series) =>
    series.data.some((value) => {
      const numeric = toFiniteNumber(value);
      return numeric !== undefined && Math.abs(numeric) > 0;
    })
  );
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildTableHtml(data: ChartData, chartWidth: number, chartHeight: number): string {
  const header = data.series
    .map(
      (series) => `
            <th class="table-head table-cell table-cell-right">${escapeHtml(series.name)}</th>`
    )
    .join('');

  const rows = data.labels
    .slice(0, 20)
    .map((label, idx) => {
      const cells = data.series
        .map((series) => {
          const value = toFiniteNumber(series.data[idx]);
          const display = value === undefined ? '-' : String(value);
          return `<td class="table-cell table-cell-right table-value">${escapeHtml(display)}</td>`;
        })
        .join('');
      return `
          <tr>
            <td class="table-cell table-label">${escapeHtml(label)}</td>
            ${cells}
          </tr>`;
    })
    .join('');

  return `
    <div class="table-wrap" style="width:${chartWidth}px;height:${chartHeight}px;">
      <table class="table">
        <thead>
          <tr>
            <th class="table-head table-cell table-cell-left">Label</th>
            ${header}
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>`;
}

function buildEmptyStateHtml(
  chartWidth: number,
  chartHeight: number,
  hasData: boolean
): string {
  const message = hasData
    ? 'Extracted chart values are all zero. Try "reverse it" to inspect the table output.'
    : 'No plottable numeric data detected. Try "reverse it" for table extraction.';

  return `
    <div class="empty-state" style="width:${chartWidth}px;height:${chartHeight}px;">
      ${escapeHtml(message)}
    </div>`;
}

function buildShellHtml(bodyContent: string, title: string): string {
  const titleHtml = title
    ? `<h2 class="chart-title">${escapeHtml(title)}</h2>`
    : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #0f0f0f;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    #root {
      width: 800px;
      height: 600px;
      background: linear-gradient(135deg, #0f0f0f 0%, #1a1a2e 50%, #16213e 100%);
      padding: 40px;
      box-sizing: border-box;
      overflow: hidden;
    }
    .chart-title {
      color: #ffffff;
      font-size: 24px;
      font-weight: 600;
      margin-bottom: 20px;
      text-align: center;
    }
    .chart-frame {
      width: 720px;
      margin: 0 auto;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .empty-state {
      border: 1px dashed rgba(255,255,255,0.24);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #9ca3af;
      font-size: 14px;
      text-align: center;
      padding: 16px;
    }
    .table-wrap {
      overflow: hidden;
      border: 1px solid rgba(255,255,255,0.14);
      border-radius: 12px;
      background: rgba(0,0,0,0.22);
      color: #e5e7eb;
    }
    .table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: 14px;
    }
    .table-cell {
      padding: 8px 12px;
      border-bottom: 1px solid rgba(255,255,255,0.08);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .table-head {
      color: #f9fafb;
      border-bottom: 1px solid rgba(255,255,255,0.16);
      padding-top: 10px;
      padding-bottom: 10px;
    }
    .table-cell-left { text-align: left; }
    .table-cell-right { text-align: right; }
    .table-label { color: #d1d5db; }
    .table-value {
      color: #e5e7eb;
      font-variant-numeric: tabular-nums;
    }
  </style>
</head>
<body>
  <div id="root">
    ${titleHtml}
    <div class="chart-frame">
      ${bodyContent}
    </div>
  </div>
</body>
</html>`;
}

function getChartPayload({ data, config }: ChartPreviewServerProps) {
  const palette = COLOR_PALETTES[config.colorScheme];
  const labels = data.labels.map((label) => String(label));
  const series = data.series.map((entry) => ({
    name: entry.name || 'Series',
    data: entry.data.map((value) => {
      const numeric = toFiniteNumber(value);
      return numeric === undefined ? null : numeric;
    }),
  }));

  return {
    type: config.type,
    labels,
    series,
    colors: palette,
    showGrid: config.showGrid,
    showLegend: config.showLegend,
    showPoints: config.showPoints,
    stacked: config.stacked,
    barLayout: config.barLayout ?? 'vertical',
  };
}

export async function renderChartToPng(data: ChartData, config: ChartConfig): Promise<Buffer> {
  const chartWidth = 720;
  const chartHeight = getChartHeight(config);
  const canPlot = hasRenderableSeries(data) && hasAnyNonZeroValue(data);
  const shouldDrawCanvas = config.type !== 'table' && canPlot;
  const bodyContent =
    config.type === 'table'
      ? buildTableHtml(data, chartWidth, chartHeight)
      : canPlot
        ? `<canvas id="chart-canvas" width="${chartWidth}" height="${chartHeight}"></canvas>`
        : buildEmptyStateHtml(chartWidth, chartHeight, hasRenderableSeries(data));

  const browserInstance = await getBrowser();
  const page = await browserInstance.newPage();

  try {
    // Set viewport to match chart size (retina for crisp output)
    const viewport = { width: 800, height: 600, deviceScaleFactor: 2 };
    await page.setViewport(viewport);

    const html = buildShellHtml(bodyContent, config.title || '');

    await page.setContent(html, { waitUntil: 'networkidle0' });
    if (shouldDrawCanvas) {
      await page.addScriptTag({ path: CHART_JS_UMD_PATH });

      await page.evaluate((payload) => {
        const chartTypeMap: Record<string, string> = {
          area: 'line',
          table: 'bar',
        };
        const resolvedType = chartTypeMap[payload.type] || payload.type;
        const chartType =
          resolvedType === 'bar' ||
          resolvedType === 'line' ||
          resolvedType === 'pie' ||
          resolvedType === 'radar' ||
          resolvedType === 'scatter'
            ? resolvedType
            : 'bar';

        const canvas = document.getElementById('chart-canvas') as HTMLCanvasElement | null;
        if (!canvas) {
          throw new Error('Chart canvas element not found');
        }

        const win = window as unknown as {
          Chart?: new (ctx: CanvasRenderingContext2D, config: unknown) => unknown;
        };
        if (!win.Chart) {
          throw new Error('Chart.js was not loaded');
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Unable to get 2D context for chart canvas');
        }

        const getDatasetColor = (idx: number): string => payload.colors[idx % payload.colors.length];
        const labels = payload.labels as string[];

        const commonDatasetOptions = {
          borderWidth: 2,
          pointRadius: payload.showPoints ? 3 : 0,
          pointHoverRadius: payload.showPoints ? 4 : 0,
        };

        let datasets: Array<Record<string, unknown>>;
        let chartData: Record<string, unknown>;
        let scales: Record<string, unknown>;

        if (chartType === 'pie') {
          const firstSeries = payload.series[0];
          const pieData = (firstSeries?.data || []).map((value: number | null) => value ?? 0);
          datasets = [
            {
              label: firstSeries?.name || 'Series',
              data: pieData,
              backgroundColor: labels.map((_, idx) => getDatasetColor(idx)),
              borderColor: '#0f172a',
              borderWidth: 1,
            },
          ];
          chartData = { labels, datasets };
          scales = {};
        } else if (chartType === 'scatter') {
          datasets = payload.series.map((series: { name: string; data: Array<number | null> }, idx: number) => ({
            label: series.name,
            data: series.data
              .map((value, pointIdx) => {
                if (typeof value !== 'number') return null;
                return { x: pointIdx + 1, y: value };
              })
              .filter((point): point is { x: number; y: number } => point !== null),
            backgroundColor: getDatasetColor(idx),
            borderColor: getDatasetColor(idx),
            ...commonDatasetOptions,
          }));
          chartData = { datasets };
          scales = {
            x: {
              type: 'linear',
              min: 1,
              max: Math.max(labels.length, 1),
              grid: { color: 'rgba(255,255,255,0.1)', display: payload.showGrid },
              ticks: {
                color: '#888',
                callback(value: number | string) {
                  const idx = Number(value) - 1;
                  return Number.isInteger(idx) && idx >= 0 && idx < labels.length ? labels[idx] : '';
                },
              },
            },
            y: {
              grid: { color: 'rgba(255,255,255,0.1)', display: payload.showGrid },
              ticks: { color: '#888' },
            },
          };
        } else {
          datasets = payload.series.map((series: { name: string; data: Array<number | null> }, idx: number) => {
            const color = getDatasetColor(idx);
            return {
              label: series.name,
              data: series.data.map((value) => (typeof value === 'number' ? value : null)),
              borderColor: color,
              backgroundColor:
                chartType === 'line' && payload.type !== 'area'
                  ? color
                  : `${color}${payload.type === 'area' ? '66' : ''}`,
              fill: payload.type === 'area',
              tension: chartType === 'line' ? 0.35 : 0,
              ...commonDatasetOptions,
            };
          });
          chartData = { labels, datasets };
          scales = {
            x: {
              stacked: payload.stacked,
              grid: { color: 'rgba(255,255,255,0.1)', display: payload.showGrid },
              ticks: { color: '#888', maxRotation: 45, minRotation: 45 },
            },
            y: {
              stacked: payload.stacked,
              grid: { color: 'rgba(255,255,255,0.1)', display: payload.showGrid },
              ticks: { color: '#888' },
            },
          };
        }

        new win.Chart(ctx, {
          type: chartType,
          data: chartData,
          options: {
            animation: false,
            responsive: false,
            maintainAspectRatio: false,
            indexAxis: chartType === 'bar' && payload.barLayout === 'horizontal' ? 'y' : 'x',
            scales,
            plugins: {
              legend: {
                display: payload.showLegend,
                labels: { color: '#aaa' },
              },
              tooltip: {
                backgroundColor: '#1a1a1a',
                borderColor: '#333',
                borderWidth: 1,
                titleColor: '#fff',
                bodyColor: '#ccc',
              },
            },
          },
        });
      }, getChartPayload({ data, config }));
    }

    // Take screenshot
    const screenshot = await page.screenshot({
      type: 'png',
      clip: { x: 0, y: 0, width: viewport.width, height: viewport.height },
    });

    logger.info('Chart rendered to PNG successfully');

    return Buffer.from(screenshot);
  } finally {
    await page.close();
  }
}

export function getDefaultConfig(data: ChartData): ChartConfig {
  // Determine the best chart type based on data
  let chartType: ChartType = data.suggestedType || 'bar';

  // Use suggested type if available, otherwise default to bar
  if (!['bar', 'line', 'area', 'pie', 'radar', 'scatter', 'table'].includes(chartType)) {
    chartType = 'bar';
  }

  return {
    type: chartType,
    colorScheme: 'default',
    styleVariant: 'professional',
    themeMode: 'dark',
    showGrid: true,
    showLegend: data.series.length > 1,
    showValues: false,
    showPoints: true,
    showBorder: false,
    animate: false, // No animations for server-side rendering
    title: data.suggestedTitle || '',
    stacked: false,
  };
}
