import type { HookCategory } from '../types.js';

// ─── Scene Types ──────────────────────────────────────────────────

export type SceneType = 'hook' | 'problem' | 'transform' | 'showcase' | 'cta';

export interface ScenePlan {
  sceneNumber: 1 | 2 | 3 | 4 | 5;
  type: SceneType;
  durationSeconds: number;
  compositionId: string;
  /** Serializable props passed to the Remotion composition */
  props: Record<string, unknown>;
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

export type VideoStatus = 'draft' | 'rendering' | 'ready' | 'posted-tiktok' | 'posted-x' | 'posted-both';

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
