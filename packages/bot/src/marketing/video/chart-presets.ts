import { COLOR_PALETTES } from '@chartsuno/shared';
import type { BarChartData, LineChartData } from '@chartsuno/video';

/**
 * Sample chart data used for video scenes.
 * Shared with image/screenshot.ts sample data to maintain consistency.
 */

const SAMPLE_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
const SAMPLE_VALUES_1 = [42, 58, 35, 72, 61, 89];
const SAMPLE_VALUES_2 = [28, 45, 52, 38, 67, 54];

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

/** Pick a random bar color palette that isn't 'monochrome' or 'muted' */
export function pickBeautifulPalette(): string[] {
  const candidates: (keyof typeof COLOR_PALETTES)[] = ['default', 'warm', 'cool', 'editorial'];
  const key = candidates[Math.floor(Math.random() * candidates.length)];
  return COLOR_PALETTES[key];
}
