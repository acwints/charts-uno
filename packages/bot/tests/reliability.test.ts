import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readTimelinePages } from '../src/twitter/timelinePages.js';
import { promptAndCreateChart } from '../src/services/chartsunoApi.js';

test('mention ingestion drains pages and checkpoints newest without losing older backlog', async () => {
  const calls: Array<string | undefined> = [];
  const result = await readTimelinePages(async token => {
    calls.push(token);
    return token ? { data: Array.from({ length: 51 }, (_, i) => ({ id: String(51 - i), text: 'chart it' })), meta: { newest_id: '51' } }
      : { data: Array.from({ length: 100 }, (_, i) => ({ id: String(150 - i), text: 'chart it' })), meta: { newest_id: '150', next_token: 'older' } };
  });
  assert.deepEqual(calls, [undefined, 'older']);
  assert.equal(result.tweets.length, 150); // duplicate at page seam is de-duplicated
  assert.equal(result.newestId, '150');
  assert.ok(result.tweets.some(tweet => tweet.id === '1'));
});

test('failed backlog page never returns a partial checkpoint', async () => {
  await assert.rejects(readTimelinePages(async token => {
    if (token) throw new Error('rate limited');
    return { data: [{ id: '150', text: 'chart it' }], meta: { newest_id: '150', next_token: 'older' } };
  }), /rate limited/);
});

test('bot API preserves missing values rather than inventing zero observations', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ chart_id: 'audit', chart_url: 'https://example.invalid/chart', labels: ['A', 'B', 'C'], series: [{ name: 'Revenue', data: [null, 5, null] }] }), { status: 200 });
  try { assert.deepEqual((await promptAndCreateChart('mock only')).chartData.series[0].data, [null, 5, null]); }
  finally { globalThis.fetch = originalFetch; }
});
