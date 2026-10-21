interface TimelineTweet {
  id: string;
  text: string;
  author_id?: string;
  referenced_tweets?: Array<{ type: string; id: string }>;
}

interface TimelinePage {
  data?: TimelineTweet[];
  meta?: { newest_id?: string; next_token?: string };
}

// A checkpoint is safe only after the whole range has been read. Failed pages
// throw instead of returning a partial page that callers might checkpoint.
export async function readTimelinePages(
  fetchPage: (paginationToken?: string) => Promise<TimelinePage>,
): Promise<{ tweets: TimelineTweet[]; newestId: string | null }> {
  const tweets = new Map<string, TimelineTweet>();
  const tokens = new Set<string>();
  let token: string | undefined;
  let newestId: string | null = null;
  do {
    const page = await fetchPage(token);
    newestId ??= page.meta?.newest_id ?? null;
    for (const tweet of page.data ?? []) tweets.set(tweet.id, tweet);
    token = page.meta?.next_token;
    if (token && tokens.has(token)) throw new Error('Mention timeline repeated a pagination token');
    if (token) tokens.add(token);
  } while (token);
  return { tweets: [...tweets.values()], newestId };
}
