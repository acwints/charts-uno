import type { ChartResponse } from './api';

// Memory only: navigation continuity within the signed-in session, not a
// second persistent copy of private chart data on disk.
export const nativeScrollPositions = new Map<string, number>();
export const nativeFeedPages = new Map<string, { charts: ChartResponse[]; offset: number; hasMore: boolean }>();
export const nativeInputDrafts = new Map<string, unknown>();
export let nativeSessionGeneration = 0;
export function clearNativeNavigationSession() {
  nativeSessionGeneration++;
  nativeScrollPositions.clear();
  nativeFeedPages.clear();
  nativeInputDrafts.clear();
}
