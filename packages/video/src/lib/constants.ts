/** Video output dimensions — 9:16 portrait for TikTok / Reels / Shorts */
export const VIDEO_WIDTH = 1080;
export const VIDEO_HEIGHT = 1920;
export const FPS = 30;

/** Scene durations in seconds */
export const SCENE_DURATIONS = {
  hook: 3,
  problem: 5,
  transform: 6,
  showcase: 4,
  cta: 4,
} as const;

/** Total video duration in seconds */
export const TOTAL_DURATION =
  SCENE_DURATIONS.hook +
  SCENE_DURATIONS.problem +
  SCENE_DURATIONS.transform +
  SCENE_DURATIONS.showcase +
  SCENE_DURATIONS.cta;

/** Convert seconds to frames */
export function secondsToFrames(seconds: number): number {
  return Math.round(seconds * FPS);
}

/** Composition IDs used by Remotion */
export const COMP_IDS = {
  hookReveal: 'HookReveal',
  chartTransform: 'ChartTransform',
  ctaSlide: 'CTASlide',
  fullVideo: 'FullVideo',
  browserScreenshots: 'BrowserScreenshots',
} as const;
