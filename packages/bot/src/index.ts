import { config, validateConfig, logger } from './config.js';
import { initializeClient, ensureFreshClient } from './twitter/client.js';
import { pollMentions } from './twitter/mentions.js';
import { processMention } from './pipeline/processor.js';
import { closeBrowser } from './chart/renderer.js';
import { createServer, type Server } from 'node:http';

let isRunning = false;
let pollTimeout: NodeJS.Timeout | null = null;
let healthServer: Server | null = null;

function startHealthServer(): void {
  const port = process.env.PORT;
  if (!port) return;

  healthServer = createServer((req, res) => {
    if (req.url === '/health' || req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true, service: 'chartsuno-bot' }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'Not Found' }));
  });

  healthServer.listen(Number(port), '0.0.0.0', () => {
    logger.info({ port: Number(port) }, 'Health server listening');
  });

  healthServer.on('error', (error) => {
    logger.error({ error }, 'Health server failed');
    process.exit(1);
  });
}

async function poll(): Promise<void> {
  if (!isRunning) return;

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
    logger.error({ error }, 'Error during poll cycle');
  }

  // Schedule next poll
  if (isRunning) {
    pollTimeout = setTimeout(poll, config.bot.pollIntervalMs);
  }
}

async function start(): Promise<void> {
  logger.info('Starting Chartsuno Bot...');
  startHealthServer();

  try {
    validateConfig();
  } catch (error) {
    logger.error({ error }, 'Configuration validation failed');
    process.exit(1);
  }

  await initializeClient();

  logger.info(
    {
      botUserId: config.bot.userId,
      pollInterval: config.bot.pollIntervalMs,
      allowedUsers: config.bot.allowedUserIds.length || 'all',
    },
    'Bot configured'
  );

  isRunning = true;

  // Start polling
  await poll();

  logger.info('Bot is now running and polling for mentions');
}

async function shutdown(): Promise<void> {
  logger.info('Shutting down...');
  isRunning = false;

  if (pollTimeout) {
    clearTimeout(pollTimeout);
    pollTimeout = null;
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
  process.exit(1);
});
