const PROD_HOST_PATTERN = /(^|\.)chartsuno\.com$/i;

function resolveApiBaseUrl(): string {
  const envUrl = (import.meta.env.VITE_API_URL || '').trim();

  if (typeof window !== 'undefined' && PROD_HOST_PATTERN.test(window.location.hostname)) {
    return '';
  }

  if (envUrl) {
    return envUrl;
  }

  if (import.meta.env.DEV) {
    return 'http://localhost:8080';
  }

  return '';
}

export const API_BASE_URL = resolveApiBaseUrl();

interface FetchApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  credentials?: RequestCredentials;
}

export async function fetchApiJson<T>(
  endpoint: string,
  { method = 'GET', body, credentials = 'include' }: FetchApiOptions = {},
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials,
    body: body != null ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: `Request failed` }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}
