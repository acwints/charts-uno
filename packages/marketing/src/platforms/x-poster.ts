import { readFile } from 'node:fs/promises';
import { TwitterApi, type TweetV2PostTweetResult } from 'twitter-api-v2';
import { logger, marketingConfig } from '../config.js';
import type { CarouselDeck, PostResult } from '../types.js';
import type { VideoProject } from '../video/types.js';

type MediaIds = [string] | [string, string] | [string, string, string] | [string, string, string, string];

// ─── Twitter Client ───────────────────────────────────────────────

let twitterClient: TwitterApi | null = null;

function getTwitterClient(): TwitterApi {
  if (!twitterClient) {
    const { twitter } = marketingConfig;
    if (twitter.accessToken && twitter.accessSecret && twitter.apiKey && twitter.apiSecret) {
      twitterClient = new TwitterApi({
        appKey: twitter.apiKey,
        appSecret: twitter.apiSecret,
        accessToken: twitter.accessToken,
        accessSecret: twitter.accessSecret,
      });
    } else {
      throw new Error('Twitter OAuth1 credentials required for marketing posting (TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_SECRET)');
    }
  }
  return twitterClient;
}

async function uploadMedia(imageBuffer: Buffer): Promise<string> {
  const client = getTwitterClient();
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

  const client = getTwitterClient();

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

  const me = await client.v2.me();
  const url = `https://x.com/${me.data.username}/status/${firstTweet.data.id}`;

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
  const client = getTwitterClient();

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

  const client = getTwitterClient();

  // Upload video via chunked API
  logger.info({ videoPath: video.finalVideoPath }, 'Uploading video to X');
  const mediaId = await uploadVideoChunked(video.finalVideoPath);

  // Post tweet with video
  const tweet: TweetV2PostTweetResult = await client.v2.tweet({
    text: caption,
    media: { media_ids: [mediaId] as MediaIds },
  });

  logger.info({ tweetId: tweet.data.id }, 'Posted video tweet to X');

  const me = await client.v2.me();
  const url = `https://x.com/${me.data.username}/status/${tweet.data.id}`;

  return {
    platform: 'x',
    postId: tweet.data.id,
    url,
    postedAt: new Date().toISOString(),
    contentId: video.id,
    format: 'video',
  };
}
