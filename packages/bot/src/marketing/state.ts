import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { marketingConfig, logger } from './config.js';
import type { MarketingState } from './types.js';

const MAX_DECKS = 500;
const MAX_VIDEOS = 200;
const MAX_POSTS = 1000;
const MAX_METRICS = 2000;

const DEFAULT_STATE: MarketingState = {
  decks: [],
  videos: [],
  posts: [],
  metrics: [],
  hookPerformance: [],
  lastDailyReport: null,
};

function getStatePath(): string {
  return resolve(marketingConfig.marketing.statePath);
}

export async function loadMarketingState(): Promise<MarketingState> {
  try {
    const data = await readFile(getStatePath(), 'utf-8');
    return { ...DEFAULT_STATE, ...JSON.parse(data) };
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
      logger.info('No marketing state file found, using defaults');
      return { ...DEFAULT_STATE };
    }
    throw error;
  }
}

export async function saveMarketingState(state: MarketingState): Promise<void> {
  const statePath = getStatePath();
  const tmpPath = statePath + '.tmp';

  await mkdir(dirname(statePath), { recursive: true });

  // Prune old entries
  const pruned: MarketingState = {
    ...state,
    decks: state.decks.slice(-MAX_DECKS),
    videos: state.videos.slice(-MAX_VIDEOS),
    posts: state.posts.slice(-MAX_POSTS),
    metrics: state.metrics.slice(-MAX_METRICS),
  };

  await writeFile(tmpPath, JSON.stringify(pruned, null, 2), 'utf-8');
  await rename(tmpPath, statePath);
}

export async function updateMarketingState(
  updater: (state: MarketingState) => MarketingState,
): Promise<MarketingState> {
  const state = await loadMarketingState();
  const newState = updater(state);
  await saveMarketingState(newState);
  return newState;
}
