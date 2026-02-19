export interface DataSeries {
  name: string;
  // `null` indicates a missing/unknown point (not the same as zero).
  data: Array<number | null>;
  // Optional confidence score per point (0-1), typically from AI extraction.
  confidence?: Array<number | null>;
}

export type XAxisType = 'year' | 'date' | 'category' | 'number';
export type YAxisFormat = 'currency' | 'percentage' | 'number';
export type BarLayout = 'vertical' | 'horizontal';
export type YAxisBaselineMode = 'auto' | 'zero' | 'data';

export interface ChartData {
  labels: string[];
  series: DataSeries[];
  sourceType: 'csv' | 'paste' | 'image' | 'sheets' | 'prompt' | 'stocks' | 'datasets';
  verifiedData?: boolean;
  suggestedTitle?: string;
  suggestedType?: ChartType;
  suggestedStacked?: boolean;
  suggestedBarLayout?: BarLayout;
  aiReasoning?: string;
  aiSummary?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  userPrompt?: string;
  sourceLink?: string;
  sourceImage?: {
    base64: string;
    mimeType: string;
  };
  // Axis formatting hints (from AI or auto-detected)
  xAxisType?: XAxisType;
  yAxisFormat?: YAxisFormat;
  yAxisPrefix?: string;
  yAxisSuffix?: string;
  // Map-specific data (used when suggestedType === 'map')
  mapRegions?: MapRegion[];
  mapScope?: MapScope;
}

export type ChartType = 'bar' | 'line' | 'area' | 'pie' | 'radar' | 'scatter' | 'histogram' | 'table' | 'infographic' | 'map';

// Combo chart (dual-axis, mixed series types)
export type SeriesChartType = 'bar' | 'line' | 'area';
export type AxisSide = 'left' | 'right';

export interface SeriesOverride {
  chartType?: SeriesChartType;
  axis?: AxisSide;
}

// Map-specific types
export type MapVariant = 'bubble' | 'choropleth';
export type MapScope = 'us-states' | 'world';

export interface MapRegion {
  id: string;      // State code (CA, TX) or ISO country code (USA, GBR)
  name: string;    // California, Texas, United States
  value: number;
}
export type AiMode = 'chart' | 'infographic' | 'custom';
export type ColorScheme = 'default' | 'monochrome' | 'warm' | 'cool' | 'editorial' | 'muted';
export type StyleVariant = 'professional' | 'playful' | 'editorial' | 'minimalist' | 'bold' | 'brand';
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
  showPoints: boolean;
  showBorder: boolean;
  animate: boolean;
  title: string;
  stacked: boolean;
  barLayout?: BarLayout;
  yAxisBaselineMode?: YAxisBaselineMode;
  sourceLink?: string;
  // Custom color overrides - when set, these take precedence
  customColors?: CustomColors;
  // AI Magic options
  aiMode?: AiMode;
  aiCustomPrompt?: string;
  aiReadyToGenerate?: boolean;
  // Map options
  mapVariant?: MapVariant;
  mapScope?: MapScope;
  // Combo chart (dual-axis, mixed series types)
  seriesConfig?: Record<string, SeriesOverride>;
  rightYAxisLabel?: string;
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
  showPoints: true,
  showBorder: true,
  animate: true,
  stacked: false,
  yAxisBaselineMode: 'auto',
  title: '',
};
