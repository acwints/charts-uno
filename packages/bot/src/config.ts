import { pino } from 'pino';

// Environment variables
export const config = {
  twitter: {
    clientId: process.env.TWITTER_CLIENT_ID || process.env.TWITTER_API_KEY || '',
    clientSecret: process.env.TWITTER_CLIENT_SECRET || process.env.TWITTER_API_SECRET || '',
  },
  bot: {
    userId: process.env.BOT_USER_ID || '',
    allowedUserIds: (process.env.ALLOWED_USER_IDS || '').split(',').filter(Boolean),
    pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS || '60000', 10),
  },
  google: {
    apiKey: process.env.GOOGLE_API_KEY || '',
  },
  chartsuno: {
    apiUrl: process.env.BOT_API_URL || process.env.API_URL || '',
    internalToken: process.env.BOT_INTERNAL_API_TOKEN || '',
  },
  storage: {
    statePath: process.env.BOT_STATE_PATH || '/data/bot-state.json',
  },
};

export function validateConfig(): void {
  const required = [
    ['TWITTER_CLIENT_ID or TWITTER_API_KEY', config.twitter.clientId],
    ['TWITTER_CLIENT_SECRET or TWITTER_API_SECRET', config.twitter.clientSecret],
    ['BOT_USER_ID', config.bot.userId],
    ['GOOGLE_API_KEY', config.google.apiKey],
    ['BOT_API_URL or API_URL', config.chartsuno.apiUrl],
    ['BOT_INTERNAL_API_TOKEN', config.chartsuno.internalToken],
  ];

  const missing = required.filter(([, value]) => !value).map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

// Logger
export const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
    },
  },
});
