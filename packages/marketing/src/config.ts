import { pino } from 'pino';

export const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
    },
  },
});

export const marketingConfig = {
  google: {
    apiKey: process.env.GOOGLE_API_KEY || '',
  },
  twitter: {
    clientId: process.env.TWITTER_CLIENT_ID || '',
    clientSecret: process.env.TWITTER_CLIENT_SECRET || '',
    apiKey: process.env.TWITTER_API_KEY || process.env.TWITTER_CLIENT_ID || '',
    apiSecret: process.env.TWITTER_API_SECRET || process.env.TWITTER_CLIENT_SECRET || '',
    accessToken: process.env.TWITTER_ACCESS_TOKEN || '',
    accessSecret: process.env.TWITTER_ACCESS_SECRET || '',
  },
  marketing: {
    uploadPostApiKey: process.env.UPLOAD_POST_API_KEY || '',
    uploadPostApiUrl: process.env.UPLOAD_POST_API_URL || 'https://api.upload-post.com',
    tiktokProfile: process.env.TIKTOK_PROFILE || '',
    statePath: process.env.MARKETING_STATE_PATH || './data/marketing-state.json',
    slidesDir: process.env.MARKETING_SLIDES_DIR || './data/marketing/slides',
    videosDir: process.env.MARKETING_VIDEOS_DIR || './data/marketing/videos',
    ffmpegPath: process.env.FFMPEG_PATH || 'ffmpeg',
    musicPath: process.env.MARKETING_MUSIC_PATH || '',
    musicVolume: parseFloat(process.env.MARKETING_MUSIC_VOLUME || '0.15'),
    heygenApiKey: process.env.HEYGEN_API_KEY || '',
    ctaUrl: process.env.MARKETING_CTA_URL || 'https://chartsuno.com',
    agentBrowserCommand: process.env.AGENT_BROWSER_CMD || 'agent-browser',
    captureUrl: process.env.CAPTURE_URL || 'https://chartsuno.com',
    imagenModel: 'imagen-4.0-fast-generate-001',
    imagenAspectRatio: '9:16',
    slideWidth: 1024,
    slideHeight: 1536,
  },
};

interface ValidateOptions {
  requireGoogle?: boolean;
  requireX?: boolean;
  requireTikTok?: boolean;
}

export function validateMarketingConfig(options: ValidateOptions = {}): void {
  const missing: string[] = [];

  if (options.requireGoogle && !marketingConfig.google.apiKey) {
    missing.push('GOOGLE_API_KEY');
  }

  if (options.requireTikTok) {
    if (!marketingConfig.marketing.uploadPostApiKey) missing.push('UPLOAD_POST_API_KEY');
    if (!marketingConfig.marketing.tiktokProfile) missing.push('TIKTOK_PROFILE');
  }

  if (missing.length > 0) {
    throw new Error(`Missing marketing config: ${missing.join(', ')}`);
  }
}
