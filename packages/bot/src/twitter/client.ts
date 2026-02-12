import { TwitterApi } from 'twitter-api-v2';
import { config, logger } from '../config.js';
import { loadState, updateState } from '../storage.js';

let client: TwitterApi | null = null;

const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes

export async function initializeClient(): Promise<void> {
  const state = await loadState();

  if (!state.oauth2) {
    throw new Error(
      'No OAuth 2.0 tokens found. Run `pnpm setup` to authenticate with Twitter first.'
    );
  }

  if (Date.now() >= state.oauth2.expiresAt - TOKEN_REFRESH_BUFFER_MS) {
    logger.info('Access token expired or expiring soon, refreshing...');
    await refreshAccessToken(state.oauth2.refreshToken);
    return;
  }

  client = new TwitterApi(state.oauth2.accessToken);
  logger.info('Twitter client initialized with OAuth 2.0');
}

export async function ensureFreshClient(): Promise<void> {
  const state = await loadState();

  if (!state.oauth2) {
    throw new Error(
      'No OAuth 2.0 tokens found. Run `pnpm setup` to authenticate with Twitter first.'
    );
  }

  if (Date.now() >= state.oauth2.expiresAt - TOKEN_REFRESH_BUFFER_MS) {
    logger.info('Refreshing access token before poll cycle...');
    await refreshAccessToken(state.oauth2.refreshToken);
  }
}

async function refreshAccessToken(refreshToken: string): Promise<void> {
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
  logger.info('Access token refreshed successfully');
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
