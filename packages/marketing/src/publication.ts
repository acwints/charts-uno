import { updateMarketingState } from './state.js';
import type { Platform, PostFormat, PostResult } from './types.js';

export interface PublicationIdentity { platform: Platform; format: PostFormat; contentId: string }

/** Durable at-most-once submission. Uncertain results deliberately require reconciliation. */
export async function publishOnce(
  identity: PublicationIdentity,
  options: { dryRun?: boolean },
  submit: (checkpoint: (remoteId: string) => Promise<void>) => Promise<PostResult>,
): Promise<PostResult> {
  if (options.dryRun) return submit(async () => {});
  const key = `${identity.platform}:${identity.format}:${identity.contentId}`;
  let previous: PostResult | undefined;
  await updateMarketingState((state) => {
    const operation = state.publications[key];
    if (operation?.status === 'completed' && operation.result) {
      previous = operation.result;
      return state;
    }
    if (operation) {
      throw new Error(`Publication ${key} is ${operation.status}; reconcile remote IDs before retrying`);
    }
    // Honor history written before the ledger existed, excluding old dry runs.
    previous = state.posts.find((post) => post.postId !== 'dry-run'
      && post.platform === identity.platform && post.format === identity.format && post.contentId === identity.contentId);
    if (previous) return state;
    return { ...state, publications: { ...state.publications, [key]: {
      status: 'in-progress', startedAt: new Date().toISOString(), remoteIds: [],
    } } };
  });
  if (previous) return previous;
  try {
    const result = await submit(async (remoteId) => {
      await updateMarketingState((state) => ({ ...state, publications: { ...state.publications,
        [key]: { ...state.publications[key], remoteIds: [...state.publications[key].remoteIds, remoteId] },
      } }));
    });
    await updateMarketingState((state) => {
      const posts = [...state.posts, result];
      // Accepted/scheduled/draft submissions are retained but never labeled published.
      const published = (platform: Platform) => posts.some((p) => p.contentId === identity.contentId
        && p.format === identity.format && p.platform === platform && p.postId !== 'dry-run'
        && (p.publicationStatus === 'published' || (!p.publicationStatus && p.platform === 'x')));
      const status = published('x') && published('tiktok') ? 'posted-both' as const
        : published('x') ? 'posted-x' as const : published('tiktok') ? 'posted-tiktok' as const : 'ready' as const;
      return { ...state, posts,
        decks: state.decks.map((deck) => identity.format === 'carousel' && deck.id === identity.contentId ? { ...deck, status } : deck),
        videos: state.videos.map((video) => identity.format === 'video' && video.id === identity.contentId ? { ...video, status } : video),
        publications: { ...state.publications, [key]: { ...state.publications[key], status: 'completed', result } },
      };
    });
    return result;
  } catch (error) {
    await updateMarketingState((state) => ({ ...state, publications: { ...state.publications,
      [key]: { ...state.publications[key], status: 'needs-reconciliation', error: error instanceof Error ? error.message : String(error) },
    } }));
    throw error;
  }
}
