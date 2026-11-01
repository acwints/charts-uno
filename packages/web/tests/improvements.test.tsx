import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';
import { ImprovementsBox } from '../src/components/Improvements/ImprovementsBox';
import { ChangelogPage } from '../src/pages/ChangelogPage';

const mocks = vi.hoisted(() => ({
  submitImprovement: vi.fn(),
  getShippedImprovements: vi.fn(),
  getShippedCount: vi.fn(),
}));

vi.mock('../src/services/api', () => mocks);

afterEach(() => {
  cleanup();
  document.title = 'Chartsuno — Transform Your Data';
});

test('the improvements bar opens one note and sends it with Enter', async () => {
  mocks.submitImprovement.mockResolvedValue({ ok: true });
  render(
    <MemoryRouter initialEntries={['/feed']}>
      <Routes>
        <Route path="/feed" element={<ImprovementsBox />} />
      </Routes>
    </MemoryRouter>,
  );

  expect(screen.getByRole('button', { name: /Improvements/ })).toBeTruthy();
  expect(screen.getByText('How should Chartsuno be different?')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /Improvements/ }));
  const note = screen.getByRole('textbox', { name: 'How should Chartsuno be different?' });
  fireEvent.change(note, { target: { value: 'Darker grids' } });
  fireEvent.keyDown(note, { key: 'Enter' });

  expect(mocks.submitImprovement).toHaveBeenCalledWith({
    message: 'Darker grids',
    email: undefined,
    page_path: '/feed',
    website: '',
  });
  expect((await screen.findByRole('status')).textContent).toBe('In the queue.');
});

test('changelog is titled from shipped feedback and hides the raw note', async () => {
  mocks.getShippedImprovements.mockResolvedValue({
    items: [{ id: '1', public_note: 'Darker grids', shipped_at: '2026-11-01T15:00:00' }],
  });
  mocks.getShippedCount.mockResolvedValue({ count: 1 });
  render(
    <MemoryRouter>
      <ChangelogPage />
    </MemoryRouter>,
  );

  expect(await screen.findByRole('heading', { name: 'Shipped from your feedback' })).toBeTruthy();
  expect(document.title).toBe('Shipped from your feedback');
  expect(screen.getByText('1 shipped')).toBeTruthy();
  expect(screen.getByText('Darker grids')).toBeTruthy();
  expect(screen.getByText('Nov 1, 2026')).toBeTruthy();
  expect(screen.queryByText(/RAW-SECRET/)).toBeNull();
});
