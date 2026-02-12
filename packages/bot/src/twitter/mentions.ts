import { getReadOnlyClient } from './client.js';
import { config, logger } from '../config.js';
import { loadState, updateState } from '../storage.js';

export interface MentionData {
  mentionId: string;
  authorId: string;
  text: string;
  parentTweetId: string | null;
  action: 'chart' | 'reverse';
}

function parseAction(text: string): MentionData['action'] | null {
  const normalized = text.toLowerCase();
  if (normalized.includes('reverse it')) {
    return 'reverse';
  }
  if (normalized.includes('chart it')) {
    return 'chart';
  }
  return null;
}

export async function pollMentions(): Promise<MentionData[]> {
  const client = getReadOnlyClient();
  const mentions: MentionData[] = [];

  try {
    const state = await loadState();
    const me = await client.v2.me();
    const botUsername = me.data.username.toLowerCase();

    const params: Parameters<typeof client.v2.search>[1] = {
      max_results: 10,
      'tweet.fields': ['referenced_tweets', 'author_id'],
    };

    if (state.lastSinceId) {
      params.since_id = state.lastSinceId;
    }

    const query = `@${botUsername} ("chart it" OR "reverse it") -from:${botUsername}`;
    const response = await client.v2.search(query, params);

    if (!response.data.data) {
      logger.debug('No new mentions found');
      return [];
    }

    // Update since_id for next poll
    if (response.data.meta?.newest_id) {
      await updateState({ lastSinceId: response.data.meta.newest_id });
    }

    for (const tweet of response.data.data) {
      // Check if this is from an allowed user
      if (config.bot.allowedUserIds.length > 0 && !config.bot.allowedUserIds.includes(tweet.author_id || '')) {
        logger.debug({ authorId: tweet.author_id }, 'Skipping mention from non-allowed user');
        continue;
      }

      const action = parseAction(tweet.text);
      if (!action) {
        logger.debug({ text: tweet.text }, 'Skipping mention without valid trigger phrase');
        continue;
      }

      // Find the parent tweet (the tweet being replied to)
      const replyToTweet = tweet.referenced_tweets?.find((ref) => ref.type === 'replied_to');

      if (!replyToTweet) {
        logger.debug({ mentionId: tweet.id }, 'Skipping mention that is not a reply');
        continue;
      }

      mentions.push({
        mentionId: tweet.id,
        authorId: tweet.author_id || '',
        text: tweet.text,
        parentTweetId: replyToTweet.id,
        action,
      });

      logger.info(
        { mentionId: tweet.id, parentTweetId: replyToTweet.id, action },
        'Found valid trigger mention'
      );
    }
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: number }).code === 429
    ) {
      logger.warn('Mention polling received 429 from X API');
    } else {
      logger.error({ error }, 'Error polling mentions');
    }
    throw error;
  }

  return mentions;
}
