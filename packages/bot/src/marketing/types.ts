import type { ChartData, ChartConfig } from '@chartsuno/shared';
import type { VideoProject } from './video/types.js';

// ─── Hook Types ────────────────────────────────────────────────────

export type HookCategory = 'person-conflict' | 'budget-pain' | 'curiosity-discovery';

export interface HookTemplate {
  id: string;
  category: HookCategory;
  /** Template string with {variable} placeholders */
  template: string;
  variables: Record<string, string[]>;
}

export interface ResolvedHook {
  id: string;
  category: HookCategory;
  text: string;
}

// ─── Slide Types ───────────────────────────────────────────────────

export type SlideRole = 'hook' | 'problem' | 'discovery' | 'transform1' | 'transform2' | 'cta';
export type ImageSource = 'ai-generated' | 'screenshot';

export interface ScreenshotConfig {
  variant: 'ugly-before' | 'beautiful-after' | 'feature-showcase';
  chartData?: ChartData;
  chartConfig?: ChartConfig;
}

export interface SlideContent {
  slideNumber: 1 | 2 | 3 | 4 | 5 | 6;
  role: SlideRole;
  headlineText: string;
  subText?: string;
  imageSource: ImageSource;
  imagePrompt?: string;
  screenshotConfig?: ScreenshotConfig;
}

export interface GeneratedSlide {
  slideNumber: number;
  imagePath: string;
  overlayApplied: boolean;
}

// ─── Deck Types ────────────────────────────────────────────────────

export type DeckStatus = 'draft' | 'ready' | 'posted-x' | 'posted-tiktok' | 'posted-both';

export interface CarouselDeck {
  id: string;
  createdAt: string;
  hookId: string;
  hookCategory: HookCategory;
  hookText: string;
  ctaText: string;
  slides: SlideContent[];
  generatedImages: GeneratedSlide[];
  status: DeckStatus;
  caption?: string;
}

// ─── Platform Types ────────────────────────────────────────────────

export type Platform = 'x' | 'tiktok';

export type PostFormat = 'carousel' | 'video';

export interface PostResult {
  platform: Platform;
  postId: string;
  url?: string;
  postedAt: string;
  deckId: string;
  videoId?: string;
  format: PostFormat;
}

// ─── Analytics Types ───────────────────────────────────────────────

export type PerformanceQuadrant = 'SCALE' | 'FIX_CTA' | 'FIX_HOOKS' | 'FULL_RESET';

export interface PostMetrics {
  postId: string;
  platform: Platform;
  deckId: string;
  hookId: string;
  hookCategory: HookCategory;
  ctaText: string;
  views: number;
  engagements: number;
  conversions: number;
  postedAt: string;
  lastCheckedAt: string;
}

export interface HookPerformance {
  hookId: string;
  hookCategory: HookCategory;
  totalUses: number;
  avgViews: number;
  avgEngagementRate: number;
  avgConversionRate: number;
  quadrant: PerformanceQuadrant;
  lastUsedAt: string;
}

export interface DailyReport {
  date: string;
  totalPosts: number;
  totalViews: number;
  totalEngagements: number;
  totalConversions: number;
  bestPerformingHook: HookPerformance | null;
  worstPerformingHook: HookPerformance | null;
  recommendations: string[];
  quadrantBreakdown: Record<PerformanceQuadrant, number>;
}

// ─── State ─────────────────────────────────────────────────────────

export interface MarketingState {
  decks: CarouselDeck[];
  videos: VideoProject[];
  posts: PostResult[];
  metrics: PostMetrics[];
  hookPerformance: HookPerformance[];
  lastDailyReport: string | null;
}

export type { VideoProject } from './video/types.js';
