export type * from './types.js';
export { marketingConfig, validateMarketingConfig } from './config.js';
export { loadMarketingState, saveMarketingState, updateMarketingState } from './state.js';
export { selectHook, HOOK_LIBRARY } from './content/hooks.js';
export { planSlides } from './content/slides.js';
export { generateCaption } from './content/captions.js';
export { generateImage } from './image/imagen.js';
export { applyTextOverlay } from './image/overlay.js';
export { generateScreenshot } from './image/screenshot.js';
export { composeDeck } from './image/composer.js';
export { postToX, postVideoToX } from './platforms/x-poster.js';
export { postToTikTok, postVideoToTikTok, checkTikTokUploadStatus } from './platforms/tiktok-poster.js';
export { classifyPerformance, getQuadrantAdvice, updateHookPerformance } from './analytics/tracker.js';
export { generateDailyReport } from './analytics/report.js';
export {
  planScenes,
  renderAllScenes,
  assembleVideo,
  prependAvatarClip,
  captureSession,
  getTransformCaptureSteps,
  screenshotsToVideo,
  isAgentBrowserAvailable,
  captureVideo,
  captureScreenshots,
  runInteractionScript,
  generateAvatarScene,
  generateAvatarScript,
} from './video/index.js';
export type {
  VideoProject, ScenePlan, RenderJob, AssembleOptions,
  CaptureMethod, BrowserCaptureConfig, PlanScenesOptions,
  AgentBrowserOptions, VideoCaptureResult, ScreenshotCaptureResult,
} from './video/index.js';
