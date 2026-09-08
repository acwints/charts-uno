import { Capacitor, registerPlugin } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { SplashScreen } from '@capacitor/splash-screen';
import { fetchApiJson, setSessionToken } from './apiBase';

export const isNativeApp = () => Capacitor.isNativePlatform();
const NativeAuth = registerPlugin<{ authenticate(options: { url: string }): Promise<{ url: string }> }>('NativeAuth');
const NativeExport = registerPlugin<{ shareFile(options: { base64: string; filename: string }): Promise<{ completed: boolean }> }>('NativeExport');
// Keychain-backed key/value store; see SecureStorePlugin.swift.
const SecureStore = registerPlugin<{
  get(options: { key: string }): Promise<{ value: string | null }>;
  set(options: { key: string; value: string }): Promise<void>;
  remove(options: { key: string }): Promise<void>;
}>('SecureStore');

const SESSION_KEY = 'chartsuno.session';

/** Bundled app: the session lives in the Keychain, not a cookie. */
const usesTokenSession = () => isNativeApp() && Capacitor.isPluginAvailable('SecureStore');

export async function restoreNativeSession(): Promise<void> {
  if (!usesTokenSession()) return;
  try {
    const { value } = await SecureStore.get({ key: SESSION_KEY });
    setSessionToken(value);
  } catch {
    setSessionToken(null);
  }
}

export async function clearNativeSession(): Promise<void> {
  setSessionToken(null);
  if (!usesTokenSession()) return;
  await SecureStore.remove({ key: SESSION_KEY }).catch(() => {});
}

/**
 * Hide the launch splash once the first screen has painted. The native side
 * keeps the splash up until this call so users never see a blank frame; a
 * watchdog in main.tsx guarantees it still goes away if rendering fails.
 */
export function hideNativeSplash(): void {
  if (!isNativeApp()) return;
  void SplashScreen.hide({ fadeOutDuration: 250 }).catch(() => {});
}

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function signInNative(): Promise<void> {
  if (!Capacitor.isPluginAvailable('NativeAuth')) {
    throw new Error('Please update Chartsuno in TestFlight to sign in inside the app.');
  }
  // Keep verifier in memory in this webview. Never put session credentials in a URL.
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const nonce = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
  const params = new URLSearchParams({ native_challenge: challenge, native_nonce: nonce });
  const { auth_url } = await fetchApiJson<{ auth_url: string }>(`/auth/google?${params}`);
  const result = await NativeAuth.authenticate({ url: auth_url });
  const callback = new URL(result.url);
  if (callback.protocol !== 'com.chartsuno.app:' || callback.hostname !== 'auth-callback' || callback.searchParams.get('state') !== nonce) {
    throw new Error('Could not verify sign-in. Please try again.');
  }
  if (callback.searchParams.get('error') === 'cancelled') throw Object.assign(new Error('Sign-in cancelled'), { code: 'CANCELLED' });
  if (callback.searchParams.get('error') === 'expired') throw new Error('Sign-in expired. Please try again.');
  if (callback.searchParams.has('error')) throw new Error('Sign-in could not finish. Please try again.');
  const code = callback.searchParams.get('code');
  if (!code) throw new Error('Sign-in did not complete. Please try again.');
  if (usesTokenSession()) {
    // Bundled app: keep the JWT in the Keychain and send it as a bearer header.
    const { token } = await fetchApiJson<{ token: string }>('/api/auth/native/exchange', {
      method: 'POST',
      body: { code, verifier, deliver: 'token' },
    });
    setSessionToken(token);
    await SecureStore.set({ key: SESSION_KEY, value: token });
    return;
  }
  // Legacy remote-URL shell: sets the httpOnly session cookie on this webview's first-party origin.
  await fetchApiJson('/api/auth/native/exchange', { method: 'POST', body: { code, verifier } });
}

export async function shareNative(title: string, url: string): Promise<void> {
  await Share.share({ title, url, dialogTitle: 'Share chart' });
}

export async function shareNativeFile(blob: Blob, filename: string, extension: 'png' | 'csv'): Promise<void> {
  if (!Capacitor.isPluginAvailable('NativeExport')) throw new Error('Please update Chartsuno in TestFlight to export files.');
  if (blob.size > 25_000_000) throw new Error('This chart is too large to share. Try a smaller chart.');
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not prepare chart file.'));
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.readAsDataURL(blob);
  });
  const safeName = filename.replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 90) || 'chart';
  await NativeExport.shareFile({ base64, filename: `${safeName}.${extension}` });
}

export function selectionHaptic(): void {
  if (isNativeApp()) void Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
}

const NativeStatusBar = registerPlugin<{ setStyle(options: { style: 'DARK' | 'LIGHT' }): Promise<void> }>('StatusBar');
export function updateNativeStatusBar(theme: 'light' | 'dark'): void {
  if (isNativeApp()) void NativeStatusBar.setStyle({ style: theme === 'dark' ? 'DARK' : 'LIGHT' }).catch(() => {});
}
