/* eslint-disable @typescript-eslint/no-explicit-any -- Transport doubles cover resource identity and out-of-order responses. */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { TeamProvider, useTeam } from '../src/contexts/TeamContext';
import { ChartFeed } from '../src/components/ChartFeed/ChartFeed';

const mocks = vi.hoisted(() => ({ getTeams: vi.fn(), getUsage: vi.fn(), getPublicCharts: vi.fn(), getSavedCharts: vi.fn(), getLikedCharts: vi.fn(), auth: { user: { id: 'one' } as { id: string } | null } }));
vi.mock('../src/services/api', () => mocks);
vi.mock('../src/hooks/useAuth', () => ({ useAuth: () => mocks.auth }));
vi.mock('../src/hooks/useMediaQuery', () => ({ useMediaQuery: () => false }));
vi.mock('../src/components/ChartFeed/ChartCard', () => ({ ChartCard: ({ chart }: any) => <p>{chart.title}</p> }));
vi.mock('../src/components/ChartFeed/InstaChartCard', () => ({ InstaChartCard: ({ chart }: any) => <p>{chart.title}</p> }));

function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
const teams = [{ id: 'A', name: 'A', is_personal: true }, { id: 'B', name: 'B', is_personal: false }];
function TeamConsumer() { const team = useTeam(); return <><p data-testid="usage">{team.currentTeam?.id ?? 'none'}:{team.usage?.charts_remaining ?? 'pending'}</p><button onClick={() => team.switchTeam('B')}>Switch B</button></>; }
beforeEach(() => { vi.clearAllMocks(); const storage = new Map<string, string>(); vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), clear: () => storage.clear() }); mocks.auth.user = { id: 'one' }; });
afterEach(cleanup);

test('a late quota response cannot attach team A limits to team B', async () => {
  const a = deferred<any>(); const b = deferred<any>();
  mocks.getTeams.mockResolvedValue({ teams });
  mocks.getUsage.mockImplementation(id => id === 'A' ? a.promise : b.promise);
  render(<TeamProvider isAuthenticated><TeamConsumer /></TeamProvider>);
  await waitFor(() => expect(mocks.getUsage).toHaveBeenCalledWith('A'));
  fireEvent.click(screen.getByText('Switch B'));
  await act(async () => b.resolve({ charts_remaining: 25 }));
  expect(screen.getByTestId('usage').textContent).toBe('B:25');
  await act(async () => a.resolve({ charts_remaining: 0 }));
  expect(screen.getByTestId('usage').textContent).toBe('B:25');
});

test('teams completing after sign-out cannot repopulate the account', async () => {
  const pending = deferred<any>(); mocks.getTeams.mockReturnValue(pending.promise);
  const view = render(<TeamProvider isAuthenticated><TeamConsumer /></TeamProvider>);
  view.rerender(<TeamProvider isAuthenticated={false}><TeamConsumer /></TeamProvider>);
  await act(async () => pending.resolve({ teams }));
  expect(screen.getByTestId('usage').textContent).toBe('none:pending');
});

test('switching feed tabs rejects a stale explore response', async () => {
  const explore = deferred<any>(); mocks.getPublicCharts.mockReturnValue(explore.promise);
  mocks.getSavedCharts.mockResolvedValue([{ chart: { id: 'saved', title: 'Saved private chart' } }]);
  render(<ChartFeed />);
  fireEvent.click(screen.getByRole('button', { name: 'Saved' }));
  await screen.findByText('Saved private chart');
  await act(async () => explore.resolve({ charts: [{ id: 'public', title: 'Public chart' }] }));
  expect(screen.queryByText('Public chart')).toBeNull();
  expect(screen.getByText('Saved private chart')).toBeTruthy();
});

test('sign-out hides private feed results and ignores their pending requests', async () => {
  const saved = deferred<any>(); mocks.getSavedCharts.mockReturnValue(saved.promise);
  mocks.getPublicCharts.mockResolvedValue({ charts: [{ id: 'public', title: 'Public chart' }] });
  const view = render(<ChartFeed />);
  await screen.findByText('Public chart');
  fireEvent.click(screen.getByRole('button', { name: 'Saved' }));
  mocks.auth.user = null; view.rerender(<ChartFeed />);
  await act(async () => saved.resolve([{ chart: { id: 'private', title: 'Old account secret' } }]));
  await screen.findByText('Public chart');
  expect(screen.queryByText('Old account secret')).toBeNull();
});
