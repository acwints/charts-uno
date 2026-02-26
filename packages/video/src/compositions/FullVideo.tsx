import React from 'react';
import { AbsoluteFill } from 'remotion';
import { TransitionSeries, linearTiming, springTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { wipe } from '@remotion/transitions/wipe';
import { slide } from '@remotion/transitions/slide';
import { FPS, SCENE_DURATIONS, secondsToFrames } from '../lib/constants';
import { HookReveal, type HookRevealProps } from './HookReveal';
import { ChartTransform, type ChartTransformProps } from './ChartTransform';
import { CTASlide, type CTASlideProps } from './CTASlide';

/** Transition overlap duration in frames */
const TRANSITION_FRAMES = 10;

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
 * Master composition: stitches all 5 scenes with transitions.
 *
 * Scene order:
 * 1. Hook text reveal (3s) —[fade]→
 * 2. Problem — ugly chart (5s) —[wipe]→
 * 3. Transform — ugly → beautiful morph (6s) —[slide]→
 * 4. Showcase — line chart variant (4s) —[fade]→
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
    <TransitionSeries>
      {/* Scene 1: Hook */}
      <TransitionSeries.Sequence durationInFrames={secondsToFrames(SCENE_DURATIONS.hook)}>
        <AbsoluteFill>
          <HookReveal {...hook} />
        </AbsoluteFill>
      </TransitionSeries.Sequence>

      {/* Fade: hook → problem */}
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
      />

      {/* Scene 2: Problem (ugly chart) */}
      <TransitionSeries.Sequence durationInFrames={secondsToFrames(SCENE_DURATIONS.problem)}>
        <AbsoluteFill>
          <ChartTransform {...problem} />
        </AbsoluteFill>
      </TransitionSeries.Sequence>

      {/* Wipe: problem → transform */}
      <TransitionSeries.Transition
        presentation={wipe({ direction: 'from-left' })}
        timing={springTiming({ config: { damping: 200 }, durationInFrames: TRANSITION_FRAMES })}
      />

      {/* Scene 3: Transform (ugly → beautiful morph) */}
      <TransitionSeries.Sequence durationInFrames={secondsToFrames(SCENE_DURATIONS.transform)}>
        <AbsoluteFill>
          <ChartTransform {...transform} />
        </AbsoluteFill>
      </TransitionSeries.Sequence>

      {/* Slide: transform → showcase */}
      <TransitionSeries.Transition
        presentation={slide({ direction: 'from-right' })}
        timing={springTiming({ config: { damping: 200 }, durationInFrames: TRANSITION_FRAMES })}
      />

      {/* Scene 4: Showcase (line chart) */}
      <TransitionSeries.Sequence durationInFrames={secondsToFrames(SCENE_DURATIONS.showcase)}>
        <AbsoluteFill>
          <ChartTransform {...showcase} />
        </AbsoluteFill>
      </TransitionSeries.Sequence>

      {/* Fade: showcase → CTA */}
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
      />

      {/* Scene 5: CTA */}
      <TransitionSeries.Sequence durationInFrames={secondsToFrames(SCENE_DURATIONS.cta)}>
        <AbsoluteFill>
          <CTASlide {...cta} />
        </AbsoluteFill>
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};
