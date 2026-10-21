import { pathToFileURL } from 'node:url';
import { authenticate, readBody, RequestError, serverSecurity } from './http-security.js';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { logger, marketingConfig, validateMarketingConfig } from './config.js';
import { loadMarketingState, updateMarketingState } from './state.js';
import { selectHook, planSlides, generateCaption, composeDeck } from './index.js';
import { postToX, postVideoToX } from './platforms/x-poster.js';
import { postToTikTok, postVideoToTikTok } from './platforms/tiktok-poster.js';
import { generateDailyReport } from './analytics/report.js';
import { planScenes, renderAllScenes, assembleVideo, prependAvatarClip, generateAvatarScene, generateAvatarScript } from './video/index.js';
import type { HookCategory, CarouselDeck } from './types.js';
import type { VideoProject, CaptureMethod } from './video/types.js';

// ─── Auth ─────────────────────────────────────────────────────────

// ─── Helpers ──────────────────────────────────────────────────────

function json(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

async function resolveDeck(deckArg: string): Promise<CarouselDeck> {
  const state = await loadMarketingState();
  let deck: CarouselDeck | undefined;
  if (deckArg === 'latest') {
    deck = state.decks.at(-1);
  } else {
    deck = state.decks.find((d) => d.id === deckArg);
  }
  if (!deck) throw new Error(`No deck found for "${deckArg}". Run generate first.`);
  return deck;
}

async function resolveVideo(videoArg: string): Promise<VideoProject> {
  const state = await loadMarketingState();
  let video: VideoProject | undefined;
  if (videoArg === 'latest') {
    video = state.videos.at(-1);
  } else {
    video = state.videos.find((v) => v.id === videoArg);
  }
  if (!video) throw new Error(`No video found for "${videoArg}". Run generate-video first.`);
  return video;
}

// ─── Route Handlers ───────────────────────────────────────────────

async function handleList(): Promise<unknown> {
  const state = await loadMarketingState();
  return {
    publications: state.publications,
    decks: state.decks.slice(-20).map((d) => ({
      id: d.id, status: d.status, createdAt: d.createdAt,
      hookCategory: d.hookCategory, hookText: d.hookText,
    })),
    videos: state.videos.slice(-20).map((v) => ({
      id: v.id, status: v.status, createdAt: v.createdAt,
      hookCategory: v.hookCategory, hookText: v.hookText,
      durationSeconds: v.durationSeconds,
    })),
  };
}

async function handleGenerate(body: Record<string, unknown>): Promise<unknown> {
  const dryRun = body.dryRun === true;
  if (!dryRun) validateMarketingConfig({ requireGoogle: true });
  const state = await loadMarketingState();

  const hookCategory = body.hookCategory as HookCategory | undefined;
  const hook = selectHook(state, hookCategory);

  const slides = planSlides(hook, marketingConfig.marketing.ctaUrl);
  const deckId = randomUUID().slice(0, 8);

  const generatedImages = await composeDeck(deckId, slides, { dryRun });
  const caption = generateCaption(hook, 'x', marketingConfig.marketing.ctaUrl);

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

  await updateMarketingState((s) => ({ ...s, decks: [...s.decks, deck] }));

  return { deckId, hook: hook.text, hookCategory: hook.category, slides: slides.length, dryRun };
}

async function handleGenerateVideo(body: Record<string, unknown>): Promise<unknown> {
  const dryRun = body.dryRun === true;
  const withAvatar = body.withAvatar === true;
  const musicPath = (body.musicPath as string) || marketingConfig.marketing.musicPath || undefined;
  const musicVolume = typeof body.musicVolume === 'number' ? body.musicVolume : marketingConfig.marketing.musicVolume;
  const captureMethod = (body.captureMethod as CaptureMethod) ?? 'remotion';
  const captureUrl = (body.captureUrl as string) ?? undefined;

  const state = await loadMarketingState();
  const hookCategory = body.hookCategory as HookCategory | undefined;
  const hook = selectHook(state, hookCategory);

  const scenes = planScenes(hook, marketingConfig.marketing.ctaUrl, { captureMethod, captureUrl });
  const totalDuration = scenes.reduce((s, sc) => s + sc.durationSeconds, 0);

  const videoId = randomUUID().slice(0, 8);
  const outputDir = join(marketingConfig.marketing.videosDir, videoId);
  let finalVideoPath = join(outputDir, 'final.mp4');

  const renderJobs = await renderAllScenes(scenes, outputDir, { dryRun });
  const failedJobs = renderJobs.filter((j) => j.status === 'error');

  if (failedJobs.length > 0 && !dryRun) {
    throw new Error(`${failedJobs.length} scene(s) failed to render`);
  }

  const assembleTarget = withAvatar ? join(outputDir, 'main.mp4') : finalVideoPath;
  await assembleVideo(renderJobs, assembleTarget, { dryRun, ffmpegPath: marketingConfig.marketing.ffmpegPath, musicPath, musicVolume });

  if (withAvatar && !dryRun && marketingConfig.marketing.heygenApiKey) {
    const script = generateAvatarScript(hook.text);
    const avatarPath = await generateAvatarScene({ script, outputDir, filename: 'avatar-intro.mp4' });
    await prependAvatarClip(avatarPath, assembleTarget, finalVideoPath, { ffmpegPath: marketingConfig.marketing.ffmpegPath });
  }

  const video: VideoProject = {
    id: videoId, createdAt: new Date().toISOString(),
    hookId: hook.id, hookCategory: hook.category, hookText: hook.text,
    ctaText: 'Try it free', ctaUrl: marketingConfig.marketing.ctaUrl,
    scenes, renderJobs, finalVideoPath, status: 'ready', durationSeconds: totalDuration,
  };

  await updateMarketingState((s) => ({ ...s, videos: [...s.videos, video] }));

  return { videoId, hook: hook.text, hookCategory: hook.category, scenes: scenes.length, durationSeconds: totalDuration, dryRun };
}

async function handlePostX(body: Record<string, unknown>): Promise<unknown> {
  const dryRun = body.dryRun === true;

  if (body.video) {
    const video = await resolveVideo(body.video as string);
    const caption = generateCaption(
      { id: video.hookId, category: video.hookCategory, text: video.hookText },
      'x', marketingConfig.marketing.ctaUrl,
    );
    const result = await postVideoToX(video, caption, { dryRun });
    return result;
  }

  const deck = await resolveDeck((body.deck as string) ?? 'latest');
  const caption = deck.caption ?? generateCaption(
    { id: deck.hookId, category: deck.hookCategory, text: deck.hookText },
    'x', marketingConfig.marketing.ctaUrl,
  );
  const result = await postToX(deck, caption, { dryRun });
  return result;
}

async function handlePostTikTok(body: Record<string, unknown>): Promise<unknown> {
  const dryRun = body.dryRun === true;
  const draft = body.draft === true;
  const scheduledDate = body.scheduledDate as string | undefined;

  if (body.video) {
    const video = await resolveVideo(body.video as string);
    const caption = generateCaption(
      { id: video.hookId, category: video.hookCategory, text: video.hookText },
      'tiktok', marketingConfig.marketing.ctaUrl,
    );
    const result = await postVideoToTikTok(video, caption, { dryRun, scheduledDate, draft });
    return result;
  }

  const deck = await resolveDeck((body.deck as string) ?? 'latest');
  const caption = generateCaption(
    { id: deck.hookId, category: deck.hookCategory, text: deck.hookText },
    'tiktok', marketingConfig.marketing.ctaUrl,
  );
  const result = await postToTikTok(deck, caption, { dryRun });
  return result;
}

async function handleReport(url: URL): Promise<unknown> {
  const days = Number(url.searchParams.get('days') ?? '3');
  if (!Number.isInteger(days) || days < 1 || days > 365) throw new RequestError(400, 'days must be between 1 and 365');
  return generateDailyReport(days);
}

// ─── Router ───────────────────────────────────────────────────────

type Handler = (req: IncomingMessage, res: ServerResponse) => Promise<void>;

async function router(req: IncomingMessage, res: ServerResponse, apiKey: string): Promise<void> {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const path = url.pathname;
  const method = req.method ?? 'GET';

  // Health check — no auth
  if (path === '/health' || path === '/') {
    json(res, 200, { ok: true, service: 'chartsuno-marketing' });
    return;
  }

  // All /api routes require auth
  if (path.startsWith('/api/') && !authenticate(req, apiKey)) {
    json(res, 401, { error: 'Unauthorized' });
    return;
  }

  try {
    if (method === 'GET' && path === '/api/list') {
      json(res, 200, await handleList());
    } else if (method === 'GET' && path === '/api/report') {
      json(res, 200, await handleReport(url));
    } else if (method === 'POST' && path === '/api/generate') {
      const body = await readBody(req);
      json(res, 200, await handleGenerate(body));
    } else if (method === 'POST' && path === '/api/generate-video') {
      const body = await readBody(req);
      json(res, 200, await handleGenerateVideo(body));
    } else if (method === 'POST' && path === '/api/post-x') {
      const body = await readBody(req);
      json(res, 200, await handlePostX(body));
    } else if (method === 'POST' && path === '/api/post-tiktok') {
      const body = await readBody(req);
      json(res, 200, await handlePostTikTok(body));
    } else if (method === 'POST' && path === '/api/post-all') {
      const body = await readBody(req);
      const xResult = await handlePostX(body);
      const tiktokResult = await handlePostTikTok(body);
      json(res, 200, { x: xResult, tiktok: tiktokResult });
    } else {
      json(res, 404, { error: 'Not found' });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ error: message, path, method }, 'Request failed');
    json(res, error instanceof RequestError ? error.status : 500, { error: message });
  }
}

// ─── Server ───────────────────────────────────────────────────────

export function createMarketingServer(env: NodeJS.ProcessEnv = process.env) {
  const security = serverSecurity(env);
  const server = createServer((req, res) => {
    const start = Date.now();
    router(req, res, security.apiKey).catch((error) => {
      logger.error({ error: String(error) }, 'Unhandled request error');
      if (!res.headersSent) json(res, 500, { error: 'Internal server error' });
      else res.end();
    }).finally(() => {
      logger.info({ method: req.method, url: req.url, status: res.statusCode, ms: Date.now() - start }, 'request');
    });
  });
  return { server, host: security.host };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT || '8081');
  const { server, host } = createMarketingServer();
  server.listen(port, host, () => logger.info({ port, host }, 'Marketing API server listening'));
  const shutdown = () => server.close(() => process.exit(0));
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
