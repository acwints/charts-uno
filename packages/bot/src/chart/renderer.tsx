import puppeteer, { Browser } from 'puppeteer';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  ResponsiveContainer,
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
import type { ChartData, ChartConfig, ChartType } from '@epic-charts/shared';
import { COLOR_PALETTES } from '@epic-charts/shared';
import { logger } from '../config.js';

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browser) {
    // Try to find chromium in common locations
    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH ||
      (await findChromium());

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

function ChartPreviewServer({ data, config }: ChartPreviewServerProps) {
  const colors = COLOR_PALETTES[config.colorScheme];

  const chartData = data.labels.map((label, idx) => {
    const point: Record<string, string | number> = { name: label };
    data.series.forEach((series) => {
      point[series.name] = series.data[idx];
    });
    return point;
  });

  const pieData = data.series[0]?.data.map((value, idx) => ({
    name: data.labels[idx],
    value,
  })) || [];

  const radarData = data.labels.map((label, idx) => {
    const point: Record<string, string | number> = { subject: label };
    data.series.forEach((series) => {
      point[series.name] = series.data[idx];
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

  const renderChart = () => {
    switch (config.type) {
      case 'bar':
        return (
          <BarChart data={chartData}>
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
              />
            ))}
          </BarChart>
        );

      case 'line':
        return (
          <LineChart data={chartData}>
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
                dot={{ fill: colors[idx % colors.length], strokeWidth: 0, r: 4 }}
              />
            ))}
          </LineChart>
        );

      case 'area':
        return (
          <AreaChart data={chartData}>
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
              />
            ))}
          </AreaChart>
        );

      case 'pie':
        return (
          <PieChart>
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
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
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
              />
            ))}
          </RadarChart>
        );

      case 'scatter':
        return (
          <ScatterChart>
            {gridElement}
            {xAxisElement}
            {yAxisElement}
            {tooltipElement}
            {legendElement}
            {data.series.map((series, idx) => (
              <Scatter
                key={series.name}
                name={series.name}
                data={series.data.map((value, i) => ({ x: i + 1, y: value, name: data.labels[i] }))}
                fill={colors[idx % colors.length]}
              />
            ))}
          </ScatterChart>
        );

      default:
        return (
          <BarChart data={chartData}>
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
      <div style={{ width: '100%', height: config.title ? '480px' : '520px' }}>
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export async function renderChartToPng(data: ChartData, config: ChartConfig): Promise<Buffer> {
  const browserInstance = await getBrowser();
  const page = await browserInstance.newPage();

  try {
    // Set viewport to match chart size
    await page.setViewport({ width: 800, height: 600 });

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
      clip: { x: 0, y: 0, width: 800, height: 600 },
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
  if (!['bar', 'line', 'area', 'pie', 'radar', 'scatter'].includes(chartType)) {
    chartType = 'bar';
  }

  return {
    type: chartType,
    colorScheme: 'default',
    styleVariant: 'professional',
    showGrid: true,
    showLegend: data.series.length > 1,
    showValues: false,
    animate: false, // No animations for server-side rendering
    title: data.suggestedTitle || '',
  };
}
