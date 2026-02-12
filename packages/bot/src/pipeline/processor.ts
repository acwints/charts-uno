import { logger } from '../config.js';
import {
  getParentTweetWithMedia,
  downloadImage,
  uploadMedia,
  replyWithMedia,
  replyWithError,
} from '../twitter/media.js';
import { analyzeImageFromBuffer, analyzeImageFromUrl } from '../chart/analyzer.js';
import { renderChartToPng, getDefaultConfig } from '../chart/renderer.js';
import { addWatermark } from '../chart/watermark.js';
import { loadState, updateState } from '../storage.js';
import type { MentionData } from '../twitter/mentions.js';

const MAX_PROCESSED_MENTIONS = 1000;

let processedMentions: Set<string> | null = null;

async function getProcessedMentions(): Promise<Set<string>> {
  if (!processedMentions) {
    const state = await loadState();
    processedMentions = new Set(state.processedMentions);
  }
  return processedMentions;
}

async function markProcessed(mentionId: string): Promise<void> {
  const set = await getProcessedMentions();
  set.add(mentionId);

  // Cap at MAX_PROCESSED_MENTIONS to prevent unbounded growth
  const entries = [...set];
  if (entries.length > MAX_PROCESSED_MENTIONS) {
    const trimmed = entries.slice(entries.length - MAX_PROCESSED_MENTIONS);
    processedMentions = new Set(trimmed);
  }

  await updateState({ processedMentions: [...(processedMentions || set)] });
}

export async function processMention(mention: MentionData): Promise<void> {
  const { mentionId, parentTweetId } = mention;

  // Skip if already processed
  const processed = await getProcessedMentions();
  if (processed.has(mentionId)) {
    logger.debug({ mentionId }, 'Skipping already processed mention');
    return;
  }

  await markProcessed(mentionId);

  logger.info({ mentionId, parentTweetId }, 'Processing mention');

  try {
    // Step 1: Get the parent tweet and find the image
    if (!parentTweetId) {
      await replyWithError(mentionId, "I couldn't find the tweet you're replying to!");
      return;
    }

    const parentTweet = await getParentTweetWithMedia(parentTweetId);

    if (!parentTweet.imageUrl) {
      await replyWithError(mentionId, "I couldn't find an image in that tweet! Please reply to a tweet that contains a chart image.");
      return;
    }

    logger.info({ imageUrl: parentTweet.imageUrl }, 'Found image in parent tweet');

    // Step 2: Analyze the image with Gemini Vision
    let chartData;
    try {
      // Try analyzing directly from URL first
      chartData = await analyzeImageFromUrl(parentTweet.imageUrl);
    } catch (urlError) {
      // If URL fails, download and analyze from buffer
      logger.warn({ error: urlError }, 'URL analysis failed, trying buffer');
      const imageBuffer = await downloadImage(parentTweet.imageUrl);
      chartData = await analyzeImageFromBuffer(imageBuffer);
    }

    logger.info(
      { labels: chartData.labels.length, series: chartData.series.length },
      'Chart data extracted'
    );

    // Step 3: Render the chart with Recharts + Puppeteer
    const config = getDefaultConfig(chartData);
    const chartPng = await renderChartToPng(chartData, config);

    // Step 4: Add watermark
    const watermarkedPng = await addWatermark(chartPng);

    // Step 5: Upload the image and reply
    const mediaId = await uploadMedia(watermarkedPng);

    const replyText = `Here's your epic chart! 📊✨`;
    await replyWithMedia(mentionId, replyText, mediaId);

    logger.info({ mentionId }, 'Successfully processed mention and posted reply');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    logger.error({ mentionId, errorMessage, errorStack }, 'Error processing mention');

    // Determine if we should reply with an error
    if (error instanceof Error) {
      if (error.message.includes('No chartable data found')) {
        await replyWithError(
          mentionId,
          "I couldn't extract chart data from that image. Make sure it contains a clear chart, table, or data visualization!"
        );
      } else if (error.message.includes('Invalid data structure')) {
        await replyWithError(
          mentionId,
          "I had trouble understanding the data in that image. Try with a clearer chart!"
        );
      } else if (error.message.includes('Request failed with code 403')) {
        await replyWithError(
          mentionId,
          "I parsed your chart, but I couldn't upload the image response due to X API permissions. I'm retrying once permissions are updated."
        );
      }
      // For other errors, don't reply to avoid spam
    }
  }
}

export function clearProcessedMentions(): void {
  processedMentions = null;
  logger.info('Cleared processed mentions cache');
}
