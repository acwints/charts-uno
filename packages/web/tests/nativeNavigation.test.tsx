import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { useInputDraftState } from '../src/hooks/useInputDraftState';
import { useNativeScrollRestoration } from '../src/hooks/useNativeScrollRestoration';
import { clearNativeNavigationSession, nativeInputDrafts, nativeFeedPages, nativeScrollPositions } from '../src/services/nativeNavigationSession';
import { hasUnsavedChartChanges, useChartStore } from '../src/stores/chartStore';
vi.mock('../src/services/native', () => ({ isNativeApp: () => true }));
beforeEach(() => { clearNativeNavigationSession(); useChartStore.getState().reset(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test('input drafts survive unmount and late callbacks cannot repopulate a signed-out session', () => {
  const first = renderHook(() => useInputDraftState('paste', ''));
  act(() => first.result.current[1]('Quarter,Revenue\nQ1,20'));
  first.unmount();
  const second = renderHook(() => useInputDraftState('paste', ''));
  expect(second.result.current[0]).toBe('Quarter,Revenue\nQ1,20');
  clearNativeNavigationSession();
  act(() => second.result.current[1]('late response'));
  expect(nativeInputDrafts.size).toBe(0);
  second.unmount();
  const third = renderHook(() => useInputDraftState('paste', ''));
  expect(third.result.current[0]).toBe('');
});

test('configuration-only changes are dirty and a save acknowledges only its captured version', () => {
  const state = useChartStore.getState();
  const data = { labels: ['Q1'], series: [{ name: 'Revenue', data: [20] }], sourceType: 'paste' as const };
  const config = { ...state.chartConfig, title: 'Revenue' };
  state.loadDocument('A', data, config);
  expect(hasUnsavedChartChanges()).toBe(false);
  state.setChartConfig({ ...config, title: 'Edited' });
  expect(hasUnsavedChartChanges()).toBe(true);
  state.markSaved('A', data, config);
  expect(hasUnsavedChartChanges()).toBe(true);
  state.markSaved('A', data, useChartStore.getState().chartConfig);
  expect(hasUnsavedChartChanges()).toBe(false);
});

test('scroll restoration waits for content, records user scrolling and isolates routes', () => {
  let resize = () => {};
  vi.stubGlobal('ResizeObserver', class { constructor(callback: () => void) { resize = callback; } observe() {} disconnect() {} });
  const element = document.createElement('main');
  element.append(document.createElement('div'));
  Object.defineProperty(element, 'clientHeight', { value: 500 });
  let height = 600;
  Object.defineProperty(element, 'scrollHeight', { get: () => height });
  const ref = { current: element };
  nativeScrollPositions.set('user:/feed', 900);
  const hook = renderHook(({ route }) => useNativeScrollRestoration(ref, route, true), { initialProps: { route: 'user:/feed' } });
  height = 2000;
  act(() => resize());
  expect(element.scrollTop).toBe(900);
  element.scrollTop = 1100;
  element.dispatchEvent(new Event('scroll'));
  hook.rerender({ route: 'user:/chart/A' });
  expect(element.scrollTop).toBe(0);
  hook.rerender({ route: 'user:/feed' });
  expect(element.scrollTop).toBe(1100);
  nativeFeedPages.set('user:explore', { charts: [], offset: 40, hasMore: true });
  clearNativeNavigationSession();
  expect(nativeScrollPositions.size).toBe(0);
  expect(nativeFeedPages.size).toBe(0);
});
