import { create } from 'zustand';
import type { ChartData, ChartConfig } from '../types';

interface ChartStore {
  chartData: ChartData | null;
  chartConfig: ChartConfig;
  setChartData: (data: ChartData | null) => void;
  setChartConfig: (config: ChartConfig | ((prev: ChartConfig) => ChartConfig)) => void;
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
  showBorder: true,
  animate: true,
  title: '',
};

export const useChartStore = create<ChartStore>((set) => ({
  chartData: null,
  chartConfig: defaultConfig,
  setChartData: (data) => set({ chartData: data }),
  setChartConfig: (config) =>
    set((state) => ({
      chartConfig: typeof config === 'function' ? config(state.chartConfig) : config,
    })),
  reset: () => set({ chartData: null, chartConfig: defaultConfig }),
}));
