import { sampleMonthlySales } from '../content/sampleChart';
import { useChartStore } from '../stores/chartStore';
import type { ChartData } from '../types';
import { readHomepageDraft } from './pendingChart';

/** Open an unsaved chart: the homepage draft if this browser has one, otherwise monthly sales. */
export function prepareFirstChartEditor(): void {
  const current = useChartStore.getState();
  if (current.chartData && current.documentId === null) return;

  const draft = readHomepageDraft();
  if (draft) {
    const data = {
      ...draft.payload.data,
      sourceType: draft.payload.source_type || 'paste',
    } as ChartData;
    useChartStore.setState({
      documentId: null,
      originalData: null,
      chartData: data,
      chartConfig: draft.payload.config,
      infographicSvg: null,
    });
    return;
  }

  const { data, config } = sampleMonthlySales();
  useChartStore.setState({
    documentId: null,
    originalData: null,
    chartData: data,
    chartConfig: config,
    infographicSvg: null,
  });
}
