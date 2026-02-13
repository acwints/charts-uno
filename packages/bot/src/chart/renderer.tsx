import puppeteer, { Browser } from 'puppeteer';
import { accessSync, constants } from 'node:fs';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from 'recharts';
import type { ChartData, ChartConfig, ChartType } from '@chartsuno/shared';
import { COLOR_PALETTES } from '@chartsuno/shared';
import { logger } from '../config.js';

let browser: Browser | null = null;

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

function ChartPreviewServer({ data, config }: ChartPreviewServerProps) {
  const chartWidth = 720;
  const chartHeight = config.title ? 480 : 520;
  const colors = COLOR_PALETTES[config.colorScheme];

  const chartData = data.labels.map((label, idx) => {
    const point: Record<string, string | number | undefined> = { name: label };
    data.series.forEach((series) => {
      point[series.name] = toFiniteNumber(series.data[idx]);
    });
    return point;
  });

  const pieData = data.series[0]?.data
    .map((value, idx) => {
      const numeric = toFiniteNumber(value);
      if (numeric === undefined) return null;
      return {
        name: data.labels[idx],
        value: numeric,
      };
    })
    .filter((point): point is { name: string; value: number } => point !== null) || [];

  const radarData = data.labels.map((label, idx) => {
    const point: Record<string, string | number | undefined> = { subject: label };
    data.series.forEach((series) => {
      point[series.name] = toFiniteNumber(series.data[idx]);
    });
    return point;
  });

  const commonAxisProps = {
    stroke: '#666',
    tick: { fill: '#888', fontSize: 12 },
    tickLine: { stroke: '#666' },
    axisLine: { stroke: '#444' },
  };

  const gridElement = config.showGrid ? (
    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
  ) : null;

  const xAxisElement = <XAxis dataKey="name" {...commonAxisProps} />;
  const yAxisElement = <YAxis {...commonAxisProps} />;

  const tooltipElement = (
    <Tooltip
      contentStyle={{
        background: '#1a1a1a',
        border: '1px solid #333',
        borderRadius: '8px',
      }}
      labelStyle={{ color: '#fff', fontWeight: 600 }}
      itemStyle={{ color: '#ccc' }}
    />
  );

  const legendElement = config.showLegend ? (
    <Legend
      wrapperStyle={{ paddingTop: '20px' }}
      formatter={(value) => <span style={{ color: '#aaa', fontSize: '0.85rem' }}>{value}</span>}
    />
  ) : null;

  const renderTable = () => (
    <div
      style={{
        width: `${chartWidth}px`,
        height: `${chartHeight}px`,
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.14)',
        borderRadius: '12px',
        background: 'rgba(0,0,0,0.22)',
        color: '#e5e7eb',
      }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: '14px' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.16)', color: '#f9fafb' }}>
              Label
            </th>
            {data.series.map((series) => (
              <th
                key={series.name}
                style={{
                  textAlign: 'right',
                  padding: '10px 12px',
                  borderBottom: '1px solid rgba(255,255,255,0.16)',
                  color: '#f9fafb',
                }}
              >
                {series.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.labels.slice(0, 20).map((label, idx) => (
            <tr key={`${label}-${idx}`}>
              <td style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#d1d5db' }}>
                {label}
              </td>
              {data.series.map((series) => (
                <td
                  key={`${series.name}-${idx}`}
                  style={{
                    textAlign: 'right',
                    padding: '8px 12px',
                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                    color: '#e5e7eb',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {Number.isFinite(series.data[idx] as number) ? String(series.data[idx]) : '-'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderChart = () => {
    const hasRenderableSeries =
      data.series.length > 0 &&
      data.series.some((series) => series.data.some((value) => toFiniteNumber(value) !== undefined));
    const hasAnyNonZeroValue = data.series.some((series) =>
      series.data.some((value) => {
        const numeric = toFiniteNumber(value);
        return numeric !== undefined && Math.abs(numeric) > 0;
      })
    );

    if (!hasRenderableSeries || !hasAnyNonZeroValue) {
      return (
        <div
          style={{
            width: `${chartWidth}px`,
            height: `${chartHeight}px`,
            border: '1px dashed rgba(255,255,255,0.24)',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#9ca3af',
            fontSize: '14px',
            textAlign: 'center',
            padding: '16px',
          }}
        >
          {!hasRenderableSeries
            ? 'No plottable numeric data detected. Try "reverse it" for table extraction.'
            : 'Extracted chart values are all zero. Try "reverse it" to inspect the table output.'}
        </div>
      );
    }

    switch (config.type) {
      case 'table':
        return renderTable();
      case 'bar':
        return (
          <BarChart width={chartWidth} height={chartHeight} data={chartData}>
            {gridElement}
            {xAxisElement}
            {yAxisElement}
            {tooltipElement}
            {legendElement}
            {data.series.map((series, idx) => (
              <Bar
                key={series.name}
                dataKey={series.name}
                fill={colors[idx % colors.length]}
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        );

      case 'line':
        return (
          <LineChart width={chartWidth} height={chartHeight} data={chartData}>
            {gridElement}
            {xAxisElement}
            {yAxisElement}
            {tooltipElement}
            {legendElement}
            {data.series.map((series, idx) => (
              <Line
                key={series.name}
                type="monotone"
                dataKey={series.name}
                stroke={colors[idx % colors.length]}
                strokeWidth={2}
                connectNulls={false}
                isAnimationActive={false}
                dot={{ fill: colors[idx % colors.length], strokeWidth: 0, r: 4 }}
              />
            ))}
          </LineChart>
        );

      case 'area':
        return (
          <AreaChart width={chartWidth} height={chartHeight} data={chartData}>
            {gridElement}
            {xAxisElement}
            {yAxisElement}
            {tooltipElement}
            {legendElement}
            {data.series.map((series, idx) => (
              <Area
                key={series.name}
                type="monotone"
                dataKey={series.name}
                stroke={colors[idx % colors.length]}
                fill={colors[idx % colors.length]}
                fillOpacity={0.3}
                strokeWidth={2}
                connectNulls={false}
                isAnimationActive={false}
              />
            ))}
          </AreaChart>
        );

      case 'pie':
        return (
          <PieChart width={chartWidth} height={chartHeight}>
            {tooltipElement}
            {legendElement}
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={120}
              paddingAngle={2}
              dataKey="value"
              isAnimationActive={false}
              label={config.showValues ? ({ name, percent }: { name?: string; percent?: number }) => `${name ?? ''} (${((percent ?? 0) * 100).toFixed(0)}%)` : false}
              labelLine={config.showValues}
            >
              {pieData.map((_, idx) => (
                <Cell key={`cell-${idx}`} fill={colors[idx % colors.length]} />
              ))}
            </Pie>
          </PieChart>
        );

      case 'radar':
        return (
          <RadarChart
            width={chartWidth}
            height={chartHeight}
            cx={chartWidth / 2}
            cy={chartHeight / 2}
            outerRadius={Math.min(chartWidth, chartHeight) * 0.32}
            data={radarData}
          >
            <PolarGrid stroke="rgba(255,255,255,0.2)" />
            <PolarAngleAxis dataKey="subject" tick={{ fill: '#aaa', fontSize: 12 }} />
            {tooltipElement}
            {legendElement}
            {data.series.map((series, idx) => (
              <Radar
                key={series.name}
                name={series.name}
                dataKey={series.name}
                stroke={colors[idx % colors.length]}
                fill={colors[idx % colors.length]}
                fillOpacity={0.3}
                isAnimationActive={false}
              />
            ))}
          </RadarChart>
        );

      case 'scatter':
        return (
          <ScatterChart width={chartWidth} height={chartHeight}>
            {gridElement}
            {xAxisElement}
            {yAxisElement}
            {tooltipElement}
            {legendElement}
            {data.series.map((series, idx) => (
              <Scatter
                key={series.name}
                name={series.name}
                data={series.data
                  .map((value, i) => {
                    const numeric = toFiniteNumber(value);
                    if (numeric === undefined) return null;
                    return { x: i + 1, y: numeric, name: data.labels[i] };
                  })
                  .filter((point): point is { x: number; y: number; name: string } => point !== null)}
                fill={colors[idx % colors.length]}
                isAnimationActive={false}
              />
            ))}
          </ScatterChart>
        );

      default:
        return (
          <BarChart width={chartWidth} height={chartHeight} data={chartData}>
            {gridElement}
            {xAxisElement}
            {yAxisElement}
            {tooltipElement}
            {legendElement}
            {data.series.map((series, idx) => (
              <Bar
                key={series.name}
                dataKey={series.name}
                fill={colors[idx % colors.length]}
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        );
    }
  };

  return (
    <div
      style={{
        width: '800px',
        height: '600px',
        background: 'linear-gradient(135deg, #0f0f0f 0%, #1a1a2e 50%, #16213e 100%)',
        padding: '40px',
        boxSizing: 'border-box',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {config.title && (
        <h2
          style={{
            color: '#ffffff',
            fontSize: '24px',
            fontWeight: 600,
            marginBottom: '20px',
            textAlign: 'center',
          }}
        >
          {config.title}
        </h2>
      )}
      <div style={{ width: `${chartWidth}px`, height: `${chartHeight}px`, margin: '0 auto' }}>
        {renderChart()}
      </div>
    </div>
  );
}

export async function renderChartToPng(data: ChartData, config: ChartConfig): Promise<Buffer> {
  const browserInstance = await getBrowser();
  const page = await browserInstance.newPage();

  try {
    // Set viewport to match chart size (retina for crisp output)
    const viewport = { width: 800, height: 600, deviceScaleFactor: 2 };
    await page.setViewport(viewport);

    // Render the React component to HTML string
    const chartHtml = renderToString(<ChartPreviewServer data={data} config={config} />);

    // Create full HTML document
    const html = `
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
    .recharts-wrapper { font-family: inherit; }
    .recharts-cartesian-axis-tick-value { fill: #888 !important; }
    .recharts-legend-item-text { color: #aaa !important; }
  </style>
</head>
<body>
  <div id="root">${chartHtml}</div>
</body>
</html>`;

    await page.setContent(html, { waitUntil: 'networkidle0' });

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
