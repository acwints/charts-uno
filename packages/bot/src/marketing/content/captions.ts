import type { ResolvedHook, Platform } from '../types.js';

const HASHTAGS_X = '#dataviz #charts #startup #design';
const HASHTAGS_TIKTOK = '#dataviz #charts #startup #techtok #productivityhack #fyp';

/**
 * Generate a platform-appropriate caption for a carousel post.
 */
export function generateCaption(hook: ResolvedHook, platform: Platform, ctaUrl: string): string {
  if (platform === 'x') {
    return generateXCaption(hook, ctaUrl);
  }
  return generateTikTokCaption(hook, ctaUrl);
}

function generateXCaption(hook: ResolvedHook, ctaUrl: string): string {
  const lines = [
    hook.text,
    '',
    'Same data — completely different impact.',
    `Try ChartsUno free: ${ctaUrl}`,
    '',
    HASHTAGS_X,
  ];
  return lines.join('\n');
}

function generateTikTokCaption(hook: ResolvedHook, ctaUrl: string): string {
  const stories: Record<string, string> = {
    'person-conflict': `${hook.text} 😭 I was so tired of presenting charts that looked like they came from a 2005 spreadsheet. Every time I shared a report, I could see people zone out. So I found this app called ChartsUno that turns your boring data into actually beautiful charts — you just paste your data and pick a style. I tried the dark theme and the editorial look and honestly?? I can't go back to default charts ever again.`,
    'budget-pain': `${hook.text} 😩 I know the struggle — you want clean, professional charts but hiring a designer for every report isn't realistic. ChartsUno lets you transform your data into beautiful visualizations in seconds. Just paste your data, pick a color scheme, and done. No design skills needed, no expensive tools.`,
    'curiosity-discovery': `${hook.text} 👀 I stumbled on ChartsUno and it completely changed how I present data. You just paste your data, choose a style, and get charts that actually look like they belong in a pitch deck. The before/after difference is wild.`,
  };

  const story = stories[hook.category] ?? stories['curiosity-discovery'];

  return `${story}\n\nLink in bio ${HASHTAGS_TIKTOK}`;
}
