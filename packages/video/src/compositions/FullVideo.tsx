import React from 'react';
import { Series } from 'remotion';
import { FPS, SCENE_DURATIONS, secondsToFrames } from '../lib/constants.js';
import { HookReveal, type HookRevealProps } from './HookReveal.js';
import { ChartTransform, type ChartTransformProps } from './ChartTransform.js';
import { CTASlide, type CTASlideProps } from './CTASlide.js';

export interface FullVideoProps {
  hook: HookRevealProps;
  /** 'problem' scene: before phase of chart transform (ugly chart builds, holds) */
  problem: ChartTransformProps;
  /** 'transform' scene: the morph from ugly → beautiful */
  transform: ChartTransformProps;
  /** 'showcase' scene: different chart type, beautiful */
  showcase: ChartTransformProps;
  cta: CTASlideProps;
}

/**
 * Master composition: stitches all 5 scenes via <Series>.
 *
 * Scene order:
 * 1. Hook text reveal (3s)
 * 2. Problem — ugly chart (5s)
 * 3. Transform — ugly → beautiful morph (6s)
 * 4. Showcase — line chart variant (4s)
 * 5. CTA slide (4s)
 */
export const FullVideo: React.FC<FullVideoProps> = ({
  hook,
  problem,
  transform,
  showcase,
  cta,
}) => {
  return (
    <Series>
      <Series.Sequence durationInFrames={secondsToFrames(SCENE_DURATIONS.hook)}>
        <HookReveal {...hook} />
      </Series.Sequence>

      <Series.Sequence durationInFrames={secondsToFrames(SCENE_DURATIONS.problem)}>
        <ChartTransform {...problem} />
      </Series.Sequence>

      <Series.Sequence durationInFrames={secondsToFrames(SCENE_DURATIONS.transform)}>
        <ChartTransform {...transform} />
      </Series.Sequence>

      <Series.Sequence durationInFrames={secondsToFrames(SCENE_DURATIONS.showcase)}>
        <ChartTransform {...showcase} />
      </Series.Sequence>

      <Series.Sequence durationInFrames={secondsToFrames(SCENE_DURATIONS.cta)}>
        <CTASlide {...cta} />
      </Series.Sequence>
    </Series>
  );
};
