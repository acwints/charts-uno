import { expect, test } from 'vitest';
import { racePreviewRows } from '../src/utils/racePreview';

test('final frame honors the carry-forward policy and ignores extra off-axis values', () => {
  const data = { labels: ['2024', '2025'], series: [
    { name: 'Missing final', data: [100, null] },
    { name: 'Present', data: [5, 10, 1000] },
    { name: 'Zero', data: [5, 0] },
  ] };
  expect(racePreviewRows(data, false)).toEqual([{ name: 'Present', value: 10 }, { name: 'Zero', value: 0 }]);
  expect(racePreviewRows(data, true)).toEqual([{ name: 'Missing final', value: 100 }, { name: 'Present', value: 10 }, { name: 'Zero', value: 0 }]);
});
