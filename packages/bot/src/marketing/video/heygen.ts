import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { logger } from '../config.js';

// ─── Types ──────────────────────────────────────────────────────────

interface HeyGenVideoRequest {
  video_inputs: HeyGenVideoInput[];
  dimension?: { width: number; height: number };
}

interface HeyGenVideoInput {
  character: {
    type: 'avatar';
    avatar_id: string;
    avatar_style: 'normal' | 'circle' | 'closeUp';
  };
  voice: {
    type: 'text';
    input_text: string;
    voice_id: string;
    speed?: number;
  };
  background?: {
    type: 'color';
    value: string;
  };
}

interface HeyGenCreateResponse {
  data?: { video_id: string };
  error?: { message: string };
}

interface HeyGenStatusResponse {
  data?: {
    status: 'processing' | 'completed' | 'failed';
    video_url?: string;
    error?: { message: string };
  };
  error?: { message: string };
}

export interface HeyGenConfig {
  apiKey: string;
  /** Default avatar ID — can be overridden per request */
  avatarId?: string;
  /** Default voice ID — can be overridden per request */
  voiceId?: string;
}

export interface AvatarSceneOptions {
  /** Script for the avatar to speak */
  script: string;
  /** Output directory for the downloaded video */
  outputDir: string;
  /** Output filename (default: avatar-intro.mp4) */
  filename?: string;
  /** Background color (default: #0a0a0f to match video dark theme) */
  backgroundColor?: string;
  /** Avatar style */
  avatarStyle?: 'normal' | 'circle' | 'closeUp';
  /** Override avatar ID */
  avatarId?: string;
  /** Override voice ID */
  voiceId?: string;
}

// ─── Constants ──────────────────────────────────────────────────────

const HEYGEN_API_URL = 'https://api.heygen.com';
const POLL_INTERVAL_MS = 5000;
const MAX_POLL_MS = 10 * 60 * 1000; // 10 minute timeout

// Default avatar/voice — HeyGen free tier includes several options
const DEFAULT_AVATAR_ID = 'Angela-inTshirt-20220820';
const DEFAULT_VOICE_ID = 'en-US-JennyNeural';

// ─── Implementation ─────────────────────────────────────────────────

function getApiKey(): string {
  const key = process.env.HEYGEN_API_KEY;
  if (!key) {
    throw new Error('HEYGEN_API_KEY environment variable is required for avatar scenes');
  }
  return key;
}

/**
 * Generate a talking-head avatar video via the HeyGen API.
 *
 * Flow:
 * 1. POST /v2/video/generate — submit video generation request
 * 2. Poll GET /v1/video_status.get — wait for processing
 * 3. Download the resulting MP4
 *
 * Returns the local path to the downloaded MP4.
 */
export async function generateAvatarScene(options: AvatarSceneOptions): Promise<string> {
  const {
    script,
    outputDir,
    filename = 'avatar-intro.mp4',
    backgroundColor = '#0a0a0f',
    avatarStyle = 'normal',
    avatarId = DEFAULT_AVATAR_ID,
    voiceId = DEFAULT_VOICE_ID,
  } = options;

  const apiKey = getApiKey();
  await mkdir(outputDir, { recursive: true });

  // Step 1: Submit video generation
  logger.info({ scriptLength: script.length, avatarId }, 'Submitting HeyGen avatar video');

  const createPayload: HeyGenVideoRequest = {
    video_inputs: [
      {
        character: {
          type: 'avatar',
          avatar_id: avatarId,
          avatar_style: avatarStyle,
        },
        voice: {
          type: 'text',
          input_text: script,
          voice_id: voiceId,
          speed: 1.0,
        },
        background: {
          type: 'color',
          value: backgroundColor,
        },
      },
    ],
    dimension: { width: 1080, height: 1920 },
  };

  const createResponse = await fetch(`${HEYGEN_API_URL}/v2/video/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey,
    },
    body: JSON.stringify(createPayload),
  });

  if (!createResponse.ok) {
    const errorText = await createResponse.text();
    throw new Error(`HeyGen video creation failed (${createResponse.status}): ${errorText}`);
  }

  const createData = (await createResponse.json()) as HeyGenCreateResponse;
  if (createData.error) {
    throw new Error(`HeyGen error: ${createData.error.message}`);
  }

  const videoId = createData.data?.video_id;
  if (!videoId) {
    throw new Error('HeyGen response missing video_id');
  }

  logger.info({ videoId }, 'HeyGen video submitted, polling for completion');

  // Step 2: Poll for completion
  const deadline = Date.now() + MAX_POLL_MS;
  let videoUrl: string | null = null;

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

    const statusResponse = await fetch(
      `${HEYGEN_API_URL}/v1/video_status.get?video_id=${videoId}`,
      {
        headers: { 'X-Api-Key': apiKey },
      },
    );

    if (!statusResponse.ok) {
      logger.warn({ status: statusResponse.status }, 'HeyGen status check failed, retrying');
      continue;
    }

    const statusData = (await statusResponse.json()) as HeyGenStatusResponse;
    const status = statusData.data?.status;

    if (status === 'completed') {
      videoUrl = statusData.data?.video_url ?? null;
      break;
    } else if (status === 'failed') {
      const errorMsg = statusData.data?.error?.message ?? 'Unknown error';
      throw new Error(`HeyGen video processing failed: ${errorMsg}`);
    }

    logger.debug({ videoId, status }, 'HeyGen video still processing');
  }

  if (!videoUrl) {
    throw new Error('HeyGen video processing timed out');
  }

  // Step 3: Download the video
  logger.info({ videoUrl }, 'Downloading HeyGen video');

  const downloadResponse = await fetch(videoUrl);
  if (!downloadResponse.ok) {
    throw new Error(`Failed to download HeyGen video (${downloadResponse.status})`);
  }

  const videoBuffer = Buffer.from(await downloadResponse.arrayBuffer());
  const outputPath = join(outputDir, filename);
  await writeFile(outputPath, videoBuffer);

  logger.info({ outputPath, sizeBytes: videoBuffer.byteLength }, 'HeyGen avatar video saved');
  return outputPath;
}

/**
 * Generate a short avatar intro script based on the marketing hook.
 *
 * Keeps it to ~5 seconds of speech (roughly 15-20 words).
 */
export function generateAvatarScript(hookText: string): string {
  // Strip any trailing punctuation for natural flow
  const cleanHook = hookText.replace(/[.!?]+$/, '');

  const intros = [
    `Hey! ${cleanHook}. Let me show you something.`,
    `You know what? ${cleanHook}. Watch this.`,
    `${cleanHook}. But what if I told you there's a fix?`,
    `Okay, ${cleanHook.toLowerCase()}. Here's what I did about it.`,
  ];

  return intros[Math.floor(Math.random() * intros.length)];
}
