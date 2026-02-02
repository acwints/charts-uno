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

export interface ChartConfig {
  type: ChartType;
  colorScheme: ColorScheme;
  styleVariant: StyleVariant;
  showGrid: boolean;
  showLegend: boolean;
  showValues: boolean;
  animate: boolean;
  title: string;
}
