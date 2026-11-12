import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { InstantChart } from '../src/components/InstantChart';
import { ThemeProvider } from '../src/contexts/ThemeContext';
import { resetHomepageChartReport } from '../src/services/homepageChartEvent';

vi.mock('../src/components/ChartPreview', () => ({
  ChartPreview: () => <div data-testid="live-chart">chart</div>,
}));

vi.mock('../src/services/exportService', () => ({
  exportToPNG: vi.fn(async () => undefined),
}));

const bodies: string[] = [];

beforeEach(() => {
  bodies.length = 0;
  localStorage.clear();
  sessionStorage.clear();
  resetHomepageChartReport();
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }));
  vi.stubGlobal('fetch', (_url: string, init: RequestInit = {}) => {
    bodies.push(String(init.body ?? ''));
    return Promise.resolve(new Response(null, { status: 204 }));
  });
});

afterEach(() => {
  cleanup();
  resetHomepageChartReport();
  vi.unstubAllGlobals();
});

function renderChart(onKeepSignIn = vi.fn(), onRequestAuth = vi.fn()) {
  render(
    <MemoryRouter>
      <ThemeProvider>
        <InstantChart onKeepSignIn={onKeepSignIn} onRequestAuth={onRequestAuth} />
      </ThemeProvider>
    </MemoryRouter>,
  );
  return { onKeepSignIn, onRequestAuth };
}

test('a signed-out download shows Keep this chart once, then sign-in keeps the chart', async () => {
  renderChart();
  await screen.findByTestId('live-chart');
  fireEvent.click(screen.getByRole('button', { name: 'Save & download this chart' }));
  const dialog = await screen.findByRole('dialog', { name: 'Keep this chart' });
  expect(dialog.textContent).toContain('Sign in with Google and this chart is saved to your account.');
  expect(document.querySelector('input[type="email"]')).toBeNull();
  expect(screen.queryByLabelText(/email/i)).toBeNull();
  expect(screen.queryByRole('button', { name: /apple/i })).toBeNull();
  await waitFor(() => expect(bodies).toContain('{"kind":"keep_shown"}'));
  expect(sessionStorage.getItem('chartsuno.keepPromptSeen')).toBe('1');
  expect(localStorage.getItem('chartsuno.pendingChart')).toContain('Monthly sales');

  fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
  expect(screen.queryByRole('dialog')).toBeNull();

  fireEvent.click(screen.getByRole('button', { name: 'Save & download this chart' }));
  await waitFor(() => expect(bodies.filter((body) => body.includes('keep_shown'))).toHaveLength(1));
  expect(screen.queryByRole('dialog')).toBeNull();

  sessionStorage.removeItem('chartsuno.keepPromptSeen');
  resetHomepageChartReport();
  cleanup();
  const again = renderChart();
  await screen.findByTestId('live-chart');
  fireEvent.click(screen.getByRole('button', { name: 'Save & download this chart' }));
  await screen.findByRole('dialog', { name: 'Keep this chart' });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in with Google' }));
  expect(again.onKeepSignIn).toHaveBeenCalledOnce();
  expect(sessionStorage.getItem('chartsuno.keepPromptArmed')).toBe('1');
  expect(bodies.filter((body) => body.includes('keep_click'))).toHaveLength(1);
  const pending = JSON.parse(localStorage.getItem('chartsuno.pendingChart') || '{}') as { payload?: { title?: string } };
  expect(pending.payload?.title).toBe('Monthly sales');
});
