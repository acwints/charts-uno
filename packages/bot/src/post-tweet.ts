import { ensureFreshClient, getReadWriteClient, initializeClient } from './twitter/client.js';

interface CliOptions {
  text: string;
  replyToTweetId?: string;
}

function printUsage(): void {
  console.error(
    [
      'Usage:',
      '  pnpm --filter @chartsuno/bot tweet -- "Tweet text"',
      '  pnpm --filter @chartsuno/bot tweet -- --reply-to <tweet_id> "Reply text"',
    ].join('\n')
  );
}

function parseArgs(argv: string[]): CliOptions | null {
  let replyToTweetId: string | undefined;
  const textParts: string[] = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--reply-to') {
      const value = argv[i + 1];
      if (!value) {
        console.error('Missing value for --reply-to');
        return null;
      }
      replyToTweetId = value;
      i += 1;
      continue;
    }

    textParts.push(arg);
  }

  const text = textParts.join(' ').trim();
  if (!text) {
    return null;
  }

  return { text, replyToTweetId };
}

async function run(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (!options) {
    printUsage();
    process.exit(1);
  }

  await initializeClient();
  await ensureFreshClient();

  const client = getReadWriteClient();
  const payload = options.replyToTweetId
    ? {
        text: options.text,
        reply: {
          in_reply_to_tweet_id: options.replyToTweetId,
        },
      }
    : { text: options.text };

  const response = await client.v2.tweet(payload);
  const me = await client.v2.me();

  console.log(`Posted tweet ${response.data.id}`);
  console.log(`https://x.com/${me.data.username}/status/${response.data.id}`);
}

run().catch((error) => {
  console.error('Failed to post tweet:', error);
  process.exit(1);
});
