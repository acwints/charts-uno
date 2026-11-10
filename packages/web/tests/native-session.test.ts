import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ store: vi.fn(), activate: vi.fn(), request: vi.fn() }));
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => true, isPluginAvailable: () => true },
  registerPlugin: () => ({ set: mocks.store }),
}));
vi.mock('../src/services/apiBase', () => ({ fetchApiJson: mocks.request, setSessionToken: mocks.activate }));
vi.mock('../src/services/referrals', () => ({ pendingReferral: () => null }));
import { signInWithReview } from '../src/services/native';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.request.mockResolvedValue({ token: 'test-session' });
});

it('does not activate a session when secure storage fails', async () => {
  mocks.store.mockRejectedValue(new Error('Keychain unavailable'));
  await expect(signInWithReview('review@example.test', 'test')).rejects.toThrow('Keychain unavailable');
  expect(mocks.activate).not.toHaveBeenCalled();
});

it('waits for secure storage before activating the session', async () => {
  let complete!: () => void;
  mocks.store.mockImplementation(() => new Promise<void>((resolve) => { complete = resolve; }));
  const pending = signInWithReview('review@example.test', 'test');
  await vi.waitFor(() => expect(mocks.store).toHaveBeenCalled());
  expect(mocks.activate).not.toHaveBeenCalled();
  complete();
  await pending;
  expect(mocks.activate).toHaveBeenCalledWith('test-session');
});
