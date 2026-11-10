import { expect, test } from 'vitest';
import { resolveCaptureTarget } from '../src/services/exportService';

test('reader exports retain their heading and provenance while editor captures remain plot-only', () => {
  const reader = document.createElement('div');
  reader.dataset.chartCapture = 'full';
  reader.innerHTML = '<h1>Quarterly revenue</h1><div class="chart-preview">Plot</div><p>Source: Annual report</p>';
  expect(resolveCaptureTarget(reader)).toBe(reader);
  const editor = document.createElement('div');
  editor.innerHTML = '<div class="chart-preview">Plot</div>';
  expect(resolveCaptureTarget(editor)).toBe(editor.firstElementChild);
});
