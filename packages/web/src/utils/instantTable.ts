import Papa from 'papaparse';
import { DEFAULT_CHART_CONFIG, type ChartConfig, type ChartData, type ChartType } from '../types';

export const SAMPLE_TABLE = `Month,Sales
Jan,18400
Feb,17600
Mar,20100
Apr,19850
May,22300
Jun,24150
`;

export const SAMPLE_CHART_TITLE = 'Monthly sales';

const MAX_ROWS = 400;
const MAX_SERIES = 8;
const ALLOWED_TYPES = new Set<ChartType>(['bar', 'line', 'area', 'pie']);
const MONTH = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*$/i;
const LABEL_KEYS = new Set(['label', 'name', 'category', 'month', 'date', 'x']);

export interface InstantChartOptions {
  type?: ChartType;
  stacked?: boolean;
  sourceType?: 'paste' | 'csv';
  title?: string;
}

export interface InstantChartResult {
  data: ChartData;
  config: ChartConfig;
}

export function requestedChartType(value: string | null): ChartType | undefined {
  if (value === 'bar' || value === 'line' || value === 'area' || value === 'pie') return value;
  return undefined;
}

export function chartFromText(
  text: string,
  options: InstantChartOptions = {},
): InstantChartResult | { error: string } {
  const trimmed = text.trim();
  if (!trimmed) return { error: 'Paste a table or drop a CSV file.' };
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return chartFromJson(trimmed, options);
  return chartFromDelimited(trimmed, options);
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const cleaned = value.trim().replace(/[$,]/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '.') return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function looksTemporal(label: string): boolean {
  const value = label.trim();
  if (MONTH.test(value)) return true;
  if (/^(19|20)\d{2}$/.test(value)) return true;
  if (/^\d{4}-\d{2}(-\d{2})?$/.test(value)) return true;
  if (/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(value)) return true;
  return false;
}

function pickType(labels: string[], seriesCount: number, options: InstantChartOptions, hinted?: string): ChartType {
  if (options.type && ALLOWED_TYPES.has(options.type)) return options.type;
  if (hinted && ALLOWED_TYPES.has(hinted as ChartType)) return hinted as ChartType;
  const temporal = labels.filter(looksTemporal).length;
  if (seriesCount >= 1 && labels.length >= 2 && temporal >= Math.ceil(labels.length * 0.6)) return 'line';
  return 'bar';
}

function moneyColumn(name: string): boolean {
  return /sales|revenue|price|cost|amount|\$/i.test(name);
}

function buildChart(
  labels: string[],
  series: ChartData['series'],
  options: InstantChartOptions,
  hintedType?: string,
): InstantChartResult | { error: string } {
  if (labels.length < 1 || series.length < 1) {
    return { error: 'Include a label column and at least one column of numbers.' };
  }
  const type = pickType(labels, series.length, options, hintedType);
  const inferred = series.length === 1
    ? series[0].name
    : series.length <= 3
      ? series.map((item) => item.name).join(' and ')
      : 'Chart';
  const title = (options.title || inferred || 'Chart').slice(0, 180);
  const currency = series.some((item) => moneyColumn(item.name));
  const config: ChartConfig = {
    ...DEFAULT_CHART_CONFIG,
    type,
    title,
    stacked: Boolean(options.stacked) && type === 'bar' && series.length > 1,
    showLegend: type === 'pie' || series.length > 1,
  };
  const data: ChartData = {
    labels,
    series,
    sourceType: options.sourceType ?? 'paste',
    suggestedTitle: title,
    suggestedType: type,
    ...(currency ? { yAxisFormat: 'currency' as const, yAxisPrefix: '$' } : {}),
  };
  return { data, config };
}

function chartFromNumberList(
  rows: unknown[][],
  options: InstantChartOptions,
): InstantChartResult | { error: string } {
  const header = toNumber(rows[0]?.[0]) === null ? String(rows[0]?.[0] ?? '').trim() : '';
  const body = header ? rows.slice(1) : rows;
  const values = body.map((row) => toNumber(row[0])).filter((value): value is number => value !== null);
  if (values.length < 1 || values.length < body.length) {
    return { error: 'Paste a CSV, or a list of numbers.' };
  }
  return buildChart(
    values.map((_, index) => String(index + 1)),
    [{ name: header || 'Value', data: values }],
    options,
  );
}

function chartFromDelimited(text: string, options: InstantChartOptions): InstantChartResult | { error: string } {
  const result = Papa.parse<unknown[]>(text, {
    header: false,
    skipEmptyLines: true,
    dynamicTyping: true,
  });
  if (result.errors.some((error) => error.type === 'Quotes')) {
    return { error: 'Unable to parse that table. Check the commas and quotes.' };
  }
  const rows = result.data.filter((row) => Array.isArray(row) && row.some((cell) => String(cell ?? '').trim() !== ''));
  if (rows.length < 2) return { error: 'Add a header row and at least one data row.' };

  const width = Math.max(...rows.map((row) => row.length));
  if (width < 2) return chartFromNumberList(rows, options);

  const headerCells = rows[0].slice(1);
  const headerIsText = headerCells.length > 0 && headerCells.every((cell) => toNumber(cell) === null && String(cell ?? '').trim() !== '');
  const body = (headerIsText ? rows.slice(1) : rows).slice(0, MAX_ROWS);
  if (body.length < 1) return { error: 'Add at least one row of numbers under the header.' };

  const headers = headerIsText
    ? rows[0].map((cell, index) => String(cell ?? '').trim() || (index === 0 ? 'Label' : `Series ${index}`))
    : ['Label', ...Array.from({ length: width - 1 }, (_, index) => `Series ${index + 1}`)];

  const numericIndexes: number[] = [];
  for (let index = 1; index < width && numericIndexes.length < MAX_SERIES; index += 1) {
    if (body.some((row) => toNumber(row[index]) !== null)) numericIndexes.push(index);
  }
  if (numericIndexes.length === 0) return { error: 'No numbers found after the first column.' };

  const labels = body.map((row, index) => {
    const label = String(row[0] ?? '').trim();
    return label || `Row ${index + 1}`;
  });
  const series = numericIndexes.map((column) => ({
    name: headers[column] || `Series ${column}`,
    data: body.map((row) => toNumber(row[column]) ?? 0),
  }));
  return buildChart(labels, series, options);
}

function chartFromJson(text: string, options: InstantChartOptions): InstantChartResult | { error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { error: 'That JSON could not be read. Use an array of objects, or {"labels":[],"series":[]}.' };
  }
  if (Array.isArray(parsed)) {
    const records = parsed.filter((row) => row && typeof row === 'object' && !Array.isArray(row)) as Record<string, unknown>[];
    if (records.length !== parsed.length || records.length === 0) {
      return { error: 'A JSON array should be objects, one object per chart point.' };
    }
    return chartFromRecords(records.slice(0, MAX_ROWS), options);
  }
  if (!parsed || typeof parsed !== 'object') {
    return { error: 'Paste a JSON array of rows, or an object with labels and series.' };
  }
  const root = parsed as Record<string, unknown>;
  const data = root.data && typeof root.data === 'object' && !Array.isArray(root.data)
    ? root.data as Record<string, unknown>
    : root;
  if (Array.isArray(data.labels) && Array.isArray(data.series)) {
    const hinted = typeof (root.config as { type?: unknown } | undefined)?.type === 'string'
      ? (root.config as { type: string }).type
      : typeof root.type === 'string' ? root.type : undefined;
    return chartFromLabeled(data.labels, data.series, options, hinted);
  }
  return { error: 'Paste a JSON array of rows, or an object with labels and series.' };
}

function chartFromRecords(
  records: Record<string, unknown>[],
  options: InstantChartOptions,
): InstantChartResult | { error: string } {
  const keys: string[] = [];
  for (const record of records) {
    for (const key of Object.keys(record)) {
      if (!keys.includes(key)) keys.push(key);
    }
  }
  const mostlyText = (key: string) => {
    const values = records.map((record) => record[key]).filter((value) => value !== undefined && value !== null && value !== '');
    if (values.length === 0) return false;
    return values.filter((value) => toNumber(value) === null).length >= Math.ceil(values.length * 0.6);
  };
  const preferred = keys.find((key) => LABEL_KEYS.has(key.toLowerCase()) && mostlyText(key));
  const labelKey = preferred ?? keys.find(mostlyText);
  const seriesKeys = keys.filter((key) => key !== labelKey && records.some((record) => toNumber(record[key]) !== null)).slice(0, MAX_SERIES);
  if (seriesKeys.length === 0) return { error: 'No numeric fields found in that JSON.' };
  const labels = records.map((record, index) => {
    const raw = labelKey ? record[labelKey] : index + 1;
    const label = String(raw ?? '').trim();
    return label || `Row ${index + 1}`;
  });
  const series = seriesKeys.map((key) => ({
    name: key,
    data: records.map((record) => toNumber(record[key]) ?? 0),
  }));
  return buildChart(labels, series, options);
}

function chartFromLabeled(
  rawLabels: unknown[],
  rawSeries: unknown[],
  options: InstantChartOptions,
  hinted?: string,
): InstantChartResult | { error: string } {
  const labels = rawLabels.slice(0, MAX_ROWS).map((label, index) => String(label ?? '').trim() || `Row ${index + 1}`);
  const series = rawSeries.slice(0, MAX_SERIES).flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const record = item as Record<string, unknown>;
    if (!Array.isArray(record.data)) return [];
    const values = record.data as unknown[];
    if (!values.some((value) => toNumber(value) !== null)) return [];
    const data = labels.map((_, index) => toNumber(values[index]) ?? 0);
    return [{ name: String(record.name ?? 'Series').slice(0, 80) || 'Series', data }];
  });
  if (series.length === 0) return { error: 'Series need a name and an array of numbers.' };
  return buildChart(labels, series, options, hinted);
}
