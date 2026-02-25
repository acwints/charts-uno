import { readFile } from 'node:fs/promises';
import type { TweetV2PostTweetResult } from 'twitter-api-v2';
import { initializeClient, ensureFreshClient, getReadWriteClient } from '../../twitter/client.js';
import { uploadMedia } from '../../twitter/media.js';
import { logger } from '../config.js';
import type { CarouselDeck, PostResult } from '../types.js';

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
      deckId: deck.id,
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
    deckId: deck.id,
    format: 'carousel',
  };
}
