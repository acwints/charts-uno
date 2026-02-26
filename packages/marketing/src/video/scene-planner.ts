import { COMP_IDS, SCENE_DURATIONS } from '../remotion/lib/constants.js';
import { COLOR_PALETTES } from '@chartsuno/shared';
import type { ResolvedHook } from '../types.js';
import { marketingConfig } from '../config.js';
import type { CaptureMethod, ScenePlan } from './types.js';
import { DEFAULT_BAR_DATA, DEFAULT_LINE_DATA, pickBeautifulPalette } from './chart-presets.js';

export interface PlanScenesOptions {
  /** Capture method for chart scenes 2-4 (default: 'remotion') */
  captureMethod?: CaptureMethod;
  /** Override capture URL (default: config captureUrl) */
  captureUrl?: string;
}

/**
 * Plans 5 scenes for a marketing video based on the selected hook.
 *
 * Scene order:
 * 1. Hook — word-by-word text reveal (always Remotion)
 * 2. Problem — ugly default chart
 * 3. Transform — chart morphs ugly → beautiful
 * 4. Showcase — different chart type / color scheme
 * 5. CTA — animated call-to-action (always Remotion)
 *
 * When captureMethod is a browser method, scenes 2-4 get browserCapture
 * config instead of Remotion compositionId/props. Scenes 1 and 5 always
 * use Remotion regardless of capture method.
 */
export function planScenes(
  hook: ResolvedHook,
  ctaUrl: string,
  options: PlanScenesOptions = {},
): ScenePlan[] {
  const captureMethod = options.captureMethod ?? 'remotion';
  const captureUrl = options.captureUrl ?? marketingConfig.marketing.captureUrl;
  const beautifulColors = pickBeautifulPalette(hook.id);

  const useBrowser = captureMethod !== 'remotion';

  return [
    // Scene 1: Hook — always Remotion
    {
      sceneNumber: 1,
      type: 'hook',
      durationSeconds: SCENE_DURATIONS.hook,
      captureMethod: 'remotion',
      compositionId: COMP_IDS.hookReveal,
      props: {
        hookText: hook.text,
      },
    },

    // Scene 2: Problem
    useBrowser
      ? {
          sceneNumber: 2,
          type: 'problem',
          durationSeconds: SCENE_DURATIONS.problem,
          captureMethod,
          browserCapture: {
            url: captureUrl,
            scriptId: 'problem-ugly',
            durationSeconds: SCENE_DURATIONS.problem,
          },
        }
      : {
          sceneNumber: 2,
          type: 'problem',
          durationSeconds: SCENE_DURATIONS.problem,
          captureMethod: 'remotion',
          compositionId: COMP_IDS.chartTransform,
          props: {
            variant: 'before-after',
            barData: DEFAULT_BAR_DATA,
            beautifulColors: DEFAULT_BAR_DATA.colors,
            title: '',
          },
        },

    // Scene 3: Transform
    useBrowser
      ? {
          sceneNumber: 3,
          type: 'transform',
          durationSeconds: SCENE_DURATIONS.transform,
          captureMethod,
          browserCapture: {
            url: captureUrl,
            scriptId: 'transform-ugly-to-beautiful',
            durationSeconds: SCENE_DURATIONS.transform,
          },
        }
      : {
          sceneNumber: 3,
          type: 'transform',
          durationSeconds: SCENE_DURATIONS.transform,
          captureMethod: 'remotion',
          compositionId: COMP_IDS.chartTransform,
          props: {
            variant: 'before-after',
            barData: DEFAULT_BAR_DATA,
            beautifulColors,
            title: 'Q1-Q2 Performance',
          },
        },

    // Scene 4: Showcase
    useBrowser
      ? {
          sceneNumber: 4,
          type: 'showcase',
          durationSeconds: SCENE_DURATIONS.showcase,
          captureMethod,
          browserCapture: {
            url: captureUrl,
            scriptId: 'showcase-features',
            durationSeconds: SCENE_DURATIONS.showcase,
          },
        }
      : {
          sceneNumber: 4,
          type: 'showcase',
          durationSeconds: SCENE_DURATIONS.showcase,
          captureMethod: 'remotion',
          compositionId: COMP_IDS.chartTransform,
          props: {
            variant: 'line-showcase',
            barData: DEFAULT_BAR_DATA,
            lineData: DEFAULT_LINE_DATA,
            beautifulColors: COLOR_PALETTES.cool,
            title: 'Growth Trends',
          },
        },

    // Scene 5: CTA — always Remotion
    {
      sceneNumber: 5,
      type: 'cta',
      durationSeconds: SCENE_DURATIONS.cta,
      captureMethod: 'remotion',
      compositionId: COMP_IDS.ctaSlide,
      props: {
        ctaText: 'Try it free',
        ctaUrl,
      },
    },
  ];
}
