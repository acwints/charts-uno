import test from 'node:test';
import { TwitterApi } from 'twitter-api-v2';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { marketingConfig } from '../src/config.js';
import { loadMarketingState, updateMarketingState } from '../src/state.js';
import { publishOnce } from '../src/publication.js';
import { postToTikTok, postVideoToTikTok } from '../src/platforms/tiktok-poster.js';
import { postToX, postVideoToX } from '../src/platforms/x-poster.js';
import type { CarouselDeck, PostResult } from '../src/types.js';
import type { VideoProject } from '../src/video/types.js';

const exec = promisify(execFile);
const result = (contentId: string, platform: 'x' | 'tiktok' = 'x'): PostResult => ({
  platform, format: 'carousel', contentId, postId: `${platform}-${contentId}`, postedAt: new Date().toISOString(),
  publicationStatus: platform === 'x' ? 'published' : 'accepted',
});
const deck = (id: string): CarouselDeck => ({ id, status: 'ready', createdAt: '', hookId: '', hookCategory: 'budget-pain', hookText: '', ctaText: '', slides: [], generatedImages: [] });

// One parent test keeps mutable configuration and global fetch scoped and sequential.
test('marketing publication and storage contracts', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'chartsuno-marketing-test-'));
  const originalPath = marketingConfig.marketing.statePath;
  const originalFetch = globalThis.fetch;
  const originalProvider = { key: marketingConfig.marketing.uploadPostApiKey, profile: marketingConfig.marketing.tiktokProfile };
  marketingConfig.marketing.statePath = join(directory, 'state.json');
  try {
    await t.test('concurrent updates retain every record across separate processes', async () => {
      const moduleUrl = new URL('../src/state.ts', import.meta.url).href;
      const code = `import { updateMarketingState } from ${JSON.stringify(moduleUrl)};\nawait Promise.all(Array.from({length: 8}, (_, i) => updateMarketingState(s => ({...s, posts: [...s.posts, {contentId: process.env.WORKER + i}]}))));`;
      const workerPath = join(directory, 'worker.mts');
      await writeFile(workerPath, code);
      await Promise.all(Array.from({ length: 4 }, (_, worker) => exec(process.execPath,
        ['--import', 'tsx', workerPath],
        { env: { ...process.env, MARKETING_STATE_PATH: marketingConfig.marketing.statePath, WORKER: String(worker) } })));
      const state = await loadMarketingState();
      assert.equal(state.posts.length, 32);
      assert.equal(new Set(state.posts.map((p) => p.contentId)).size, 32);
    });
    await t.test('post-all retry reuses successful X submission after TikTok failure', async () => {
      let xCalls = 0;
      let tiktokCalls = 0;
      const x = () => publishOnce({ platform: 'x', format: 'carousel', contentId: 'resume' }, {}, async () => { xCalls++; return result('resume'); });
      const tt = () => publishOnce({ platform: 'tiktok', format: 'carousel', contentId: 'resume' }, {}, async () => { tiktokCalls++; throw new Error('connection lost after possible acceptance'); });
      await x();
      await assert.rejects(tt(), /connection lost/);
      await x();
      await assert.rejects(tt(), /reconcile/);
      assert.equal(xCalls, 1);
      assert.equal(tiktokCalls, 1);
    });
    await t.test('concurrent same-content submissions perform only one remote operation', async () => {
      let release!: () => void;
      const gate = new Promise<void>((resolve) => { release = resolve; });
      let started!: () => void;
      const entered = new Promise<void>((resolve) => { started = resolve; });
      let calls = 0;
      const submit = () => publishOnce({ platform: 'x', format: 'carousel', contentId: 'concurrent' }, {}, async () => {
        calls++; started(); await gate; return result('concurrent');
      });
      const first = submit();
      await entered;
      await assert.rejects(submit(), /in-progress/);
      release(); await first;
      assert.equal(calls, 1);
    });
    await t.test('partial thread persists remote ID and refuses blind retry', async () => {
      const identity = { platform: 'x' as const, format: 'carousel' as const, contentId: 'partial' };
      await assert.rejects(publishOnce(identity, {}, async (checkpoint) => {
        await checkpoint('main-tweet'); throw new Error('reply timed out');
      }), /reply timed out/);
      const state = await loadMarketingState();
      assert.deepEqual(state.publications['x:carousel:partial'].remoteIds, ['main-tweet']);
      await assert.rejects(publishOnce(identity, {}, async () => result('partial')), /reconcile/);
    });
    await t.test('exported X adapter uses rotated tokens and checkpoints partial threads', async () => {
      const descriptor = Object.getOwnPropertyDescriptor(TwitterApi.prototype, 'v2')!;
      const previousBotPath = process.env.BOT_STATE_PATH;
      const botPath = join(directory, 'bot.json');
      const imagePath = join(directory, 'image.png'); await writeFile(imagePath, 'fake-image');
      process.env.BOT_STATE_PATH = botPath;
      const tweetTokens: string[] = [];
      const uploadTokens: string[] = [];
      let failReply = false;
      Object.defineProperty(TwitterApi.prototype, 'v2', { configurable: true, get(this: TwitterApi) {
        const tokens = this.getActiveTokens();
        return {
          tweet: async (body: { reply?: unknown }) => {
            assert.equal(tokens.type, 'oauth2');
            if (tokens.type === 'oauth2') tweetTokens.push(tokens.bearerToken);
            if (body.reply && failReply) throw new Error('reply response lost');
            return { data: { id: `tweet-${tweetTokens.length}` } };
          },
          me: async () => ({ data: { username: 'test' } }),
        };
      } });
      globalThis.fetch = async (_url, options) => {
        uploadTokens.push((options!.headers as Record<string, string>).Authorization);
        return Response.json({ data: { id: 'media-id' } });
      };
      try {
        const content = (id: string, count = 1) => ({ ...deck(id), generatedImages: Array.from({ length: count }, (_, i) => ({ slideNumber: i + 1, imagePath, overlayApplied: false })) });
        await writeFile(botPath, JSON.stringify({ oauth2: { accessToken: 'token-one', expiresAt: Date.now() + 3600000 } }));
        await postToX(content('token-one'), 'caption');
        await writeFile(botPath, JSON.stringify({ oauth2: { accessToken: 'token-two', expiresAt: Date.now() + 3600000 } }));
        await postToX(content('token-two'), 'caption');
        assert.deepEqual(tweetTokens, ['token-one', 'token-two']);
        assert.deepEqual(uploadTokens, ['Bearer token-one', 'Bearer token-two']);
        failReply = true;
        await assert.rejects(postToX(content('real-partial', 6), 'caption'), /reply response lost/);
        assert.equal((await loadMarketingState()).publications['x:carousel:real-partial'].remoteIds.length, 1);
        const calls = tweetTokens.length;
        await assert.rejects(postToX(content('real-partial', 6), 'caption'), /reconcile/);
        assert.equal(tweetTokens.length, calls);
      } finally {
        Object.defineProperty(TwitterApi.prototype, 'v2', descriptor);
        if (previousBotPath === undefined) delete process.env.BOT_STATE_PATH;
        else process.env.BOT_STATE_PATH = previousBotPath;
        globalThis.fetch = originalFetch;
      }
    });
    await t.test('real exported posting adapters keep every dry-run out of live state', async () => {
      const before = await readFile(marketingConfig.marketing.statePath, 'utf-8');
      const video = { id: 'dry-video' } as VideoProject;
      await postToX(deck('dry'), 'caption', { dryRun: true });
      await postVideoToX(video, 'caption', { dryRun: true });
      await postToTikTok(deck('dry'), 'caption', { dryRun: true });
      await postVideoToTikTok(video, 'caption', { dryRun: true });
      assert.equal(await readFile(marketingConfig.marketing.statePath, 'utf-8'), before);
    });
    await t.test('TikTok exported adapters deduplicate accepted, scheduled and draft submissions without claiming publication', async () => {
      marketingConfig.marketing.uploadPostApiKey = 'test';
      marketingConfig.marketing.tiktokProfile = 'test';
      let submissions = 0;
      globalThis.fetch = async () => { submissions++; return Response.json({ request_id: `request-${submissions}` }); };
      await updateMarketingState((s) => ({ ...s, decks: [...s.decks, deck('accepted')] }));
      const accepted = await postToTikTok(deck('accepted'), 'caption');
      await postToTikTok(deck('accepted'), 'caption');
      assert.equal(accepted.publicationStatus, 'accepted');
      assert.equal(submissions, 1);
      assert.equal((await loadMarketingState()).decks.find((d) => d.id === 'accepted')?.status, 'ready');
      const file = join(directory, 'video.mp4'); await writeFile(file, 'fake-video');
      const scheduled = await postVideoToTikTok({ id: 'scheduled', finalVideoPath: file } as VideoProject, 'caption', { scheduledDate: '2030-01-01T00:00:00Z' });
      const draft = await postVideoToTikTok({ id: 'draft', finalVideoPath: file } as VideoProject, 'caption', { draft: true });
      assert.equal(scheduled.publicationStatus, 'scheduled');
      assert.equal(draft.publicationStatus, 'draft');
    });
  } finally {
    marketingConfig.marketing.statePath = originalPath;
    globalThis.fetch = originalFetch;
    marketingConfig.marketing.uploadPostApiKey = originalProvider.key;
    marketingConfig.marketing.tiktokProfile = originalProvider.profile;
    await rm(directory, { recursive: true, force: true });
  }
});
