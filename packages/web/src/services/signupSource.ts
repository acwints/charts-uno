const SOURCE_KEY = 'chartsuno.signupSource';
const UTM_FIELDS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;

export interface SignupSource {
  referrer_host?: string;
  landing_path?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
}

function referrerHost(referrer: string): string | undefined {
  if (!referrer) return undefined;
  try {
    const url = new URL(referrer);
    if (url.username || url.password) return undefined;
    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    if (!host || host.length > 253 || host.includes('..')) return undefined;
    return host;
  } catch {
    return undefined;
  }
}

function landingPath(pathname: string): string | undefined {
  if (!pathname.startsWith('/') || pathname.startsWith('//') || pathname.includes('@')) return undefined;
  const path = pathname.split(/[?#]/, 1)[0];
  if (!path.startsWith('/') || path.length > 200) return undefined;
  return path;
}

function utmValue(value: string | null): string | undefined {
  if (!value) return undefined;
  const text = value.trim().replace(/\s+/g, ' ');
  if (!text || text.length > 64 || /[@/?#&%]/.test(text)) return undefined;
  if (!/^[A-Za-z0-9][A-Za-z0-9 ._+-]{0,63}$/.test(text)) return undefined;
  return text;
}

/** Remember the first page's hostname, path, and UTM fields for a later sign-in. */
export function rememberSignupSource(search: string, referrer: string, pathname: string): void {
  try {
    if (sessionStorage.getItem(SOURCE_KEY)) return;
    const params = new URLSearchParams(search);
    const stored: SignupSource = {};
    const host = referrerHost(referrer);
    const path = landingPath(pathname);
    if (host) stored.referrer_host = host;
    if (path) stored.landing_path = path;
    for (const field of UTM_FIELDS) {
      const value = utmValue(params.get(field));
      if (value) stored[field] = value;
    }
    if (!stored.referrer_host && !stored.landing_path && !UTM_FIELDS.some((field) => stored[field])) return;
    sessionStorage.setItem(SOURCE_KEY, JSON.stringify(stored));
  } catch {
    // Private mode can block sessionStorage. Sign-in still works.
  }
}

/** Sanitized source captured in this tab, if any. */
export function pendingSignupSource(): SignupSource {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(SOURCE_KEY) || 'null') as SignupSource | null;
    if (!parsed || typeof parsed !== 'object') return {};
    const source: SignupSource = {};
    if (typeof parsed.referrer_host === 'string') source.referrer_host = parsed.referrer_host;
    if (typeof parsed.landing_path === 'string') source.landing_path = parsed.landing_path;
    for (const field of UTM_FIELDS) {
      const value = parsed[field];
      if (typeof value === 'string') source[field] = value;
    }
    return source;
  } catch {
    return {};
  }
}
