import React from 'react';
import { Composition } from 'remotion';
import {
  VIDEO_WIDTH,
  VIDEO_HEIGHT,
  FPS,
  SCENE_DURATIONS,
  TOTAL_DURATION,
  secondsToFrames,
  COMP_IDS,
} from './lib/constants.js';
import { HookReveal, type HookRevealProps } from './compositions/HookReveal.js';
import { ChartTransform, type ChartTransformProps } from './compositions/ChartTransform.js';
import { CTASlide, type CTASlideProps } from './compositions/CTASlide.js';
import { FullVideo, type FullVideoProps } from './compositions/FullVideo.js';
import { COLOR_PALETTES } from './lib/colors.js';

// Default props for Remotion Studio previews
const DEFAULT_BAR_DATA = {
  labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
  values: [42, 58, 35, 72, 61, 89],
  colors: COLOR_PALETTES.editorial,
};

const DEFAULT_LINE_DATA = {
  labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
  series: [
    { name: 'Revenue', values: [42, 58, 35, 72, 61, 89], color: '#3b82f6' },
    { name: 'Users', values: [28, 45, 52, 38, 67, 54], color: '#8b5cf6' },
  ],
};

// Remotion v4 Composition requires components to accept Record<string, unknown>.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Remotion typing constraint
type AnyComp = React.FC<any>;
const HookRevealComp: AnyComp = HookReveal;
const ChartTransformComp: AnyComp = ChartTransform;
const CTASlideComp: AnyComp = CTASlide;
const FullVideoComp: AnyComp = FullVideo;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id={COMP_IDS.hookReveal}
        component={HookRevealComp}
        durationInFrames={secondsToFrames(SCENE_DURATIONS.hook)}
        fps={FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
        defaultProps={{
          hookText: 'My boss said my charts look like they\'re from 2005',
        } satisfies HookRevealProps}
      />

      <Composition
        id={COMP_IDS.chartTransform}
        component={ChartTransformComp}
        durationInFrames={secondsToFrames(SCENE_DURATIONS.transform)}
        fps={FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
        defaultProps={{
          variant: 'before-after',
          barData: DEFAULT_BAR_DATA,
          beautifulColors: COLOR_PALETTES.editorial,
          title: 'Q1-Q2 Performance',
        } satisfies ChartTransformProps}
      />

      <Composition
        id={COMP_IDS.ctaSlide}
        component={CTASlideComp}
        durationInFrames={secondsToFrames(SCENE_DURATIONS.cta)}
        fps={FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
        defaultProps={{
          ctaText: 'Try it free',
          ctaUrl: 'chartsuno.com',
        } satisfies CTASlideProps}
      />

      <Composition
        id={COMP_IDS.fullVideo}
        component={FullVideoComp}
        durationInFrames={secondsToFrames(TOTAL_DURATION)}
        fps={FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
        defaultProps={{
          hook: {
            hookText: 'My boss said my charts look like they\'re from 2005',
          },
          problem: {
            variant: 'before-after',
            barData: DEFAULT_BAR_DATA,
            beautifulColors: COLOR_PALETTES.editorial,
            title: 'Q1-Q2 Performance',
          },
          transform: {
            variant: 'before-after',
            barData: DEFAULT_BAR_DATA,
            beautifulColors: COLOR_PALETTES.editorial,
            title: 'Q1-Q2 Performance',
          },
          showcase: {
            variant: 'line-showcase',
            barData: DEFAULT_BAR_DATA,
            lineData: DEFAULT_LINE_DATA,
            beautifulColors: COLOR_PALETTES.cool,
            title: 'Growth Trends',
          },
          cta: {
            ctaText: 'Try it free',
            ctaUrl: 'chartsuno.com',
          },
        } satisfies FullVideoProps}
      />
    </>
  );
};
