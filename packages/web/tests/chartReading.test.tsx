import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { ChartDetail } from '../src/pages/ChartDetail';
import { useChartStore } from '../src/stores/chartStore';
import { safeSourceUrl } from '../src/utils/chartSources';
import type { ChartResponse } from '../src/services/api';

const mocks = vi.hoisted(() => ({ getChart: vi.fn() }));
vi.mock('../src/services/api', () => mocks);
vi.mock('../src/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'me' }, isAuthenticated: true }) }));
vi.mock('../src/components/ChartPreview', () => ({ ChartPreview: ({ readOnly }: { readOnly?: boolean }) => <p>{readOnly ? 'Read-only visualization' : 'Editor visualization'}</p> }));
vi.mock('../src/components/ShareMenu', () => ({ ShareMenu: () => <button>Share image</button> }));
function chart(id: string, owner = 'me'): ChartResponse { return { id, user_id: owner, title: id, description: null, source_type: 'paste', is_public: true, view_count: 0, like_count: 0, created_at: '2026-11-01T00:00:00Z', is_liked: false, is_saved: false, data: { labels: ['Q1', 'Q2'], series: [{ name: 'Revenue', data: [0, null] }] }, config: { ...useChartStore.getState().chartConfig, title: id } }; }
function NavigateB() { const navigate = useNavigate(); return <button onClick={() => navigate('/chart/B')}>Open B</button>; }
function mount() { return render(<MemoryRouter initialEntries={['/chart/A']}><NavigateB /><Routes><Route path="/chart/:id" element={<ChartDetail />} /></Routes></MemoryRouter>); }
beforeEach(() => { vi.clearAllMocks(); useChartStore.getState().reset(); });
afterEach(cleanup);

test('reading and inspecting data leaves the editor draft intact; editing requires an explicit link', async () => {
  const draft = chart('Draft');
  useChartStore.getState().loadDocument(null, draft.data, draft.config);
  const before = useChartStore.getState();
  mocks.getChart.mockResolvedValue(chart('A'));
  mount();
  await screen.findByText('Read-only visualization');
  expect(screen.getByRole('link', { name: 'Edit chart' }).getAttribute('href')).toBe('/chart/A/edit');
  fireEvent.click(screen.getByText('View data · 2 rows'));
  expect(screen.getByText('0')).toBeTruthy();
  expect(screen.getByText('—')).toBeTruthy();
  expect(useChartStore.getState().chartData).toBe(before.chartData);
  expect(useChartStore.getState().documentId).toBeNull();
});

test('late responses cannot replace another chart and another author gets a copy action', async () => {
  let resolveA!: (value: ChartResponse) => void;
  mocks.getChart.mockImplementation(id => id === 'A' ? new Promise<ChartResponse>(resolve => { resolveA = resolve; }) : Promise.resolve(chart('B', 'other')));
  mount();
  fireEvent.click(screen.getByText('Open B'));
  await screen.findByRole('heading', { name: 'B' });
  await act(async () => resolveA(chart('A')));
  expect(screen.queryByRole('heading', { name: 'A' })).toBeNull();
  expect(screen.getByRole('link', { name: 'Customize a copy' }).getAttribute('href')).toBe('/chart/B/edit');
});

test('source links accept only explicit web URLs', () => {
  expect(safeSourceUrl('https://example.com/data')).toBe('https://example.com/data');
  expect(safeSourceUrl('javascript:alert(1)')).toBeUndefined();
  expect(safeSourceUrl('paste')).toBeUndefined();
});

test('large data tables reveal remaining rows on demand', async () => {
  const large = chart('A');
  large.data.labels = Array.from({ length: 60 }, (_, i) => `Row ${i + 1}`);
  large.data.series = [{ name: 'Value', data: large.data.labels.map((_, i) => i) }];
  mocks.getChart.mockResolvedValue(large);
  mount();
  await screen.findByRole('heading', { name: 'A' });
  fireEvent.click(screen.getByText('View data · 60 rows'));
  expect(screen.queryByText('Row 60')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Show more rows (50 of 60)' }));
  expect(screen.getByText('Row 60')).toBeTruthy();
});

test('a failed chart load offers a working retry', async () => {
  mocks.getChart.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(chart('A'));
  mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
  await screen.findByRole('heading', { name: 'A' });
});
