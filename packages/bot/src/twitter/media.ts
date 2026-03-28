import { getAuthMode, getReadOnlyClient, getReadWriteClient, ensureFreshClient } from './client.js';
import { logger } from '../config.js';
import { loadState } from '../storage.js';

export interface TweetMediaData {
  imageUrl: string | null;
  tweetText: string;
  authorUsername: string;
  tweetUrl: string;
}

let cachedBotUsername: string | null = null;

async function getBotUsername(): Promise<string> {
  if (cachedBotUsername) {
    return cachedBotUsername;
  }

  const client = getReadOnlyClient();
  const me = await client.v2.me();
  cachedBotUsername = me.data.username.toLowerCase();
  return cachedBotUsername;
}

export async function hasExistingReplyToMention(mentionId: string): Promise<boolean> {
  try {
    const client = getReadOnlyClient();
    const botUsername = await getBotUsername();
    const query = `from:${botUsername} in_reply_to_tweet_id:${mentionId}`;
    const response = await client.v2.search(query, { max_results: 10, 'tweet.fields': ['id'] });
    return Boolean(response.data.data && response.data.data.length > 0);
  } catch (error) {
    logger.warn({ mentionId, error }, 'Failed to check existing replies for mention');
    return false;
  }
}

export async function getParentTweetWithMedia(tweetId: string): Promise<TweetMediaData> {
  const client = getReadOnlyClient();

  try {
    const response = await client.v2.singleTweet(tweetId, {
      'tweet.fields': ['attachments', 'author_id', 'note_tweet'],
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

    const noteTweetText = (tweet as unknown as { note_tweet?: { text?: string } }).note_tweet?.text || '';
    const tweetText = noteTweetText || tweet.text || '';
    const tweetUrl = `https://x.com/${authorUsername}/status/${tweet.id}`;

    logger.info(
      { tweetId, hasImage: !!imageUrl, authorUsername, hasNoteTweet: Boolean(noteTweetText) },
      'Fetched parent tweet'
    );

    return {
      imageUrl,
      tweetText,
      authorUsername,
      tweetUrl,
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
  // Ensure token is fresh before attempting upload
  await ensureFreshClient();

  if (getAuthMode() === 'oauth1') {
    try {
      const mediaId = await getReadWriteClient().v1.uploadMedia(imageBuffer, { type: 'png' });
      logger.info({ mediaId }, 'Uploaded media successfully via X v1');
      return mediaId;
    } catch (error) {
      logger.error({ error }, 'Error uploading media via X v1');
      throw error;
    }
  }

  try {
    const state = await loadState();
    const accessToken = state.oauth2?.accessToken;
    if (!accessToken) {
      throw new Error('Missing OAuth2 access token for media upload');
    }

    const form = new FormData();
    const mediaBytes = new Uint8Array(imageBuffer);
    form.append('media', new Blob([mediaBytes], { type: 'image/png' }), 'chart.png');
    form.append('media_category', 'tweet_image');
    form.append('media_type', 'image/png');

    const response = await fetch('https://api.x.com/2/media/upload', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: form,
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(
        {
          status: response.status,
          body: errorText,
          headers: Object.fromEntries(response.headers.entries()),
        },
        'X v2 media upload failed'
      );
      throw new Error(`Media upload failed with status ${response.status}`);
    }

    const payload = (await response.json()) as { data?: { id?: string }; errors?: unknown };
    const mediaId = payload.data?.id;
    if (!mediaId) {
      throw new Error('Media upload succeeded but response did not include media id');
    }

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
