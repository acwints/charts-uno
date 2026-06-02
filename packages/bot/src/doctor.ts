import { config, validateConfig } from './config.js';
import {
  getAuthMode,
  getReadOnlyClient,
  initializeClient,
  verifyAuthenticatedUser,
} from './twitter/client.js';
import { loadState } from './storage.js';

function snowflakeToDate(id: string | null): string | null {
  if (!id) return null;
  try {
    const timestampMs = Number((BigInt(id) >> 22n) + 1288834974657n);
    return new Date(timestampMs).toISOString();
  } catch {
    return null;
  }
}

function maskId(id: string): string {
  if (id.length <= 8) return id;
  return `${id.slice(0, 4)}...${id.slice(-4)}`;
}

async function run(): Promise<void> {
  validateConfig();
  await initializeClient();
  await verifyAuthenticatedUser();

  const state = await loadState();
  const client = getReadOnlyClient();
  const response = await client.v2.userMentionTimeline(config.bot.userId, {
    max_results: 5,
    'tweet.fields': ['referenced_tweets', 'author_id', 'created_at'],
  });

  const mentions = response.data.data || [];
  const newestId = response.data.meta?.newest_id || null;

  console.log('Chartsuno bot doctor');
  console.log(`- Auth mode: ${getAuthMode()}`);
  console.log(`- Bot user id: ${config.bot.userId}`);
  console.log(`- Poll interval: ${config.bot.pollIntervalMs}ms`);
  console.log(
    `- Allowed users: ${config.bot.allowedUserIds.length > 0 ? config.bot.allowedUserIds.map(maskId).join(', ') : 'all'}`
  );
  console.log(
    `- Stored since_id: ${state.lastSinceId || 'none'}${snowflakeToDate(state.lastSinceId) ? ` (${snowflakeToDate(state.lastSinceId)})` : ''}`
  );
  console.log(
    `- Latest visible mention: ${newestId || 'none'}${snowflakeToDate(newestId) ? ` (${snowflakeToDate(newestId)})` : ''}`
  );
  console.log(`- Recent mentions visible to API: ${mentions.length}`);

  for (const mention of mentions) {
    const parent = mention.referenced_tweets?.find((ref) => ref.type === 'replied_to')?.id || 'none';
    console.log(
      `  - ${mention.id} by ${mention.author_id || 'unknown'} parent=${parent}: ${mention.text.replace(/\s+/g, ' ').slice(0, 120)}`
    );
  }
}

run().catch((error) => {
  console.error('Doctor failed:', error);
  process.exit(1);
});
