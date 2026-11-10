import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { EmptyState } from '../src/components/Dashboard/EmptyState';
import { useChartStore } from '../src/stores/chartStore';

const mocks = vi.hoisted(() => ({ createChart: vi.fn() }));
vi.mock('../src/services/api', () => ({ createChart: mocks.createChart }));
vi.mock('../src/components/MiniChartPreview', () => ({
  MiniChartPreview: () => <div data-testid="mini-chart" />,
}));
vi.mock('../src/contexts/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light', setTheme: () => undefined, toggleTheme: () => undefined, hasStoredPreference: false }),
}));

function PathProbe() {
  const location = useLocation();
  return <p data-testid="path">{location.pathname}{location.search}</p>;
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
  mocks.createChart.mockResolvedValue({ id: 'saved-template' });
});

afterEach(cleanup);

test('one click on a template saves it and opens that chart', async () => {
  renderEmpty('all');
  expect(screen.getAllByTestId('mini-chart').length).toBeGreaterThanOrEqual(4);
  expect(screen.getByRole('link', { name: 'Create New Chart' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /Monthly sales/ }));
  await waitFor(() => {
    expect(screen.getByTestId('path').textContent).toBe('/chart/saved-template');
  });
  expect(mocks.createChart).toHaveBeenCalledTimes(1);
  const payload = mocks.createChart.mock.calls[0][0];
  expect(payload.source_type).toBe('template:sales');
  expect(payload.is_public).toBe(false);
  expect(payload.title).toBe('Monthly sales');
  expect(useChartStore.getState().documentId).toBe('saved-template');
  expect(screen.getByText('saved editor')).toBeTruthy();
});

test('website traffic and the ranking save as their own templates', async () => {
  renderEmpty('all');
  fireEvent.click(screen.getByRole('button', { name: /Website traffic/ }));
  await waitFor(() => expect(mocks.createChart.mock.calls[0][0].source_type).toBe('template:traffic'));
  expect(mocks.createChart.mock.calls[0][0].config.type).toBe('line');
  cleanup();
  mocks.createChart.mockClear();
  renderEmpty('all');
  fireEvent.click(screen.getByRole('button', { name: /Top 10 products/ }));
  await waitFor(() => expect(mocks.createChart.mock.calls[0][0].source_type).toBe('template:ranking'));
  expect(mocks.createChart.mock.calls[0][0].config.barLayout).toBe('horizontal');
});

test('paste from a spreadsheet opens the editor data view without saving', () => {
  renderEmpty('all');
  fireEvent.click(screen.getByRole('button', { name: 'Paste from a spreadsheet' }));
  expect(mocks.createChart).not.toHaveBeenCalled();
  expect(screen.getByTestId('path').textContent).toBe('/chart?paste=1');
});

test('the picker stays off published and search empty states', () => {
  renderEmpty('published');
  expect(screen.queryByRole('button', { name: /Monthly sales/ })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Paste from a spreadsheet' })).toBeNull();
  cleanup();
  renderEmpty('all', 'revenue');
  expect(screen.queryByRole('button', { name: /Monthly sales/ })).toBeNull();
  expect(screen.getByText('No charts found for "revenue"')).toBeTruthy();
});

test('a failed template save stays on the empty library and can be retried', async () => {
  mocks.createChart.mockRejectedValue(new Error('Monthly chart limit reached'));
  renderEmpty('all');
  fireEvent.click(screen.getByRole('button', { name: /Budget vs actual/ }));
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Monthly chart limit reached');
  expect(screen.getByTestId('path').textContent).toBe('/dashboard');
  expect(screen.getByRole('button', { name: /Budget vs actual/ }).hasAttribute('disabled')).toBe(false);
  expect(useChartStore.getState().documentId).toBeNull();
});
