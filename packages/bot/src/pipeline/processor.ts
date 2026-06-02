import { logger } from '../config.js';
import {
  getParentTweetWithMedia,
  hasExistingReplyToMention,
  downloadImage,
  uploadMedia,
  replyWithMedia,
  replyWithError,
  ParentTweetUnavailableError,
} from '../twitter/media.js';
import { renderChartToPng, getDefaultConfig, addWatermark } from '@chartsuno/shared/node';
import { analyzeAndCreateChart, promptAndCreateChart } from '../services/chartsunoApi.js';
import { loadState, updateState } from '../storage.js';
import type { MentionData } from '../twitter/mentions.js';

const MAX_PROCESSED_MENTIONS = 1000;
const CHARTABLE_TYPES = new Set(['bar', 'line', 'area', 'pie', 'radar', 'scatter']);
const X_REPLY_COLOR_SCHEMES = ['default', 'warm', 'cool', 'editorial', 'muted'] as const;
const X_REPLY_STYLE_VARIANTS = ['professional', 'editorial', 'minimalist', 'bold'] as const;
const X_REPLY_THEME_MODES = ['dark', 'light'] as const;
export type ProcessMentionResult = 'completed' | 'deferred';

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

function buildPromptFromTweetText(tweetText: string, authorUsername: string): string {
  return [
    'Extract chart data from this X post text.',
    'Use exact numeric values when present.',
    'Do not invent values if explicit data is already listed.',
    `Author: @${authorUsername}`,
    '',
    tweetText.trim(),
  ].join('\n');
}

function pickRandomItem<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export async function processMention(mention: MentionData): Promise<ProcessMentionResult> {
  const { mentionId, parentTweetId, action } = mention;
  const mentionActionKey = `${mentionId}:${action}`;

  // Skip if already processed
  const processed = await getProcessedMentions();
  if (processed.has(mentionActionKey) || processed.has(mentionId)) {
    logger.debug({ mentionId, action }, 'Skipping already processed mention');
    return 'completed';
  }

  // Belt-and-suspenders dedupe: if we've already replied on X, don't post again.
  if (await hasExistingReplyToMention(mentionId)) {
    logger.info({ mentionId, action }, 'Skipping mention because bot already replied');
    await markProcessed(mentionActionKey);
    return 'completed';
  }

  logger.info({ mentionId, parentTweetId }, 'Processing mention');

  try {
    // Step 1: Get the parent tweet (image preferred; text fallback supported)
    if (!parentTweetId) {
      await replyWithError(mentionId, "I couldn't find the tweet you're replying to!");
      await markProcessed(mentionActionKey);
      return 'completed';
    }

    const parentTweet = await getParentTweetWithMedia(parentTweetId);

    // Step 2: Use the same backend AI path as web upload and create a shareable chart.
    let result: Awaited<ReturnType<typeof analyzeAndCreateChart>> | null = null;
    if (parentTweet.imageUrl) {
      logger.info({ imageUrl: parentTweet.imageUrl }, 'Found image in parent tweet');
      const sourceImage = await downloadImage(parentTweet.imageUrl);
      result = await analyzeAndCreateChart(sourceImage, parentTweet.imageUrl);
    } else {
      if (!parentTweet.tweetText.trim()) {
        await replyWithError(
          mentionId,
          "I couldn't find an image or readable text in that tweet. Reply to a chart image or a tweet that lists data values."
        );
        await markProcessed(mentionActionKey);
        return 'completed';
      }
      logger.info({ parentTweetId, tweetUrl: parentTweet.tweetUrl }, 'No image found; using tweet text fallback');
      const prompt = buildPromptFromTweetText(parentTweet.tweetText, parentTweet.authorUsername);
      result = await promptAndCreateChart(prompt, parentTweet.tweetUrl);
    }

    if (!result) {
      await markProcessed(mentionActionKey);
      return 'completed';
    }
    const { chartData, chartUrl } = result;

    logger.info(
      { labels: chartData.labels.length, series: chartData.series.length },
      'Chart data extracted'
    );

    // Step 3: Render the chart with Recharts + Puppeteer
    const config = getDefaultConfig(chartData);
    config.colorScheme = pickRandomItem(X_REPLY_COLOR_SCHEMES);
    config.styleVariant = pickRandomItem(X_REPLY_STYLE_VARIANTS);
    config.themeMode = pickRandomItem(X_REPLY_THEME_MODES);

    if (action === 'reverse') {
      config.type = 'table';
      config.showLegend = true;
      config.showGrid = false;
    } else {
      // "chart it" should always render an actual chart, never a table view.
      if (!CHARTABLE_TYPES.has(config.type)) {
        config.type = chartData.series.length > 1 ? 'bar' : 'line';
      }
      config.showGrid = true;
      config.showLegend = chartData.series.length > 1;
    }

    logger.info(
      {
        action,
        chartType: config.type,
        colorScheme: config.colorScheme,
        styleVariant: config.styleVariant,
        themeMode: config.themeMode,
        labels: chartData.labels.length,
        series: chartData.series.length,
      },
      'Selected render mode for mention'
    );
    const chartPng = await renderChartToPng(chartData, config);

    // Step 4: Add watermark
    const watermarkedPng = await addWatermark(chartPng);

    // Step 5: Upload the image and reply
    const mediaId = await uploadMedia(watermarkedPng);

    const replyText =
      action === 'reverse'
        ? `Here's your table! 📋✨\n${chartUrl}`
        : `Here's your chart! 📊✨\n${chartUrl}`;
    await replyWithMedia(mentionId, replyText, mediaId);

    // Mark as processed only AFTER the reply is successfully posted
    await markProcessed(mentionActionKey);

    logger.info({ mentionId }, 'Successfully processed mention and posted reply');
    return 'completed';
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    logger.error({ mentionId, errorMessage, errorStack }, 'Error processing mention');

    // Determine if we should reply with an error
    let repliedWithError = false;
    if (error instanceof Error) {
      if (error instanceof ParentTweetUnavailableError) {
        await replyWithError(
          mentionId,
          "I couldn't access the tweet you're replying to. It may have been deleted, protected, or unavailable to me."
        );
        repliedWithError = true;
      } else if (error.message.includes('No chartable data found')) {
        await replyWithError(
          mentionId,
          "I couldn't extract chart data from that tweet. Make sure it contains a clear chart image or explicit numeric values."
        );
        repliedWithError = true;
      } else if (error.message.includes('Invalid data structure')) {
        await replyWithError(
          mentionId,
          "I had trouble understanding the data in that tweet. Try a clearer chart image or a cleaner text table."
        );
        repliedWithError = true;
      } else if (error.message.includes('Request failed with code 403')) {
        await replyWithError(
          mentionId,
          "I parsed your chart, but I couldn't upload the image response due to X API permissions. I'm retrying once permissions are updated."
        );
        repliedWithError = true;
      }
    }

    // Only mark as processed if we sent a user-visible error reply (terminal failure).
    // Transient errors (network, 500, auth) should NOT be marked — allow retry next cycle.
    if (repliedWithError) {
      await markProcessed(mentionActionKey);
      return 'completed';
    }

    return 'deferred';
  }
}

export function clearProcessedMentions(): void {
  processedMentions = null;
  logger.info('Cleared processed mentions cache');
}
