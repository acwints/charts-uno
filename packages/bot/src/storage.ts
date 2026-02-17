import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { config, logger } from './config.js';

export interface BotState {
  oauth2: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    scope: string[];
  } | null;
  lastSinceId: string | null;
  processedMentions: string[];
}

const DEFAULT_STATE: BotState = {
  oauth2: null,
  lastSinceId: null,
  processedMentions: [],
};

function getStatePath(): string {
  return resolve(config.storage.statePath);
}

function getSeedStatePath(): string {
  return resolve(process.env.BOT_STATE_SEED_PATH || 'packages/bot/bot-state.json');
}

function loadSeedStateFromEnv(): BotState | null {
  const raw = process.env.BOT_STATE_JSON;
  if (!raw) return null;

  const candidates = [raw];
  try {
    candidates.push(Buffer.from(raw, 'base64').toString('utf-8'));
  } catch {
    // Ignore base64 decode errors and continue with raw value.
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as Partial<BotState>;
      const seeded = { ...DEFAULT_STATE, ...parsed };
      if (!seeded.oauth2) continue;
      return seeded;
    } catch {
      // Try next candidate format.
    }
  }

  logger.warn('BOT_STATE_JSON is present but invalid; ignoring env seed state');
  return null;
}

export async function loadSeedState(): Promise<BotState | null> {
  const envSeed = loadSeedStateFromEnv();
  if (envSeed?.oauth2) {
    return envSeed;
  }

  try {
    const data = await readFile(getSeedStatePath(), 'utf-8');
    const parsed = JSON.parse(data) as Partial<BotState>;
    const seeded = { ...DEFAULT_STATE, ...parsed };
    if (!seeded.oauth2) return null;
    return seeded;
  } catch {
    return null;
  }
}

export async function loadState(): Promise<BotState> {
  try {
    const data = await readFile(getStatePath(), 'utf-8');
    const state = { ...DEFAULT_STATE, ...JSON.parse(data) };
    if (state.oauth2) return state;

    const seed = await loadSeedState();
    if (seed?.oauth2) {
      logger.warn('State file missing OAuth2 tokens, using seed state from repository file');
      await saveState(seed);
      return seed;
    }

    return state;
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
      const seed = await loadSeedState();
      if (seed?.oauth2) {
        logger.info('No existing state file found, initializing from seed state');
        await saveState(seed);
        return seed;
      }

      logger.info('No existing state file found, using defaults');
      return { ...DEFAULT_STATE };
    }
    throw error;
  }
}

export async function saveState(state: BotState): Promise<void> {
  const statePath = getStatePath();
  const tmpPath = statePath + '.tmp';

  await mkdir(dirname(statePath), { recursive: true });

  // Atomic write: write to temp file then rename
  await writeFile(tmpPath, JSON.stringify(state, null, 2), 'utf-8');
  await rename(tmpPath, statePath);
}

export async function updateState(updates: Partial<BotState>): Promise<BotState> {
  const state = await loadState();
  const newState = { ...state, ...updates };
  await saveState(newState);
  return newState;
}
