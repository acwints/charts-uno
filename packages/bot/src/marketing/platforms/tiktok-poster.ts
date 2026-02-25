import { readFile } from 'node:fs/promises';
import { marketingConfig, logger } from '../config.js';
import type { CarouselDeck, PostResult } from '../types.js';
import type { VideoProject } from '../video/types.js';

interface UploadPostResponse {
  success?: boolean;
  request_id?: string;
  message?: string;
  error?: string;
}

/**
 * Post a carousel deck to TikTok via the Upload-Post API.
 * Sends all slide images as a photo slideshow.
 */
export async function postToTikTok(
  deck: CarouselDeck,
  caption: string,
  options: { dryRun?: boolean } = {},
): Promise<PostResult> {
  if (options.dryRun) {
    logger.info({
      caption: caption.slice(0, 100),
      slideCount: deck.generatedImages.length,
      profile: marketingConfig.marketing.tiktokProfile,
    }, '[DRY RUN] Would post to TikTok via Upload-Post');

    return {
      platform: 'tiktok',
      postId: 'dry-run',
      postedAt: new Date().toISOString(),
      deckId: deck.id,
      format: 'carousel',
    };
  }

  const { uploadPostApiKey, uploadPostApiUrl, tiktokProfile } = marketingConfig.marketing;

  if (!uploadPostApiKey || !tiktokProfile) {
    throw new Error('UPLOAD_POST_API_KEY and TIKTOK_PROFILE are required for TikTok posting');
  }

  // Read all slide images as base64
  const photos: string[] = [];
  for (const slide of deck.generatedImages) {
    const buffer = await readFile(slide.imagePath);
    photos.push(buffer.toString('base64'));
  }

  logger.info({ profile: tiktokProfile, slideCount: photos.length }, 'Posting to TikTok via Upload-Post');

  const response = await fetch(`${uploadPostApiUrl}/api/upload_photos`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Apikey ${uploadPostApiKey}`,
    },
    body: JSON.stringify({
      profile_username: tiktokProfile,
      title: caption.slice(0, 150),
      description: caption,
      photos,
      platforms: ['tiktok'],
      async_upload: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Upload-Post API failed (${response.status}): ${errorText}`);
  }

  const result = (await response.json()) as UploadPostResponse;

  if (result.error) {
    throw new Error(`Upload-Post error: ${result.error}`);
  }

  const requestId = result.request_id ?? 'unknown';
  logger.info({ requestId }, 'TikTok post submitted successfully');

  return {
    platform: 'tiktok',
    postId: requestId,
    postedAt: new Date().toISOString(),
    deckId: deck.id,
    format: 'carousel',
  };
}

/**
 * Post a video to TikTok via the Upload-Post API.
 * Sends the final MP4 as a base64-encoded video.
 */
export async function postVideoToTikTok(
  video: VideoProject,
  caption: string,
  options: { dryRun?: boolean } = {},
): Promise<PostResult> {
  if (options.dryRun) {
    logger.info({
      caption: caption.slice(0, 100),
      videoId: video.id,
      profile: marketingConfig.marketing.tiktokProfile,
    }, '[DRY RUN] Would post video to TikTok via Upload-Post');

    return {
      platform: 'tiktok',
      postId: 'dry-run',
      postedAt: new Date().toISOString(),
      deckId: video.id,
      videoId: video.id,
      format: 'video',
    };
  }

  const { uploadPostApiKey, uploadPostApiUrl, tiktokProfile } = marketingConfig.marketing;

  if (!uploadPostApiKey || !tiktokProfile) {
    throw new Error('UPLOAD_POST_API_KEY and TIKTOK_PROFILE are required for TikTok posting');
  }

  if (!video.finalVideoPath) {
    throw new Error('Video has no final video path — render it first');
  }

  const videoBuffer = await readFile(video.finalVideoPath);
  const videoBase64 = videoBuffer.toString('base64');

  logger.info({ profile: tiktokProfile, videoId: video.id }, 'Posting video to TikTok via Upload-Post');

  const response = await fetch(`${uploadPostApiUrl}/api/upload_videos`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Apikey ${uploadPostApiKey}`,
    },
    body: JSON.stringify({
      profile_username: tiktokProfile,
      title: caption.slice(0, 150),
      description: caption,
      video: videoBase64,
      platforms: ['tiktok'],
      async_upload: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Upload-Post video API failed (${response.status}): ${errorText}`);
  }

  const result = (await response.json()) as UploadPostResponse;

  if (result.error) {
    throw new Error(`Upload-Post video error: ${result.error}`);
  }

  const requestId = result.request_id ?? 'unknown';
  logger.info({ requestId }, 'TikTok video post submitted successfully');

  return {
    platform: 'tiktok',
    postId: requestId,
    postedAt: new Date().toISOString(),
    deckId: video.id,
    videoId: video.id,
    format: 'video',
  };
}

/**
 * Check the status of a previously submitted TikTok upload.
 */
export async function checkTikTokUploadStatus(requestId: string): Promise<UploadPostResponse> {
  const { uploadPostApiKey, uploadPostApiUrl } = marketingConfig.marketing;

  const response = await fetch(
    `${uploadPostApiUrl}/api/uploadposts/status?request_id=${requestId}`,
    {
      headers: { 'Authorization': `Apikey ${uploadPostApiKey}` },
    },
  );

  if (!response.ok) {
    throw new Error(`Upload-Post status check failed (${response.status})`);
  }

  return (await response.json()) as UploadPostResponse;
}
