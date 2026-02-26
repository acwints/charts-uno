import { COLOR_PALETTES } from '@chartsuno/shared';
import type { BarChartData, LineChartData } from '@chartsuno/video';
import { SAMPLE_LABELS, SAMPLE_VALUES_1, SAMPLE_VALUES_2 } from '../constants.js';

export const DEFAULT_BAR_DATA: BarChartData = {
  labels: SAMPLE_LABELS,
  values: SAMPLE_VALUES_1,
  colors: COLOR_PALETTES.editorial,
};

export const DEFAULT_LINE_DATA: LineChartData = {
  labels: SAMPLE_LABELS,
  series: [
    { name: 'Revenue', values: SAMPLE_VALUES_1, color: '#3b82f6' },
    { name: 'Users', values: SAMPLE_VALUES_2, color: '#8b5cf6' },
  ],
};

/** Pick a bar color palette that isn't 'monochrome' or 'muted'. Accepts optional seed for determinism. */
export function pickBeautifulPalette(seed?: string): string[] {
  const candidates: (keyof typeof COLOR_PALETTES)[] = ['default', 'warm', 'cool', 'editorial'];
  if (seed) {
    const hash = [...seed].reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return COLOR_PALETTES[candidates[hash % candidates.length]];
  }
  return COLOR_PALETTES[candidates[Math.floor(Math.random() * candidates.length)]];
}
