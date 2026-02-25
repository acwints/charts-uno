import sharp from 'sharp';
import type { ChartData, ChartConfig } from '@chartsuno/shared';
import { renderChartToPng, getDefaultConfig } from '../../chart/renderer.js';
import { marketingConfig, logger } from '../config.js';
import type { ScreenshotConfig } from '../types.js';

// ─── Pre-built chart data for before/after contrast ────────────────

const SAMPLE_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
const SAMPLE_SERIES_1 = [42, 58, 35, 72, 61, 89];
const SAMPLE_SERIES_2 = [28, 45, 52, 38, 67, 54];

const SAMPLE_DATA: ChartData = {
  labels: SAMPLE_LABELS,
  series: [
    { name: 'Revenue', data: SAMPLE_SERIES_1 },
    { name: 'Users', data: SAMPLE_SERIES_2 },
  ],
  sourceType: 'paste',
  suggestedTitle: 'Q1-Q2 Performance',
};

const UGLY_CONFIG: ChartConfig = {
  type: 'bar',
  colorScheme: 'default',
  styleVariant: 'professional',
  themeMode: 'dark',
  showGrid: true,
  showLegend: true,
  showValues: false,
  showPoints: false,
  showBorder: false,
  animate: false,
  title: '',
  stacked: false,
  yAxisBaselineMode: 'auto',
};

const BEAUTIFUL_BAR_CONFIG: ChartConfig = {
  type: 'bar',
  colorScheme: 'editorial',
  styleVariant: 'professional',
  themeMode: 'dark',
  showGrid: true,
  showLegend: true,
  showValues: false,
  showPoints: false,
  showBorder: false,
  animate: false,
  title: 'Q1-Q2 Performance',
  stacked: false,
  yAxisBaselineMode: 'auto',
};

const BEAUTIFUL_LINE_CONFIG: ChartConfig = {
  type: 'line',
  colorScheme: 'cool',
  styleVariant: 'professional',
  themeMode: 'dark',
  showGrid: true,
  showLegend: true,
  showValues: false,
  showPoints: true,
  showBorder: false,
  animate: false,
  title: 'Growth Trends',
  stacked: false,
  yAxisBaselineMode: 'auto',
};

// Track which "beautiful" variant to use (alternates for transform1 vs transform2)
let beautifulCallCount = 0;

/**
 * Generate a chart screenshot for a marketing slide.
 * Renders via the existing Puppeteer + Chart.js pipeline, then
 * resizes to portrait 9:16 on a dark canvas.
 */
export async function generateScreenshot(config: ScreenshotConfig): Promise<Buffer> {
  const { slideWidth, slideHeight } = marketingConfig.marketing;

  const chartData = config.chartData ?? SAMPLE_DATA;
  let chartConfig: ChartConfig;

  switch (config.variant) {
    case 'ugly-before':
      chartConfig = config.chartConfig ?? UGLY_CONFIG;
      break;
    case 'beautiful-after': {
      // Alternate between bar and line for variety
      beautifulCallCount += 1;
      chartConfig = config.chartConfig ?? (beautifulCallCount % 2 === 1
        ? BEAUTIFUL_BAR_CONFIG
        : BEAUTIFUL_LINE_CONFIG);
      break;
    }
    case 'feature-showcase':
      chartConfig = config.chartConfig ?? {
        ...getDefaultConfig(chartData),
        colorScheme: 'warm',
        title: 'ChartsUno',
        showGrid: true,
        showLegend: true,
        showPoints: true,
      };
      break;
  }

  logger.info({ variant: config.variant }, 'Generating chart screenshot');

  const chartPng = await renderChartToPng(chartData, chartConfig);

  // Resize 800x600 landscape chart onto 1024x1536 portrait canvas
  return sharp(chartPng)
    .resize(slideWidth, slideHeight, {
      fit: 'contain',
      background: { r: 15, g: 15, b: 15, alpha: 1 },
    })
    .png()
    .toBuffer();
}
