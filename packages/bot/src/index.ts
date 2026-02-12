import { config, validateConfig, logger } from './config.js';
import { initializeClient, ensureFreshClient } from './twitter/client.js';
import { pollMentions } from './twitter/mentions.js';
import { processMention } from './pipeline/processor.js';
import { closeBrowser } from './chart/renderer.js';
import { createServer, type Server } from 'node:http';

let isRunning = false;
let pollTimeout: NodeJS.Timeout | null = null;
let healthServer: Server | null = null;
let startRetryTimeout: NodeJS.Timeout | null = null;
const START_RETRY_MS = 30_000;
const MIN_RATE_LIMIT_BACKOFF_MS = 5_000;

interface RateLimitedErrorLike {
  code?: number;
  rateLimit?: {
    limit?: number;
    remaining?: number;
    reset?: number;
  };
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

    logger.debug('Polling for mentions...');
    const mentions = await pollMentions();

    if (mentions.length > 0) {
      logger.info({ count: mentions.length }, 'Found mentions to process');

      for (const mention of mentions) {
        try {
          await processMention(mention);
        } catch (error) {
          logger.error({ error, mentionId: mention.mentionId }, 'Failed to process mention');
        }
      }
    }
  } catch (error) {
    const rateLimitBackoffMs = getRateLimitBackoffMs(error);
    if (rateLimitBackoffMs) {
      nextPollDelayMs = Math.max(config.bot.pollIntervalMs, rateLimitBackoffMs);
      logger.warn(
        { waitMs: nextPollDelayMs, retryAt: new Date(Date.now() + nextPollDelayMs).toISOString() },
        'X mention timeline rate-limited; delaying next poll'
      );
    } else {
      logger.error({ error }, 'Error during poll cycle');
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
      await initializeClient();

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
