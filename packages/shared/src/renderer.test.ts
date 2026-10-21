import assert from 'node:assert/strict';
import { after, afterEach, mock, test } from 'node:test';
import puppeteer, { type Browser } from 'puppeteer';
import type { Chart as ChartJs } from 'chart.js';
import { closeBrowser, getDefaultConfig, renderChartToPng } from './chart/renderer.js';
import type { ChartData } from './types.js';

type ScaleContract = { beginAtZero?: boolean; suggestedMin?: number; ticks?: { display?: boolean }; pointLabels?: { display?: boolean } };
interface RenderContract {
  type: string;
  data: { datasets: Array<{ data: Array<number | null>; yAxisID?: string }> };
  options: { scales: Record<string, ScaleContract> };
  plugins: Array<{ afterDatasetsDraw: (chart: ChartJs) => void }>;
}
let rendered: RenderContract;
const root = globalThis as unknown as { window?: unknown; document?: unknown };
const originalWindow = root.window;
const originalDocument = root.document;
const originalExecutable = process.env.PUPPETEER_EXECUTABLE_PATH;
process.env.PUPPETEER_EXECUTABLE_PATH = process.execPath;
const page = {
  setViewport: async () => {}, setContent: async () => {}, addScriptTag: async () => {}, close: async () => {},
  evaluate: async (callback: (payload: unknown) => unknown, payload: unknown) => callback(payload),
  screenshot: async () => Buffer.from('fake image'),
};
mock.method(puppeteer, 'launch', async () => ({ newPage: async () => page, close: async () => {} }) as unknown as Browser);
root.document = { getElementById: () => ({ getContext: () => ({}) }) };
root.window = { Chart: class { constructor(_context: unknown, config: RenderContract) { rendered = config; } } };
afterEach(closeBrowser);
after(() => {
  mock.restoreAll();
  if (originalWindow === undefined) delete root.window; else root.window = originalWindow;
  if (originalDocument === undefined) delete root.document; else root.document = originalDocument;
  if (originalExecutable === undefined) delete process.env.PUPPETEER_EXECUTABLE_PATH; else process.env.PUPPETEER_EXECUTABLE_PATH = originalExecutable;
});
const data: ChartData = { labels: ['A', 'B', 'C'], series: [{ name: 'Revenue', data: [100, null, 105] }] };

test('exported renderer sends selected zero baseline to Chart.js for line and area charts', async () => {
  for (const type of ['line', 'area'] as const) {
    await renderChartToPng(data, { ...getDefaultConfig(data), type, yAxisBaselineMode: 'zero' });
    assert.equal(rendered.options.scales.y.beginAtZero, true);
    assert.equal(rendered.options.scales.y.suggestedMin, 0);
    assert.deepEqual(rendered.data.datasets[0].data, [100, null, 105]);
  }
});

test('exported renderer hides category/value/right-axis labels and radial labels when requested', async () => {
  const comboData = { ...data, series: [...data.series, { name: 'Rate', data: [1, 2, 3] }] };
  await renderChartToPng(comboData, { ...getDefaultConfig(data), type: 'bar', showAxisLabels: false,
    seriesConfig: { Revenue: { chartType: 'bar', axis: 'left' }, Rate: { chartType: 'line', axis: 'right' } } });
  for (const axis of ['x', 'y', 'y1']) assert.equal(rendered.options.scales[axis].ticks?.display, false);
  await renderChartToPng(data, { ...getDefaultConfig(data), type: 'radar', showAxisLabels: false });
  assert.equal(rendered.options.scales.r.ticks?.display, false);
  assert.equal(rendered.options.scales.r.pointLabels?.display, false);
});

test('value-label drawing honors visibility, formats units and skips missing observations', async () => {
  const formatted = { ...data, yAxisPrefix: '$' };
  await renderChartToPng(formatted, { ...getDefaultConfig(data), type: 'line', showValues: false });
  assert.deepEqual(rendered.plugins, []);
  await renderChartToPng(formatted, { ...getDefaultConfig(data), type: 'line', showValues: true });
  const drawn: string[] = [];
  rendered.plugins[0].afterDatasetsDraw({
    ctx: { save() {}, restore() {}, fillText(text: string) { drawn.push(text); } },
    data: rendered.data, isDatasetVisible: () => true,
    getDatasetMeta: () => ({ data: data.labels.map(() => ({ tooltipPosition: () => ({ x: 10, y: 10 }) })) }),
  } as unknown as ChartJs);
  assert.deepEqual(drawn, ['$100', '$105']);
});
