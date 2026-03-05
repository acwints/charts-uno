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
  if (/\breverse(?:\s+it|\s+this)?\b/.test(normalized)) {
    return 'reverse';
  }
  if (/\bchart(?:\s+it|\s+this)?\b/.test(normalized)) {
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
      max_results: 100,
      'tweet.fields': ['referenced_tweets', 'author_id'],
    };

    if (state.lastSinceId) {
      params.since_id = state.lastSinceId;
    }

    // Fetch all direct mentions first, then apply trigger phrase parsing locally.
    // This avoids brittle dependence on exact phrase matching in X query syntax.
    const query = `@${botUsername} -from:${botUsername}`;
    const response = await client.v2.search(query, params);

    if (!response.data.data) {
      logger.debug('No new mentions found');
      return [];
    }

    // Update since_id checkpoint (handles both cold start and normal polls)
    if (response.data.meta?.newest_id) {
      const isFirstPoll = !state.lastSinceId;
      await updateState({ lastSinceId: response.data.meta.newest_id });
      if (isFirstPoll) {
        logger.warn(
          { newestId: response.data.meta.newest_id, resultCount: response.data.meta?.result_count || response.data.data.length },
          'Initialized since_id checkpoint; processing found mentions'
        );
      }
    }

    let skippedByAllowedUser = 0;
    let skippedByPhrase = 0;
    let skippedByNotReply = 0;

    for (const tweet of response.data.data) {
      // Check if this is from an allowed user
      if (config.bot.allowedUserIds.length > 0 && !config.bot.allowedUserIds.includes(tweet.author_id || '')) {
        skippedByAllowedUser += 1;
        logger.debug({ authorId: tweet.author_id }, 'Skipping mention from non-allowed user');
        continue;
      }

      const action = parseAction(tweet.text);
      if (!action) {
        skippedByPhrase += 1;
        logger.info({ text: tweet.text, mentionId: tweet.id }, 'Skipping mention without valid trigger phrase');
        continue;
      }

      // Find the parent tweet (the tweet being replied to)
      const replyToTweet = tweet.referenced_tweets?.find((ref) => ref.type === 'replied_to');

      if (!replyToTweet) {
        skippedByNotReply += 1;
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

    if (response.data.data.length > 0 && mentions.length === 0) {
      logger.info(
        {
          fetched: response.data.data.length,
          skippedByAllowedUser,
          skippedByPhrase,
          skippedByNotReply,
          hasAllowedUsersList: config.bot.allowedUserIds.length > 0,
          sinceId: state.lastSinceId,
        },
        'Fetched mentions, but none matched trigger requirements'
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
