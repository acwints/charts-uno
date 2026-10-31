import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { EmptyState } from '../src/components/Dashboard/EmptyState';
import { useChartStore } from '../src/stores/chartStore';

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
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useChartStore.getState().reset();
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
  cleanup();
  renderEmpty('all', 'revenue');
  expect(screen.queryByRole('button', { name: /Monthly revenue/ })).toBeNull();
  expect(screen.getByText('No charts found for "revenue"')).toBeTruthy();
});
