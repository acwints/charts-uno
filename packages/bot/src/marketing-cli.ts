import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import {
  validateMarketingConfig,
  loadMarketingState,
  updateMarketingState,
  selectHook,
  planSlides,
  generateCaption,
  composeDeck,
  postToX,
  postVideoToX,
  postToTikTok,
  postVideoToTikTok,
  generateDailyReport,
  marketingConfig,
  planScenes,
  renderAllScenes,
  assembleVideo,
  prependAvatarClip,
  generateAvatarScene,
  generateAvatarScript,
} from './marketing/index.js';
import { logger } from './marketing/config.js';
import type { HookCategory, CarouselDeck } from './marketing/types.js';
import type { VideoProject } from './marketing/video/types.js';
import type { CaptureMethod } from './marketing/video/types.js';

// ─── CLI Argument Parsing ──────────────────────────────────────────

const args = process.argv.slice(2).filter((a) => a !== '--');
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
  'generate-video': 'Generate a marketing video (5 scenes, ~18s)',
  'post-x': 'Post a deck or video to X/Twitter',
  'post-tiktok': 'Post a deck or video to TikTok via Upload-Post',
  'post-all': 'Post to both X and TikTok',
  analytics: 'Check analytics for recent posts',
  report: 'Generate daily performance report',
  list: 'List all decks and videos',
};

function printUsage(): void {
  console.log('Usage: pnpm --filter @chartsuno/bot marketing -- <command> [options]\n');
  console.log('Commands:');
  for (const [cmd, desc] of Object.entries(COMMANDS)) {
    console.log(`  ${cmd.padEnd(18)} ${desc}`);
  }
  console.log('\nOptions:');
  console.log('  --hook-category <category>  Force hook category (person-conflict|budget-pain|curiosity-discovery)');
  console.log('  --deck <id|latest>          Select deck by ID or "latest"');
  console.log('  --video <id|latest>         Select video by ID or "latest"');
  console.log('  --days <n>                  Analytics window in days (default: 3)');
  console.log('  --dry-run                   Skip actual API calls');
  console.log('\nVideo options:');
  console.log('  --with-avatar               Add HeyGen talking-head intro (requires HEYGEN_API_KEY)');
  console.log('  --music <path>              Add background music track');
  console.log('  --music-volume <0.0-1.0>    Music volume (default: 0.15)');
  console.log('  --capture <method>          Capture method: remotion (default), browser-video, browser-screenshots, browser-remotion');
  console.log('  --capture-url <url>         Override capture URL (default: https://chartsuno.com)');
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

async function resolveVideo(): Promise<VideoProject> {
  const state = await loadMarketingState();
  const videoArg = getFlag('video') ?? 'latest';

  let video: VideoProject | undefined;
  if (videoArg === 'latest') {
    video = state.videos.at(-1);
  } else {
    video = state.videos.find((v) => v.id === videoArg);
  }

  if (!video) {
    throw new Error(`No video found for "${videoArg}". Run "generate-video" first.`);
  }

  return video;
}

// ─── Commands ──────────────────────────────────────────────────────

async function cmdGenerate(): Promise<void> {
  const dryRun = hasFlag('dry-run');
  if (!dryRun) validateMarketingConfig({ requireGoogle: true });
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

async function cmdGenerateVideo(): Promise<void> {
  const dryRun = hasFlag('dry-run');
  const withAvatar = hasFlag('with-avatar');
  const musicPath = getFlag('music') || marketingConfig.marketing.musicPath || undefined;
  const musicVolume = parseFloat(getFlag('music-volume') ?? String(marketingConfig.marketing.musicVolume));
  const captureMethod = (getFlag('capture') as CaptureMethod) ?? 'remotion';
  const captureUrl = getFlag('capture-url') ?? undefined;
  const state = await loadMarketingState();

  // Select hook
  const hookCategory = getFlag('hook-category') as HookCategory | undefined;
  const hook = selectHook(state, hookCategory);
  console.log(`\nHook: "${hook.text}" [${hook.category}]`);

  // Plan scenes
  const scenes = planScenes(hook, marketingConfig.marketing.ctaUrl, { captureMethod, captureUrl });
  if (captureMethod !== 'remotion') {
    console.log(`Capture method: ${captureMethod}${captureUrl ? ` (url: ${captureUrl})` : ''}`);
  }
  const totalDuration = scenes.reduce((s, sc) => s + sc.durationSeconds, 0);
  console.log(`Planned ${scenes.length} scenes (${totalDuration}s total)`);

  // Generate video
  const videoId = randomUUID().slice(0, 8);
  const outputDir = join(marketingConfig.marketing.videosDir, videoId);
  let finalVideoPath = join(outputDir, 'final.mp4');

  console.log(`\nRendering video ${videoId}...${dryRun ? ' (dry run)' : ''}`);

  // Render all scenes
  const renderJobs = await renderAllScenes(scenes, outputDir, { dryRun });
  const failedJobs = renderJobs.filter((j) => j.status === 'error');

  if (failedJobs.length > 0) {
    console.error(`\n${failedJobs.length} scene(s) failed to render:`);
    for (const job of failedJobs) {
      console.error(`  Scene ${job.sceneNumber}: ${job.error}`);
    }
    if (!dryRun) {
      throw new Error('Video rendering failed');
    }
  }

  // Assemble final video (with optional music)
  const assembleTarget = withAvatar ? join(outputDir, 'main.mp4') : finalVideoPath;
  console.log(`\nAssembling video...${musicPath ? ' (with background music)' : ''}`);
  await assembleVideo(renderJobs, assembleTarget, {
    dryRun,
    ffmpegPath: marketingConfig.marketing.ffmpegPath,
    musicPath,
    musicVolume,
  });

  // Optional: HeyGen avatar intro
  if (withAvatar && !dryRun) {
    if (!marketingConfig.marketing.heygenApiKey) {
      console.warn('HEYGEN_API_KEY not set — skipping avatar intro');
    } else {
      console.log('\nGenerating HeyGen avatar intro...');
      const script = generateAvatarScript(hook.text);
      console.log(`Avatar script: "${script}"`);

      const avatarPath = await generateAvatarScene({
        script,
        outputDir,
        filename: 'avatar-intro.mp4',
      });

      console.log('Prepending avatar clip to video...');
      await prependAvatarClip(avatarPath, assembleTarget, finalVideoPath, {
        ffmpegPath: marketingConfig.marketing.ffmpegPath,
      });
    }
  } else if (withAvatar && dryRun) {
    console.log('[DRY RUN] Would generate HeyGen avatar intro');
  }

  // Save to state
  const video: VideoProject = {
    id: videoId,
    createdAt: new Date().toISOString(),
    hookId: hook.id,
    hookCategory: hook.category,
    hookText: hook.text,
    ctaText: 'Try it free',
    ctaUrl: marketingConfig.marketing.ctaUrl,
    scenes,
    renderJobs,
    finalVideoPath,
    status: 'ready',
    durationSeconds: totalDuration,
  };

  await updateMarketingState((s) => ({
    ...s,
    videos: [...s.videos, video],
  }));

  console.log(`\nVideo ${videoId} ready.`);
  console.log(`Output: ${finalVideoPath}`);
  console.log(`\nNext steps:`);
  console.log(`  pnpm --filter @chartsuno/bot marketing -- post-tiktok --video ${videoId}`);
  console.log(`  pnpm --filter @chartsuno/bot marketing -- post-x --video ${videoId}`);
}

async function cmdPostX(): Promise<void> {
  const dryRun = hasFlag('dry-run');

  // Check if posting a video or a carousel deck
  if (hasFlag('video') || getFlag('video')) {
    const video = await resolveVideo();
    const caption = generateCaption(
      { id: video.hookId, category: video.hookCategory, text: video.hookText },
      'x',
      marketingConfig.marketing.ctaUrl,
    );

    console.log(`\nPosting video ${video.id} to X...${dryRun ? ' (dry run)' : ''}`);
    const result = await postVideoToX(video, caption, { dryRun });

    await updateMarketingState((s) => ({
      ...s,
      posts: [...s.posts, result],
      videos: s.videos.map((v) =>
        v.id === video.id
          ? { ...v, status: v.status === 'posted-tiktok' ? 'posted-both' : 'posted-x' }
          : v,
      ),
    }));

    console.log(`Posted video to X: ${result.url}`);
    return;
  }

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
  const draft = hasFlag('draft');

  // Check if posting a video or a carousel deck
  if (hasFlag('video') || getFlag('video')) {
    const video = await resolveVideo();
    const caption = generateCaption(
      { id: video.hookId, category: video.hookCategory, text: video.hookText },
      'tiktok',
      marketingConfig.marketing.ctaUrl,
    );

    const scheduledDate = getFlag('schedule');
    const draftLabel = draft ? ' (draft)' : '';
    const scheduleLabel = scheduledDate ? ` (scheduled: ${scheduledDate})` : '';
    console.log(`\nPosting video ${video.id} to TikTok...${dryRun ? ' (dry run)' : ''}${draftLabel}${scheduleLabel}`);
    const result = await postVideoToTikTok(video, caption, { dryRun, scheduledDate, draft });

    await updateMarketingState((s) => ({
      ...s,
      posts: [...s.posts, result],
      videos: s.videos.map((v) =>
        v.id === video.id
          ? { ...v, status: v.status === 'posted-x' ? 'posted-both' : 'posted-tiktok' }
          : v,
      ),
    }));

    console.log(`Posted video to TikTok (request_id: ${result.postId})`);
    return;
  }

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

  if (state.decks.length === 0 && state.videos.length === 0) {
    console.log('No decks or videos yet. Run "generate" or "generate-video" to create one.');
    return;
  }

  if (state.decks.length > 0) {
    console.log(`\n${state.decks.length} deck(s):\n`);
    for (const deck of state.decks.slice(-20)) {
      const date = new Date(deck.createdAt).toLocaleDateString();
      console.log(`  ${deck.id}  ${deck.status.padEnd(14)} ${date}  "${deck.hookText.slice(0, 60)}"`);
    }
  }

  if (state.videos.length > 0) {
    console.log(`\n${state.videos.length} video(s):\n`);
    for (const video of state.videos.slice(-20)) {
      const date = new Date(video.createdAt).toLocaleDateString();
      console.log(`  ${video.id}  ${video.status.padEnd(14)} ${date}  ${video.durationSeconds}s  "${video.hookText.slice(0, 50)}"`);
    }
  }
}

// ─── Router ────────────────────────────────────────────────────────

async function run(): Promise<void> {
  switch (command) {
    case 'generate':
      return cmdGenerate();
    case 'generate-video':
      return cmdGenerateVideo();
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
