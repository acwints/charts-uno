import { writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { marketingConfig, logger } from '../config.js';
import { loadMarketingState, saveMarketingState } from '../state.js';
import { classifyPerformance, getQuadrantAdvice } from './tracker.js';
import type { DailyReport, PerformanceQuadrant, MarketingState } from '../types.js';

interface UploadPostAnalytics {
  followers?: number;
  impressions?: number;
  reach?: number;
  profile_views?: number;
}

/**
 * Fetch platform analytics from Upload-Post API.
 */
async function fetchUploadPostAnalytics(profile: string): Promise<UploadPostAnalytics | null> {
  const { uploadPostApiKey, uploadPostApiUrl } = marketingConfig.marketing;
  if (!uploadPostApiKey || !profile) return null;

  try {
    const response = await fetch(
      `${uploadPostApiUrl}/api/analytics/${profile}?platforms=tiktok`,
      { headers: { 'Authorization': `Apikey ${uploadPostApiKey}` } },
    );

    if (!response.ok) {
      logger.warn({ status: response.status }, 'Failed to fetch Upload-Post analytics');
      return null;
    }

    return (await response.json()) as UploadPostAnalytics;
  } catch (error) {
    logger.warn({ error }, 'Error fetching Upload-Post analytics');
    return null;
  }
}

/**
 * Generate a daily marketing performance report.
 */
export async function generateDailyReport(days = 3): Promise<DailyReport> {
  const state = await loadMarketingState();
  const now = new Date();
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  // Filter metrics to recent window
  const recentMetrics = state.metrics.filter(
    (m) => new Date(m.lastCheckedAt) >= cutoff,
  );

  // Aggregate
  const totalViews = recentMetrics.reduce((sum, m) => sum + m.views, 0);
  const totalEngagements = recentMetrics.reduce((sum, m) => sum + m.engagements, 0);
  const totalConversions = recentMetrics.reduce((sum, m) => sum + m.conversions, 0);

  // Quadrant breakdown
  const quadrantBreakdown: Record<PerformanceQuadrant, number> = {
    SCALE: 0, FIX_CTA: 0, FIX_HOOKS: 0, FULL_RESET: 0,
  };
  for (const m of recentMetrics) {
    quadrantBreakdown[classifyPerformance(m)] += 1;
  }

  // Best/worst hooks
  const sortedHooks = [...state.hookPerformance].sort((a, b) => b.avgViews - a.avgViews);
  const bestPerformingHook = sortedHooks[0] ?? null;
  const worstPerformingHook = sortedHooks.at(-1) ?? null;

  // Build recommendations
  const recommendations = buildRecommendations(state, quadrantBreakdown);

  const report: DailyReport = {
    date: now.toISOString().split('T')[0],
    totalPosts: recentMetrics.length,
    totalViews,
    totalEngagements,
    totalConversions,
    bestPerformingHook,
    worstPerformingHook,
    recommendations,
    quadrantBreakdown,
  };

  // Fetch Upload-Post analytics
  const analytics = await fetchUploadPostAnalytics(marketingConfig.marketing.tiktokProfile);

  // Save report as markdown
  const reportDir = resolve(marketingConfig.marketing.slidesDir, '..', 'reports');
  await mkdir(reportDir, { recursive: true });
  const reportPath = join(reportDir, `${report.date}.md`);
  await writeFile(reportPath, formatReportMarkdown(report, analytics), 'utf-8');

  // Update state
  state.lastDailyReport = report.date;
  await saveMarketingState(state);

  logger.info({ reportPath, totalPosts: report.totalPosts }, 'Daily report generated');
  return report;
}

function buildRecommendations(
  state: MarketingState,
  quadrants: Record<PerformanceQuadrant, number>,
): string[] {
  const recs: string[] = [];

  if (state.metrics.length === 0) {
    recs.push('No post data yet. Generate your first deck and start posting.');
    return recs;
  }

  // Quadrant-based recommendations
  const dominant = (Object.entries(quadrants) as [PerformanceQuadrant, number][])
    .sort((a, b) => b[1] - a[1])[0];

  if (dominant && dominant[1] > 0) {
    recs.push(`Most posts are in ${dominant[0]} quadrant: ${getQuadrantAdvice(dominant[0])}`);
  }

  // Hook category diversity
  const categoriesUsed = new Set(state.decks.slice(-10).map((d) => d.hookCategory));
  if (categoriesUsed.size === 1) {
    recs.push('You\'re only using one hook category. Try mixing in person-conflict or curiosity hooks for variety.');
  }

  // Posting frequency
  const recentDecks = state.decks.filter(
    (d) => new Date(d.createdAt) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  );
  if (recentDecks.length < 7) {
    recs.push(`Only ${recentDecks.length} decks created this week. Aim for at least 1 per day for consistency.`);
  }

  return recs;
}

function formatReportMarkdown(report: DailyReport, analytics: UploadPostAnalytics | null): string {
  const lines: string[] = [
    `# Marketing Report — ${report.date}`,
    '',
    '## Summary',
    `- **Posts tracked:** ${report.totalPosts}`,
    `- **Total views:** ${report.totalViews.toLocaleString()}`,
    `- **Total engagements:** ${report.totalEngagements.toLocaleString()}`,
    `- **Total conversions:** ${report.totalConversions.toLocaleString()}`,
    '',
  ];

  if (analytics) {
    lines.push(
      '## Platform Analytics (Upload-Post)',
      `- Followers: ${analytics.followers ?? 'N/A'}`,
      `- Impressions: ${analytics.impressions ?? 'N/A'}`,
      `- Reach: ${analytics.reach ?? 'N/A'}`,
      `- Profile views: ${analytics.profile_views ?? 'N/A'}`,
      '',
    );
  }

  lines.push(
    '## Quadrant Breakdown',
    `| Quadrant | Count |`,
    `|----------|-------|`,
    `| SCALE | ${report.quadrantBreakdown.SCALE} |`,
    `| FIX_CTA | ${report.quadrantBreakdown.FIX_CTA} |`,
    `| FIX_HOOKS | ${report.quadrantBreakdown.FIX_HOOKS} |`,
    `| FULL_RESET | ${report.quadrantBreakdown.FULL_RESET} |`,
    '',
  );

  if (report.bestPerformingHook) {
    lines.push(
      '## Best Hook',
      `- **ID:** ${report.bestPerformingHook.hookId}`,
      `- **Category:** ${report.bestPerformingHook.hookCategory}`,
      `- **Avg views:** ${Math.round(report.bestPerformingHook.avgViews).toLocaleString()}`,
      `- **Quadrant:** ${report.bestPerformingHook.quadrant}`,
      '',
    );
  }

  lines.push(
    '## Recommendations',
    ...report.recommendations.map((r) => `- ${r}`),
    '',
  );

  return lines.join('\n');
}
