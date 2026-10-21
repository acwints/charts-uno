import { timingSafeEqual } from 'node:crypto';
import type { IncomingMessage } from 'node:http';

export class RequestError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function serverSecurity(env: NodeJS.ProcessEnv = process.env): { host: string; apiKey: string } {
  const apiKey = env.MARKETING_API_KEY?.trim() || '';
  if (!apiKey && (env.NODE_ENV === 'production' || env.MARKETING_ALLOW_LOCAL_NO_AUTH !== 'true')) {
    throw new Error('MARKETING_API_KEY is required; local development may explicitly set MARKETING_ALLOW_LOCAL_NO_AUTH=true');
  }
  return { apiKey, host: apiKey ? '0.0.0.0' : '127.0.0.1' };
}

export function authenticate(req: IncomingMessage, apiKey: string): boolean {
  if (!apiKey) return req.socket.remoteAddress === '127.0.0.1' || req.socket.remoteAddress === '::1';
  const actual = Buffer.from(req.headers.authorization || '');
  const expected = Buffer.from(`Bearer ${apiKey}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += Buffer.byteLength(chunk);
    if (size > 64 * 1024) throw new RequestError(413, 'Request body exceeds 64 KiB');
    chunks.push(Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString('utf-8');
  let body: unknown;
  try { body = raw.trim() ? JSON.parse(raw) : {}; }
  catch { throw new RequestError(400, 'Malformed JSON'); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new RequestError(400, 'Expected a JSON object');
  const record = body as Record<string, unknown>;
  for (const field of ['dryRun', 'withAvatar', 'draft']) {
    if (record[field] !== undefined && typeof record[field] !== 'boolean') throw new RequestError(400, `${field} must be boolean`);
  }
  for (const field of ['deck', 'video', 'scheduledDate', 'musicPath', 'captureUrl']) {
    if (record[field] !== undefined && (typeof record[field] !== 'string' || !(record[field] as string).trim())) throw new RequestError(400, `${field} must be a nonempty string`);
  }
  if (record.deck && record.video) throw new RequestError(400, 'Specify deck or video, not both');
  if (record.scheduledDate && !Number.isFinite(Date.parse(record.scheduledDate as string))) throw new RequestError(400, 'scheduledDate must be an ISO date');
  if (record.draft && record.scheduledDate) throw new RequestError(400, 'A draft cannot also be scheduled');
  if (record.hookCategory !== undefined && !['person-conflict', 'budget-pain', 'curiosity-discovery'].includes(record.hookCategory as string)) throw new RequestError(400, 'Invalid hookCategory');
  if (record.captureMethod !== undefined && !['remotion', 'browser-video', 'browser-screenshots', 'browser-remotion'].includes(record.captureMethod as string)) throw new RequestError(400, 'Invalid captureMethod');
  if (record.musicVolume !== undefined && (typeof record.musicVolume !== 'number' || !Number.isFinite(record.musicVolume) || record.musicVolume < 0 || record.musicVolume > 1)) throw new RequestError(400, 'musicVolume must be between 0 and 1');
  return record;
}
