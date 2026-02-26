import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { promisify } from 'node:util';
import { logger, marketingConfig } from '../config.js';
import type { BrowserScriptId } from './types.js';

const execFileAsync = promisify(execFile);

// ─── Sample Data ──────────────────────────────────────────────────

const SAMPLE_CSV = `Month,Revenue,Users
Jan,42,28
Feb,58,45
Mar,35,52
Apr,72,38
May,61,67
Jun,89,54`;

// ─── Types ────────────────────────────────────────────────────────

export interface AgentBrowserOptions {
  /** Base URL to capture (default: config captureUrl) */
  url?: string;
  /** Output directory for captured files */
  outputDir: string;
  /** Viewport dimensions */
  viewport?: { width: number; height: number };
  /** Total capture duration in seconds */
  durationSeconds?: number;
}

export interface VideoCaptureResult {
  videoPath: string;
  durationMs: number;
}

export interface ScreenshotCaptureResult {
  screenshotPaths: string[];
  durationMs: number;
}

// ─── Availability Check ───────────────────────────────────────────

/**
 * Checks if agent-browser CLI is available on the system.
 */
export async function isAgentBrowserAvailable(): Promise<boolean> {
  const cmd = marketingConfig.marketing.agentBrowserCommand;
  try {
    await execFileAsync(cmd, ['--version']);
    return true;
  } catch {
    return false;
  }
}

// ─── Core Capture Functions ───────────────────────────────────────

/**
 * Records a real-time video of browser interaction using agent-browser.
 *
 * Runs the full ChartsUno interaction script while recording,
 * producing an MP4 of the actual app in use.
 */
export async function captureVideo(options: AgentBrowserOptions): Promise<VideoCaptureResult> {
  const cmd = marketingConfig.marketing.agentBrowserCommand;
  const url = options.url ?? marketingConfig.marketing.captureUrl;
  const { width = 1080, height = 1920 } = options.viewport ?? {};
  const outputDir = options.outputDir;
  await mkdir(outputDir, { recursive: true });

  const videoPath = join(outputDir, 'browser-capture.mp4');
  const sessionName = `chartsuno-capture-${Date.now()}`;
  const startMs = Date.now();

  logger.info({ url, outputDir, sessionName }, 'Starting agent-browser video capture');

  try {
    // Open browser session
    await execFileAsync(cmd, [
      'open', `${url}/new`,
      '--viewport', `${width}x${height}`,
      '--session', sessionName,
    ], { timeout: 30_000 });

    // Start recording
    await execFileAsync(cmd, [
      'record', 'start',
      '--session', sessionName,
      '--output', videoPath,
    ], { timeout: 10_000 });

    // Run interaction script
    await runInteractionScript('problem-ugly', sessionName, cmd);
    await runInteractionScript('transform-ugly-to-beautiful', sessionName, cmd);
    await runInteractionScript('showcase-features', sessionName, cmd);

    // Stop recording
    await execFileAsync(cmd, [
      'record', 'stop',
      '--session', sessionName,
    ], { timeout: 10_000 });

    // Close session
    await execFileAsync(cmd, ['close', '--session', sessionName]).catch(() => {});

    const durationMs = Date.now() - startMs;
    logger.info({ durationMs, videoPath }, 'Agent-browser video capture complete');

    return { videoPath, durationMs };
  } catch (error) {
    // Ensure session is cleaned up on failure
    await execFileAsync(cmd, ['close', '--session', sessionName]).catch(() => {});
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`agent-browser video capture failed: ${message}`);
  }
}

/**
 * Captures screenshots at key moments of the browser interaction.
 *
 * Runs the ChartsUno interaction script, taking screenshots at scene
 * boundaries. Returns paths to all captured screenshots.
 */
export async function captureScreenshots(options: AgentBrowserOptions): Promise<ScreenshotCaptureResult> {
  const cmd = marketingConfig.marketing.agentBrowserCommand;
  const url = options.url ?? marketingConfig.marketing.captureUrl;
  const { width = 1080, height = 1920 } = options.viewport ?? {};
  const outputDir = options.outputDir;
  await mkdir(outputDir, { recursive: true });

  const sessionName = `chartsuno-capture-${Date.now()}`;
  const startMs = Date.now();
  const screenshotPaths: string[] = [];

  logger.info({ url, outputDir, sessionName }, 'Starting agent-browser screenshot capture');

  try {
    // Open browser session
    await execFileAsync(cmd, [
      'open', `${url}/new`,
      '--viewport', `${width}x${height}`,
      '--session', sessionName,
    ], { timeout: 30_000 });

    // Wait for page load
    await execFileAsync(cmd, [
      'wait', '--session', sessionName,
      '--event', 'networkidle',
    ], { timeout: 15_000 });

    // ── Shared setup: paste CSV data ──
    await execFileAsync(cmd, [
      'click', '--session', sessionName,
      '--selector', '.mode-tab:has-text("Paste")',
    ], { timeout: 10_000 });

    await execFileAsync(cmd, [
      'fill', '--session', sessionName,
      '--selector', '.paste-textarea',
      '--value', SAMPLE_CSV,
    ], { timeout: 10_000 });

    await execFileAsync(cmd, [
      'click', '--session', sessionName,
      '--selector', 'button:has-text("Generate Chart")',
    ], { timeout: 10_000 });

    // Wait for chart to render
    await execFileAsync(cmd, [
      'wait', '--session', sessionName,
      '--selector', '.recharts-wrapper',
    ], { timeout: 15_000 });

    // ── Scene 2: Problem — ugly default chart ──
    const scene2Path = join(outputDir, 'scene2-problem-001.png');
    await execFileAsync(cmd, [
      'screenshot', '--session', sessionName,
      '--output', scene2Path,
    ], { timeout: 10_000 });
    screenshotPaths.push(scene2Path);

    // Extra frame for scene 2
    await sleep(500);
    const scene2Path2 = join(outputDir, 'scene2-problem-002.png');
    await execFileAsync(cmd, [
      'screenshot', '--session', sessionName,
      '--output', scene2Path2,
    ], { timeout: 10_000 });
    screenshotPaths.push(scene2Path2);

    // ── Scene 3: Transform — apply editorial theme ──
    await execFileAsync(cmd, [
      'click', '--session', sessionName,
      '--selector', '[aria-label="Editorial color scheme"]',
    ], { timeout: 10_000 });
    await sleep(600);

    const scene3Path1 = join(outputDir, 'scene3-transform-001.png');
    await execFileAsync(cmd, [
      'screenshot', '--session', sessionName,
      '--output', scene3Path1,
    ], { timeout: 10_000 });
    screenshotPaths.push(scene3Path1);

    await sleep(400);
    const scene3Path2 = join(outputDir, 'scene3-transform-002.png');
    await execFileAsync(cmd, [
      'screenshot', '--session', sessionName,
      '--output', scene3Path2,
    ], { timeout: 10_000 });
    screenshotPaths.push(scene3Path2);

    // ── Scene 4: Showcase — switch to line chart + cool scheme ──
    await execFileAsync(cmd, [
      'click', '--session', sessionName,
      '--selector', '.style-card:nth-child(3)',
    ], { timeout: 10_000 });
    await sleep(400);

    await execFileAsync(cmd, [
      'click', '--session', sessionName,
      '--selector', '[aria-label="Cool color scheme"]',
    ], { timeout: 10_000 });
    await sleep(600);

    const scene4Path1 = join(outputDir, 'scene4-showcase-001.png');
    await execFileAsync(cmd, [
      'screenshot', '--session', sessionName,
      '--output', scene4Path1,
    ], { timeout: 10_000 });
    screenshotPaths.push(scene4Path1);

    await sleep(300);
    const scene4Path2 = join(outputDir, 'scene4-showcase-002.png');
    await execFileAsync(cmd, [
      'screenshot', '--session', sessionName,
      '--output', scene4Path2,
    ], { timeout: 10_000 });
    screenshotPaths.push(scene4Path2);

    // Close session
    await execFileAsync(cmd, ['close', '--session', sessionName]).catch(() => {});

    const durationMs = Date.now() - startMs;
    logger.info({ durationMs, screenshots: screenshotPaths.length }, 'Agent-browser screenshot capture complete');

    return { screenshotPaths, durationMs };
  } catch (error) {
    await execFileAsync(cmd, ['close', '--session', sessionName]).catch(() => {});
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`agent-browser screenshot capture failed: ${message}`);
  }
}

// ─── Interaction Scripts ──────────────────────────────────────────

/**
 * Executes a named interaction script on an open agent-browser session.
 *
 * Scripts are segments of the ChartsUno story:
 * - `problem-ugly`: Paste CSV → generate ugly default chart
 * - `transform-ugly-to-beautiful`: Apply editorial color scheme
 * - `showcase-features`: Switch chart type + cool scheme
 */
export async function runInteractionScript(
  scriptId: BrowserScriptId,
  sessionName: string,
  cmd?: string,
): Promise<void> {
  const agentCmd = cmd ?? marketingConfig.marketing.agentBrowserCommand;

  switch (scriptId) {
    case 'problem-ugly': {
      // Click Paste tab
      await execFileAsync(agentCmd, [
        'click', '--session', sessionName,
        '--selector', '.mode-tab:has-text("Paste")',
      ], { timeout: 10_000 });

      // Fill CSV data
      await execFileAsync(agentCmd, [
        'fill', '--session', sessionName,
        '--selector', '.paste-textarea',
        '--value', SAMPLE_CSV,
      ], { timeout: 10_000 });

      // Generate chart
      await execFileAsync(agentCmd, [
        'click', '--session', sessionName,
        '--selector', 'button:has-text("Generate Chart")',
      ], { timeout: 10_000 });

      // Wait for chart
      await execFileAsync(agentCmd, [
        'wait', '--session', sessionName,
        '--selector', '.recharts-wrapper',
      ], { timeout: 15_000 });

      await sleep(1000);
      break;
    }

    case 'transform-ugly-to-beautiful': {
      // Apply editorial color scheme
      await execFileAsync(agentCmd, [
        'click', '--session', sessionName,
        '--selector', '[aria-label="Editorial color scheme"]',
      ], { timeout: 10_000 });

      await sleep(600);
      break;
    }

    case 'showcase-features': {
      // Switch to line chart (3rd style card)
      await execFileAsync(agentCmd, [
        'click', '--session', sessionName,
        '--selector', '.style-card:nth-child(3)',
      ], { timeout: 10_000 });

      await sleep(400);

      // Apply cool color scheme
      await execFileAsync(agentCmd, [
        'click', '--session', sessionName,
        '--selector', '[aria-label="Cool color scheme"]',
      ], { timeout: 10_000 });

      await sleep(600);
      break;
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
