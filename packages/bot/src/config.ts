import { pino } from 'pino';

// Environment variables
export const config = {
  twitter: {
    clientId: process.env.TWITTER_CLIENT_ID || '',
    clientSecret: process.env.TWITTER_CLIENT_SECRET || '',
    apiKey: process.env.TWITTER_API_KEY || process.env.TWITTER_CLIENT_ID || '',
    apiSecret: process.env.TWITTER_API_SECRET || process.env.TWITTER_CLIENT_SECRET || '',
    accessToken: process.env.TWITTER_ACCESS_TOKEN || '',
    accessSecret: process.env.TWITTER_ACCESS_SECRET || '',
  },
  bot: {
    userId: process.env.BOT_USER_ID || '',
    allowedUserIds: (process.env.ALLOWED_USER_IDS || '').split(',').filter(Boolean),
    pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS || '300000', 10),
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
  const hasOAuth2AppCreds = Boolean(config.twitter.clientId && config.twitter.clientSecret);
  const hasOAuth1Creds = Boolean(
    config.twitter.apiKey &&
      config.twitter.apiSecret &&
      config.twitter.accessToken &&
      config.twitter.accessSecret
  );

  const authMissingMessage =
    'Twitter auth is not configured. Provide OAuth2 app creds (TWITTER_CLIENT_ID + TWITTER_CLIENT_SECRET) or OAuth1 creds (TWITTER_API_KEY + TWITTER_API_SECRET + TWITTER_ACCESS_TOKEN + TWITTER_ACCESS_SECRET).';

  const required = [
    ['BOT_USER_ID', config.bot.userId],
    ['GOOGLE_API_KEY', config.google.apiKey],
    ['BOT_API_URL or API_URL', config.chartsuno.apiUrl],
    ['BOT_INTERNAL_API_TOKEN', config.chartsuno.internalToken],
  ];

  const missing = required.filter(([, value]) => !value).map(([name]) => name);

  if (!hasOAuth2AppCreds && !hasOAuth1Creds) {
    throw new Error(authMissingMessage);
  }

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
