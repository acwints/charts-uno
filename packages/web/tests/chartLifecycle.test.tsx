/* eslint-disable @typescript-eslint/no-explicit-any -- Lightweight UI doubles exercise document behavior, while production props remain typed. */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { ChartView } from '../src/pages/ChartView';
import { ChartBuilder } from '../src/pages/ChartBuilder';
import { useChartStore } from '../src/stores/chartStore';

const mocks = vi.hoisted(() => ({ getChart: vi.fn(), updateChart: vi.fn(), createChart: vi.fn(), recommend: vi.fn(), teams: [], toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('../src/services/api', () => ({ ...mocks, getChartPublishTargets: vi.fn(async () => ({ is_public: false, team_ids: [] })), getTeamBranding: vi.fn() }));
vi.mock('../src/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'user' }, isAuthenticated: true }) }));
vi.mock('../src/contexts/TeamContext', () => ({ useTeam: () => ({ teams: mocks.teams }) }));
vi.mock('../src/contexts/ToastContext', () => ({ useToast: () => mocks.toast }));
vi.mock('../src/services/native', () => ({ isNativeApp: () => false }));
vi.mock('../src/services/chartTypeRecommender', () => ({ recommendChartType: mocks.recommend }));
vi.mock('../src/components/ChartWorkbench', () => ({ ChartWorkbench: (p: any) => <div>
  <p data-testid="document">{p.data.labels.join(',')}</p>
  <p data-testid="source">{p.config.sourceLink ?? ''}</p>
  <button onClick={p.onSave}>Save</button>
  <button onClick={p.onDataReset}>Reset data</button>
  <button onClick={() => p.onDataChange({ ...p.data, labels: ['edited'] })}>Edit</button>
</div> }));
vi.mock('../src/components/DataInput', () => ({ DataInput: (p: any) => <button onClick={() => p.onSubmit({ labels: ['Fresh'], series: [{ name: 'new', data: [9] }], sourceType: 'sheets' })}>Import</button> }));
vi.mock('../src/components/Hero', () => ({ Hero: () => null }));
vi.mock('../src/components/Features', () => ({ Features: () => null }));
vi.mock('../src/components/ValueOfCharts', () => ({ ValueOfCharts: () => null }));
vi.mock('../src/components/BottomCTA', () => ({ BottomCTA: () => null }));

function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
function chart(id: string) { return { id, user_id: 'user', title: id, source_type: 'paste', is_public: false, data: { labels: [id], series: [{ name: id, data: [1] }] }, config: { ...useChartStore.getState().chartConfig, title: id } }; }
function Navigation() { const navigate = useNavigate(); const location = useLocation(); return <><p data-testid="route">{location.pathname}</p><button onClick={() => navigate('/chart/B')}>Open B</button><button onClick={() => navigate('/new')}>New</button></>; }
function app(path: string) { return render(<MemoryRouter initialEntries={[path]}><Navigation /><Routes><Route path="/chart/:id" element={<ChartView />} /><Route path="/chart" element={<ChartView />} /><Route path="/new" element={<ChartBuilder />} /></Routes></MemoryRouter>); }
beforeEach(() => { useChartStore.getState().reset(); vi.clearAllMocks(); mocks.updateChart.mockResolvedValue({}); });
afterEach(cleanup);

test('late A response cannot replace B or cause Save to overwrite B with A', async () => {
  const a = deferred<any>(); const b = deferred<any>();
  mocks.getChart.mockImplementation(id => id === 'A' ? a.promise : b.promise);
  app('/chart/A');
  fireEvent.click(screen.getByText('Open B'));
  await act(async () => b.resolve(chart('B')));
  expect(screen.getByTestId('document').textContent).toBe('B');
  await act(async () => a.resolve(chart('A')));
  expect(screen.getByTestId('document').textContent).toBe('B');
  fireEvent.click(screen.getByText('Save'));
  await waitFor(() => expect(mocks.updateChart).toHaveBeenCalledWith('B', expect.objectContaining({ data: expect.objectContaining({ labels: ['B'] }) })));
});

test('Reset uses the loaded document baseline, and a successful save replaces that baseline', async () => {
  const a = chart('A'); useChartStore.setState({ documentId: 'A', chartData: a.data, chartConfig: a.config, originalData: a.data });
  mocks.getChart.mockResolvedValue(chart('B'));
  app('/chart/B');
  await waitFor(() => expect(screen.getByTestId('document').textContent).toBe('B'));
  fireEvent.click(screen.getByText('Edit'));
  fireEvent.click(screen.getByText('Reset data'));
  expect(screen.getByTestId('document').textContent).toBe('B');
  fireEvent.click(screen.getByText('Edit'));
  fireEvent.click(screen.getByText('Save'));
  await waitFor(() => expect(mocks.toast.success).toHaveBeenCalledWith('Chart updated'));
  fireEvent.click(screen.getByText('Reset data'));
  expect(screen.getByTestId('document').textContent).toBe('edited');
});

test('new imports do not inherit another document source, title, stacking or dual axes', async () => {
  const a = chart('A'); useChartStore.setState({ documentId: 'A', chartData: a.data, originalData: a.data, chartConfig: { ...a.config, sourceLink: 'https://old.invalid', stacked: true, seriesConfig: { old: { chartType: 'line', axis: 'right' } }, rightYAxisLabel: 'Old units' } });
  app('/new'); fireEvent.click(screen.getByText('Import'));
  await waitFor(() => expect(screen.getByTestId('document').textContent).toBe('Fresh'));
  const state = useChartStore.getState();
  expect(state.chartConfig).toMatchObject({ title: '', stacked: false });
  expect(state.documentId).toBeNull();
  expect(state.chartConfig.sourceLink).toBeUndefined();
  expect(state.chartConfig.seriesConfig).toBeUndefined();
  expect(state.chartConfig.rightYAxisLabel).toBeUndefined();
});

test('completing a draft save after leaving cannot navigate back or relabel the next document', async () => {
  const draft = chart('Draft'); useChartStore.setState({ documentId: null, chartData: draft.data, chartConfig: draft.config, originalData: draft.data });
  const saved = deferred<any>(); mocks.createChart.mockReturnValue(saved.promise); mocks.getChart.mockResolvedValue(chart('B'));
  app('/chart'); fireEvent.click(screen.getByText('Save')); fireEvent.click(screen.getByText('Open B'));
  await waitFor(() => expect(screen.getByTestId('document').textContent).toBe('B'));
  await act(async () => saved.resolve({ id: 'saved-draft', is_public: false }));
  expect(screen.getByTestId('document').textContent).toBe('B');
  expect(screen.getByTestId('route').textContent).toBe('/chart/B');
  expect(useChartStore.getState().documentId).toBe('B');
});

test('saving another author public chart creates a private copy, then updates only that copy', async () => {
  mocks.getChart.mockResolvedValue({ ...chart('public'), user_id: 'another-author', is_public: true });
  mocks.createChart.mockResolvedValue({ id: 'my-copy', is_public: false });
  app('/chart/public');
  await waitFor(() => expect(screen.getByTestId('document').textContent).toBe('public'));
  fireEvent.click(screen.getByText('Save'));
  await waitFor(() => expect(screen.getByTestId('route').textContent).toBe('/chart/my-copy'));
  expect(mocks.createChart).toHaveBeenCalledWith(expect.objectContaining({ is_public: false, data: expect.objectContaining({ labels: ['public'] }) }));
  expect(mocks.updateChart).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('Save'));
  await waitFor(() => expect(mocks.updateChart).toHaveBeenCalledWith('my-copy', expect.anything()));
});
