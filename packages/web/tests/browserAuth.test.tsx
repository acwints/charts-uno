import { webcrypto } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { beginBrowserSignIn, finishBrowserSignIn } from '../src/services/browserAuth';
import { fetchApiJson } from '../src/services/apiBase';
import { getAuthUrl } from '../src/services/api';
vi.mock('../src/services/apiBase', () => ({ fetchApiJson: vi.fn(async () => ({})) }));
vi.mock('../src/services/api', () => ({ getAuthUrl: vi.fn(async () => ({ auth_url: 'https://accounts.google.com/test' })) }));
beforeEach(() => { sessionStorage.clear(); vi.clearAllMocks(); vi.stubGlobal('crypto', webcrypto); });

describe('browser-owned sign-in handoff', () => {
  it('binds the code to this tab and sends only the verifier to the cookie exchange', async () => {
    expect(await beginBrowserSignIn('https://chartsuno.com/new?source=demo')).toBe('https://accounts.google.com/test');
    const pending = JSON.parse(sessionStorage.getItem('chartsuno.web-sign-in')!);
    const [, challenge, nonce] = vi.mocked(getAuthUrl).mock.calls[0];
    expect(challenge).toMatch(/^[\w-]{43}$/);
    expect(nonce).toBe(pending.nonce);
    await finishBrowserSignIn('one-use-code', nonce);
    expect(fetchApiJson).toHaveBeenCalledWith('/api/auth/web/exchange', { method: 'POST', body: { code: 'one-use-code', verifier: pending.verifier } });
    expect(sessionStorage.getItem('chartsuno.web-sign-in')).toBeNull();
    await expect(finishBrowserSignIn('one-use-code', nonce)).rejects.toThrow();
  });
  it('rejects callbacks that did not start in this tab or have the wrong state', async () => {
    await expect(finishBrowserSignIn('foreign-code', 'foreign-state')).rejects.toThrow();
    await beginBrowserSignIn('https://chartsuno.com');
    await expect(finishBrowserSignIn('foreign-code', 'foreign-state')).rejects.toThrow();
    expect(fetchApiJson).not.toHaveBeenCalled();
  });
  it('rejects expired browser attempts before sending a code', async () => {
    sessionStorage.setItem('chartsuno.web-sign-in', JSON.stringify({ verifier: 'a'.repeat(43), nonce: 'state', createdAt: Date.now() - 11 * 60_000 }));
    await expect(finishBrowserSignIn('code', 'state')).rejects.toThrow(/expired/);
    expect(fetchApiJson).not.toHaveBeenCalled();
  });
});
