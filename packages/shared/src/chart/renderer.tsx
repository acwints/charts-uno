import puppeteer, { Browser } from 'puppeteer';
import { accessSync, constants } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { ChartData, ChartConfig, ChartType } from '../types.js';
import { getNumericDomainFromValues } from '../axisDomain.js';
import { applyCustomColors, COLOR_PALETTES, getTheme } from '../colors.js';
import { getStyleVariantConfig } from '../styleVariants.js';
import { isComboChart, resolveSeriesConfig } from '../seriesConfig.js';
import type { ChartLogger } from './analyzer.js';

const defaultLogger: ChartLogger = {
  info: (obj, msg) => console.log(msg ?? '', obj),
  error: (obj, msg) => console.error(msg ?? '', obj),
  warn: (obj, msg) => console.warn(msg ?? '', obj),
};

let _logger: ChartLogger = defaultLogger;

/** Set the logger used by the chart renderer. Call once at startup. */
export function setRendererLogger(logger: ChartLogger): void {
  _logger = logger;
}

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

    _logger.warn?.(
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
    _logger.info({ executablePath }, 'Puppeteer browser launched');
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
    _logger.info({}, 'Puppeteer browser closed');
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

function sanitizeCssValue(value: string): string {
  return value.replace(/[;{}<>]/g, '');
}

function buildTableHtml(data: ChartData, config: ChartConfig, chartWidth: number, chartHeight: number): string {
  const variant = getStyleVariantConfig(config.styleVariant);
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
    <div class="table-wrap table-wrap-${variant.chart.gridStyle}" style="width:${chartWidth}px;height:${chartHeight}px;">
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

function buildShellHtml(bodyContent: string, title: string, config: ChartConfig): string {
  const titleHtml = title
    ? `<h2 class="chart-title">${escapeHtml(title)}</h2>`
    : '';
  const variant = getStyleVariantConfig(config.styleVariant);
  const theme = applyCustomColors(getTheme(config.colorScheme, config.themeMode), config.customColors);
  const palette = config.customColors?.seriesColors?.length
    ? config.customColors.seriesColors
    : COLOR_PALETTES[config.colorScheme];
  const accent = palette[0] || theme.textMuted;
  const accentSecondary = palette[1] || accent;
  const background =
    config.themeMode === 'dark'
      ? `linear-gradient(135deg, ${theme.background} 0%, ${theme.cardBackground} 62%, ${accent} 160%)`
      : `linear-gradient(135deg, ${theme.background} 0%, ${theme.cardBackground} 68%, ${accentSecondary} 175%)`;
  const cardAlpha = config.themeMode === 'dark' ? '0.26' : '0.72';
  const frameShadow = variant.decorations.useShadows
    ? config.themeMode === 'dark'
      ? '0 18px 60px rgba(0,0,0,0.28)'
      : '0 18px 42px rgba(15,23,42,0.12)'
    : 'none';
  const titleWeight = config.styleVariant === 'editorial' ? 500 : config.styleVariant === 'bold' ? 700 : 600;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: ${sanitizeCssValue(theme.background)};
      font-family: ${sanitizeCssValue(variant.fonts.body)}, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    #root {
      width: 800px;
      height: 600px;
      background: ${sanitizeCssValue(background)};
      padding: 40px;
      box-sizing: border-box;
      overflow: hidden;
    }
    .chart-title {
      color: ${sanitizeCssValue(theme.text)};
      font-size: 24px;
      font-weight: ${titleWeight};
      margin-bottom: 20px;
      text-align: center;
      font-family: ${sanitizeCssValue(variant.fonts.display)}, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .chart-frame {
      width: 720px;
      margin: 0 auto;
      display: flex;
      justify-content: center;
      align-items: center;
      border-radius: ${config.styleVariant === 'playful' ? 20 : config.styleVariant === 'editorial' ? 0 : 12}px;
      box-shadow: ${frameShadow};
    }
    .empty-state {
      border: 1px dashed ${sanitizeCssValue(theme.border)};
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: ${sanitizeCssValue(theme.textMuted)};
      font-size: 14px;
      text-align: center;
      padding: 16px;
      background: color-mix(in srgb, ${sanitizeCssValue(theme.cardBackground)} 78%, transparent);
    }
    .table-wrap {
      overflow: hidden;
      border: 1px solid ${sanitizeCssValue(theme.border)};
      border-radius: ${config.styleVariant === 'editorial' ? 0 : config.styleVariant === 'playful' ? 18 : 12}px;
      background: color-mix(in srgb, ${sanitizeCssValue(theme.cardBackground)} ${Math.round(Number(cardAlpha) * 100)}%, transparent);
      color: ${sanitizeCssValue(theme.text)};
    }
    .table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: 14px;
    }
    .table-cell {
      padding: 8px 12px;
      border-bottom: 1px solid ${sanitizeCssValue(theme.border)};
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .table-head {
      color: ${sanitizeCssValue(theme.text)};
      border-bottom: 1px solid ${sanitizeCssValue(accent)};
      padding-top: 10px;
      padding-bottom: 10px;
    }
    .table-cell-left { text-align: left; }
    .table-cell-right { text-align: right; }
    .table-label { color: ${sanitizeCssValue(theme.textMuted)}; }
    .table-value {
      color: ${sanitizeCssValue(theme.text)};
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
  const theme = applyCustomColors(getTheme(config.colorScheme, config.themeMode), config.customColors);
  const variant = getStyleVariantConfig(config.styleVariant);
  const palette = config.customColors?.seriesColors?.length
    ? config.customColors.seriesColors
    : COLOR_PALETTES[config.colorScheme];
  const labels = data.labels.map((label) => String(label));
  const series = data.series.map((entry) => ({
    name: entry.name || 'Series',
    data: entry.data.map((value) => {
      const numeric = toFiniteNumber(value);
      return numeric === undefined ? null : numeric;
    }),
  }));
  // Combo charts: each series can be a bar/line/area on the left or right axis.
  const combo = isComboChart(config) && (config.type === 'bar' || config.type === 'line' || config.type === 'area');
  const seriesOverrides = data.series.map((entry) => {
    const resolved = resolveSeriesConfig(entry.name || 'Series', config);
    return combo ? resolved : { chartType: resolved.chartType, axis: 'left' as const };
  });
  const leftValues = series.flatMap((entry, idx) => (seriesOverrides[idx].axis === 'left' ? entry.data : []));
  const rightValues = series.flatMap((entry, idx) => (seriesOverrides[idx].axis === 'right' ? entry.data : []));
  const valueDomain = getNumericDomainFromValues(
    leftValues.length > 0 ? leftValues : series.flatMap((entry) => entry.data),
    { mode: config.yAxisBaselineMode ?? 'auto' }
  );
  const rightValueDomain = rightValues.length > 0
    ? getNumericDomainFromValues(rightValues, { mode: config.yAxisBaselineMode ?? 'auto' })
    : undefined;
  const canStack = series.length > 1;

  return {
    type: config.type,
    labels,
    series,
    combo,
    seriesOverrides,
    axisTitles: {
      x: config.showAxisTitles === false ? '' : data.xAxisLabel ?? '',
      y: config.showAxisTitles === false ? '' : data.yAxisLabel ?? '',
      y1: config.showAxisTitles === false ? '' : config.rightYAxisLabel ?? '',
    },
    leftFormat: { prefix: data.yAxisPrefix ?? '', suffix: data.yAxisSuffix ?? (data.yAxisFormat === 'percentage' ? '%' : '') },
    rightFormat: { prefix: config.rightYAxisPrefix ?? '', suffix: config.rightYAxisSuffix ?? '' },
    rightValueDomain,
    colors: palette,
    theme,
    style: {
      strokeWidth: variant.chart.strokeWidth,
      dotRadius: variant.chart.dotRadius,
      gridStyle: variant.chart.gridStyle,
      gridOpacity: variant.chart.gridOpacity,
      useShadows: variant.decorations.useShadows,
    },
    showGrid: config.showGrid,
    showLegend: config.showLegend,
    showPoints: config.showPoints,
    stacked: config.stacked && canStack,
    barLayout: combo ? 'vertical' : (config.barLayout ?? 'vertical'),
    yAxisBaselineMode: config.yAxisBaselineMode ?? 'auto',
    valueDomain,
  };
}

export async function renderChartToPng(data: ChartData, config: ChartConfig): Promise<Buffer> {
  const chartWidth = 720;
  const chartHeight = getChartHeight(config);
  const canPlot = hasRenderableSeries(data) && hasAnyNonZeroValue(data);
  const shouldDrawCanvas = config.type !== 'table' && canPlot;
  const bodyContent =
    config.type === 'table'
      ? buildTableHtml(data, config, chartWidth, chartHeight)
      : canPlot
        ? `<canvas id="chart-canvas" width="${chartWidth}" height="${chartHeight}"></canvas>`
        : buildEmptyStateHtml(chartWidth, chartHeight, hasRenderableSeries(data));

  const browserInstance = await getBrowser();
  const page = await browserInstance.newPage();

  try {
    // Set viewport to match chart size (retina for crisp output)
    const viewport = { width: 800, height: 600, deviceScaleFactor: 2 };
    await page.setViewport(viewport);

    const html = buildShellHtml(bodyContent, config.title || '', config);

    await page.setContent(html, { waitUntil: 'domcontentloaded' });
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

        const theme = payload.theme;
        const style = payload.style;
        const getDatasetColor = (idx: number): string => payload.colors[idx % payload.colors.length];
        const labels = payload.labels as string[];
        const gridDash = style.gridStyle === 'dashed'
          ? [5, 5]
          : style.gridStyle === 'dotted'
            ? [1, 5]
            : [];
        const gridOptions = {
          color: theme.grid,
          display: payload.showGrid && style.gridStyle !== 'none',
          lineWidth: 1,
          drawTicks: true,
          tickLength: 4,
          borderDash: gridDash,
        };

        const commonDatasetOptions = {
          borderWidth: style.strokeWidth,
          pointRadius: payload.showPoints ? style.dotRadius : 0,
          pointHoverRadius: payload.showPoints ? style.dotRadius + 1 : 0,
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
              borderColor: theme.background,
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
              grid: gridOptions,
              ticks: {
                color: theme.textMuted,
                callback(value: number | string) {
                  const idx = Number(value) - 1;
                  return Number.isInteger(idx) && idx >= 0 && idx < labels.length ? labels[idx] : '';
                },
              },
            },
            y: {
              grid: gridOptions,
              ticks: { color: theme.textMuted },
            },
          };
        } else {
          const overrides = payload.seriesOverrides as Array<{ chartType: 'bar' | 'line' | 'area'; axis: 'left' | 'right' }>;
          const combo = Boolean(payload.combo);
          datasets = payload.series.map((series: { name: string; data: Array<number | null> }, idx: number) => {
            const color = getDatasetColor(idx);
            // In a combo every dataset carries its own type and axis; otherwise they follow the chart.
            const seriesType = combo ? overrides[idx].chartType : (payload.type as string);
            const drawsLine = seriesType === 'line' || seriesType === 'area';
            const isArea = seriesType === 'area';
            return {
              label: series.name,
              data: series.data.map((value) => (typeof value === 'number' ? value : null)),
              ...(combo ? { type: drawsLine ? 'line' : 'bar', yAxisID: overrides[idx].axis === 'right' ? 'y1' : 'y', order: drawsLine ? 0 : 1 } : {}),
              borderColor: color,
              backgroundColor: drawsLine && !isArea ? color : `${color}${isArea ? '66' : ''}`,
              fill: isArea,
              tension: drawsLine ? 0.35 : 0,
              ...commonDatasetOptions,
              ...(drawsLine && combo ? { borderWidth: Math.max(style.strokeWidth, 3) } : {}),
            };
          });
          chartData = { labels, datasets };
          const isHorizontalBar = chartType === 'bar' && payload.barLayout === 'horizontal';
          const valueAxisKey = isHorizontalBar ? 'x' : 'y';
          const toDomain = (domain: unknown): [number, number] | undefined =>
            Array.isArray(domain) && domain.length === 2 && typeof domain[0] === 'number' && typeof domain[1] === 'number'
              ? (domain as [number, number])
              : undefined;
          const valueAxisDomain = toDomain(payload.valueDomain);
          const rightAxisDomain = toDomain(payload.rightValueDomain);
          const valueScaleOptions = chartType === 'bar'
            ? {
                beginAtZero: payload.yAxisBaselineMode === 'zero',
                // suggested* lets Chart.js land on round tick values instead of the raw data max.
                ...(valueAxisDomain ? { suggestedMin: valueAxisDomain[0], suggestedMax: valueAxisDomain[1] } : {}),
              }
            : {};
          const titles = payload.axisTitles as { x: string; y: string; y1: string };
          const axisTitle = (text: string) => ({ display: Boolean(text), text, color: theme.textMuted, font: { size: 12 } });
          const formatTick = (value: number | string, fmt: { prefix: string; suffix: string }) => {
            const num = typeof value === 'number' ? value : Number(value);
            if (!Number.isFinite(num)) return String(value);
            const abs = Math.abs(num);
            const compact = abs >= 1e9 ? `${(num / 1e9).toFixed(abs >= 1e10 ? 0 : 1)}B`
              : abs >= 1e6 ? `${(num / 1e6).toFixed(abs >= 1e7 ? 0 : 1)}M`
              : abs >= 1e4 ? `${(num / 1e3).toFixed(0)}K`
              : new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(num);
            return `${fmt.prefix}${compact}${fmt.suffix}`;
          };
          const leftFormat = payload.leftFormat as { prefix: string; suffix: string };
          const rightFormat = payload.rightFormat as { prefix: string; suffix: string };
          scales = {
            x: {
              stacked: chartType === 'bar' ? payload.stacked : false,
              ...(valueAxisKey === 'x' ? valueScaleOptions : {}),
              grid: gridOptions,
              title: axisTitle(isHorizontalBar ? titles.y : titles.x),
              ticks: valueAxisKey === 'x'
                ? { color: theme.textMuted, callback: (value: number | string) => formatTick(value, leftFormat) }
                : { color: theme.textMuted, maxRotation: 45, minRotation: labels.length > 8 ? 45 : 0 },
            },
            y: {
              stacked: chartType === 'bar' ? payload.stacked : false,
              ...(valueAxisKey === 'y' ? valueScaleOptions : {}),
              grid: gridOptions,
              title: axisTitle(isHorizontalBar ? titles.x : titles.y),
              ticks: valueAxisKey === 'y'
                ? { color: theme.textMuted, callback: (value: number | string) => formatTick(value, leftFormat) }
                : { color: theme.textMuted },
            },
            ...(combo && overrides.some((o) => o.axis === 'right')
              ? {
                  y1: {
                    position: 'right',
                    beginAtZero: payload.yAxisBaselineMode === 'zero',
                    ...(rightAxisDomain ? { suggestedMin: rightAxisDomain[0], suggestedMax: rightAxisDomain[1] } : {}),
                    grid: { ...gridOptions, drawOnChartArea: false },
                    title: axisTitle(titles.y1),
                    ticks: { color: theme.textMuted, callback: (value: number | string) => formatTick(value, rightFormat) },
                  },
                }
              : {}),
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
                labels: { color: theme.text },
              },
              tooltip: {
                backgroundColor: theme.cardBackground,
                borderColor: theme.border,
                borderWidth: 1,
                titleColor: theme.text,
                bodyColor: theme.textMuted,
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

    _logger.info({}, 'Chart rendered to PNG successfully');

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
    yAxisBaselineMode: 'auto',
  };
}
