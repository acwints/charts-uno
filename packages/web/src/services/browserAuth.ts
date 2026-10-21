import { fetchApiJson } from './apiBase';
import { getAuthUrl } from './api';

const KEY = 'chartsuno.web-sign-in';
let exchange: Promise<void> | null = null;

function randomToken(): string {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function beginBrowserSignIn(target: string): Promise<string> {
  const verifier = randomToken();
  const nonce = randomToken();
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  const challenge = btoa(String.fromCharCode(...digest)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const { auth_url } = await getAuthUrl(target, challenge, nonce);
  sessionStorage.setItem(KEY, JSON.stringify({ verifier, nonce, createdAt: Date.now() }));
  return auth_url;
}

export function finishBrowserSignIn(code: string, nonce: string): Promise<void> {
  // React StrictMode may mount the same callback twice; redeem the one-use code only once.
  if (exchange) return exchange;
  try {
    const pending = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    sessionStorage.removeItem(KEY);
    if (!pending || pending.nonce !== nonce || typeof pending.verifier !== 'string'
      || typeof pending.createdAt !== 'number' || Date.now() - pending.createdAt > 10 * 60_000
      || Date.now() < pending.createdAt) {
      return Promise.reject(new Error('This sign-in did not start in this tab or has expired. Please try again.'));
    }
    exchange = fetchApiJson<void>('/api/auth/web/exchange', {
      method: 'POST', body: { code, verifier: pending.verifier },
    }).finally(() => { exchange = null; });
    return exchange;
  } catch {
    return Promise.reject(new Error('Could not verify sign-in. Please try again.'));
  }
}
