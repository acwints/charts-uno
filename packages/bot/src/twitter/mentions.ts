import { getReadOnlyClient, getAuthMode } from './client.js';
import { config, logger } from '../config.js';
import { loadState } from '../storage.js';

export interface MentionData {
  mentionId: string;
  authorId: string;
  text: string;
  parentTweetId: string | null;
  action: 'chart' | 'reverse';
}

export interface MentionPollResult {
  mentions: MentionData[];
  fetchedCount: number;
  newestId: string | null;
}

function parseAction(text: string): MentionData['action'] | null {
  const normalized = text.toLowerCase();
  if (/\b(?:reverse|table)(?:\s+(?:it|this))?\b/.test(normalized)) {
    return 'reverse';
  }
  if (/\b(?:chart|graph|plot)(?:\s+(?:it|this))?\b/.test(normalized)) {
    return 'chart';
  }
  return null;
}

export async function pollMentions(): Promise<MentionPollResult> {
  const client = getReadOnlyClient();
  const mentions: MentionData[] = [];

  try {
    const state = await loadState();

    // Use mentions timeline endpoint (more reliable than search)
    const userId = config.bot.userId;
    const params: Record<string, unknown> = {
      max_results: 100,
      'tweet.fields': ['referenced_tweets', 'author_id', 'created_at'],
    };

    if (state.lastSinceId) {
      params.since_id = state.lastSinceId;
    }

    logger.info(
      { sinceId: state.lastSinceId, authMode: getAuthMode(), userId },
      'Fetching mentions timeline'
    );

    const response = await client.v2.userMentionTimeline(userId, params);

    if (!response.data.data) {
      logger.debug('No new mentions found');
      return { mentions: [], fetchedCount: 0, newestId: null };
    }

    const newestId = response.data.meta?.newest_id || null;
    logger.info(
      { count: response.data.data.length, newestId },
      'Mentions timeline returned results'
    );

    let skippedByAllowedUser = 0;
    let skippedByPhrase = 0;
    let skippedByNotReply = 0;

    for (const tweet of response.data.data) {
      // Skip tweets from the bot itself
      if (tweet.author_id === userId) {
        continue;
      }

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

    return { mentions, fetchedCount: response.data.data.length, newestId };
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
}
