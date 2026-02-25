import type {
  PostMetrics,
  HookPerformance,
  PerformanceQuadrant,
  MarketingState,
} from '../types.js';

const VIEW_THRESHOLD = 1000;
const CONVERSION_RATE_THRESHOLD = 0.02;

/**
 * Classify a post's performance into one of the four Larry quadrants.
 */
export function classifyPerformance(metrics: PostMetrics): PerformanceQuadrant {
  const conversionRate = metrics.views > 0 ? metrics.conversions / metrics.views : 0;
  const highViews = metrics.views >= VIEW_THRESHOLD;
  const highConversion = conversionRate >= CONVERSION_RATE_THRESHOLD;

  if (highViews && highConversion) return 'SCALE';
  if (highViews && !highConversion) return 'FIX_CTA';
  if (!highViews && highConversion) return 'FIX_HOOKS';
  return 'FULL_RESET';
}

/**
 * Get actionable recommendation text for a quadrant.
 */
export function getQuadrantAdvice(quadrant: PerformanceQuadrant): string {
  switch (quadrant) {
    case 'SCALE':
      return 'This hook is working. Make 3 variations and increase posting frequency.';
    case 'FIX_CTA':
      return 'Hook is driving views but not conversions. Test different CTAs on slide 6. Don\'t touch the hook.';
    case 'FIX_HOOKS':
      return 'People who see it convert, but not enough people see it. Try different hook categories and posting times.';
    case 'FULL_RESET':
      return 'Neither views nor conversions are working. Try a completely different format and hook category.';
  }
}

/**
 * Update aggregated hook performance based on new post metrics.
 */
export function updateHookPerformance(
  state: MarketingState,
  newMetrics: PostMetrics,
): HookPerformance {
  const existing = state.hookPerformance.find((hp) => hp.hookId === newMetrics.hookId);

  if (existing) {
    const n = existing.totalUses;
    const engagementRate = newMetrics.views > 0
      ? newMetrics.engagements / newMetrics.views
      : 0;
    const conversionRate = newMetrics.views > 0
      ? newMetrics.conversions / newMetrics.views
      : 0;

    // Rolling average
    const updated: HookPerformance = {
      ...existing,
      totalUses: n + 1,
      avgViews: (existing.avgViews * n + newMetrics.views) / (n + 1),
      avgEngagementRate: (existing.avgEngagementRate * n + engagementRate) / (n + 1),
      avgConversionRate: (existing.avgConversionRate * n + conversionRate) / (n + 1),
      lastUsedAt: newMetrics.postedAt,
      quadrant: classifyPerformance({
        ...newMetrics,
        views: (existing.avgViews * n + newMetrics.views) / (n + 1),
      }),
    };

    // Replace in state
    const idx = state.hookPerformance.indexOf(existing);
    state.hookPerformance[idx] = updated;
    return updated;
  }

  // New hook
  const engagementRate = newMetrics.views > 0
    ? newMetrics.engagements / newMetrics.views
    : 0;
  const conversionRate = newMetrics.views > 0
    ? newMetrics.conversions / newMetrics.views
    : 0;

  const fresh: HookPerformance = {
    hookId: newMetrics.hookId,
    hookCategory: newMetrics.hookCategory,
    totalUses: 1,
    avgViews: newMetrics.views,
    avgEngagementRate: engagementRate,
    avgConversionRate: conversionRate,
    quadrant: classifyPerformance(newMetrics),
    lastUsedAt: newMetrics.postedAt,
  };

  state.hookPerformance.push(fresh);
  return fresh;
}
