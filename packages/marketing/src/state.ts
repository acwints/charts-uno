import { readFile, writeFile, rename, mkdir, rm, open } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import { setTimeout as delay } from 'node:timers/promises';
import { dirname, resolve } from 'node:path';
import { marketingConfig, logger } from './config.js';
import type { MarketingState } from './types.js';

const MAX_DECKS = 500;
const MAX_VIDEOS = 200;
const MAX_POSTS = 1000;
const MAX_METRICS = 2000;

const DEFAULT_STATE: MarketingState = {
  publications: {},
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
      return structuredClone(DEFAULT_STATE);
    }
    throw error;
  }
}

async function writeState(state: MarketingState): Promise<void> {
  const statePath = getStatePath();
  const tmpPath = `${statePath}.${randomUUID()}.tmp`;

  await mkdir(dirname(statePath), { recursive: true });

  // Prune old entries
  const pruned: MarketingState = {
    ...state,
    decks: state.decks.slice(-MAX_DECKS),
    videos: state.videos.slice(-MAX_VIDEOS),
    posts: state.posts.slice(-MAX_POSTS),
    metrics: state.metrics.slice(-MAX_METRICS),
  };

  try {
    const file = await open(tmpPath, 'wx');
    try {
      await file.writeFile(JSON.stringify(pruned, null, 2), 'utf-8');
      await file.sync();
    } finally { await file.close(); }
    await rename(tmpPath, statePath);
    const directory = await open(dirname(statePath), 'r');
    try { await directory.sync(); } finally { await directory.close(); }
  } finally { await rm(tmpPath, { force: true }); }
}

// Atomic directory creation coordinates server and CLI processes sharing this volume.
// Never steal a lock by age: a slow/live process must retain ownership.
async function withStateLock<T>(action: () => Promise<T>): Promise<T> {
  const lock = getStatePath() + '.lock';
  await mkdir(dirname(lock), { recursive: true });
  const deadline = Date.now() + 10_000;
  while (true) {
    try {
      await mkdir(lock);
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      // Crash recovery only when the owner is provably dead on this host.
      try {
        const owner = JSON.parse(await readFile(lock + '/owner', 'utf-8'));
        if (owner.host === hostname() && Number.isInteger(owner.pid)) {
          try { process.kill(owner.pid, 0); } catch (err) {
            if ((err as NodeJS.ErrnoException).code === 'ESRCH') {
              // No automatic deletion: another waiter could already have recovered
              // the lock. Fail closed and let an operator remove the dead-owner lock.
              throw new Error(`Dead state lock at ${lock}; verify owner and remove it before retrying`);
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.message.startsWith('Dead state lock')) throw err;
      }
      if (Date.now() >= deadline) throw new Error(`State lock busy: ${lock}`);
      await delay(20);
    }
  }
  try {
    await writeFile(lock + '/owner', JSON.stringify({ pid: process.pid, host: hostname() }));
    return await action();
  } finally { await rm(lock, { recursive: true, force: true }); }
}

/** Whole-state replacement for initialization/maintenance only. Use update for mutations. */
export async function saveMarketingState(state: MarketingState): Promise<void> {
  await withStateLock(() => writeState(state));
}

export async function updateMarketingState(
  updater: (state: MarketingState) => MarketingState,
): Promise<MarketingState> {
  return withStateLock(async () => {
    const newState = updater(await loadMarketingState());
    await writeState(newState);
    return newState;
  });
}
