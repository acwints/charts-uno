import type { ColorScheme, ThemeMode, CustomColors } from './types.js';

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

// Light themes - bright, clean backgrounds
export const LIGHT_THEMES: Record<ColorScheme, ColorTheme> = {
  default: {
    background: '#ffffff',
    cardBackground: '#f8fafc',
    text: '#0f172a',
    textMuted: '#64748b',
    grid: '#334155',
    gridOpacity: 0.1,
    border: '#e2e8f0',
  },
  monochrome: {
    background: '#fafafa',
    cardBackground: '#f4f4f5',
    text: '#18181b',
    textMuted: '#71717a',
    grid: '#3f3f46',
    gridOpacity: 0.12,
    border: '#e4e4e7',
  },
  warm: {
    background: '#fffbeb',
    cardBackground: '#fef3c7',
    text: '#78350f',
    textMuted: '#92400e',
    grid: '#d97706',
    gridOpacity: 0.15,
    border: '#fde68a',
  },
  cool: {
    background: '#f0f9ff',
    cardBackground: '#e0f2fe',
    text: '#0c4a6e',
    textMuted: '#0369a1',
    grid: '#0284c7',
    gridOpacity: 0.12,
    border: '#bae6fd',
  },
  editorial: {
    background: '#fefce8',
    cardBackground: '#fef9c3',
    text: '#422006',
    textMuted: '#854d0e',
    grid: '#ca8a04',
    gridOpacity: 0.15,
    border: '#fde047',
  },
  muted: {
    background: '#f9fafb',
    cardBackground: '#f3f4f6',
    text: '#1f2937',
    textMuted: '#6b7280',
    grid: '#4b5563',
    gridOpacity: 0.1,
    border: '#e5e7eb',
  },
};

// Dark themes - rich, deep backgrounds
export const DARK_THEMES: Record<ColorScheme, ColorTheme> = {
  default: {
    background: '#0f172a',
    cardBackground: '#1e293b',
    text: '#f8fafc',
    textMuted: '#94a3b8',
    grid: '#cbd5e1',
    gridOpacity: 0.15,
    border: '#334155',
  },
  monochrome: {
    background: '#18181b',
    cardBackground: '#27272a',
    text: '#fafafa',
    textMuted: '#a1a1aa',
    grid: '#d4d4d8',
    gridOpacity: 0.12,
    border: '#3f3f46',
  },
  warm: {
    background: '#1c1410',
    cardBackground: '#2c2218',
    text: '#fef3c7',
    textMuted: '#fcd34d',
    grid: '#fbbf24',
    gridOpacity: 0.12,
    border: '#44403c',
  },
  cool: {
    background: '#0c1929',
    cardBackground: '#142338',
    text: '#e0f2fe',
    textMuted: '#7dd3fc',
    grid: '#38bdf8',
    gridOpacity: 0.12,
    border: '#1e3a5f',
  },
  editorial: {
    background: '#1a1814',
    cardBackground: '#28251e',
    text: '#fef9c3',
    textMuted: '#fde047',
    grid: '#eab308',
    gridOpacity: 0.15,
    border: '#3d3a32',
  },
  muted: {
    background: '#1f2937',
    cardBackground: '#374151',
    text: '#e5e7eb',
    textMuted: '#9ca3af',
    grid: '#9ca3af',
    gridOpacity: 0.1,
    border: '#4b5563',
  },
};

// Combined themes accessor
export const COLOR_THEMES: Record<ThemeMode, Record<ColorScheme, ColorTheme>> = {
  light: LIGHT_THEMES,
  dark: DARK_THEMES,
};

// Get theme based on mode and scheme
export function getTheme(colorScheme: ColorScheme, themeMode: ThemeMode = 'dark'): ColorTheme {
  return COLOR_THEMES[themeMode][colorScheme];
}

// Apply custom colors to a theme
export function applyCustomColors(baseTheme: ColorTheme, customColors?: CustomColors): ColorTheme {
  if (!customColors) return baseTheme;

  return {
    background: customColors.background || baseTheme.background,
    cardBackground: customColors.cardBackground || baseTheme.cardBackground,
    text: customColors.text || baseTheme.text,
    textMuted: customColors.textMuted || baseTheme.textMuted,
    grid: customColors.grid || baseTheme.grid,
    gridOpacity: baseTheme.gridOpacity,
    border: customColors.border || baseTheme.border,
  };
}

// Vibrant color palettes for chart data
export const COLOR_PALETTES: Record<ColorScheme, string[]> = {
  default: ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#ef4444', '#84cc16'],
  monochrome: ['#18181b', '#3f3f46', '#52525b', '#71717a', '#a1a1aa', '#d4d4d8', '#e4e4e7', '#fafafa'],
  warm: ['#f97316', '#ef4444', '#eab308', '#f59e0b', '#dc2626', '#ca8a04', '#ea580c', '#fbbf24'],
  cool: ['#3b82f6', '#6366f1', '#06b6d4', '#0ea5e9', '#8b5cf6', '#14b8a6', '#2563eb', '#22d3ee'],
  editorial: ['#1e3a5f', '#c9a227', '#7c3238', '#2d5a3c', '#5c4033', '#4a4a4a', '#8b6914', '#1e4d6e'],
  muted: ['#64748b', '#78716c', '#71717a', '#6b7280', '#737373', '#525252', '#57534e', '#4b5563'],
};

// Gradient pairs for enhanced visual effects
export const COLOR_GRADIENTS: Record<ColorScheme, [string, string][]> = {
  default: [
    ['#3b82f6', '#1d4ed8'],
    ['#8b5cf6', '#6d28d9'],
    ['#06b6d4', '#0891b2'],
    ['#10b981', '#059669'],
    ['#f59e0b', '#d97706'],
    ['#ec4899', '#db2777'],
    ['#ef4444', '#dc2626'],
    ['#84cc16', '#65a30d'],
  ],
  monochrome: [
    ['#18181b', '#09090b'],
    ['#3f3f46', '#27272a'],
    ['#52525b', '#3f3f46'],
    ['#71717a', '#52525b'],
    ['#a1a1aa', '#71717a'],
    ['#d4d4d8', '#a1a1aa'],
    ['#e4e4e7', '#d4d4d8'],
    ['#fafafa', '#e4e4e7'],
  ],
  warm: [
    ['#f97316', '#ea580c'],
    ['#ef4444', '#dc2626'],
    ['#eab308', '#ca8a04'],
    ['#f59e0b', '#d97706'],
    ['#dc2626', '#b91c1c'],
    ['#ca8a04', '#a16207'],
    ['#ea580c', '#c2410c'],
    ['#fbbf24', '#f59e0b'],
  ],
  cool: [
    ['#3b82f6', '#2563eb'],
    ['#6366f1', '#4f46e5'],
    ['#06b6d4', '#0891b2'],
    ['#0ea5e9', '#0284c7'],
    ['#8b5cf6', '#7c3aed'],
    ['#14b8a6', '#0d9488'],
    ['#2563eb', '#1d4ed8'],
    ['#22d3ee', '#06b6d4'],
  ],
  editorial: [
    ['#1e3a5f', '#172e4d'],
    ['#c9a227', '#b8911f'],
    ['#7c3238', '#6b2a2f'],
    ['#2d5a3c', '#244a31'],
    ['#5c4033', '#4d3529'],
    ['#4a4a4a', '#3d3d3d'],
    ['#8b6914', '#725610'],
    ['#1e4d6e', '#173d57'],
  ],
  muted: [
    ['#64748b', '#475569'],
    ['#78716c', '#57534e'],
    ['#71717a', '#52525b'],
    ['#6b7280', '#4b5563'],
    ['#737373', '#525252'],
    ['#525252', '#404040'],
    ['#57534e', '#44403c'],
    ['#4b5563', '#374151'],
  ],
};

// Preset custom color combinations for quick selection
export const PRESET_PALETTES: { id: string; name: string; colors: string[] }[] = [
  { id: 'vibrant', name: 'Vibrant', colors: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#dfe6e9'] },
  { id: 'pastel', name: 'Pastel', colors: ['#fab1a0', '#74b9ff', '#a29bfe', '#81ecec', '#ffeaa7', '#fd79a8'] },
  { id: 'neon', name: 'Neon', colors: ['#00ff87', '#60efff', '#ff00ff', '#ffff00', '#ff6b35', '#00d9ff'] },
  { id: 'earth', name: 'Earth', colors: ['#8b4513', '#228b22', '#cd853f', '#2f4f4f', '#daa520', '#556b2f'] },
  { id: 'ocean', name: 'Ocean', colors: ['#006994', '#40e0d0', '#00ced1', '#20b2aa', '#48d1cc', '#5f9ea0'] },
  { id: 'sunset', name: 'Sunset', colors: ['#ff7e5f', '#feb47b', '#ff6a88', '#ff99ac', '#ffd194', '#d4a574'] },
  { id: 'forest', name: 'Forest', colors: ['#2d5a27', '#228b22', '#32cd32', '#90ee90', '#98fb98', '#00ff7f'] },
  { id: 'berry', name: 'Berry', colors: ['#8e44ad', '#9b59b6', '#e74c3c', '#c0392b', '#d35400', '#e67e22'] },
];

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

// Get effective colors considering custom overrides
export function getEffectiveColors(
  colorScheme: ColorScheme,
  customSeriesColors?: string[]
): string[] {
  if (customSeriesColors && customSeriesColors.length > 0) {
    return customSeriesColors;
  }
  return COLOR_PALETTES[colorScheme];
}
