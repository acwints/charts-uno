import { resolve, join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { FPS, VIDEO_WIDTH, VIDEO_HEIGHT, COMP_IDS, secondsToFrames } from '@chartsuno/video';
import { logger, marketingConfig } from '../config.js';
import type { ScenePlan, RenderJob, CaptureMethod } from './types.js';
import {
  isAgentBrowserAvailable,
  captureVideo,
  captureScreenshots,
} from './agent-browser.js';
import { captureSession, getTransformCaptureSteps, screenshotsToVideo } from './browser-capture.js';

const execFileAsync = promisify(execFile);

/** Lazy-loaded Remotion modules (heavy imports) */
let bundleModule: typeof import('@remotion/bundler') | null = null;
let rendererModule: typeof import('@remotion/renderer') | null = null;

async function getBundler() {
  if (!bundleModule) {
    bundleModule = await import('@remotion/bundler');
  }
  return bundleModule;
}

async function getRenderer() {
  if (!rendererModule) {
    rendererModule = await import('@remotion/renderer');
  }
  return rendererModule;
}

/** Cached webpack bundle path — only bundled once per process */
let cachedBundlePath: string | null = null;

async function ensureBundle(): Promise<string> {
  if (cachedBundlePath) return cachedBundlePath;

  const { bundle } = await getBundler();

  // Resolve the video package entry point
  const entryPoint = resolve(
    import.meta.dirname,
    '../../../../video/src/index.ts',
  );

  logger.info({ entryPoint }, 'Bundling Remotion project (first run only)');
  const startMs = Date.now();

  cachedBundlePath = await bundle({
    entryPoint,
    onProgress: (progress: number) => {
      if (progress % 25 === 0) {
        logger.debug({ progress }, 'Bundle progress');
      }
    },
  });

  logger.info({ durationMs: Date.now() - startMs }, 'Bundle complete');
  return cachedBundlePath;
}

/**
 * Renders a single Remotion scene to MP4 using @remotion/renderer.
 */
export async function renderScene(
  scene: ScenePlan,
  outputDir: string,
  options: { dryRun?: boolean } = {},
): Promise<RenderJob> {
  const compositionId = scene.compositionId ?? COMP_IDS.chartTransform;
  const props = scene.props ?? {};

  const job: RenderJob = {
    sceneNumber: scene.sceneNumber,
    compositionId,
    status: 'pending',
  };

  const outputPath = join(outputDir, `scene-${scene.sceneNumber}.mp4`);

  if (options.dryRun) {
    logger.info({
      scene: scene.sceneNumber,
      compositionId,
      durationSeconds: scene.durationSeconds,
    }, '[DRY RUN] Would render scene');

    return { ...job, status: 'done', outputPath, durationMs: 0 };
  }

  try {
    job.status = 'rendering';
    await mkdir(outputDir, { recursive: true });

    const bundlePath = await ensureBundle();
    const { renderMedia, selectComposition } = await getRenderer();

    const durationInFrames = secondsToFrames(scene.durationSeconds);

    const composition = await selectComposition({
      serveUrl: bundlePath,
      id: compositionId,
      inputProps: props,
    });

    const startMs = Date.now();

    await renderMedia({
      composition: {
        ...composition,
        width: VIDEO_WIDTH,
        height: VIDEO_HEIGHT,
        fps: FPS,
        durationInFrames,
        props,
      },
      serveUrl: bundlePath,
      codec: 'h264',
      outputLocation: outputPath,
      onProgress: ({ progress }) => {
        if (Math.round(progress * 100) % 25 === 0) {
          logger.debug({ scene: scene.sceneNumber, progress: Math.round(progress * 100) }, 'Render progress');
        }
      },
    });

    const durationMs = Date.now() - startMs;
    logger.info({ scene: scene.sceneNumber, durationMs, outputPath }, 'Scene rendered');

    return { ...job, status: 'done', outputPath, durationMs };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ scene: scene.sceneNumber, error: message }, 'Scene render failed');
    return { ...job, status: 'error', error: message };
  }
}

// ─── Browser Capture Rendering ────────────────────────────────────

/**
 * Renders browser-captured scenes (2-4) as a shared session.
 *
 * All browser scenes share one session so the pasted data carries across.
 * The combined script runs once, capturing at scene boundaries.
 *
 * Returns render jobs for each browser scene, with individual MP4s
 * extracted from the capture.
 */
async function renderBrowserScenes(
  browserScenes: ScenePlan[],
  outputDir: string,
  captureMethod: CaptureMethod,
  options: { dryRun?: boolean },
): Promise<RenderJob[]> {
  const captureDir = join(outputDir, 'browser-capture');
  await mkdir(captureDir, { recursive: true });
  const ffmpeg = marketingConfig.marketing.ffmpegPath;

  if (options.dryRun) {
    return browserScenes.map((scene) => ({
      sceneNumber: scene.sceneNumber,
      compositionId: scene.compositionId ?? 'browser-capture',
      status: 'done' as const,
      outputPath: join(outputDir, `scene-${scene.sceneNumber}.mp4`),
      durationMs: 0,
    }));
  }

  const startMs = Date.now();

  try {
    if (captureMethod === 'browser-video') {
      return await renderBrowserVideoScenes(browserScenes, outputDir, captureDir, ffmpeg);
    }

    // browser-screenshots or browser-remotion — both start with screenshots
    const screenshots = await captureBrowserScreenshots(captureDir);

    if (captureMethod === 'browser-remotion') {
      return await renderBrowserRemotionScenes(browserScenes, outputDir, screenshots);
    }

    // browser-screenshots: assemble screenshots into per-scene MP4s via ffmpeg
    return await renderBrowserScreenshotScenes(browserScenes, outputDir, screenshots, ffmpeg);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ captureMethod, error: message }, 'Browser scene rendering failed');

    return browserScenes.map((scene) => ({
      sceneNumber: scene.sceneNumber,
      compositionId: scene.compositionId ?? 'browser-capture',
      status: 'error' as const,
      error: message,
    }));
  } finally {
    const durationMs = Date.now() - startMs;
    logger.info({ captureMethod, durationMs }, 'Browser scene rendering finished');
  }
}

/**
 * browser-video: record real-time video, then split into per-scene clips.
 */
async function renderBrowserVideoScenes(
  scenes: ScenePlan[],
  outputDir: string,
  captureDir: string,
  ffmpeg: string,
): Promise<RenderJob[]> {
  const result = await captureVideo({ outputDir: captureDir });
  const videoPath = result.videoPath;

  // Normalize captured video to pipeline specs
  const normalizedPath = join(captureDir, 'normalized.mp4');
  await normalizeVideo(videoPath, normalizedPath, ffmpeg);

  // Split into per-scene clips based on durations
  const jobs: RenderJob[] = [];
  let offsetSeconds = 0;

  for (const scene of scenes) {
    const outputPath = join(outputDir, `scene-${scene.sceneNumber}.mp4`);

    await execFileAsync(ffmpeg, [
      '-y',
      '-ss', String(offsetSeconds),
      '-i', normalizedPath,
      '-t', String(scene.durationSeconds),
      '-c', 'copy',
      '-movflags', '+faststart',
      outputPath,
    ]);

    jobs.push({
      sceneNumber: scene.sceneNumber,
      compositionId: 'browser-video',
      status: 'done',
      outputPath,
      durationMs: result.durationMs,
    });

    offsetSeconds += scene.durationSeconds;
  }

  return jobs;
}

/**
 * Captures screenshots using agent-browser, falling back to puppeteer.
 */
async function captureBrowserScreenshots(captureDir: string): Promise<string[]> {
  // Try agent-browser first
  if (await isAgentBrowserAvailable()) {
    logger.info('Using agent-browser for screenshot capture');
    const result = await captureScreenshots({ outputDir: captureDir });
    return result.screenshotPaths;
  }

  // Fallback to puppeteer (existing browser-capture.ts)
  logger.info('agent-browser not available, falling back to puppeteer');
  const captureUrl = marketingConfig.marketing.captureUrl;
  const steps = getTransformCaptureSteps();
  const result = await captureSession({
    url: `${captureUrl}/new`,
    outputDir: captureDir,
    steps,
  });

  return result.screenshots;
}

/**
 * browser-screenshots: assemble screenshot sets into per-scene MP4s via ffmpeg.
 */
async function renderBrowserScreenshotScenes(
  scenes: ScenePlan[],
  outputDir: string,
  allScreenshots: string[],
  ffmpeg: string,
): Promise<RenderJob[]> {
  const jobs: RenderJob[] = [];

  // Distribute screenshots across scenes proportionally
  const screenshotsPerScene = distributeScreenshots(allScreenshots, scenes);

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const sceneScreenshots = screenshotsPerScene[i];
    const outputPath = join(outputDir, `scene-${scene.sceneNumber}.mp4`);

    if (sceneScreenshots.length === 0) {
      jobs.push({
        sceneNumber: scene.sceneNumber,
        compositionId: 'browser-screenshots',
        status: 'error',
        error: 'No screenshots captured for this scene',
      });
      continue;
    }

    await screenshotsToVideo(sceneScreenshots, outputPath, {
      fps: FPS,
      ffmpegPath: ffmpeg,
    });

    jobs.push({
      sceneNumber: scene.sceneNumber,
      compositionId: 'browser-screenshots',
      status: 'done',
      outputPath,
    });
  }

  return jobs;
}

/**
 * browser-remotion: render screenshots through the BrowserScreenshots Remotion composition
 * with Ken Burns + crossfade polish.
 */
async function renderBrowserRemotionScenes(
  scenes: ScenePlan[],
  outputDir: string,
  allScreenshots: string[],
): Promise<RenderJob[]> {
  const jobs: RenderJob[] = [];
  const screenshotsPerScene = distributeScreenshots(allScreenshots, scenes);

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const sceneScreenshots = screenshotsPerScene[i];

    // Render each browser scene through the BrowserScreenshots composition
    const remotionScene: ScenePlan = {
      sceneNumber: scene.sceneNumber,
      type: scene.type,
      durationSeconds: scene.durationSeconds,
      captureMethod: 'remotion',
      compositionId: COMP_IDS.browserScreenshots,
      props: {
        screenshotPaths: sceneScreenshots,
        zoomAmount: 1.06,
      },
    };

    const job = await renderScene(remotionScene, outputDir);
    jobs.push(job);
  }

  return jobs;
}

// ─── Helpers ──────────────────────────────────────────────────────

/**
 * Distributes screenshots across scenes proportionally by duration.
 */
function distributeScreenshots(screenshots: string[], scenes: ScenePlan[]): string[][] {
  const totalDuration = scenes.reduce((sum, s) => sum + s.durationSeconds, 0);
  const result: string[][] = [];
  let offset = 0;

  for (let i = 0; i < scenes.length; i++) {
    const ratio = scenes[i].durationSeconds / totalDuration;
    const count = i === scenes.length - 1
      ? screenshots.length - offset
      : Math.max(1, Math.round(screenshots.length * ratio));
    result.push(screenshots.slice(offset, offset + count));
    offset += count;
  }

  return result;
}

/**
 * Normalizes a captured video to match pipeline specs (1080x1920, h264, 30fps).
 */
async function normalizeVideo(inputPath: string, outputPath: string, ffmpeg: string): Promise<void> {
  await execFileAsync(ffmpeg, [
    '-y',
    '-i', inputPath,
    '-vf', `fps=${FPS},scale=${VIDEO_WIDTH}:${VIDEO_HEIGHT}:force_original_aspect_ratio=decrease,pad=${VIDEO_WIDTH}:${VIDEO_HEIGHT}:(ow-iw)/2:(oh-ih)/2`,
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    outputPath,
  ]);
}

/**
 * Determines the effective capture method, applying the fallback chain:
 * agent-browser → puppeteer → remotion
 */
async function resolveEffectiveCaptureMethod(requested: CaptureMethod): Promise<CaptureMethod> {
  if (requested === 'remotion') return 'remotion';

  // For browser methods, check if agent-browser is available
  if (await isAgentBrowserAvailable()) return requested;

  // Fallback: try puppeteer for screenshot-based methods
  if (requested === 'browser-screenshots' || requested === 'browser-remotion') {
    logger.warn({ requested }, 'agent-browser not available, will use puppeteer fallback');
    return requested; // captureBrowserScreenshots handles the puppeteer fallback internally
  }

  // browser-video requires agent-browser — fall back to remotion
  logger.warn({ requested }, 'agent-browser not available, falling back to remotion');
  return 'remotion';
}

// ─── Public API ───────────────────────────────────────────────────

/**
 * Renders all scenes sequentially.
 *
 * Dispatches per-scene based on captureMethod:
 * - 'remotion' → existing renderScene() path
 * - 'browser-*' → renderBrowserScenes() with shared session
 *
 * Fallback chain: agent-browser → puppeteer → remotion
 */
export async function renderAllScenes(
  scenes: ScenePlan[],
  outputDir: string,
  options: { dryRun?: boolean } = {},
): Promise<RenderJob[]> {
  const jobs: RenderJob[] = [];

  // Separate Remotion scenes from browser scenes
  const remotionScenes = scenes.filter((s) => !s.captureMethod || s.captureMethod === 'remotion');
  const browserScenes = scenes.filter((s) => s.captureMethod && s.captureMethod !== 'remotion');

  // If there are browser scenes, determine the effective capture method
  if (browserScenes.length > 0) {
    const requestedMethod = browserScenes[0].captureMethod!;
    const effectiveMethod = await resolveEffectiveCaptureMethod(requestedMethod);

    if (effectiveMethod === 'remotion') {
      // Full fallback to remotion — re-plan all scenes as remotion
      logger.info('Browser capture unavailable, rendering all scenes via Remotion');
      return renderAllRemotionScenes(scenes, outputDir, options);
    }

    // Render Remotion scenes (1, 5) first
    for (const scene of remotionScenes) {
      const job = await renderScene(scene, outputDir, options);
      jobs.push(job);

      if (job.status === 'error') {
        logger.warn({ scene: scene.sceneNumber }, 'Remotion scene failed');
      }
    }

    // Render browser scenes (2-4) as a batch
    const browserJobs = await renderBrowserScenes(browserScenes, outputDir, effectiveMethod, options);
    jobs.push(...browserJobs);

    // Sort by scene number for correct assembly order
    jobs.sort((a, b) => a.sceneNumber - b.sceneNumber);
  } else {
    // All remotion — use existing sequential path
    return renderAllRemotionScenes(scenes, outputDir, options);
  }

  return jobs;
}

/**
 * Renders all scenes sequentially via Remotion (original behavior).
 */
async function renderAllRemotionScenes(
  scenes: ScenePlan[],
  outputDir: string,
  options: { dryRun?: boolean } = {},
): Promise<RenderJob[]> {
  const jobs: RenderJob[] = [];

  for (const scene of scenes) {
    const job = await renderScene(scene, outputDir, options);
    jobs.push(job);

    if (job.status === 'error') {
      logger.warn({ scene: scene.sceneNumber }, 'Stopping render pipeline due to scene error');
      for (let i = scenes.indexOf(scene) + 1; i < scenes.length; i++) {
        jobs.push({
          sceneNumber: scenes[i].sceneNumber,
          compositionId: scenes[i].compositionId ?? 'unknown',
          status: 'pending',
        });
      }
      break;
    }
  }

  return jobs;
}
