import type { ChartData } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export interface TickerResult {
  symbol: string;
  description: string;
  type: string;
}

export async function searchTickers(query: string): Promise<TickerResult[]> {
  if (!query || query.trim().length < 1) {
    return [];
  }

  const response = await fetch(`${API_URL}/api/stocks/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Ticker search failed' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function fetchStockData(ticker: string, range: string, ticker2?: string): Promise<ChartData> {
  const response = await fetch(`${API_URL}/api/stocks/prices`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ ticker, range, ticker2: ticker2 || null }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Stock data fetch failed' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  const parsed = await response.json();
  const symbol = ticker.toUpperCase();

  return {
    labels: parsed.labels,
    series: parsed.series,
    sourceType: 'stocks',
    suggestedTitle: parsed.suggestedTitle,
    suggestedType: parsed.suggestedType,
    xAxisLabel: parsed.xAxisLabel,
    yAxisLabel: parsed.yAxisLabel,
    sourceLink: `https://finance.yahoo.com/quote/${symbol}`,
  };
}
