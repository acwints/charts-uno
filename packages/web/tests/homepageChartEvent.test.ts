import { afterEach, expect, test, vi } from 'vitest';
import {
  reportHomepageChart,
  reportHomepageSave,
  reportHomepageStart,
  reportHomepageView,
  resetHomepageChartReport,
} from '../src/services/homepageChartEvent';

afterEach(() => {
  resetHomepageChartReport();
  vi.unstubAllGlobals();
});

test('homepage funnel events post once each and send no cookies', () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  vi.stubGlobal('fetch', (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return Promise.resolve(new Response(null, { status: 204 }));
  });

  reportHomepageView();
  reportHomepageView();
  reportHomepageStart('paste');
  reportHomepageStart('sample');
  reportHomepageChart('paste');
  reportHomepageChart('drop');
  reportHomepageSave();
  reportHomepageSave();

  expect(calls.map((call) => call.init.body)).toEqual([
    '{"kind":"view"}',
    '{"kind":"start","source":"paste"}',
    '{"kind":"render","source":"paste"}',
    '{"kind":"save"}',
  ]);
  for (const call of calls) {
    expect(String(call.url)).toMatch(/\/api\/events\/homepage-chart$/);
    expect(call.init.credentials).toBe('omit');
    expect(call.init.method).toBe('POST');
    expect(JSON.stringify(call.init.headers)).not.toContain('cookie');
  }
});
