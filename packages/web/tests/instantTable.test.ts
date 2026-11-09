import { expect, test } from 'vitest';
import { SAMPLE_CHART_TITLE, SAMPLE_DATASETS, SAMPLE_TABLE, chartFromText } from '../src/utils/instantTable';

test('a pasted CSV becomes a chart without a network call', () => {
  const chart = chartFromText(SAMPLE_TABLE, { title: SAMPLE_CHART_TITLE });
  expect('error' in chart).toBe(false);
  if ('error' in chart) return;
  expect(chart.config.title).toBe('Monthly sales');
  expect(chart.config.type).toBe('line');
  expect(chart.data.labels).toEqual(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']);
  expect(chart.data.series[0]).toMatchObject({ name: 'Sales', data: [18400, 17600, 20100, 19850, 22300, 24150] });
  expect(chart.data.yAxisPrefix).toBe('$');
  const sampleBar = chartFromText(SAMPLE_TABLE, { title: SAMPLE_CHART_TITLE, type: 'bar' });
  expect('error' in sampleBar).toBe(false);
  if ('error' in sampleBar) return;
  expect(sampleBar.config.type).toBe('bar');
});

test('a homepage type query selects a donut pie and stacked bars', () => {
  const pie = chartFromText('Category,Amount\nRent,1800\nTools,640\n', { type: 'pie' });
  const stacked = chartFromText('Month,New,Returning\nJan,120,300\nFeb,160,350\n', { type: 'bar', stacked: true });
  expect('error' in pie).toBe(false);
  expect('error' in stacked).toBe(false);
  if ('error' in pie || 'error' in stacked) return;
  expect(pie.config.type).toBe('pie');
  expect(stacked.config).toMatchObject({ type: 'bar', stacked: true, title: 'New and Returning' });
  expect(stacked.data.series.map((series) => series.name)).toEqual(['New', 'Returning']);
});

test('JSON rows and a labels/series object both become a chart', () => {
  const rows = chartFromText('[{"month":"Jan","sales":18400,"returns":900},{"month":"Feb","sales":17600,"returns":840}]');
  const labeled = chartFromText('{"labels":["Jan","Feb"],"series":[{"name":"Sales","data":[18400,17600]}]}');
  expect('error' in rows).toBe(false);
  expect('error' in labeled).toBe(false);
  if ('error' in rows || 'error' in labeled) return;
  expect(rows.data.labels).toEqual(['Jan', 'Feb']);
  expect(rows.data.series.map((series) => series.name)).toEqual(['sales', 'returns']);
  expect(labeled.data.series[0].data).toEqual([18400, 17600]);
});

test('a list of numbers becomes a chart', () => {
  const chart = chartFromText('10\n20\n30\n');
  expect('error' in chart).toBe(false);
  if ('error' in chart) return;
  expect(chart.data.labels).toEqual(['1', '2', '3']);
  expect(chart.data.series[0].data).toEqual([10, 20, 30]);
});

test('sample datasets each draw their own chart', () => {
  expect(SAMPLE_DATASETS.map((dataset) => dataset.label)).toEqual(['Monthly sales', 'Budget', 'Website traffic']);
  for (const dataset of SAMPLE_DATASETS) {
    const chart = chartFromText(dataset.text, { title: dataset.title, type: dataset.type });
    expect('error' in chart).toBe(false);
    if ('error' in chart) return;
    expect(chart.config.type).toBe(dataset.type);
    expect(chart.config.title).toBe(dataset.title);
    expect(chart.data.series[0].data.length).toBeGreaterThan(1);
  }
});

test('a one-line paste is not a chart yet', () => {
  expect(chartFromText('Month,Sales')).toMatchObject({ error: expect.any(String) });
});
