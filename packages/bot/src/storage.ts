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

export async function loadState(): Promise<BotState> {
  try {
    const data = await readFile(getStatePath(), 'utf-8');
    return { ...DEFAULT_STATE, ...JSON.parse(data) };
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
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
