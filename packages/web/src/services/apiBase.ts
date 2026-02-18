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
