import { DEFAULT_CHART_CONFIG, type ChartConfig, type ChartData, type ChartType } from '../types';
import { createChart, type CreateChartData } from '../services/api';
import { useChartStore } from '../stores/chartStore';

export interface StarterTemplate {
  id: 'monthly-sales' | 'budget-vs-actual' | 'survey-results' | 'website-traffic' | 'top-10-products';
  title: string;
  detail: string;
  chartTitle: string;
  labelHeader: string;
  type: ChartType;
  barLayout?: 'horizontal';
  labels: string[];
  series: ChartData['series'];
  yAxisFormat?: ChartData['yAxisFormat'];
  yAxisPrefix?: string;
}

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: 'monthly-sales',
    title: 'Monthly sales',
    detail: 'Six months of revenue, as a bar chart.',
    chartTitle: 'Monthly sales',
    labelHeader: 'Month',
    type: 'bar',
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    series: [{ name: 'Sales', data: [18400, 17600, 20100, 19850, 22300, 24150] }],
    yAxisFormat: 'currency',
    yAxisPrefix: '$',
  },
  {
    id: 'budget-vs-actual',
    title: 'Budget vs actual',
    detail: 'Planned spend next to what was spent.',
    chartTitle: 'Budget vs actual',
    labelHeader: 'Month',
    type: 'bar',
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    series: [
      { name: 'Budget', data: [40000, 42000, 45000, 44000, 48000, 50000] },
      { name: 'Actual', data: [38200, 44100, 46800, 42700, 52100, 54800] },
    ],
    yAxisFormat: 'currency',
    yAxisPrefix: '$',
  },
  {
    id: 'survey-results',
    title: 'Survey results',
    detail: 'How 240 responses split, as a pie.',
    chartTitle: 'Survey results',
    labelHeader: 'Response',
    type: 'pie',
    labels: ['Promoters', 'Passives', 'Detractors'],
    series: [{ name: 'Responses', data: [148, 58, 34] }],
  },
  {
    id: 'website-traffic',
    title: 'Website traffic',
    detail: 'A week of visitors, as a line.',
    chartTitle: 'Website traffic',
    labelHeader: 'Day',
    type: 'line',
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    series: [{ name: 'Visitors', data: [4200, 3850, 5100, 4760, 6230, 2980, 2540] }],
  },
  {
    id: 'top-10-products',
    title: 'Top 10 products',
    detail: 'Units sold, largest first.',
    chartTitle: 'Top 10 products',
    labelHeader: 'Product',
    type: 'bar',
    barLayout: 'horizontal',
    labels: ['Trail bottle', 'Desk lamp', 'Wool socks', 'Notebook', 'Travel mug', 'Key light', 'Canvas tote', 'Field hat', 'Pen set', 'Cable kit'],
    series: [{ name: 'Units', data: [980, 860, 740, 690, 640, 580, 510, 460, 390, 340] }],
  },
];

export function starterBySlug(value: string | null | undefined): StarterTemplate | undefined {
  if (!value) return undefined;
  return STARTER_TEMPLATES.find((template) => template.id === value);
}

export function starterTable(template: StarterTemplate): string {
  const header = [template.labelHeader, ...template.series.map((series) => series.name)].join(',');
  const lines = template.labels.map((label, index) => (
    [label, ...template.series.map((series) => series.data[index] ?? '')].join(',')
  ));
  return `${header}\n${lines.join('\n')}\n`;
}

export function starterChart(template: StarterTemplate): { data: ChartData; config: ChartConfig } {
  const data: ChartData = {
    labels: template.labels,
    series: template.series,
    sourceType: 'paste',
    suggestedTitle: template.chartTitle,
    suggestedType: template.type,
    ...(template.yAxisFormat ? { yAxisFormat: template.yAxisFormat } : {}),
    ...(template.yAxisPrefix ? { yAxisPrefix: template.yAxisPrefix } : {}),
    ...(template.barLayout ? { suggestedBarLayout: template.barLayout } : {}),
  };
  const config: ChartConfig = {
    ...DEFAULT_CHART_CONFIG,
    type: template.type,
    title: template.chartTitle,
    showLegend: template.type === 'pie' || template.series.length > 1,
    ...(template.barLayout ? { barLayout: template.barLayout } : {}),
  };
  return { data, config };
}

export function starterCreatePayload(template: StarterTemplate): CreateChartData {
  const { data, config } = starterChart(template);
  const { sourceType: _sourceType, ...stored } = data;
  void _sourceType;
  return {
    title: template.chartTitle,
    data: stored,
    config,
    source_type: `template:${template.id}`,
    is_public: false,
  };
}

/** Save the template to the signed-in account and open that saved chart. */
export async function saveStarterTemplate(template: StarterTemplate): Promise<string> {
  const { data, config } = starterChart(template);
  const saved = await createChart(starterCreatePayload(template));
  useChartStore.getState().loadDocument(saved.id, data, config);
  return saved.id;
}

const inflightSaves = new Map<string, Promise<string>>();

/** One save per template while a request is in flight. Covers a repeated effect. */
export function saveStarterTemplateOnce(template: StarterTemplate): Promise<string> {
  const existing = inflightSaves.get(template.id);
  if (existing) return existing;
  const pending = saveStarterTemplate(template).finally(() => {
    inflightSaves.delete(template.id);
  });
  inflightSaves.set(template.id, pending);
  return pending;
}
