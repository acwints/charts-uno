import { test } from 'node:test';
import assert from 'node:assert/strict';
import { suggestComboConfig } from './seriesConfig.js';
import type { ChartData } from './types.js';

const eladTable: ChartData = {
  labels: ['1970', '1985', '2000', '2010', '2020', 'Sep 2026'],
  series: [
    { name: 'Top 5 combined market cap ($T)', data: [0.115, 0.218, 1.6, 1.29, 7.51, 21.1] },
    { name: 'U.S. nominal GDP ($T)', data: [1.07, 4.35, 10.25, 15.0, 21.1, 32.5] },
    { name: 'Top 5 / GDP (%)', data: [10.7, 5.0, 15.6, 8.6, 35.7, 65.0] },
  ],
};

test('a ratio in % beside dollar series goes to a right-axis line', () => {
  const suggestion = suggestComboConfig(eladTable, 'bar');
  assert.deepEqual(suggestion?.seriesConfig, { 'Top 5 / GDP (%)': { chartType: 'line', axis: 'right' } });
  assert.equal(suggestion?.rightYAxisLabel, 'Top 5 / GDP (%)');
});

test('a series dwarfed by another goes right even without a percentage name', () => {
  const suggestion = suggestComboConfig(
    { labels: ['a', 'b'], series: [{ name: 'Users', data: [120000, 150000] }, { name: 'Churn', data: [3.1, 2.8] }] },
    'line',
  );
  assert.equal(suggestion?.seriesConfig['Churn']?.axis, 'right');
});

test('similar scales stay on one axis', () => {
  assert.equal(
    suggestComboConfig({ labels: ['a', 'b'], series: [{ name: 'Revenue', data: [10, 20] }, { name: 'Profit', data: [4, 6] }] }, 'bar'),
    null,
  );
});

test('all-percentage datasets are not split', () => {
  assert.equal(
    suggestComboConfig({ labels: ['a'], series: [{ name: 'A (%)', data: [10] }, { name: 'B (%)', data: [20] }] }, 'bar'),
    null,
  );
});
