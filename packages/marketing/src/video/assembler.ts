import { execFile } from 'node:child_process';
import { writeFile, unlink, access } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { logger } from '../config.js';
import type { RenderJob } from './types.js';

const execFileAsync = promisify(execFile);

export interface AssembleOptions {
  dryRun?: boolean;
  ffmpegPath?: string;
  /** Path to a background music file (mp3/m4a/wav) */
  musicPath?: string;
  /** Music volume relative to video (0.0–1.0, default 0.15) */
  musicVolume?: number;
  /** Fade music out over the last N seconds (default 3) */
  musicFadeOutSeconds?: number;
}

/**
 * Concatenates rendered scene MP4s into a single final video using ffmpeg.
 *
 * Uses ffmpeg's concat demuxer for lossless joining of same-codec clips.
 * Optionally mixes in a background music track with volume control and fade-out.
 */
export async function assembleVideo(
  renderJobs: RenderJob[],
  outputPath: string,
  options: AssembleOptions = {},
): Promise<string> {
  const ffmpeg = options.ffmpegPath ?? process.env.FFMPEG_PATH ?? 'ffmpeg';

  // Filter to successfully rendered scenes, in order
  const completed = renderJobs
    .filter((j) => j.status === 'done' && j.outputPath)
    .sort((a, b) => a.sceneNumber - b.sceneNumber);

  if (completed.length === 0) {
    throw new Error('No rendered scenes to assemble');
  }

  if (options.dryRun) {
    logger.info({
      sceneCount: completed.length,
      outputPath,
      hasMusic: !!options.musicPath,
    }, '[DRY RUN] Would assemble video');
    return outputPath;
  }

  // Write ffmpeg concat list file (absolute paths required for concat demuxer)
  const concatListPath = join(outputPath, '..', 'concat-list.txt');
  const concatContent = completed
    .map((j) => `file '${resolve(j.outputPath!)}'`)
    .join('\n');
  await writeFile(concatListPath, concatContent, 'utf-8');

  const startMs = Date.now();

  try {
    if (options.musicPath) {
      await assembleWithMusic(ffmpeg, concatListPath, outputPath, options);
    } else {
      await assembleWithoutMusic(ffmpeg, concatListPath, outputPath);
    }

    const durationMs = Date.now() - startMs;
    logger.info({ durationMs, outputPath }, 'Video assembly complete');

    // Cleanup concat list
    await unlink(concatListPath).catch(() => { /* ignore */ });

    return outputPath;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`ffmpeg assembly failed: ${message}`);
  }
}

/**
 * Simple concat without audio mixing.
 */
async function assembleWithoutMusic(
  ffmpeg: string,
  concatListPath: string,
  outputPath: string,
): Promise<void> {
  logger.info({ outputPath }, 'Assembling video (no music)');

  await execFileAsync(ffmpeg, [
    '-y',
    '-f', 'concat',
    '-safe', '0',
    '-i', concatListPath,
    '-c', 'copy',
    '-movflags', '+faststart',
    outputPath,
  ]);
}

/**
 * Concat video scenes and mix in background music.
 *
 * Uses a two-pass approach:
 * 1. Concat video scenes into a temp file
 * 2. Mix music into the temp file with volume + fade-out filters
 *
 * The music is:
 * - Looped to cover the full video duration (if shorter)
 * - Trimmed to match video duration (if longer)
 * - Faded out over the last N seconds
 * - Mixed at configurable volume (default 15%)
 */
async function assembleWithMusic(
  ffmpeg: string,
  concatListPath: string,
  outputPath: string,
  options: AssembleOptions,
): Promise<void> {
  const musicPath = options.musicPath!;
  const musicVolume = options.musicVolume ?? 0.15;
  const fadeOutSec = options.musicFadeOutSeconds ?? 3;

  // Verify music file exists
  try {
    await access(musicPath);
  } catch {
    logger.warn({ musicPath }, 'Music file not found, assembling without music');
    await assembleWithoutMusic(ffmpeg, concatListPath, outputPath);
    return;
  }

  logger.info({ outputPath, musicPath, musicVolume }, 'Assembling video with background music');

  // Step 1: Concat scenes to a temp file
  const tempVideoPath = outputPath.replace(/\.mp4$/, '.tmp.mp4');

  await execFileAsync(ffmpeg, [
    '-y',
    '-f', 'concat',
    '-safe', '0',
    '-i', concatListPath,
    '-c', 'copy',
    '-movflags', '+faststart',
    tempVideoPath,
  ]);

  // Step 2: Get video duration for fade-out calculation
  const probeResult = await execFileAsync(ffmpeg.replace('ffmpeg', 'ffprobe'), [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'csv=p=0',
    tempVideoPath,
  ]).catch(() => ({ stdout: '22' })); // fallback to ~22s

  const videoDuration = parseFloat(probeResult.stdout.trim()) || 22;
  const fadeOutStart = Math.max(0, videoDuration - fadeOutSec);

  // Step 3: Mix music into the video
  // Audio filter chain:
  // - Loop music to ensure it covers full video
  // - Set volume
  // - Apply fade-out at the end
  // - Trim to video duration
  const audioFilter = [
    `[1:a]aloop=loop=-1:size=2e+09,`,
    `atrim=0:${videoDuration},`,
    `volume=${musicVolume},`,
    `afade=t=out:st=${fadeOutStart}:d=${fadeOutSec}[music]`,
  ].join('');

  await execFileAsync(ffmpeg, [
    '-y',
    '-i', tempVideoPath,
    '-stream_loop', '-1',
    '-i', musicPath,
    '-filter_complex', audioFilter,
    '-map', '0:v',
    '-map', '[music]',
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-shortest',
    '-movflags', '+faststart',
    outputPath,
  ]);

  // Cleanup temp file
  await unlink(tempVideoPath).catch(() => { /* ignore */ });
}

/**
 * Insert an avatar clip at the beginning of an existing video.
 *
 * Used when HeyGen generates a talking-head intro that needs
 * to be prepended to the main video.
 */
export async function prependAvatarClip(
  avatarClipPath: string,
  mainVideoPath: string,
  outputPath: string,
  options: { ffmpegPath?: string } = {},
): Promise<string> {
  const ffmpeg = options.ffmpegPath ?? process.env.FFMPEG_PATH ?? 'ffmpeg';

  const concatListPath = join(outputPath, '..', 'avatar-concat.txt');
  const concatContent = [
    `file '${resolve(avatarClipPath)}'`,
    `file '${resolve(mainVideoPath)}'`,
  ].join('\n');
  await writeFile(concatListPath, concatContent, 'utf-8');

  logger.info({ avatarClipPath, mainVideoPath, outputPath }, 'Prepending avatar clip');

  // Re-encode to ensure compatible codecs between avatar and main video
  await execFileAsync(ffmpeg, [
    '-y',
    '-f', 'concat',
    '-safe', '0',
    '-i', concatListPath,
    '-c:v', 'libx264',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-movflags', '+faststart',
    outputPath,
  ]);

  await unlink(concatListPath).catch(() => { /* ignore */ });
  return outputPath;
}
