import { TwitterApi } from 'twitter-api-v2';
import { config, logger } from '../config.js';
import { loadSeedState, loadState, updateState } from '../storage.js';

let client: TwitterApi | null = null;
let authMode: 'oauth2' | 'oauth1' | null = null;

const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes

function hasOAuth1Credentials(): boolean {
  return Boolean(
    config.twitter.apiKey &&
      config.twitter.apiSecret &&
      config.twitter.accessToken &&
      config.twitter.accessSecret
  );
}

function initializeOAuth1Client(reason: string): void {
  if (!hasOAuth1Credentials()) {
    throw new Error('OAuth1 credentials are not configured');
  }

  client = new TwitterApi({
    appKey: config.twitter.apiKey,
    appSecret: config.twitter.apiSecret,
    accessToken: config.twitter.accessToken,
    accessSecret: config.twitter.accessSecret,
  });
  authMode = 'oauth1';
  logger.warn({ reason }, 'Twitter client initialized with OAuth 1.0a fallback');
}

export async function initializeClient(): Promise<void> {
  const state = await loadState();

  if (!state.oauth2) {
    if (hasOAuth1Credentials()) {
      initializeOAuth1Client('No OAuth2 tokens found in bot state');
      return;
    }
    throw new Error(
      'No OAuth 2.0 tokens found. Run `pnpm --filter @chartsuno/bot auth` to authenticate with X first.'
    );
  }

  try {
    if (Date.now() >= state.oauth2.expiresAt - TOKEN_REFRESH_BUFFER_MS) {
      logger.info('Access token expired or expiring soon, refreshing...');
      await refreshAccessToken(state.oauth2.refreshToken);
      return;
    }

    client = new TwitterApi(state.oauth2.accessToken);
    authMode = 'oauth2';
    logger.info('Twitter client initialized with OAuth 2.0');
  } catch (error) {
    if (hasOAuth1Credentials()) {
      initializeOAuth1Client('OAuth2 initialization failed, using OAuth1 credentials');
      return;
    }
    throw error;
  }
}

export async function ensureFreshClient(): Promise<void> {
  if (authMode === 'oauth1') {
    return;
  }

  const state = await loadState();

  if (!state.oauth2) {
    if (hasOAuth1Credentials()) {
      initializeOAuth1Client('OAuth2 state missing during poll cycle');
      return;
    }
    throw new Error(
      'No OAuth 2.0 tokens found. Run `pnpm --filter @chartsuno/bot auth` to authenticate with X first.'
    );
  }

  if (Date.now() >= state.oauth2.expiresAt - TOKEN_REFRESH_BUFFER_MS) {
    logger.info('Refreshing access token before poll cycle...');
    await refreshAccessToken(state.oauth2.refreshToken);
  }
}

async function refreshAccessToken(refreshToken: string): Promise<void> {
  await refreshAccessTokenInternal(refreshToken, true);
}

interface TwitterRefreshError {
  code?: number;
  error?: {
    error?: string;
    error_description?: string;
    errors?: Array<{
      code?: number;
      message?: string;
    }>;
  };
}

function isInvalidRefreshTokenError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as TwitterRefreshError;
  const description = candidate.error?.error_description?.toLowerCase() || '';
  const kind = candidate.error?.error?.toLowerCase() || '';
  const apiCode = candidate.error?.errors?.[0]?.code;

  return (
    candidate.code === 400 &&
    (description.includes('token was invalid') ||
      apiCode === 131 ||
      (kind === 'invalid_request' && description.includes('token')))
  );
}

async function refreshAccessTokenInternal(
  refreshToken: string,
  allowSeedFallback: boolean
): Promise<void> {
  try {
    const tempClient = new TwitterApi({
      clientId: config.twitter.clientId,
      clientSecret: config.twitter.clientSecret,
    });

    const {
      client: refreshedClient,
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn,
    } = await tempClient.refreshOAuth2Token(refreshToken);

    await updateState({
      oauth2: {
        accessToken,
        refreshToken: newRefreshToken || refreshToken,
        expiresAt: Date.now() + expiresIn * 1000,
        scope: ['tweet.read', 'tweet.write', 'users.read', 'media.write', 'offline.access'],
      },
    });

    client = refreshedClient;
    authMode = 'oauth2';
    logger.info('Access token refreshed successfully');
  } catch (error) {
    if (allowSeedFallback && isInvalidRefreshTokenError(error)) {
      const seedState = await loadSeedState();
      const seedRefreshToken = seedState?.oauth2?.refreshToken?.trim();
      if (seedRefreshToken && seedRefreshToken !== refreshToken) {
        logger.warn('Stored refresh token was rejected; trying seed refresh token');
        await refreshAccessTokenInternal(seedRefreshToken, false);
        return;
      }

      throw new Error(
        'OAuth refresh token is invalid or revoked. Re-run `pnpm --filter @chartsuno/bot auth` and update BOT_STATE_PATH or BOT_STATE_JSON.',
        { cause: error }
      );
    }

    throw error;
  }
}

export function getReadOnlyClient() {
  if (!client) {
    throw new Error('Twitter client not initialized. Call initializeClient() first.');
  }
  return client.readOnly;
}

export function getReadWriteClient() {
  if (!client) {
    throw new Error('Twitter client not initialized. Call initializeClient() first.');
  }
  return client.readWrite;
}

export async function verifyAuthenticatedUser(): Promise<void> {
  const me = await getReadOnlyClient().v2.me();
  const authenticatedUserId = me.data.id;

  if (authenticatedUserId !== config.bot.userId) {
    throw new Error(
      `Twitter credentials are authenticated as user ${authenticatedUserId} (@${me.data.username}), but BOT_USER_ID is ${config.bot.userId}.`
    );
  }

  logger.info(
    { userId: authenticatedUserId, username: me.data.username, authMode },
    'Verified Twitter credentials match BOT_USER_ID'
  );
}

export function getAuthMode(): 'oauth2' | 'oauth1' | null {
  return authMode;
}
