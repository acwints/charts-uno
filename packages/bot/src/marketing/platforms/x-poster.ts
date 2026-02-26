import { readFile, stat } from 'node:fs/promises';
import type { TweetV2PostTweetResult } from 'twitter-api-v2';
import { initializeClient, ensureFreshClient, getReadWriteClient, getAuthMode } from '../../twitter/client.js';
import { uploadMedia } from '../../twitter/media.js';
import { loadState } from '../../storage.js';
import { logger } from '../config.js';
import type { CarouselDeck, PostResult } from '../types.js';
import type { VideoProject } from '../video/types.js';

type MediaIds = [string] | [string, string] | [string, string, string] | [string, string, string, string];

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

  await initializeClient();
  await ensureFreshClient();

  const client = getReadWriteClient();

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
const UPLOAD_POLL_INTERVAL_MS = 3000;
const UPLOAD_MAX_WAIT_MS = 5 * 60 * 1000; // 5 minute timeout

/**
 * Upload a video to X using the chunked media upload API (v1.1).
 *
 * X requires videos to be uploaded via the chunked INIT → APPEND → FINALIZE flow.
 * After FINALIZE, we poll STATUS until processing completes.
 */
async function uploadVideoChunked(videoPath: string): Promise<string> {
  const videoBuffer = await readFile(videoPath);
  const fileSizeBytes = videoBuffer.byteLength;

  if (getAuthMode() === 'oauth1') {
    // Use twitter-api-v2's built-in chunked upload for OAuth1
    const client = getReadWriteClient();
    const mediaId = await client.v1.uploadMedia(videoBuffer, {
      mimeType: 'video/mp4',
      target: 'tweet',
      chunkLength: CHUNK_SIZE,
    });
    logger.info({ mediaId }, 'Video uploaded via OAuth1 chunked upload');
    return mediaId;
  }

  // OAuth2: manual chunked upload via X v2 media API
  const state = await loadState();
  const accessToken = state.oauth2?.accessToken;
  if (!accessToken) {
    throw new Error('Missing OAuth2 access token for video upload');
  }

  // INIT
  const initResponse = await fetch('https://upload.twitter.com/1.1/media/upload.json', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      command: 'INIT',
      total_bytes: String(fileSizeBytes),
      media_type: 'video/mp4',
      media_category: 'tweet_video',
    }),
  });

  if (!initResponse.ok) {
    const errorText = await initResponse.text();
    throw new Error(`Video upload INIT failed (${initResponse.status}): ${errorText}`);
  }

  const initData = (await initResponse.json()) as { media_id_string: string };
  const mediaId = initData.media_id_string;
  logger.info({ mediaId, fileSizeBytes }, 'Video upload initialized');

  // APPEND — send in chunks
  const totalChunks = Math.ceil(fileSizeBytes / CHUNK_SIZE);
  for (let segment = 0; segment < totalChunks; segment++) {
    const start = segment * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, fileSizeBytes);
    const chunk = videoBuffer.subarray(start, end);

    const form = new FormData();
    form.append('command', 'APPEND');
    form.append('media_id', mediaId);
    form.append('segment_index', String(segment));
    form.append('media_data', new Blob([chunk], { type: 'video/mp4' }), 'chunk.mp4');

    const appendResponse = await fetch('https://upload.twitter.com/1.1/media/upload.json', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    });

    if (!appendResponse.ok) {
      const errorText = await appendResponse.text();
      throw new Error(`Video upload APPEND segment ${segment} failed (${appendResponse.status}): ${errorText}`);
    }

    logger.debug({ segment, totalChunks }, 'Video chunk uploaded');
  }

  // FINALIZE
  const finalizeResponse = await fetch('https://upload.twitter.com/1.1/media/upload.json', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      command: 'FINALIZE',
      media_id: mediaId,
    }),
  });

  if (!finalizeResponse.ok) {
    const errorText = await finalizeResponse.text();
    throw new Error(`Video upload FINALIZE failed (${finalizeResponse.status}): ${errorText}`);
  }

  const finalizeData = (await finalizeResponse.json()) as {
    media_id_string: string;
    processing_info?: { state: string; check_after_secs?: number };
  };

  // STATUS — poll until processing completes
  if (finalizeData.processing_info) {
    logger.info({ state: finalizeData.processing_info.state }, 'Video processing started');

    const deadline = Date.now() + UPLOAD_MAX_WAIT_MS;
    let processing = true;

    while (processing && Date.now() < deadline) {
      const waitMs = (finalizeData.processing_info.check_after_secs ?? 3) * 1000;
      await new Promise((resolve) => setTimeout(resolve, Math.max(waitMs, UPLOAD_POLL_INTERVAL_MS)));

      const statusResponse = await fetch(
        `https://upload.twitter.com/1.1/media/upload.json?command=STATUS&media_id=${mediaId}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );

      if (!statusResponse.ok) {
        const errorText = await statusResponse.text();
        throw new Error(`Video upload STATUS check failed (${statusResponse.status}): ${errorText}`);
      }

      const statusData = (await statusResponse.json()) as {
        processing_info?: { state: string; check_after_secs?: number; error?: { message: string } };
      };

      const state = statusData.processing_info?.state;
      logger.debug({ state }, 'Video processing status');

      if (state === 'succeeded') {
        processing = false;
      } else if (state === 'failed') {
        const errorMsg = statusData.processing_info?.error?.message ?? 'Unknown processing error';
        throw new Error(`Video processing failed: ${errorMsg}`);
      }
      // else 'pending' or 'in_progress' — keep polling
    }

    if (processing) {
      throw new Error('Video processing timed out');
    }
  }

  logger.info({ mediaId }, 'Video upload and processing complete');
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

  await initializeClient();
  await ensureFreshClient();

  const client = getReadWriteClient();

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
