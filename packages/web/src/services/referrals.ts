const REFERRAL_KEY = 'chartsuno.ref';
const REFERRAL_RE = /^[A-Za-z0-9_-]{8,16}$/;

/** Public invite link. The code is the signed-in user's referral_code. */
export function referralShareUrl(code: string): string {
  return `https://www.chartsuno.com/?ref=${encodeURIComponent(code)}`;
}

/** Remember ?ref= from a landing URL so a later sign-in in this tab can send it. */
export function rememberReferral(search: string): void {
  try {
    const ref = new URLSearchParams(search).get('ref');
    if (ref && REFERRAL_RE.test(ref)) sessionStorage.setItem(REFERRAL_KEY, ref);
  } catch {
    // Private mode can block sessionStorage. Sign-in still works without a referral.
  }
}

/** Code captured from ?ref=, if this tab has one. */
export function pendingReferral(): string | null {
  try {
    rememberReferral(window.location.search);
    const value = sessionStorage.getItem(REFERRAL_KEY);
    return value && REFERRAL_RE.test(value) ? value : null;
  } catch {
    return null;
  }
}

export async function copyReferralLink(code: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(referralShareUrl(code));
    return true;
  } catch {
    return false;
  }
}
