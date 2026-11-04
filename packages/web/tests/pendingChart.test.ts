import { expect, test } from 'vitest';
import type { CreateChartData } from '../src/services/api';
import { flushPendingChart, forgetPendingChart, readPendingChart, rememberPendingChart } from '../src/services/pendingChart';

const payload: CreateChartData = {
  title: 'Monthly sales',
  data: { labels: ['Jan'], series: [{ name: 'Sales', data: [18400] }] },
  config: { type: 'bar', title: 'Monthly sales' },
  source_type: 'paste',
  is_public: false,
};

test('a pending chart survives in localStorage until it is saved once', async () => {
  localStorage.clear();
  rememberPendingChart('Month,Sales\nJan,18400\n', payload);
  expect(readPendingChart()?.payload.title).toBe('Monthly sales');

  let calls = 0;
  const first = flushPendingChart(async (body) => {
    calls += 1;
    expect(body).toEqual(payload);
    return { id: 'chart-1' };
  });
  const second = flushPendingChart(async () => {
    calls += 1;
    return { id: 'chart-2' };
  });
  await expect(Promise.all([first, second])).resolves.toEqual(['chart-1', 'chart-1']);
  expect(calls).toBe(1);
  expect(readPendingChart()).toBeNull();

  forgetPendingChart();
  await expect(flushPendingChart(async () => ({ id: 'unused' }))).resolves.toBeNull();
});
