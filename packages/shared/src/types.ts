export interface DataSeries {
  name: string;
  data: number[];
}

export interface ChartData {
  labels: string[];
  series: DataSeries[];
  sourceType: 'csv' | 'paste' | 'image' | 'sheets';
  suggestedTitle?: string;
  suggestedType?: ChartType;
  aiReasoning?: string;
  aiSummary?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  userPrompt?: string;
  sourceImage?: {
    base64: string;
    mimeType: string;
  };
}

export type ChartType = 'bar' | 'line' | 'area' | 'pie' | 'radar' | 'scatter' | 'table' | 'infographic';
export type ColorScheme = 'default' | 'monochrome' | 'warm' | 'cool' | 'editorial' | 'muted';
export type StyleVariant = 'professional' | 'playful' | 'editorial' | 'minimalist' | 'bold';
export type ThemeMode = 'light' | 'dark';

export interface ChartStyleOption {
  id: string;
  label: string;
  type: ChartType;
  colorScheme: ColorScheme;
  description: string;
}

export interface EditableChartState {
  original: ChartData;
  current: ChartData;
  isDirty: boolean;
}

// Custom colors that users can override for full creative control
export interface CustomColors {
  background?: string;
  cardBackground?: string;
  text?: string;
  textMuted?: string;
  grid?: string;
  border?: string;
  seriesColors?: string[];
}

export interface ChartConfig {
  type: ChartType;
  colorScheme: ColorScheme;
  styleVariant: StyleVariant;
  themeMode: ThemeMode;
  showGrid: boolean;
  showLegend: boolean;
  showValues: boolean;
  showBorder: boolean;
  animate: boolean;
  title: string;
  // Custom color overrides - when set, these take precedence
  customColors?: CustomColors;
}

// Default chart config
export const DEFAULT_CHART_CONFIG: ChartConfig = {
  type: 'bar',
  colorScheme: 'default',
  styleVariant: 'professional',
  themeMode: 'dark',
  showGrid: true,
  showLegend: true,
  showValues: false,
  showBorder: true,
  animate: true,
  title: '',
};
