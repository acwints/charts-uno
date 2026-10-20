import { Capacitor, registerPlugin } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { SplashScreen } from '@capacitor/splash-screen';
import { fetchApiJson, setSessionToken } from './apiBase';

export const isNativeApp = () => Capacitor.isNativePlatform();
const NativeAuth = registerPlugin<{
  authenticate(options: { url: string }): Promise<{ url: string }>;
  signInWithApple(): Promise<{ identityToken: string; user: string; email?: string; fullName?: string }>;
}>('NativeAuth');
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

/**
 * http(s) links leave the bundled origin. Open them in the in-app browser
 * sheet so the chart the user was editing stays mounted underneath.
 */
export function installNativeLinkGuard(): void {
  if (!isNativeApp() || typeof document === 'undefined') return;
  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const anchor = target.closest('a');
    if (!anchor) return;
    const href = anchor.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('/')) return;
    let url: URL;
    try {
      url = new URL(href, window.location.href);
    } catch {
      return;
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return;
    if (url.origin === window.location.origin) return;
    const sameSite = url.hostname === 'chartsuno.com' || url.hostname === 'www.chartsuno.com';
    const inAppPath = /^\/(chart|feed|settings|privacy|terms|dashboard|dashboards|team|invite)(\/|$)/.test(url.pathname);
    if (sameSite && inAppPath) {
      event.preventDefault();
      window.history.pushState({}, '', `${url.pathname}${url.search}${url.hash}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
      return;
    }
    event.preventDefault();
    void Browser.open({ url: url.toString() }).catch(() => {});
  });
}

function cancelled(error: unknown): boolean {
  if (typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'CANCELLED') {
    return true;
  }
  return error instanceof Error && error.message.toLowerCase().includes('cancel');
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

/** Sign in with Apple through AuthenticationServices. iOS only. */
export async function signInWithApple(): Promise<void> {
  if (!Capacitor.isPluginAvailable('NativeAuth') || !usesTokenSession()) {
    throw new Error('Please update Chartsuno in TestFlight to sign in inside the app.');
  }
  let result: { identityToken: string; fullName?: string };
  try {
    result = await NativeAuth.signInWithApple();
  } catch (error) {
    if (cancelled(error)) throw Object.assign(new Error('Sign-in cancelled'), { code: 'CANCELLED' });
    const message = error instanceof Error ? error.message : '';
    if (message.toLowerCase().includes('not implemented')) {
      throw new Error('Please update Chartsuno in TestFlight to use Sign in with Apple.');
    }
    throw error instanceof Error ? error : new Error('Could not finish sign-in. Please try again.');
  }
  const { token } = await fetchApiJson<{ token: string }>('/api/auth/apple', {
    method: 'POST',
    body: {
      identity_token: result.identityToken,
      full_name: result.fullName,
      deliver: 'token',
    },
  });
  setSessionToken(token);
  await SecureStore.set({ key: SESSION_KEY, value: token });
}

/** Email and password for the App Review demo account. iOS only. */
export async function signInWithReview(email: string, password: string): Promise<void> {
  if (!usesTokenSession()) {
    throw new Error('Reviewer sign-in is only available in the iOS app.');
  }
  const { token } = await fetchApiJson<{ token: string }>('/api/auth/review/login', {
    method: 'POST',
    body: { email, password, deliver: 'token' },
  });
  setSessionToken(token);
  await SecureStore.set({ key: SESSION_KEY, value: token });
}

export async function shareNative(title: string, url: string): Promise<void> {
  try {
    await Share.share({ title, url, dialogTitle: 'Share chart' });
  } catch (error) {
    if (isShareCancelled(error)) return;
    throw error;
  }
}

function isShareCancelled(error: unknown): boolean {
  const message = error instanceof Error ? error.message : '';
  return message.toLowerCase().includes('cancel');
}

function safeShareName(filename: string): string {
  return filename.replace(/[^A-Za-z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'chart';
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not prepare chart file.'));
    reader.onload = () => {
      const encoded = String(reader.result ?? '').split(',')[1];
      if (!encoded) reject(new Error('Could not prepare chart file.'));
      else resolve(encoded);
    };
    reader.readAsDataURL(blob);
  });
}

/**
 * Write the chart file into the app cache, then open the system share sheet.
 * iOS uses the Capacitor Filesystem and Share plugins (UIActivityViewController).
 * Dismissing the sheet is a normal end to the flow and does not throw.
 */
export async function shareNativeFile(blob: Blob, filename: string, extension: 'png' | 'csv'): Promise<void> {
  if (!Capacitor.isPluginAvailable('Filesystem') || !Capacitor.isPluginAvailable('Share')) {
    throw new Error('Please update Chartsuno in TestFlight to export files.');
  }
  if (blob.size > 25_000_000) throw new Error('This chart is too large to share. Try a smaller chart.');
  const path = `${safeShareName(filename)}-${Date.now()}.${extension}`;
  let wrote = false;
  try {
    const written = await Filesystem.writeFile({
      path,
      data: await blobToBase64(blob),
      directory: Directory.Cache,
    });
    wrote = true;
    const uri = written.uri || (await Filesystem.getUri({ directory: Directory.Cache, path })).uri;
    await Share.share({
      title: safeShareName(filename),
      files: [uri],
      dialogTitle: 'Share chart',
    });
  } catch (error) {
    if (isShareCancelled(error)) return;
    const message = error instanceof Error ? error.message : '';
    if (message.toLowerCase().includes('sharing is in progress')) {
      throw new Error('Close the current sheet and try again.');
    }
    console.error('Native share failed', error);
    throw new Error('Could not share this chart. Please try again.');
  } finally {
    if (wrote) await Filesystem.deleteFile({ directory: Directory.Cache, path }).catch(() => {});
  }
}

export function selectionHaptic(): void {
  if (isNativeApp()) void Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
}

const NativeStatusBar = registerPlugin<{ setStyle(options: { style: 'DARK' | 'LIGHT' }): Promise<void> }>('StatusBar');
export function updateNativeStatusBar(theme: 'light' | 'dark'): void {
  if (isNativeApp()) void NativeStatusBar.setStyle({ style: theme === 'dark' ? 'DARK' : 'LIGHT' }).catch(() => {});
}
