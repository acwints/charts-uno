import type { ResolvedHook, SlideContent } from '../types.js';

/**
 * Plans 6 slides following the Larry methodology:
 * 1. Hook — AI-generated lifestyle/emotion background
 * 2. Problem — ugly "before" chart screenshot
 * 3. Discovery — ChartsUno feature showcase
 * 4. Transform 1 — beautiful "after" chart
 * 5. Transform 2 — different chart type, also beautiful
 * 6. CTA — AI-generated clean gradient background
 */
export function planSlides(hook: ResolvedHook, ctaUrl: string): SlideContent[] {
  return [
    {
      slideNumber: 1,
      role: 'hook',
      headlineText: hook.text,
      imageSource: 'ai-generated',
      imagePrompt: buildHookImagePrompt(hook),
    },
    {
      slideNumber: 2,
      role: 'problem',
      headlineText: 'This is what most\npeople deal with',
      subText: 'Ugly default charts nobody wants to present',
      imageSource: 'screenshot',
      screenshotConfig: { variant: 'ugly-before' },
    },
    {
      slideNumber: 3,
      role: 'discovery',
      headlineText: 'Then I found\nChartsUno',
      imageSource: 'screenshot',
      screenshotConfig: { variant: 'feature-showcase' },
    },
    {
      slideNumber: 4,
      role: 'transform1',
      headlineText: 'Same data.\nCompletely different.',
      imageSource: 'screenshot',
      screenshotConfig: { variant: 'beautiful-after' },
    },
    {
      slideNumber: 5,
      role: 'transform2',
      headlineText: 'Every chart type.\nEvery style.',
      imageSource: 'screenshot',
      screenshotConfig: { variant: 'beautiful-after' },
    },
    {
      slideNumber: 6,
      role: 'cta',
      headlineText: 'Try it free',
      subText: ctaUrl,
      imageSource: 'ai-generated',
      imagePrompt: 'Clean minimal dark gradient background, deep navy to black, subtle geometric glow accents, professional app interface aesthetic. No text, no UI elements. Abstract and premium. Portrait orientation.',
    },
  ];
}

function buildHookImagePrompt(hook: ResolvedHook): string {
  const baseContext = hook.category === 'person-conflict'
    ? 'iPhone photo of a professional at their desk, looking frustrated at a laptop screen showing a messy spreadsheet with ugly charts. Modern open-plan office, natural window lighting from the left.'
    : hook.category === 'budget-pain'
      ? 'iPhone photo of a person working late at a small home desk, laptop open with multiple browser tabs visible. Warm desk lamp lighting, small apartment setting, coffee mug nearby.'
      : 'iPhone photo of a clean modern workspace with a large monitor showing a beautiful data dashboard. Minimalist desk setup, natural daylight, plant in corner.';

  return `${baseContext} Photorealistic, natural phone camera quality, slight depth of field. No text overlays. Portrait orientation 9:16.`;
}
