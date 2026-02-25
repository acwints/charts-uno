import { registerRoot } from 'remotion';
import { RemotionRoot } from './Root.js';

registerRoot(RemotionRoot);

// Re-export for programmatic use by @chartsuno/bot
export { COMP_IDS, FPS, VIDEO_WIDTH, VIDEO_HEIGHT, TOTAL_DURATION, SCENE_DURATIONS, secondsToFrames } from './lib/constants.js';
export type { FullVideoProps } from './compositions/FullVideo.js';
export type { HookRevealProps } from './compositions/HookReveal.js';
export type { ChartTransformProps } from './compositions/ChartTransform.js';
export type { CTASlideProps } from './compositions/CTASlide.js';
export type { BarChartData } from './components/AnimatedBarChart.js';
export type { LineChartData } from './components/AnimatedLineChart.js';
