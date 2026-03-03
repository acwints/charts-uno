import { create } from 'zustand';
import type { ChartData, ChartConfig } from '../types';

interface ChartStore {
  chartData: ChartData | null;
  chartConfig: ChartConfig;
  infographicSvg: string | null;
  setChartData: (data: ChartData | null) => void;
  setChartConfig: (config: ChartConfig | ((prev: ChartConfig) => ChartConfig)) => void;
  setInfographicSvg: (svg: string | null) => void;
  reset: () => void;
}

const defaultConfig: ChartConfig = {
  type: 'bar',
  colorScheme: 'default',
  styleVariant: 'professional',
  themeMode: 'dark',
  showGrid: true,
  showLegend: true,
  showValues: false,
  showPoints: true,
  showBorder: true,
  showAxisTitles: true,
  showAxisLabels: true,
  animate: true,
  stacked: false,
  yAxisBaselineMode: 'auto',
  title: '',
};

export const useChartStore = create<ChartStore>((set) => ({
  chartData: null,
  chartConfig: defaultConfig,
  infographicSvg: null,
  setChartData: (data) => set({ chartData: data }),
  setChartConfig: (config) =>
    set((state) => ({
      chartConfig: typeof config === 'function' ? config(state.chartConfig) : config,
    })),
  setInfographicSvg: (svg) => set({ infographicSvg: svg }),
  reset: () => set({ chartData: null, chartConfig: defaultConfig, infographicSvg: null }),
}));
