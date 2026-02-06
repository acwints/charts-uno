import type { StyleVariant } from './types.js';

export interface StyleVariantConfig {
  id: StyleVariant;
  label: string;
  description: string;
  fonts: {
    display: string;
    body: string;
    mono: string;
  };
  chart: {
    barRadius: [number, number, number, number];
    strokeWidth: number;
    dotRadius: number;
    activeDotRadius: number;
    gridStyle: 'solid' | 'dashed' | 'dotted' | 'none';
    gridOpacity: number;
  };
  decorations: {
    useGradients: boolean;
    useGlow: boolean;
    useShadows: boolean;
  };
}

export const STYLE_VARIANTS: Record<StyleVariant, StyleVariantConfig> = {
  professional: {
    id: 'professional',
    label: 'Professional',
    description: 'Clean and corporate',
    fonts: {
      display: 'Inter',
      body: 'Inter',
      mono: 'JetBrains Mono',
    },
    chart: {
      barRadius: [4, 4, 0, 0],
      strokeWidth: 2,
      dotRadius: 4,
      activeDotRadius: 6,
      gridStyle: 'dashed',
      gridOpacity: 0.06,
    },
    decorations: {
      useGradients: false,
      useGlow: false,
      useShadows: true,
    },
  },
  playful: {
    id: 'playful',
    label: 'Playful',
    description: 'Fun and friendly',
    fonts: {
      display: 'Nunito',
      body: 'Nunito',
      mono: 'JetBrains Mono',
    },
    chart: {
      barRadius: [20, 20, 20, 20],
      strokeWidth: 3,
      dotRadius: 6,
      activeDotRadius: 10,
      gridStyle: 'dotted',
      gridOpacity: 0.08,
    },
    decorations: {
      useGradients: true,
      useGlow: true,
      useShadows: true,
    },
  },
  editorial: {
    id: 'editorial',
    label: 'Editorial',
    description: 'NYT/Economist style',
    fonts: {
      display: 'Instrument Serif',
      body: 'Instrument Serif',
      mono: 'JetBrains Mono',
    },
    chart: {
      barRadius: [0, 0, 0, 0],
      strokeWidth: 1.5,
      dotRadius: 0,
      activeDotRadius: 4,
      gridStyle: 'solid',
      gridOpacity: 0.04,
    },
    decorations: {
      useGradients: false,
      useGlow: false,
      useShadows: false,
    },
  },
  minimalist: {
    id: 'minimalist',
    label: 'Minimalist',
    description: 'Essential only',
    fonts: {
      display: 'DM Sans',
      body: 'DM Sans',
      mono: 'JetBrains Mono',
    },
    chart: {
      barRadius: [2, 2, 0, 0],
      strokeWidth: 1.5,
      dotRadius: 0,
      activeDotRadius: 3,
      gridStyle: 'none',
      gridOpacity: 0,
    },
    decorations: {
      useGradients: false,
      useGlow: false,
      useShadows: false,
    },
  },
  bold: {
    id: 'bold',
    label: 'Bold',
    description: 'High impact',
    fonts: {
      display: 'Sora',
      body: 'Sora',
      mono: 'JetBrains Mono',
    },
    chart: {
      barRadius: [8, 8, 0, 0],
      strokeWidth: 4,
      dotRadius: 8,
      activeDotRadius: 12,
      gridStyle: 'dashed',
      gridOpacity: 0.1,
    },
    decorations: {
      useGradients: true,
      useGlow: true,
      useShadows: true,
    },
  },
  brand: {
    id: 'brand',
    label: 'Brand',
    description: 'Your brand colors',
    fonts: {
      display: 'Inter',
      body: 'Inter',
      mono: 'JetBrains Mono',
    },
    chart: {
      barRadius: [6, 6, 0, 0],
      strokeWidth: 2.5,
      dotRadius: 5,
      activeDotRadius: 8,
      gridStyle: 'dashed',
      gridOpacity: 0.06,
    },
    decorations: {
      useGradients: false,
      useGlow: false,
      useShadows: true,
    },
  },
};

export function getStyleVariantConfig(variant: StyleVariant): StyleVariantConfig {
  return STYLE_VARIANTS[variant];
}
