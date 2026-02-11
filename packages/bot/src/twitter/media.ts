import { getReadOnlyClient, getReadWriteClient } from './client.js';
import { logger } from '../config.js';

export interface TweetMediaData {
  imageUrl: string | null;
  tweetText: string;
  authorUsername: string;
}

export async function getParentTweetWithMedia(tweetId: string): Promise<TweetMediaData> {
  const client = getReadOnlyClient();

  try {
    const response = await client.v2.singleTweet(tweetId, {
      'tweet.fields': ['attachments', 'author_id'],
      expansions: ['attachments.media_keys', 'author_id'],
      'media.fields': ['url', 'preview_image_url', 'type'],
      'user.fields': ['username'],
    });

    const tweet = response.data;
    const includes = response.includes;

    // Get author username
    const author = includes?.users?.find((u) => u.id === tweet.author_id);
    const authorUsername = author?.username || 'unknown';

    // Find image attachment
    let imageUrl: string | null = null;

    if (includes?.media) {
      const imageMedia = includes.media.find(
        (m) => m.type === 'photo' && m.url
      );
      if (imageMedia && 'url' in imageMedia) {
        imageUrl = imageMedia.url || null;
      }
    }

    logger.info({ tweetId, hasImage: !!imageUrl, authorUsername }, 'Fetched parent tweet');

    return {
      imageUrl,
      tweetText: tweet.text,
      authorUsername,
    };
  } catch (error) {
    logger.error({ error, tweetId }, 'Error fetching parent tweet');
    throw error;
  }
}

export async function downloadImage(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function uploadMedia(imageBuffer: Buffer): Promise<string> {
  const client = getReadWriteClient();

  try {
    // v1.1 media upload works with OAuth 2.0 user-context tokens
    const mediaId = await client.v1.uploadMedia(imageBuffer, {
      mimeType: 'image/png',
    });

    logger.info({ mediaId }, 'Uploaded media successfully');
    return mediaId;
  } catch (error) {
    logger.error({ error }, 'Error uploading media');
    throw error;
  }
}

export async function replyWithMedia(
  replyToTweetId: string,
  text: string,
  mediaId: string
): Promise<string> {
  const client = getReadWriteClient();

  try {
    const response = await client.v2.tweet({
      text,
      reply: {
        in_reply_to_tweet_id: replyToTweetId,
      },
      media: {
        media_ids: [mediaId],
      },
    });

    logger.info({ tweetId: response.data.id, replyToTweetId }, 'Posted reply successfully');
    return response.data.id;
  } catch (error) {
    logger.error({ error, replyToTweetId }, 'Error posting reply');
    throw error;
  }
}

export async function replyWithError(replyToTweetId: string, errorMessage: string): Promise<string> {
  const client = getReadWriteClient();

  try {
    const response = await client.v2.tweet({
      text: errorMessage,
      reply: {
        in_reply_to_tweet_id: replyToTweetId,
      },
    });

    logger.info({ tweetId: response.data.id }, 'Posted error reply');
    return response.data.id;
  } catch (error) {
    logger.error({ error, replyToTweetId }, 'Error posting error reply');
    throw error;
  }
}
