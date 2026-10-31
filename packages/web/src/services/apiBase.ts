import { Capacitor } from '@capacitor/core';

const PROD_HOST_PATTERN = /(^|\.)chartsuno\.com$/i;
// chartsuno.com 307-redirects to www, and WKWebView rejects a redirected CORS preflight,
// so the native app must call the canonical host directly.
const NATIVE_API_ORIGIN = 'https://www.chartsuno.com';

/** Public site origin. Shared chart links from the iOS app must not use capacitor://localhost. */
export const PUBLIC_WEB_ORIGIN = 'https://chartsuno.com';

/** Read-only public page for a share token. Native builds must not use capacitor://. */
export function browserShareUrl(token: string): string {
  if (Capacitor.isNativePlatform() || typeof window === 'undefined') {
    return `https://www.chartsuno.com/s/${token}`;
  }
  if (PROD_HOST_PATTERN.test(window.location.hostname)) {
    return `https://www.chartsuno.com/s/${token}`;
  }
  return `${window.location.origin}/s/${token}`;
}

export function chartShareUrl(chartId: string): string {
  if (Capacitor.isNativePlatform() || typeof window === 'undefined') {
    return `${PUBLIC_WEB_ORIGIN}/chart/${chartId}`;
  }
  return `${window.location.origin}/chart/${chartId}`;
}

function reportReachability(ok: boolean): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('chartsuno:reachability', { detail: { ok } }));
}

function resolveApiBaseUrl(): string {
  const envUrl = (import.meta.env.VITE_API_URL || '').trim();

  if (typeof window !== 'undefined' && PROD_HOST_PATTERN.test(window.location.hostname)) {
    return '';
  }

  // The iOS app ships the web bundle on its own origin (capacitor://localhost)
  // and talks to production through the same Vercel proxy the site uses.
  if (Capacitor.isNativePlatform()) {
    return envUrl || NATIVE_API_ORIGIN;
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

// ---------------------------------------------------------------------------
// Native session token
// The bundled app cannot share the site's HttpOnly cookie, so it keeps the
// JWT in the Keychain (see native.ts) and sends it as a bearer header. The web
// build never sets this; cookies keep working unchanged there.
// ---------------------------------------------------------------------------
let sessionToken: string | null = null;

export function setSessionToken(token: string | null): void {
  sessionToken = token;
}

export function getSessionToken(): string | null {
  return sessionToken;
}

/** Headers every API request should carry. Spread into fetch() options. */
export function apiHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  if (sessionToken) headers.Authorization = `Bearer ${sessionToken}`;
  // Lets the API hide App Store licensing risks (IMDb public datasets)
  // without changing the website. The website never sends this header.
  if (Capacitor.isNativePlatform()) headers['X-Chartsuno-Client'] = 'ios';
  return headers;
}

interface FetchApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  credentials?: RequestCredentials;
}

export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function fetchApiJson<T>(
  endpoint: string,
  { method = 'GET', body, credentials = 'include' }: FetchApiOptions = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method,
      headers: apiHeaders({ 'Content-Type': 'application/json' }),
      credentials,
      body: body != null ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    reportReachability(false);
    throw error;
  }
  reportReachability(true);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: `Request failed` }));
    throw new ApiError(error.detail || `HTTP ${response.status}`, response.status);
  }

  return response.json();
}
