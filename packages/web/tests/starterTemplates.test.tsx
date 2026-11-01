import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { EmptyState } from '../src/components/Dashboard/EmptyState';
import { SAMPLE_CHART_TITLE, sampleChartCreatePayload } from '../src/content/sampleChart';
import { useChartStore } from '../src/stores/chartStore';

const mocks = vi.hoisted(() => ({ createChart: vi.fn() }));
vi.mock('../src/services/api', () => ({ createChart: mocks.createChart }));

function PathProbe() {
  const location = useLocation();
  return <p data-testid="path">{location.pathname}</p>;
}

function renderEmpty(type: 'all' | 'published' | 'liked' = 'all', searchQuery?: string) {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <PathProbe />
      <Routes>
        <Route path="/dashboard" element={<EmptyState type={type} searchQuery={searchQuery} />} />
        <Route path="/chart" element={<p>editor</p>} />
        <Route path="/chart/:id" element={<p>saved editor</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useChartStore.getState().reset();
  mocks.createChart.mockReset();
  mocks.createChart.mockResolvedValue({ id: 'sample-chart-id' });
});

afterEach(cleanup);

test('an empty library opens a starter straight in the editor', () => {
  renderEmpty('all');
  expect(screen.getByRole('link', { name: 'Create New Chart' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /Monthly revenue/ }));
  const { chartData, chartConfig, documentId } = useChartStore.getState();
  expect(documentId).toBeNull();
  expect(chartConfig.type).toBe('bar');
  expect(chartConfig.title).toBe('Monthly revenue');
  expect(chartData?.labels[0]).toBe('Jan');
  expect(chartData?.series[0].data[0]).toBe(42000);
  expect(screen.getByTestId('path').textContent).toBe('/chart');
});

test('the line starter and the csv-shaped starter are both one click', () => {
  renderEmpty('all');
  fireEvent.click(screen.getByRole('button', { name: /Weekly visits/ }));
  expect(useChartStore.getState().chartConfig.type).toBe('line');
  useChartStore.getState().reset();
  cleanup();
  renderEmpty('all');
  fireEvent.click(screen.getByRole('button', { name: /Signups and churn/ }));
  expect(useChartStore.getState().chartData?.series.map((series) => series.name)).toEqual(['Signups', 'Churned']);
});

test('starters stay off the published and search empty states', () => {
  renderEmpty('published');
  expect(screen.queryByRole('button', { name: /Monthly revenue/ })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Make a sample chart' })).toBeNull();
  cleanup();
  renderEmpty('all', 'revenue');
  expect(screen.queryByRole('button', { name: /Monthly revenue/ })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Make a sample chart' })).toBeNull();
  expect(screen.getByText('No charts found for "revenue"')).toBeTruthy();
});

test('make a sample chart saves monthly sales and opens that chart', async () => {
  renderEmpty('all');
  fireEvent.click(screen.getByRole('button', { name: 'Make a sample chart' }));
  await waitFor(() => {
    expect(screen.getByTestId('path').textContent).toBe('/chart/sample-chart-id');
  });
  expect(mocks.createChart).toHaveBeenCalledTimes(1);
  expect(mocks.createChart).toHaveBeenCalledWith(sampleChartCreatePayload());
  expect(sampleChartCreatePayload().title).toBe(SAMPLE_CHART_TITLE);
  expect(sampleChartCreatePayload().is_public).toBe(false);
  expect(sampleChartCreatePayload().data.labels[0]).toBe('Jan');
  const stored = useChartStore.getState();
  expect(stored.documentId).toBe('sample-chart-id');
  expect(stored.chartConfig.title).toBe('Monthly sales');
  expect(stored.chartData?.series[0].name).toBe('Sales');
  expect(screen.getByText('saved editor')).toBeTruthy();
});

test('a failed sample save stays on the empty library and can be retried', async () => {
  mocks.createChart.mockRejectedValue(new Error('Monthly chart limit reached'));
  renderEmpty('all');
  fireEvent.click(screen.getByRole('button', { name: 'Make a sample chart' }));
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Monthly chart limit reached');
  expect(screen.getByTestId('path').textContent).toBe('/dashboard');
  expect(screen.getByRole('button', { name: 'Make a sample chart' }).hasAttribute('disabled')).toBe(false);
  expect(useChartStore.getState().documentId).toBeNull();
});
