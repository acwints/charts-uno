import type { HookTemplate, HookCategory, ResolvedHook, MarketingState } from '../types.js';

// ─── Category weights for random selection ─────────────────────────

const CATEGORY_WEIGHTS: Record<HookCategory, number> = {
  'person-conflict': 0.5,
  'budget-pain': 0.3,
  'curiosity-discovery': 0.2,
};

// ─── Hook Template Library ─────────────────────────────────────────

export const HOOK_LIBRARY: HookTemplate[] = [
  // Person + Conflict (highest performing)
  {
    id: 'pc-boss-charts',
    category: 'person-conflict',
    template: 'My boss said my charts look like they\'re from {year}',
    variables: { year: ['2005', '2003', '1999'] },
  },
  {
    id: 'pc-coworker-hours',
    category: 'person-conflict',
    template: 'My coworker spent {time} making charts so I showed him this',
    variables: { time: ['3 hours', '4 hours', 'all morning'] },
  },
  {
    id: 'pc-investor-deck',
    category: 'person-conflict',
    template: 'My investor said our deck looks unprofessional so I showed her this',
    variables: {},
  },
  {
    id: 'pc-client-ugly',
    category: 'person-conflict',
    template: 'My client said the charts look {adjective} so I rebuilt them in 2 minutes',
    variables: { adjective: ['ugly', 'amateur', 'like a school project'] },
  },
  {
    id: 'pc-designer-friend',
    category: 'person-conflict',
    template: 'My designer friend roasted my dashboard so I showed them this',
    variables: {},
  },
  {
    id: 'pc-manager-redo',
    category: 'person-conflict',
    template: 'My manager asked me to redo all our charts before the board meeting',
    variables: {},
  },
  {
    id: 'pc-cto-data',
    category: 'person-conflict',
    template: 'Our CTO said "nobody reads your charts" so I changed how they look',
    variables: {},
  },

  // Budget Pain
  {
    id: 'bp-hours-charts',
    category: 'budget-pain',
    template: 'I was spending {time} on charts until I found this',
    variables: { time: ['4 hours', '3 hours every week', 'half my day'] },
  },
  {
    id: 'bp-pov-budget',
    category: 'budget-pain',
    template: 'POV: You need beautiful charts but can\'t afford a designer',
    variables: {},
  },
  {
    id: 'bp-excel-pain',
    category: 'budget-pain',
    template: 'I\'m done fighting with Excel charts. There\'s a better way.',
    variables: {},
  },
  {
    id: 'bp-free-vs-paid',
    category: 'budget-pain',
    template: 'Why I stopped paying {amount} for chart tools',
    variables: { amount: ['$50/month', '$30/month'] },
  },
  {
    id: 'bp-startup-budget',
    category: 'budget-pain',
    template: 'Startup budget but enterprise-looking charts? Here\'s how.',
    variables: {},
  },
  {
    id: 'bp-manual-work',
    category: 'budget-pain',
    template: 'Stop manually styling every single chart. I found a shortcut.',
    variables: {},
  },

  // Curiosity / Discovery
  {
    id: 'cd-nobody-talking',
    category: 'curiosity-discovery',
    template: 'The chart tool no one is talking about',
    variables: {},
  },
  {
    id: 'cd-same-charts',
    category: 'curiosity-discovery',
    template: 'Why do all my charts look the same? I finally fixed it.',
    variables: {},
  },
  {
    id: 'cd-before-after',
    category: 'curiosity-discovery',
    template: 'Same data. Completely different chart. Watch this.',
    variables: {},
  },
  {
    id: 'cd-one-click',
    category: 'curiosity-discovery',
    template: 'One click changed how my entire dashboard looks',
    variables: {},
  },
  {
    id: 'cd-chart-glow-up',
    category: 'curiosity-discovery',
    template: 'Giving my boring charts a glow up',
    variables: {},
  },
  {
    id: 'cd-default-charts',
    category: 'curiosity-discovery',
    template: 'Default charts are killing your credibility. Here\'s the fix.',
    variables: {},
  },
];

// ─── Hook Resolution ───────────────────────────────────────────────

function resolveTemplate(template: HookTemplate): ResolvedHook {
  let text = template.template;

  for (const [key, options] of Object.entries(template.variables)) {
    if (options.length > 0) {
      const pick = options[Math.floor(Math.random() * options.length)];
      text = text.replaceAll(`{${key}}`, pick);
    }
  }

  return {
    id: template.id,
    category: template.category,
    text,
  };
}

// ─── Hook Selection ────────────────────────────────────────────────

function weightedRandomCategory(): HookCategory {
  const roll = Math.random();
  let cumulative = 0;

  for (const [category, weight] of Object.entries(CATEGORY_WEIGHTS)) {
    cumulative += weight;
    if (roll <= cumulative) return category as HookCategory;
  }

  return 'person-conflict';
}

export function selectHook(
  state: MarketingState,
  preferredCategory?: HookCategory,
): ResolvedHook {
  const category = preferredCategory ?? weightedRandomCategory();

  // Get hooks in this category, excluding those in FULL_RESET quadrant
  const fullResetHookIds = new Set(
    state.hookPerformance
      .filter((hp) => hp.quadrant === 'FULL_RESET')
      .map((hp) => hp.hookId),
  );

  const candidates = HOOK_LIBRARY.filter(
    (h) => h.category === category && !fullResetHookIds.has(h.id),
  );

  // If all hooks in category are in FULL_RESET, fall back to any category
  const pool = candidates.length > 0
    ? candidates
    : HOOK_LIBRARY.filter((h) => !fullResetHookIds.has(h.id));

  // Bias away from recently-used hooks
  const recentDeckHookIds = new Set(
    state.decks.slice(-10).map((d) => d.hookId),
  );

  const fresh = pool.filter((h) => !recentDeckHookIds.has(h.id));
  const finalPool = fresh.length > 0 ? fresh : pool;

  // Pick random from pool
  const pick = finalPool[Math.floor(Math.random() * finalPool.length)] ?? HOOK_LIBRARY[0];
  return resolveTemplate(pick);
}
