import type { ColorScheme } from './types.js';

// Theme colors for chart backgrounds, text, and grid
export interface ColorTheme {
  background: string;
  cardBackground: string;
  text: string;
  textMuted: string;
  grid: string;
  gridOpacity: number;
  border: string;
}

export const COLOR_THEMES: Record<ColorScheme, ColorTheme> = {
  default: {
    background: '#09090b',
    cardBackground: '#18181b',
    text: '#fafafa',
    textMuted: '#a1a1aa',
    grid: '#ffffff',
    gridOpacity: 0.06,
    border: '#27272a',
  },
  monochrome: {
    background: '#0a0a0a',
    cardBackground: '#141414',
    text: '#ffffff',
    textMuted: '#737373',
    grid: '#ffffff',
    gridOpacity: 0.08,
    border: '#262626',
  },
  warm: {
    background: '#0c0a09',
    cardBackground: '#1c1917',
    text: '#fef3c7',
    textMuted: '#d6d3d1',
    grid: '#fef3c7',
    gridOpacity: 0.05,
    border: '#292524',
  },
  cool: {
    background: '#020617',
    cardBackground: '#0f172a',
    text: '#e0f2fe',
    textMuted: '#94a3b8',
    grid: '#e0f2fe',
    gridOpacity: 0.06,
    border: '#1e293b',
  },
  editorial: {
    background: '#0f0f0f',
    cardBackground: '#1a1a1a',
    text: '#f5f5dc',
    textMuted: '#a0a0a0',
    grid: '#f5f5dc',
    gridOpacity: 0.04,
    border: '#2a2a2a',
  },
  muted: {
    background: '#0e0e0e',
    cardBackground: '#171717',
    text: '#d4d4d4',
    textMuted: '#737373',
    grid: '#d4d4d4',
    gridOpacity: 0.05,
    border: '#262626',
  },
};

export const COLOR_PALETTES: Record<ColorScheme, string[]> = {
  default: ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ec4899'],
  monochrome: ['#fafafa', '#a1a1aa', '#71717a', '#52525b', '#3f3f46', '#27272a'],
  warm: ['#f97316', '#ef4444', '#eab308', '#f59e0b', '#dc2626', '#ca8a04'],
  cool: ['#3b82f6', '#6366f1', '#06b6d4', '#0ea5e9', '#8b5cf6', '#14b8a6'],
  editorial: ['#1e3a5f', '#c9a227', '#7c3238', '#2d5a3c', '#5c4033', '#4a4a4a'],
  muted: ['#64748b', '#78716c', '#71717a', '#6b7280', '#737373', '#525252'],
};

export const COLOR_GRADIENTS: Record<ColorScheme, [string, string][]> = {
  default: [
    ['#3b82f6', '#1d4ed8'],
    ['#8b5cf6', '#6d28d9'],
    ['#06b6d4', '#0891b2'],
    ['#10b981', '#059669'],
    ['#f59e0b', '#d97706'],
    ['#ec4899', '#db2777'],
  ],
  monochrome: [
    ['#fafafa', '#d4d4d8'],
    ['#a1a1aa', '#71717a'],
    ['#71717a', '#52525b'],
    ['#52525b', '#3f3f46'],
    ['#3f3f46', '#27272a'],
    ['#27272a', '#18181b'],
  ],
  warm: [
    ['#f97316', '#ea580c'],
    ['#ef4444', '#dc2626'],
    ['#eab308', '#ca8a04'],
    ['#f59e0b', '#d97706'],
    ['#dc2626', '#b91c1c'],
    ['#ca8a04', '#a16207'],
  ],
  cool: [
    ['#3b82f6', '#2563eb'],
    ['#6366f1', '#4f46e5'],
    ['#06b6d4', '#0891b2'],
    ['#0ea5e9', '#0284c7'],
    ['#8b5cf6', '#7c3aed'],
    ['#14b8a6', '#0d9488'],
  ],
  editorial: [
    ['#1e3a5f', '#172e4d'],
    ['#c9a227', '#b8911f'],
    ['#7c3238', '#6b2a2f'],
    ['#2d5a3c', '#244a31'],
    ['#5c4033', '#4d3529'],
    ['#4a4a4a', '#3d3d3d'],
  ],
  muted: [
    ['#64748b', '#475569'],
    ['#78716c', '#57534e'],
    ['#71717a', '#52525b'],
    ['#6b7280', '#4b5563'],
    ['#737373', '#525252'],
    ['#525252', '#404040'],
  ],
};

export function getGradientDefs(colorScheme: ColorScheme, seriesCount: number): string {
  const gradients = COLOR_GRADIENTS[colorScheme];
  let defs = '';

  for (let i = 0; i < seriesCount; i++) {
    const [start, end] = gradients[i % gradients.length];
    defs += `
      <linearGradient id="gradient-${i}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="${start}" stopOpacity="1" />
        <stop offset="100%" stopColor="${end}" stopOpacity="0.8" />
      </linearGradient>
    `;
  }

  return defs;
}
