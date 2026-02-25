import { readFile } from 'node:fs/promises';
import { marketingConfig, logger } from '../config.js';
import type { CarouselDeck, PostResult } from '../types.js';

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
