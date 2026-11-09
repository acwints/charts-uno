import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { InstantChart } from '../src/components/InstantChart';
import { ThemeProvider } from '../src/contexts/ThemeContext';
import { resetHomepageChartReport } from '../src/services/homepageChartEvent';

vi.mock('../src/components/ChartPreview', () => ({
  ChartPreview: ({ config }: { config: { type: string; title: string } }) => (
    <div data-testid="live-chart">{config.type}|{config.title}</div>
  ),
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

function renderEditor() {
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <InstantChart />
      </ThemeProvider>
    </MemoryRouter>,
  );
}

function starts() {
  return bodies.filter((body) => body.includes('"kind":"start"'));
}

async function shownChart() {
  return waitFor(() => screen.getByTestId('live-chart'));
}

test('loading the sample chart is not a chart start', async () => {
  renderEditor();
  expect((await shownChart()).textContent).toBe('bar|Monthly sales');
  await waitFor(() => expect(bodies).toContain('{"kind":"view"}'));
  expect(starts()).toEqual([]);
  expect(screen.getByRole('button', { name: 'Bar' }).getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByRole('button', { name: 'Monthly sales' }).getAttribute('aria-pressed')).toBe('true');
});

test('a chart-type link selects that chart without counting a start', async () => {
  render(
    <MemoryRouter initialEntries={['/?type=pie']}>
      <ThemeProvider>
        <InstantChart />
      </ThemeProvider>
    </MemoryRouter>,
  );
  await waitFor(() => expect(screen.getByTestId('live-chart').textContent).toBe('pie|Monthly sales'));
  expect(screen.getByRole('button', { name: 'Pie' }).getAttribute('aria-pressed')).toBe('true');
  await waitFor(() => expect(bodies).toContain('{"kind":"view"}'));
  expect(starts()).toEqual([]);
});

test('the first chart-type chip starts a chart once and redraws the sample', async () => {
  renderEditor();
  await shownChart();
  fireEvent.click(screen.getByRole('button', { name: 'Line' }));
  await waitFor(() => expect(screen.getByTestId('live-chart').textContent).toBe('line|Monthly sales'));
  expect(screen.getByRole('button', { name: 'Line' }).getAttribute('aria-pressed')).toBe('true');
  fireEvent.click(screen.getByRole('button', { name: 'Pie' }));
  await waitFor(() => expect(screen.getByTestId('live-chart').textContent).toBe('pie|Monthly sales'));
  expect(starts()).toEqual(['{"kind":"start","source":"sample"}']);
});

test('a sample dataset swaps the data and counts one chart start', async () => {
  renderEditor();
  await shownChart();
  fireEvent.click(screen.getByRole('button', { name: 'Budget' }));
  await waitFor(() => expect(screen.getByTestId('live-chart').textContent).toBe('pie|Monthly budget'));
  expect((screen.getByRole('textbox', { name: 'Paste your data' }) as HTMLTextAreaElement).value).toContain('Rent,1800');
  expect(screen.getByRole('button', { name: 'Budget' }).getAttribute('aria-pressed')).toBe('true');
  fireEvent.click(screen.getByRole('button', { name: 'Website traffic' }));
  await waitFor(() => expect(screen.getByTestId('live-chart').textContent).toBe('line|Website traffic'));
  expect(starts()).toEqual(['{"kind":"start","source":"sample"}']);
});

test('the first focus selects sample text and the edit is the chart start', async () => {
  renderEditor();
  await shownChart();
  const box = screen.getByRole('textbox', { name: 'Paste your data' }) as HTMLTextAreaElement;
  fireEvent.focus(box);
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(box.selectionStart).toBe(0);
  expect(box.selectionEnd).toBe(box.value.length);
  expect(starts()).toEqual([]);

  box.blur();
  box.setSelectionRange(2, 2);
  fireEvent.focus(box);
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(box.selectionStart).toBe(2);

  fireEvent.change(box, { target: { value: 'Month,Sales\nJan,10\nFeb,12\n' } });
  await waitFor(() => expect(screen.getByTestId('live-chart').textContent).toBe('line|Sales'));
  expect(starts()).toEqual(['{"kind":"start","source":"paste"}']);
});

test('Try with your data counts a chart start and Use sample remains after an edit', async () => {
  renderEditor();
  await shownChart();
  fireEvent.click(screen.getByRole('button', { name: 'Try with your data' }));
  expect(starts()).toEqual(['{"kind":"start","source":"paste"}']);
  const box = screen.getByRole('textbox', { name: 'Paste your data' }) as HTMLTextAreaElement;
  fireEvent.change(box, { target: { value: 'Month,Sales\nJan,10\nFeb,12\n' } });
  expect(screen.getByRole('button', { name: 'Use sample' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Use sample' }));
  expect(starts()).toEqual(['{"kind":"start","source":"paste"}']);
  await waitFor(() => expect(screen.getByTestId('live-chart').textContent).toBe('bar|Monthly sales'));
});
