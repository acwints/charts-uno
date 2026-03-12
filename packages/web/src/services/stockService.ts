import type { ChartData } from '../types';
import { fetchApiJson } from './apiBase';

export interface TickerResult {
  symbol: string;
  description: string;
  type: string;
}

export async function searchTickers(query: string): Promise<TickerResult[]> {
  if (!query || query.trim().length < 1) {
    return [];
  }
  return fetchApiJson('/api/stocks/search', { method: 'POST', body: { query } });
}

export async function fetchStockData(ticker: string, range: string, ticker2?: string): Promise<ChartData> {
  const parsed = await fetchApiJson<{
    labels: string[];
    series: ChartData['series'];
    suggestedTitle?: string;
    suggestedType?: string;
    xAxisLabel?: string;
    yAxisLabel?: string;
  }>('/api/stocks/prices', {
    method: 'POST',
    body: { ticker, range, ticker2: ticker2 || null },
  });

  const symbol = ticker.toUpperCase();
  return {
    labels: parsed.labels,
    series: parsed.series,
    sourceType: 'stocks',
    verifiedData: true,
    suggestedTitle: parsed.suggestedTitle,
    suggestedType: parsed.suggestedType,
    xAxisLabel: parsed.xAxisLabel,
    yAxisLabel: parsed.yAxisLabel,
    sourceLink: `https://finance.yahoo.com/quote/${symbol}`,
  };
}

export async function fetchStockInsights(
  labels: string[],
  series: { name: string; data: Array<number | null> }[],
  title: string
): Promise<string> {
  const result = await fetchApiJson<{ insight: string }>('/api/stocks/insights', {
    method: 'POST',
    body: { labels, series, title },
  });
  return result.insight;
}
