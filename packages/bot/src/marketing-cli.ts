import { randomUUID } from 'node:crypto';
import {
  validateMarketingConfig,
  loadMarketingState,
  updateMarketingState,
  selectHook,
  planSlides,
  generateCaption,
  composeDeck,
  postToX,
  postToTikTok,
  generateDailyReport,
  marketingConfig,
} from './marketing/index.js';
import { logger } from './marketing/config.js';
import type { HookCategory, CarouselDeck } from './marketing/types.js';

// ─── CLI Argument Parsing ──────────────────────────────────────────

const args = process.argv.slice(2);
const command = args[0];

function getFlag(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : undefined;
}

function hasFlag(name: string): boolean {
  return args.includes(`--${name}`);
}

const COMMANDS: Record<string, string> = {
  generate: 'Generate a new 6-slide carousel deck',
  'post-x': 'Post a deck to X/Twitter',
  'post-tiktok': 'Post a deck to TikTok via Upload-Post',
  'post-all': 'Post to both X and TikTok',
  analytics: 'Check analytics for recent posts',
  report: 'Generate daily performance report',
  list: 'List all decks and their status',
};

function printUsage(): void {
  console.log('Usage: pnpm --filter @chartsuno/bot marketing -- <command> [options]\n');
  console.log('Commands:');
  for (const [cmd, desc] of Object.entries(COMMANDS)) {
    console.log(`  ${cmd.padEnd(14)} ${desc}`);
  }
  console.log('\nOptions:');
  console.log('  --hook-category <category>  Force hook category (person-conflict|budget-pain|curiosity-discovery)');
  console.log('  --deck <id|latest>          Select deck by ID or "latest"');
  console.log('  --days <n>                  Analytics window in days (default: 3)');
  console.log('  --dry-run                   Skip actual API calls');
}

// ─── Helpers ───────────────────────────────────────────────────────

async function resolveDeck(): Promise<CarouselDeck> {
  const state = await loadMarketingState();
  const deckArg = getFlag('deck') ?? 'latest';

  let deck: CarouselDeck | undefined;
  if (deckArg === 'latest') {
    deck = state.decks.at(-1);
  } else {
    deck = state.decks.find((d) => d.id === deckArg);
  }

  if (!deck) {
    throw new Error(`No deck found for "${deckArg}". Run "generate" first.`);
  }

  return deck;
}

// ─── Commands ──────────────────────────────────────────────────────

async function cmdGenerate(): Promise<void> {
  validateMarketingConfig();
  const dryRun = hasFlag('dry-run');
  const state = await loadMarketingState();

  // Select hook
  const hookCategory = getFlag('hook-category') as HookCategory | undefined;
  const hook = selectHook(state, hookCategory);
  console.log(`\nHook: "${hook.text}" [${hook.category}]`);

  // Plan slides
  const slides = planSlides(hook, marketingConfig.marketing.ctaUrl);
  console.log(`Planned ${slides.length} slides`);

  // Generate deck
  const deckId = randomUUID().slice(0, 8);
  console.log(`\nGenerating deck ${deckId}...${dryRun ? ' (dry run)' : ''}`);

  const generatedImages = await composeDeck(deckId, slides, { dryRun });

  // Caption
  const caption = generateCaption(hook, 'x', marketingConfig.marketing.ctaUrl);

  // Save to state
  const deck: CarouselDeck = {
    id: deckId,
    createdAt: new Date().toISOString(),
    hookId: hook.id,
    hookCategory: hook.category,
    hookText: hook.text,
    ctaText: 'Try it free — chartsuno.com',
    slides,
    generatedImages,
    status: 'ready',
    caption,
  };

  await updateMarketingState((s) => ({
    ...s,
    decks: [...s.decks, deck],
  }));

  console.log(`\nDeck ${deckId} ready.`);
  console.log(`Slides saved to: ${marketingConfig.marketing.slidesDir}/${deckId}/`);
  console.log(`\nNext steps:`);
  console.log(`  pnpm --filter @chartsuno/bot marketing -- post-x --deck ${deckId}`);
  console.log(`  pnpm --filter @chartsuno/bot marketing -- post-tiktok --deck ${deckId}`);
}

async function cmdPostX(): Promise<void> {
  validateMarketingConfig();
  const dryRun = hasFlag('dry-run');
  const deck = await resolveDeck();
  const caption = deck.caption ?? generateCaption(
    { id: deck.hookId, category: deck.hookCategory, text: deck.hookText },
    'x',
    marketingConfig.marketing.ctaUrl,
  );

  console.log(`\nPosting deck ${deck.id} to X...${dryRun ? ' (dry run)' : ''}`);
  const result = await postToX(deck, caption, { dryRun });

  // Update state
  await updateMarketingState((s) => ({
    ...s,
    posts: [...s.posts, result],
    decks: s.decks.map((d) =>
      d.id === deck.id
        ? { ...d, status: d.status === 'posted-tiktok' ? 'posted-both' : 'posted-x' }
        : d,
    ),
  }));

  console.log(`Posted to X: ${result.url}`);
}

async function cmdPostTikTok(): Promise<void> {
  validateMarketingConfig({ requireTikTok: true });
  const dryRun = hasFlag('dry-run');
  const deck = await resolveDeck();
  const caption = generateCaption(
    { id: deck.hookId, category: deck.hookCategory, text: deck.hookText },
    'tiktok',
    marketingConfig.marketing.ctaUrl,
  );

  console.log(`\nPosting deck ${deck.id} to TikTok...${dryRun ? ' (dry run)' : ''}`);
  const result = await postToTikTok(deck, caption, { dryRun });

  await updateMarketingState((s) => ({
    ...s,
    posts: [...s.posts, result],
    decks: s.decks.map((d) =>
      d.id === deck.id
        ? { ...d, status: d.status === 'posted-x' ? 'posted-both' : 'posted-tiktok' }
        : d,
    ),
  }));

  console.log(`Posted to TikTok (request_id: ${result.postId})`);
}

async function cmdPostAll(): Promise<void> {
  await cmdPostX();
  await cmdPostTikTok();
}

async function cmdReport(): Promise<void> {
  const days = parseInt(getFlag('days') ?? '3', 10);
  console.log(`\nGenerating report for last ${days} days...`);
  const report = await generateDailyReport(days);

  console.log(`\n── Daily Report: ${report.date} ──`);
  console.log(`Posts: ${report.totalPosts} | Views: ${report.totalViews} | Engagements: ${report.totalEngagements} | Conversions: ${report.totalConversions}`);
  console.log(`\nQuadrant breakdown:`);
  for (const [q, count] of Object.entries(report.quadrantBreakdown)) {
    if (count > 0) console.log(`  ${q}: ${count}`);
  }
  console.log(`\nRecommendations:`);
  for (const rec of report.recommendations) {
    console.log(`  - ${rec}`);
  }
}

async function cmdList(): Promise<void> {
  const state = await loadMarketingState();

  if (state.decks.length === 0) {
    console.log('No decks yet. Run "generate" to create one.');
    return;
  }

  console.log(`\n${state.decks.length} deck(s):\n`);
  for (const deck of state.decks.slice(-20)) {
    const date = new Date(deck.createdAt).toLocaleDateString();
    console.log(`  ${deck.id}  ${deck.status.padEnd(14)} ${date}  "${deck.hookText.slice(0, 60)}"`);
  }
}

// ─── Router ────────────────────────────────────────────────────────

async function run(): Promise<void> {
  switch (command) {
    case 'generate':
      return cmdGenerate();
    case 'post-x':
      return cmdPostX();
    case 'post-tiktok':
      return cmdPostTikTok();
    case 'post-all':
      return cmdPostAll();
    case 'report':
      return cmdReport();
    case 'analytics':
      return cmdReport(); // Analytics is the report for now
    case 'list':
      return cmdList();
    default:
      printUsage();
      if (command && command !== '--help' && command !== '-h') {
        process.exit(1);
      }
  }
}

run().catch((error) => {
  logger.error({ error }, 'Marketing CLI failed');
  console.error('\nError:', error instanceof Error ? error.message : error);
  process.exit(1);
});
