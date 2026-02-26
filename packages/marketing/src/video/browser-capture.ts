import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import puppeteer, { type Browser, type Page } from 'puppeteer';
import { logger } from '../config.js';

export interface CaptureOptions {
  /** URL to navigate to */
  url: string;
  /** Output directory for screenshots/recordings */
  outputDir: string;
  /** Viewport width */
  width?: number;
  /** Viewport height */
  height?: number;
  /** Steps to execute on the page before/during capture */
  steps: CaptureStep[];
}

export type CaptureStep =
  | { type: 'wait'; ms: number }
  | { type: 'screenshot'; filename: string }
  | { type: 'click'; selector: string }
  | { type: 'select-theme'; theme: string }
  | { type: 'select-chart-type'; chartType: string }
  | { type: 'scroll'; y: number }
  | { type: 'evaluate'; script: string };

export interface CaptureResult {
  screenshots: string[];
  durationMs: number;
}

/**
 * Captures a series of screenshots from a live browser session.
 *
 * Designed for recording chartsuno.com interactions:
 * - Navigate to the app
 * - Show an ugly default chart
 * - Apply a theme transformation
 * - Capture the beautiful result
 *
 * These screenshots can be assembled into a video scene via ffmpeg
 * or used as still frames in Remotion compositions.
 */
export async function captureSession(options: CaptureOptions): Promise<CaptureResult> {
  const {
    url,
    outputDir,
    width = 1080,
    height = 1920,
    steps,
  } = options;

  await mkdir(outputDir, { recursive: true });

  const startMs = Date.now();
  const screenshots: string[] = [];
  let browser: Browser | null = null;

  try {
    logger.info({ url, steps: steps.length }, 'Starting browser capture session');

    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        `--window-size=${width},${height}`,
      ],
    });

    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 2 });

    // Navigate to target
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
    logger.info({ url }, 'Page loaded');

    // Execute capture steps
    for (const step of steps) {
      await executeStep(page, step, outputDir, screenshots);
    }

    const durationMs = Date.now() - startMs;
    logger.info({ durationMs, screenshots: screenshots.length }, 'Browser capture complete');

    return { screenshots, durationMs };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ error: message }, 'Browser capture failed');
    throw new Error(`Browser capture failed: ${message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function executeStep(
  page: Page,
  step: CaptureStep,
  outputDir: string,
  screenshots: string[],
): Promise<void> {
  switch (step.type) {
    case 'wait':
      await new Promise((resolve) => setTimeout(resolve, step.ms));
      break;

    case 'screenshot': {
      const path = join(outputDir, step.filename);
      await page.screenshot({ path, type: 'png', fullPage: false });
      screenshots.push(path);
      logger.debug({ filename: step.filename }, 'Screenshot captured');
      break;
    }

    case 'click':
      await page.click(step.selector);
      // Brief pause for UI to react
      await new Promise((resolve) => setTimeout(resolve, 300));
      break;

    case 'select-theme':
      // Click color scheme by aria-label (e.g. "Editorial color scheme")
      await page.evaluate((theme) => {
        const label = `${theme.charAt(0).toUpperCase() + theme.slice(1)} color scheme`;
        const btn = document.querySelector(`[aria-label="${label}"]`) as HTMLElement | null;
        btn?.click();
      }, step.theme);
      await new Promise((resolve) => setTimeout(resolve, 500));
      break;

    case 'select-chart-type':
      // Click chart style card by position (bar=1, area=2, line=3)
      await page.evaluate((chartType) => {
        const index = chartType === 'bar' ? 1 : chartType === 'area' ? 2 : 3;
        const card = document.querySelector(`.style-card:nth-child(${index})`) as HTMLElement | null;
        card?.click();
      }, step.chartType);
      await new Promise((resolve) => setTimeout(resolve, 500));
      break;

    case 'scroll':
      await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'smooth' }), step.y);
      await new Promise((resolve) => setTimeout(resolve, 400));
      break;

    case 'evaluate':
      await page.evaluate(step.script);
      break;
  }
}

/**
 * Pre-built capture sequence: "ugly → beautiful" transformation.
 *
 * Takes 8 screenshots at key moments of the transformation,
 * suitable for creating a timelapse-style video scene.
 */
export function getTransformCaptureSteps(): CaptureStep[] {
  return [
    // Initial state: default/ugly chart
    { type: 'wait', ms: 1000 },
    { type: 'screenshot', filename: 'frame-001-before.png' },
    { type: 'wait', ms: 500 },
    { type: 'screenshot', filename: 'frame-002-before.png' },

    // Apply beautiful theme
    { type: 'select-theme', theme: 'editorial' },
    { type: 'wait', ms: 200 },
    { type: 'screenshot', filename: 'frame-003-morphing.png' },
    { type: 'wait', ms: 300 },
    { type: 'screenshot', filename: 'frame-004-morphing.png' },

    // Switch chart type
    { type: 'select-chart-type', chartType: 'line' },
    { type: 'wait', ms: 200 },
    { type: 'screenshot', filename: 'frame-005-changing.png' },
    { type: 'wait', ms: 400 },
    { type: 'screenshot', filename: 'frame-006-beautiful.png' },

    // Final beauty shots
    { type: 'wait', ms: 500 },
    { type: 'screenshot', filename: 'frame-007-final.png' },
    { type: 'wait', ms: 300 },
    { type: 'screenshot', filename: 'frame-008-final.png' },
  ];
}

/**
 * Creates an MP4 from captured screenshots using ffmpeg.
 *
 * Produces a smooth video by interpolating between frames at the target FPS.
 */
export async function screenshotsToVideo(
  screenshotPaths: string[],
  outputPath: string,
  options: { fps?: number; ffmpegPath?: string } = {},
): Promise<string> {
  const { fps = 30, ffmpegPath = process.env.FFMPEG_PATH ?? 'ffmpeg' } = options;
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const { writeFile, unlink } = await import('node:fs/promises');
  const execFileAsync = promisify(execFile);

  // Write concat file — each screenshot held for multiple frames for smooth playback
  const framesPerShot = Math.max(1, Math.round(fps * 0.5)); // 0.5s per screenshot
  const concatListPath = join(outputPath, '..', 'frames-concat.txt');
  const lines = screenshotPaths.flatMap((p) => [
    `file '${p}'`,
    `duration ${framesPerShot / fps}`,
  ]);
  // ffmpeg concat needs the last file repeated without duration
  lines.push(`file '${screenshotPaths[screenshotPaths.length - 1]}'`);
  await writeFile(concatListPath, lines.join('\n'), 'utf-8');

  logger.info({ frames: screenshotPaths.length, outputPath }, 'Converting screenshots to video');

  await execFileAsync(ffmpegPath, [
    '-y',
    '-f', 'concat',
    '-safe', '0',
    '-i', concatListPath,
    '-vf', `fps=${fps},scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2`,
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    outputPath,
  ]);

  await unlink(concatListPath).catch(() => { /* ignore */ });
  return outputPath;
}
