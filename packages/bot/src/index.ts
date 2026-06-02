import { config, validateConfig, logger } from './config.js';
import { initializeClient, ensureFreshClient, verifyAuthenticatedUser } from './twitter/client.js';
import { pollMentions } from './twitter/mentions.js';
import { processMention } from './pipeline/processor.js';
import { loadSeedState, saveState, loadState, updateState } from './storage.js';
import { closeBrowser, setRendererLogger } from '@chartsuno/shared/node';

// Inject bot logger into shared chart renderer
setRendererLogger(logger);
import { createServer, type Server } from 'node:http';

let isRunning = false;
let pollTimeout: NodeJS.Timeout | null = null;
let healthServer: Server | null = null;
let startRetryTimeout: NodeJS.Timeout | null = null;
let consecutiveErrors = 0;
const START_RETRY_MS = 30_000;
const MIN_RATE_LIMIT_BACKOFF_MS = 5_000;
const AUTH_RECOVERY_RETRY_MS = 15_000;
const MAX_BACKOFF_MS = 5 * 60 * 1000; // 5 minutes max backoff

interface RateLimitedErrorLike {
  code?: number;
  rateLimit?: {
    limit?: number;
    remaining?: number;
    reset?: number;
  };
}

function getErrorCode(error: unknown): number | null {
  if (!error || typeof error !== 'object') {
    return null;
  }

  const candidate = error as { code?: number };
  return typeof candidate.code === 'number' ? candidate.code : null;
}

function getRateLimitBackoffMs(error: unknown): number | null {
  if (!error || typeof error !== 'object') {
    return null;
  }

  const candidate = error as RateLimitedErrorLike;
  if (candidate.code !== 429 || !candidate.rateLimit?.reset) {
    return null;
  }

  const resetMs = candidate.rateLimit.reset * 1000;
  const waitMs = resetMs - Date.now();
  return Math.max(MIN_RATE_LIMIT_BACKOFF_MS, waitMs);
}

function sortMentionsByAge<T extends { mentionId: string }>(mentions: T[]): T[] {
  return [...mentions].sort((a, b) => {
    const left = BigInt(a.mentionId);
    const right = BigInt(b.mentionId);
    if (left === right) return 0;
    return left < right ? -1 : 1;
  });
}

async function advanceMentionCheckpoint(newestId: string | null, deferredCount: number): Promise<void> {
  if (!newestId) {
    return;
  }

  if (deferredCount > 0) {
    logger.warn(
      { newestId, deferredCount },
      'Not advancing mention checkpoint because some trigger mentions need retry'
    );
    return;
  }

  const state = await loadState();
  if (state.lastSinceId === newestId) {
    return;
  }

  await updateState({ lastSinceId: newestId });
  logger.info(
    { previousSinceId: state.lastSinceId, newestId },
    state.lastSinceId ? 'Advanced mention checkpoint' : 'Initialized mention checkpoint'
  );
}

function startHealthServer(): void {
  const port = Number(process.env.PORT || '8080');

  healthServer = createServer((req, res) => {
    if (req.url === '/health' || req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true, service: 'chartsuno-bot' }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'Not Found' }));
  });

  healthServer.listen(port, '0.0.0.0', () => {
    logger.info({ port }, 'Health server listening');
  });

  healthServer.on('error', (error) => {
    logger.error({ error }, 'Health server failed');
    process.exit(1);
  });
}

async function poll(): Promise<void> {
  if (!isRunning) return;
  let nextPollDelayMs = config.bot.pollIntervalMs;

  try {
    await ensureFreshClient();

    logger.info('Polling for mentions...');
    const mentionPoll = await pollMentions();
    const mentions = sortMentionsByAge(mentionPoll.mentions);
    let deferredCount = 0;

    if (mentions.length > 0) {
      logger.info({ count: mentions.length }, 'Found mentions to process');

      for (const mention of mentions) {
        try {
          // Refresh token before each mention to avoid mid-batch expiry
          await ensureFreshClient();
          const result = await processMention(mention);
          if (result === 'deferred') {
            deferredCount += 1;
          }
        } catch (error) {
          deferredCount += 1;
          logger.error({ error, mentionId: mention.mentionId }, 'Failed to process mention');
        }
      }
    } else if (mentionPoll.fetchedCount > 0) {
      logger.info(
        { fetchedCount: mentionPoll.fetchedCount },
        'No new trigger mentions found'
      );
    } else {
      logger.info('No new mentions found');
    }

    await advanceMentionCheckpoint(mentionPoll.newestId, deferredCount);

    // Reset consecutive error counter on successful poll
    consecutiveErrors = 0;
  } catch (error) {
    const errorCode = getErrorCode(error);
    const rateLimitBackoffMs = getRateLimitBackoffMs(error);
    if (rateLimitBackoffMs) {
      // Poll again as soon as X indicates the limit resets.
      nextPollDelayMs = rateLimitBackoffMs;
      consecutiveErrors = 0; // Rate limiting is expected, not an error
      logger.warn(
        { waitMs: nextPollDelayMs, retryAt: new Date(Date.now() + nextPollDelayMs).toISOString() },
        'X mention timeline rate-limited; delaying next poll'
      );
    } else if (errorCode === 401) {
      logger.warn('X API returned 401; reinitializing Twitter client');
      try {
        await initializeClient();
        nextPollDelayMs = AUTH_RECOVERY_RETRY_MS;
        consecutiveErrors = 0;
        logger.info(
          { retryInMs: nextPollDelayMs },
          'Twitter client reinitialized after 401; scheduling quick retry'
        );
      } catch (reinitError) {
        logger.error({ error: reinitError }, 'Failed to reinitialize Twitter client after 401');
        consecutiveErrors++;
      }
    } else {
      consecutiveErrors++;
      // Exponential backoff with jitter for transient errors
      const backoffMs = Math.min(
        MAX_BACKOFF_MS,
        config.bot.pollIntervalMs * Math.pow(2, consecutiveErrors - 1) + Math.random() * 2000
      );
      nextPollDelayMs = backoffMs;
      logger.error(
        { error, consecutiveErrors, backoffMs: Math.round(backoffMs) },
        'Error during poll cycle; backing off'
      );
    }
  }

  // Schedule next poll
  if (isRunning) {
    pollTimeout = setTimeout(poll, nextPollDelayMs);
  }
}

async function start(): Promise<void> {
  logger.info('Starting Chartsuno Bot...');
  startHealthServer();
  isRunning = true;

  const attemptStart = async (): Promise<void> => {
    if (!isRunning) return;

    try {
      validateConfig();

      // Allow full state reset via env var (reseeds OAuth2 tokens + clears sinceId)
      if (process.env.RESET_SINCE_ID === 'true') {
        const seed = await loadSeedState();
        if (seed) {
          logger.warn('RESET_SINCE_ID is set; replacing state with seed (fresh OAuth2 + cleared sinceId)');
          await saveState({ ...seed, lastSinceId: null, processedMentions: [] });
        } else {
          const current = await loadState();
          logger.warn('RESET_SINCE_ID is set; clearing lastSinceId checkpoint');
          await saveState({ ...current, lastSinceId: null, processedMentions: [] });
        }
      }

      await initializeClient();
      await verifyAuthenticatedUser();

      logger.info(
        {
          botUserId: config.bot.userId,
          pollInterval: config.bot.pollIntervalMs,
          allowedUsers: config.bot.allowedUserIds.length || 'all',
        },
        'Bot configured'
      );

      // Start polling
      await poll();
      logger.info('Bot is now running and polling for mentions');
    } catch (error) {
      logger.error({ error, retryInMs: START_RETRY_MS }, 'Bot initialization failed; retrying');
      startRetryTimeout = setTimeout(() => {
        void attemptStart();
      }, START_RETRY_MS);
    }
  };

  await attemptStart();
}

async function shutdown(): Promise<void> {
  logger.info('Shutting down...');
  isRunning = false;

  if (pollTimeout) {
    clearTimeout(pollTimeout);
    pollTimeout = null;
  }
  if (startRetryTimeout) {
    clearTimeout(startRetryTimeout);
    startRetryTimeout = null;
  }

  await closeBrowser();
  await new Promise<void>((resolve) => {
    if (!healthServer) {
      resolve();
      return;
    }

    healthServer.close(() => resolve());
  });
  logger.info('Shutdown complete');
  process.exit(0);
}

// Handle graceful shutdown
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error({ error }, 'Uncaught exception');
  shutdown();
});

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled rejection');
  shutdown();
});

// Start the bot
start().catch((error) => {
  logger.error(error, 'Failed to start bot');
});
