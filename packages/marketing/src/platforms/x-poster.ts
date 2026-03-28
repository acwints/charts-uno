import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { TwitterApi, type TweetV2PostTweetResult } from 'twitter-api-v2';
import { logger, marketingConfig } from '../config.js';
import type { CarouselDeck, PostResult } from '../types.js';
import type { VideoProject } from '../video/types.js';

type MediaIds = [string] | [string, string] | [string, string, string] | [string, string, string, string];

// ─── Bot State (OAuth2 tokens) ────────────────────────────────────

interface BotOAuth2State {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope: string[];
}

async function loadBotOAuth2(): Promise<BotOAuth2State | null> {
  const botStatePath = process.env.BOT_STATE_PATH
    || resolve(dirname(marketingConfig.marketing.statePath), '../../bot/data/bot-state.json');
  try {
    const data = JSON.parse(await readFile(botStatePath, 'utf-8'));
    return data.oauth2 || null;
  } catch {
    return null;
  }
}

// ─── Twitter Client ───────────────────────────────────────────────

let twitterClient: TwitterApi | null = null;
let authMode: 'oauth2' | 'oauth1' = 'oauth1';

async function getTwitterClient(): Promise<TwitterApi> {
  if (twitterClient) return twitterClient;

  // Try OAuth2 from bot state first (for @chartsuno account)
  const oauth2 = await loadBotOAuth2();
  if (oauth2?.accessToken) {
    twitterClient = new TwitterApi(oauth2.accessToken);
    authMode = 'oauth2';
    logger.info('Using OAuth2 bot credentials for X posting');
    return twitterClient;
  }

  // Fall back to OAuth1
  const { twitter } = marketingConfig;
  if (twitter.accessToken && twitter.accessSecret && twitter.apiKey && twitter.apiSecret) {
    twitterClient = new TwitterApi({
      appKey: twitter.apiKey,
      appSecret: twitter.apiSecret,
      accessToken: twitter.accessToken,
      accessSecret: twitter.accessSecret,
    });
    authMode = 'oauth1';
    logger.info('Using OAuth1 credentials for X posting');
    return twitterClient;
  }

  throw new Error('No Twitter credentials available. Need either bot OAuth2 state or OAuth1 env vars.');
}

async function uploadMedia(imageBuffer: Buffer): Promise<string> {
  const client = await getTwitterClient();

  if (authMode === 'oauth2') {
    // Use X v2 media upload endpoint (same as bot)
    const oauth2 = await loadBotOAuth2();
    const form = new FormData();
    form.append('media', new Blob([new Uint8Array(imageBuffer)], { type: 'image/png' }), 'slide.png');
    form.append('media_category', 'tweet_image');
    form.append('media_type', 'image/png');

    const response = await fetch('https://api.x.com/2/media/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${oauth2!.accessToken}` },
      body: form,
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error({ status: response.status, body: errorText }, 'X v2 media upload failed');
      throw new Error(`Media upload failed with status ${response.status}: ${errorText}`);
    }

    const payload = (await response.json()) as { data?: { id?: string } };
    const mediaId = payload.data?.id;
    if (!mediaId) throw new Error('Media upload succeeded but no media id returned');
    return mediaId;
  }

  return client.v1.uploadMedia(imageBuffer, { mimeType: 'image/png' });
}

// ─── Carousel Posting ─────────────────────────────────────────────

/**
 * Post a carousel deck to X/Twitter.
 * Uploads up to 4 images per tweet (X limit), threads the rest.
 */
export async function postToX(
  deck: CarouselDeck,
  caption: string,
  options: { dryRun?: boolean } = {},
): Promise<PostResult> {
  if (options.dryRun) {
    logger.info({
      caption: caption.slice(0, 100),
      slideCount: deck.generatedImages.length,
    }, '[DRY RUN] Would post to X');

    return {
      platform: 'x',
      postId: 'dry-run',
      url: 'https://x.com/dry-run',
      postedAt: new Date().toISOString(),
      contentId: deck.id,
      format: 'carousel',
    };
  }

  const client = await getTwitterClient();

  // Upload all slide images
  const mediaIds: string[] = [];
  for (const slide of deck.generatedImages) {
    const imageBuffer = await readFile(slide.imagePath);
    const mediaId = await uploadMedia(imageBuffer);
    mediaIds.push(mediaId);
  }

  // X allows max 4 media per tweet — split into batches
  const firstBatch = mediaIds.slice(0, 4) as MediaIds;
  const secondBatch = mediaIds.slice(4);

  // Post main tweet with first 4 images
  const firstTweet: TweetV2PostTweetResult = await client.v2.tweet({
    text: caption,
    media: { media_ids: firstBatch },
  });

  logger.info({ tweetId: firstTweet.data.id }, 'Posted main tweet to X');

  // Thread remaining images if any
  if (secondBatch.length > 0) {
    await client.v2.tweet({
      text: '',
      reply: { in_reply_to_tweet_id: firstTweet.data.id },
      media: { media_ids: secondBatch as MediaIds },
    });
    logger.info('Posted thread reply with remaining slides');
  }

  let url: string;
  try {
    const me = await client.v2.me();
    url = `https://x.com/${me.data.username}/status/${firstTweet.data.id}`;
  } catch {
    url = `https://x.com/i/status/${firstTweet.data.id}`;
  }

  return {
    platform: 'x',
    postId: firstTweet.data.id,
    url,
    postedAt: new Date().toISOString(),
    contentId: deck.id,
    format: 'carousel',
  };
}

// ─── Video Upload ───────────────────────────────────────────────────

const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB chunks

/**
 * Upload a video to X using the chunked media upload API (v1.1).
 */
async function uploadVideoChunked(videoPath: string): Promise<string> {
  const videoBuffer = await readFile(videoPath);
  const client = await getTwitterClient();

  const mediaId = await client.v1.uploadMedia(videoBuffer, {
    mimeType: 'video/mp4',
    target: 'tweet',
    chunkLength: CHUNK_SIZE,
  });

  logger.info({ mediaId }, 'Video uploaded via chunked upload');
  return mediaId;
}

/**
 * Post a video to X/Twitter.
 * Uploads via chunked media API, then tweets with the video attached.
 */
export async function postVideoToX(
  video: VideoProject,
  caption: string,
  options: { dryRun?: boolean } = {},
): Promise<PostResult> {
  if (options.dryRun) {
    logger.info({
      caption: caption.slice(0, 100),
      videoId: video.id,
    }, '[DRY RUN] Would post video to X');

    return {
      platform: 'x',
      postId: 'dry-run',
      url: 'https://x.com/dry-run',
      postedAt: new Date().toISOString(),
      contentId: video.id,
      format: 'video',
    };
  }

  if (!video.finalVideoPath) {
    throw new Error('Video has no final video path — render it first');
  }

  const client = await getTwitterClient();

  // Upload video via chunked API
  logger.info({ videoPath: video.finalVideoPath }, 'Uploading video to X');
  const mediaId = await uploadVideoChunked(video.finalVideoPath);

  // Post tweet with video
  const tweet: TweetV2PostTweetResult = await client.v2.tweet({
    text: caption,
    media: { media_ids: [mediaId] as MediaIds },
  });

  logger.info({ tweetId: tweet.data.id }, 'Posted video tweet to X');

  let url: string;
  try {
    const me = await client.v2.me();
    url = `https://x.com/${me.data.username}/status/${tweet.data.id}`;
  } catch {
    url = `https://x.com/i/status/${tweet.data.id}`;
  }

  return {
    platform: 'x',
    postId: tweet.data.id,
    url,
    postedAt: new Date().toISOString(),
    contentId: video.id,
    format: 'video',
  };
}
