import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
  Easing,
} from 'remotion';
import { VIDEO_WIDTH, VIDEO_HEIGHT } from '../lib/constants.js';
import { GlowBackground } from '../components/GlowBackground.js';
import { TextReveal } from '../components/TextReveal.js';

export interface HookRevealProps {
  hookText: string;
}

export const HookReveal: React.FC<HookRevealProps> = ({ hookText }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Background glow animation
  const bgProgress = interpolate(frame, [0, durationInFrames], [0, 1]);

  // Text reveal: starts at frame 8, completes by 80% of duration
  const textProgress = spring({
    frame: frame - 8,
    fps,
    config: { damping: 50, stiffness: 80, mass: 1 },
    durationInFrames: Math.round(durationInFrames * 0.7),
  });

  // Subtle scale-in for the whole scene
  const scaleIn = interpolate(frame, [0, 15], [1.05, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // Fade out last 10 frames
  const fadeOut = interpolate(frame, [durationInFrames - 10, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <svg
      width={VIDEO_WIDTH}
      height={VIDEO_HEIGHT}
      viewBox={`0 0 ${VIDEO_WIDTH} ${VIDEO_HEIGHT}`}
      style={{ transform: `scale(${scaleIn})`, opacity: fadeOut }}
    >
      <GlowBackground progress={bgProgress} />
      <TextReveal
        text={hookText}
        progress={textProgress}
        fontSize={68}
        y={VIDEO_HEIGHT * 0.45}
      />
    </svg>
  );
};
