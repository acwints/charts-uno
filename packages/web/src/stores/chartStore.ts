import { create } from 'zustand';
import type { ChartData, ChartConfig } from '../types';

interface ChartStore {
  chartData: ChartData | null;
  documentId: string | null;
  originalData: ChartData | null;
  originalConfig: ChartConfig | null;
  editorView: 'chart' | 'data';
  setEditorView: (view: 'chart' | 'data') => void;
  loadDocument: (id: string | null, data: ChartData, config: ChartConfig) => void;
  markSaved: (id: string | null, data: ChartData, config?: ChartConfig) => void;
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
  documentId: null,
  originalData: null,
  originalConfig: null,
  editorView: 'chart',
  setEditorView: (editorView) => set({ editorView }),
  chartConfig: { ...defaultConfig },
  loadDocument: (id, data, config) => set({ documentId: id, chartData: data, originalData: data, originalConfig: config, chartConfig: config, editorView: 'chart', infographicSvg: null }),
  markSaved: (id, data, config) => set((state) => state.documentId === id ? { originalData: data, originalConfig: config ?? state.chartConfig } : {}),
  infographicSvg: null,
  setChartData: (data) => set({ chartData: data }),
  setChartConfig: (config) =>
    set((state) => ({
      chartConfig: typeof config === 'function' ? config(state.chartConfig) : config,
    })),
  setInfographicSvg: (svg) => set({ infographicSvg: svg }),
  reset: () => set({ documentId: null, originalData: null, originalConfig: null, editorView: 'chart', chartData: null, chartConfig: { ...defaultConfig }, infographicSvg: null }),
}));

export function hasUnsavedChartChanges(): boolean {
  const state = useChartStore.getState();
  if (!state.chartData) return false;
  if (!state.documentId) return true;
  return JSON.stringify(state.chartData) !== JSON.stringify(state.originalData)
    || JSON.stringify(state.chartConfig) !== JSON.stringify(state.originalConfig);
}

export function confirmDiscardChart(): boolean {
  return !hasUnsavedChartChanges() || window.confirm('Discard your unsaved chart changes? This cannot be undone.');
}
