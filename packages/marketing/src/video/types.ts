import type { HookCategory, PostingStatus } from '../types.js';

// ─── Capture Types ────────────────────────────────────────────────

export type CaptureMethod = 'remotion' | 'browser-video' | 'browser-screenshots' | 'browser-remotion';

export type BrowserScriptId = 'problem-ugly' | 'transform-ugly-to-beautiful' | 'showcase-features';

export interface BrowserCaptureConfig {
  url: string;
  scriptId: BrowserScriptId;
  viewport?: { width: number; height: number };
  durationSeconds?: number;
}

// ─── Scene Types ──────────────────────────────────────────────────

export type SceneType = 'hook' | 'problem' | 'transform' | 'showcase' | 'cta';

export interface ScenePlan {
  sceneNumber: 1 | 2 | 3 | 4 | 5;
  type: SceneType;
  durationSeconds: number;
  /** Remotion composition ID — required for remotion captureMethod, optional for browser methods */
  compositionId?: string;
  /** Serializable props passed to the Remotion composition */
  props?: Record<string, unknown>;
  /** How this scene is captured (default: 'remotion') */
  captureMethod?: CaptureMethod;
  /** Config for browser-based capture methods */
  browserCapture?: BrowserCaptureConfig;
}

// ─── Render Types ─────────────────────────────────────────────────

export type RenderStatus = 'pending' | 'rendering' | 'done' | 'error';

export interface RenderJob {
  sceneNumber: number;
  compositionId: string;
  status: RenderStatus;
  outputPath?: string;
  error?: string;
  durationMs?: number;
}

// ─── Video Project ────────────────────────────────────────────────

export type VideoStatus = 'draft' | 'rendering' | PostingStatus;

export interface VideoProject {
  id: string;
  createdAt: string;
  hookId: string;
  hookCategory: HookCategory;
  hookText: string;
  ctaText: string;
  ctaUrl: string;
  scenes: ScenePlan[];
  renderJobs: RenderJob[];
  finalVideoPath?: string;
  status: VideoStatus;
  durationSeconds: number;
}
