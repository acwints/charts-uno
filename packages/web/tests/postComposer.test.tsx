import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { PostComposer } from '../src/pages/PostComposer';
import { ApiError } from '../src/services/apiBase';
import type { ChartResponse } from '../src/services/api';
const mocks = vi.hoisted(() => ({ getMyCharts: vi.fn(), getChart: vi.fn(), previewPublication: vi.fn(), publishChart: vi.fn() }));
vi.mock('../src/services/api', () => mocks);
vi.mock('../src/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'me' } }) }));
vi.mock('../src/components/ChartPreview', () => ({ ChartPreview: () => <div>Chart preview</div> }));
vi.mock('../src/components/MiniChartPreview', () => ({ MiniChartPreview: () => <div>Library preview</div> }));
const chart: ChartResponse = { id: 'chart1', user_id: 'me', title: 'Bird counts', description: '', data: { labels: ['Monday', 'Tuesday'], series: [{ name: 'Birds', data: [0.00000123456789, null] }] }, config: { type: 'bar' }, source_type: 'paste', is_public: false, created_at: '2026-11-10', like_count: 0, view_count: 0, is_liked: false, is_saved: false };
beforeEach(() => {
  vi.clearAllMocks();
  window.scrollTo = vi.fn();
  mocks.getMyCharts.mockResolvedValue({ charts: [chart], total: 1 });
  mocks.getChart.mockResolvedValue(chart);
  mocks.previewPublication.mockResolvedValue({ chart, errors: [], draft_hash: 'reviewed-hash' });
  mocks.publishChart.mockResolvedValue({ ...chart, revision_id: 'rev1', is_public: true });
});
afterEach(cleanup);
function mount() { return render(<MemoryRouter initialEntries={['/post']}><PostComposer /></MemoryRouter>); }
async function sourceStep() {
  mount();
  fireEvent.click(await screen.findByRole('button', { name: /Bird counts/ }));
  await screen.findByLabelText('How did you collect this data?');
}
async function preview() {
  await sourceStep();
  fireEvent.change(screen.getByLabelText('How did you collect this data?'), { target: { value: 'I counted birds in my garden each morning in November.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  fireEvent.click(screen.getByRole('button', { name: 'Preview post' }));
  await screen.findByRole('heading', { name: 'Review your post' });
}
test('own data requires disclosure, exact table review, and explicit acknowledgment before publication', async () => {
  await sourceStep();
  expect((screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('How did you collect this data?'), { target: { value: 'Counted each morning.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  fireEvent.change(screen.getByLabelText('Caption'), { target: { value: 'A week in the garden' } });
  fireEvent.click(screen.getByRole('button', { name: 'Preview post' }));
  await screen.findByText('0.00000123456789');
  expect(screen.getByText('—')).toBeTruthy();
  const publish = screen.getByRole('button', { name: 'Publish post' });
  expect((publish as HTMLButtonElement).disabled).toBe(true);
  expect(mocks.publishChart).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(publish);
  await screen.findByRole('heading', { name: 'Your post is live' });
  expect(mocks.publishChart).toHaveBeenCalledWith('chart1', expect.objectContaining({ expected_draft_hash: 'reviewed-hash', source: { kind: 'own_data', title: 'My own data', description: 'Counted each morning.', url: undefined }, caption: 'A week in the garden' }));
});
test('external data needs a safe source link as well as a description', async () => {
  await sourceStep();
  fireEvent.change(screen.getByLabelText('Data source'), { target: { value: 'external' } });
  fireEvent.change(screen.getByLabelText('Source name'), { target: { value: 'Bird census' } });
  fireEvent.change(screen.getByLabelText('What does this data cover?'), { target: { value: 'Daily counts' } });
  fireEvent.change(screen.getByLabelText('Source link'), { target: { value: 'javascript:alert(1)' } });
  expect((screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('Source link'), { target: { value: 'https://example.com/census' } });
  expect((screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement).disabled).toBe(false);
});
test('stale reviews require a new preview and acknowledgment', async () => {
  mocks.publishChart.mockRejectedValue(new ApiError('Draft changed', 409));
  await preview();
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'Publish post' }));
  await screen.findByText(/This chart changed since your review/);
  expect(screen.queryByRole('button', { name: 'Publish post' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Preview post' }));
  await screen.findByRole('checkbox');
  expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false);
  expect(mocks.previewPublication).toHaveBeenCalledTimes(2);
});
test('invalid server previews cannot be published or rendered as valid charts', async () => {
  mocks.previewPublication.mockResolvedValue({ chart, errors: ['Pie requires one nonnegative series.'], draft_hash: 'bad' });
  await preview();
  expect(screen.getByText('Pie requires one nonnegative series.')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Publish post' })).toBeNull();
  expect(screen.queryByText('Chart preview')).toBeNull();
  await waitFor(() => expect(mocks.publishChart).not.toHaveBeenCalled());
});

test('link and team preparation bind the same private audience in preview and publish', async () => {
  await sourceStep();
  fireEvent.change(screen.getByLabelText('How did you collect this data?'), { target: { value: 'Counted each morning.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  fireEvent.change(screen.getByLabelText('Audience'), { target: { value: 'private' } });
  fireEvent.click(screen.getByRole('button', { name: 'Preview post' }));
  await screen.findByRole('checkbox');
  expect(mocks.previewPublication).toHaveBeenCalledWith('chart1', expect.objectContaining({ is_public: false }));
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'Prepare sharing version' }));
  await screen.findByRole('heading', { name: 'Your chart is ready to share' });
  expect(mocks.publishChart).toHaveBeenCalledWith('chart1', expect.objectContaining({ is_public: false }));
});

test('an unlisted existing revision still offers and requires a correction note', async () => {
  mocks.getChart.mockResolvedValue({ ...chart, revision_id: 'previous-revision', is_public: false });
  await sourceStep();
  fireEvent.change(screen.getByLabelText('How did you collect this data?'), { target: { value: 'Counted each morning.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  expect((screen.getByRole('button', { name: 'Preview post' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('What changed?'), { target: { value: 'Corrected Tuesday after checking the log.' } });
  expect((screen.getByRole('button', { name: 'Preview post' }) as HTMLButtonElement).disabled).toBe(false);
});
