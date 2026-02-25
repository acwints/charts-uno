import { COMP_IDS, SCENE_DURATIONS } from '@chartsuno/video';
import { COLOR_PALETTES } from '@chartsuno/shared';
import type { ResolvedHook } from '../types.js';
import type { ScenePlan } from './types.js';
import { DEFAULT_BAR_DATA, DEFAULT_LINE_DATA, pickBeautifulPalette } from './chart-presets.js';

/**
 * Plans 5 scenes for a marketing video based on the selected hook.
 *
 * Scene order:
 * 1. Hook — word-by-word text reveal
 * 2. Problem — ugly grey bar chart builds up
 * 3. Transform — chart morphs ugly → beautiful
 * 4. Showcase — line chart in a different color scheme
 * 5. CTA — animated call-to-action
 */
export function planScenes(hook: ResolvedHook, ctaUrl: string): ScenePlan[] {
  const beautifulColors = pickBeautifulPalette();

  return [
    {
      sceneNumber: 1,
      type: 'hook',
      durationSeconds: SCENE_DURATIONS.hook,
      compositionId: COMP_IDS.hookReveal,
      props: {
        hookText: hook.text,
      },
    },
    {
      sceneNumber: 2,
      type: 'problem',
      durationSeconds: SCENE_DURATIONS.problem,
      compositionId: COMP_IDS.chartTransform,
      props: {
        variant: 'before-after',
        barData: DEFAULT_BAR_DATA,
        beautifulColors: DEFAULT_BAR_DATA.colors, // stays ugly — no morph in problem scene
        title: '',
      },
    },
    {
      sceneNumber: 3,
      type: 'transform',
      durationSeconds: SCENE_DURATIONS.transform,
      compositionId: COMP_IDS.chartTransform,
      props: {
        variant: 'before-after',
        barData: DEFAULT_BAR_DATA,
        beautifulColors,
        title: 'Q1-Q2 Performance',
      },
    },
    {
      sceneNumber: 4,
      type: 'showcase',
      durationSeconds: SCENE_DURATIONS.showcase,
      compositionId: COMP_IDS.chartTransform,
      props: {
        variant: 'line-showcase',
        barData: DEFAULT_BAR_DATA,
        lineData: DEFAULT_LINE_DATA,
        beautifulColors: COLOR_PALETTES.cool,
        title: 'Growth Trends',
      },
    },
    {
      sceneNumber: 5,
      type: 'cta',
      durationSeconds: SCENE_DURATIONS.cta,
      compositionId: COMP_IDS.ctaSlide,
      props: {
        ctaText: 'Try it free',
        ctaUrl,
      },
    },
  ];
}
