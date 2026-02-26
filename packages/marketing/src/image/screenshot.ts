import sharp from 'sharp';
import type { ChartData, ChartConfig } from '@chartsuno/shared';
import { renderChartToPng, getDefaultConfig } from '@chartsuno/shared/node';
import { marketingConfig, logger } from '../config.js';
import { SAMPLE_LABELS, SAMPLE_VALUES_1, SAMPLE_VALUES_2 } from '../constants.js';
import type { ScreenshotConfig } from '../types.js';

const SAMPLE_DATA: ChartData = {
  labels: SAMPLE_LABELS,
  series: [
    { name: 'Revenue', data: SAMPLE_VALUES_1 },
    { name: 'Users', data: SAMPLE_VALUES_2 },
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

  try {
    const chartPng = await renderChartToPng(chartData, chartConfig);

    // Resize 800x600 landscape chart onto 1024x1536 portrait canvas
    return sharp(chartPng)
      .resize(slideWidth, slideHeight, {
        fit: 'contain',
        background: { r: 15, g: 15, b: 15, alpha: 1 },
      })
      .png()
      .toBuffer();
  } catch (error) {
    // Puppeteer rendering can fail locally via tsx (esbuild __name issue).
    // Fall back to a styled placeholder — deployed builds compile first and work fine.
    logger.warn({ error, variant: config.variant },
      'Chart screenshot failed, using placeholder (this is normal when running via tsx locally)');
    return createChartPlaceholder(config.variant, slideWidth, slideHeight);
  }
}

async function createChartPlaceholder(
  variant: string,
  width: number,
  height: number,
): Promise<Buffer> {
  const labels: Record<string, { bg: string; accent: string; text: string }> = {
    'ugly-before': { bg: '#1a1a1a', accent: '#444', text: 'Before: Default Charts' },
    'beautiful-after': { bg: '#0f0f2e', accent: '#4f7cff', text: 'After: ChartsUno' },
    'feature-showcase': { bg: '#0f1a2e', accent: '#ff6b4f', text: 'ChartsUno' },
  };
  const style = labels[variant] ?? labels['beautiful-after'];

  // Simple bar chart placeholder via SVG
  const bars = [42, 58, 35, 72, 61, 89];
  const maxVal = Math.max(...bars);
  const barWidth = 60;
  const gap = 30;
  const chartLeft = (width - (bars.length * (barWidth + gap) - gap)) / 2;
  const chartBottom = height * 0.65;
  const chartHeight = height * 0.25;

  const barsSvg = bars.map((v, i) => {
    const barH = (v / maxVal) * chartHeight;
    const x = chartLeft + i * (barWidth + gap);
    const y = chartBottom - barH;
    return `<rect x="${x}" y="${y}" width="${barWidth}" height="${barH}" rx="4" fill="${style.accent}" opacity="0.8"/>`;
  }).join('');

  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="${style.bg}"/>
    ${barsSvg}
    <text x="${width / 2}" y="${height * 0.78}" text-anchor="middle"
          font-size="24" fill="#666" font-family="sans-serif">${style.text}</text>
  </svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}
