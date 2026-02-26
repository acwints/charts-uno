import { registerRoot } from 'remotion';
import { RemotionRoot } from './Root';

registerRoot(RemotionRoot);

// Re-export for programmatic use by @chartsuno/bot
export { COMP_IDS, FPS, VIDEO_WIDTH, VIDEO_HEIGHT, TOTAL_DURATION, SCENE_DURATIONS, secondsToFrames } from './lib/constants';
export type { FullVideoProps } from './compositions/FullVideo';
export type { HookRevealProps } from './compositions/HookReveal';
export type { ChartTransformProps } from './compositions/ChartTransform';
export type { CTASlideProps } from './compositions/CTASlide';
export type { BrowserScreenshotsProps } from './compositions/BrowserScreenshots';
export type { BarChartData } from './components/AnimatedBarChart';
export type { LineChartData } from './components/AnimatedLineChart';
export type { PieChartData } from './components/AnimatedPieChart';
