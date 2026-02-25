import { execFile } from 'node:child_process';
import { writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { logger } from '../config.js';
import type { RenderJob } from './types.js';

const execFileAsync = promisify(execFile);

/**
 * Concatenates rendered scene MP4s into a single final video using ffmpeg.
 *
 * Uses ffmpeg's concat demuxer for lossless joining of same-codec clips.
 */
export async function assembleVideo(
  renderJobs: RenderJob[],
  outputPath: string,
  options: { dryRun?: boolean; ffmpegPath?: string } = {},
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
    }, '[DRY RUN] Would assemble video');
    return outputPath;
  }

  // Write ffmpeg concat list file
  const concatListPath = join(outputPath, '..', 'concat-list.txt');
  const concatContent = completed
    .map((j) => `file '${j.outputPath}'`)
    .join('\n');
  await writeFile(concatListPath, concatContent, 'utf-8');

  logger.info({
    sceneCount: completed.length,
    outputPath,
  }, 'Assembling final video');

  const startMs = Date.now();

  try {
    await execFileAsync(ffmpeg, [
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', concatListPath,
      '-c', 'copy',
      '-movflags', '+faststart',
      outputPath,
    ]);

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
