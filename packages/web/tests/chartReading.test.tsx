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
  expect(screen.getByRole('link', { name: 'Update post' }).getAttribute('href')).toBe('/post?chart=A');
  fireEvent.click(screen.getByText('Data & sources · 2 rows'));
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
  expect(screen.queryByRole('link', { name: 'Update post' })).toBeNull();
});

test('source links accept only explicit web URLs', () => {
  expect(safeSourceUrl('https://example.com/data')).toBe('https://example.com/data');
  expect(safeSourceUrl('javascript:alert(1)')).toBeUndefined();
  expect(safeSourceUrl('paste')).toBeUndefined();
  expect(safeSourceUrl('https://user:secret@example.com')).toBeUndefined();
  expect(safeSourceUrl('https://example.com/\nprivate')).toBeUndefined();
});

test('large data tables reveal remaining rows on demand', async () => {
  const large = chart('A');
  large.data.labels = Array.from({ length: 60 }, (_, i) => `Row ${i + 1}`);
  large.data.series = [{ name: 'Value', data: large.data.labels.map((_, i) => i) }];
  mocks.getChart.mockResolvedValue(large);
  mount();
  await screen.findByRole('heading', { name: 'A' });
  fireEvent.click(screen.getByText('Data & sources · 60 rows'));
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


test('reader preserves numeric precision, categorical context, and all safe source references', async () => {
  const item = chart('A');
  item.data.series[0].data = [0.00001234, -1.23456789];
  item.data.categoricalColumns = [{ name: 'Method', data: ['Measured', 'Estimated'] }];
  item.data.sources = [{ title: 'Dataset', url: 'https://example.com/data' }];
  item.data.sourceLink = 'https://example.com/data';
  item.config.sourceLink = 'javascript:alert(1)';
  item.source_url = 'https://example.org/original';
  mocks.getChart.mockResolvedValue(item);
  mount();
  fireEvent.click(await screen.findByText('Data & sources · 2 rows'));
  expect(screen.getByText('0.00001234')).toBeTruthy();
  expect(screen.getByText('-1.23456789')).toBeTruthy();
  expect(screen.getByRole('columnheader', { name: 'Method' })).toBeTruthy();
  expect(screen.getByText('Estimated')).toBeTruthy();
  expect(screen.getAllByRole('link', { name: /Dataset/ })).toHaveLength(1);
  expect(screen.getByRole('link', { name: /Original reference/ }).getAttribute('href')).toBe('https://example.org/original');
  expect(document.querySelector('a[href^="javascript:"]')).toBeNull();
});

test('client asserted verification cannot suppress generated-data disclosure', async () => {
  const item = chart('A');
  item.source_type = 'prompt'; item.data.verifiedData = true;
  mocks.getChart.mockResolvedValue(item);
  mount();
  expect((await screen.findAllByText('AI-generated data. Linked sources do not independently verify these values.')).length).toBeGreaterThan(0);
  expect(screen.queryByText('Verified')).toBeNull();
});

test('a direct data link opens the table and image reconstruction keeps its disclosure', async () => {
  const item = chart('A'); item.source_type = 'image'; item.data.verifiedData = true;
  mocks.getChart.mockResolvedValue(item);
  render(<MemoryRouter initialEntries={['/chart/A#data']}><Routes><Route path="/chart/:id" element={<ChartDetail />} /></Routes></MemoryRouter>);
  const summary = await screen.findByText('Data & sources · 2 rows');
  expect(summary.closest('details')?.open).toBe(true);
  expect(screen.getAllByText('Reconstructed from an image. Extracted values may be approximate.').length).toBeGreaterThan(0);
});


test('mixed-axis tables do not imply one unit applies to every series', async () => {
  const item = chart('A');
  item.data.yAxisLabel = 'Revenue'; item.data.yAxisPrefix = '$';
  item.data.series.push({ name: 'Conversion', data: [5, 10] });
  item.config.seriesConfig = { Conversion: { axis: 'right', chartType: 'line' } };
  item.config.rightYAxisLabel = 'Conversion'; item.config.rightYAxisSuffix = '%';
  mocks.getChart.mockResolvedValue(item);
  mount();
  fireEvent.click(await screen.findByText('Data & sources · 2 rows'));
  expect(screen.getByText('Primary axis: Revenue $')).toBeTruthy();
  expect(screen.getByText('Secondary axis: Conversion %')).toBeTruthy();
  expect(screen.getByRole('columnheader', { name: 'Conversion (secondary axis)' })).toBeTruthy();
});
