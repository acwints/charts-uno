import { afterEach, expect, test, vi } from 'vitest';
import { reportHomepageChart, resetHomepageChartReport } from '../src/services/homepageChartEvent';

afterEach(() => {
  resetHomepageChartReport();
  vi.unstubAllGlobals();
});

test('a homepage chart is reported once per page load, without cookies', async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  vi.stubGlobal('fetch', (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return Promise.resolve(new Response(null, { status: 204 }));
  });

  reportHomepageChart('paste');
  reportHomepageChart('sample');

  expect(calls).toHaveLength(1);
  expect(String(calls[0].url)).toMatch(/\/api\/events\/homepage-chart$/);
  expect(calls[0].init.credentials).toBe('omit');
  expect(calls[0].init.method).toBe('POST');
  expect(calls[0].init.body).toBe('{"source":"paste"}');
  expect(JSON.stringify(calls[0].init.headers)).not.toContain('cookie');
});
