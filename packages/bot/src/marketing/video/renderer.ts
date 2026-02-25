import { resolve, join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { FPS, VIDEO_WIDTH, VIDEO_HEIGHT, secondsToFrames } from '@chartsuno/video';
import { logger } from '../config.js';
import type { ScenePlan, RenderJob } from './types.js';

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
 * Renders a single scene to MP4 using @remotion/renderer.
 */
export async function renderScene(
  scene: ScenePlan,
  outputDir: string,
  options: { dryRun?: boolean } = {},
): Promise<RenderJob> {
  const job: RenderJob = {
    sceneNumber: scene.sceneNumber,
    compositionId: scene.compositionId,
    status: 'pending',
  };

  const outputPath = join(outputDir, `scene-${scene.sceneNumber}.mp4`);

  if (options.dryRun) {
    logger.info({
      scene: scene.sceneNumber,
      compositionId: scene.compositionId,
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
      id: scene.compositionId,
      inputProps: scene.props,
    });

    const startMs = Date.now();

    await renderMedia({
      composition: {
        ...composition,
        width: VIDEO_WIDTH,
        height: VIDEO_HEIGHT,
        fps: FPS,
        durationInFrames,
        props: scene.props,
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

/**
 * Renders all scenes sequentially.
 */
export async function renderAllScenes(
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
      // Mark remaining scenes as pending
      for (let i = scene.sceneNumber; i < scenes.length; i++) {
        jobs.push({
          sceneNumber: scenes[i].sceneNumber,
          compositionId: scenes[i].compositionId,
          status: 'pending',
        });
      }
      break;
    }
  }

  return jobs;
}
