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

export interface CTASlideProps {
  ctaText: string;
  ctaUrl: string;
}

export const CTASlide: React.FC<CTASlideProps> = ({ ctaText, ctaUrl }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const bgProgress = interpolate(frame, [0, durationInFrames], [0, 1]);

  // CTA text drops in
  const textDrop = spring({
    frame: frame - 5,
    fps,
    config: { damping: 20, stiffness: 120, mass: 0.8 },
  });
  const textY = interpolate(textDrop, [0, 1], [VIDEO_HEIGHT * 0.35, VIDEO_HEIGHT * 0.42]);
  const textOpacity = interpolate(textDrop, [0, 0.3], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // URL fades in after
  const urlOpacity = interpolate(frame, [20, 35], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const urlY = interpolate(frame, [20, 35], [VIDEO_HEIGHT * 0.56, VIDEO_HEIGHT * 0.54], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // Button pulse
  const pulse = interpolate(frame % 40, [0, 20, 40], [1, 1.04, 1]);

  // Arrow bounce
  const arrowBounce = interpolate(frame % 30, [0, 15, 30], [0, -8, 0]);

  // Fade out
  const fadeOut = interpolate(frame, [durationInFrames - 8, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const btnWidth = 520;
  const btnHeight = 80;
  const btnX = (VIDEO_WIDTH - btnWidth) / 2;
  const btnY = VIDEO_HEIGHT * 0.62;

  return (
    <svg
      width={VIDEO_WIDTH}
      height={VIDEO_HEIGHT}
      viewBox={`0 0 ${VIDEO_WIDTH} ${VIDEO_HEIGHT}`}
      style={{ opacity: fadeOut }}
    >
      <defs>
        <linearGradient id="cta-btn-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>

      <GlowBackground progress={bgProgress} glowColor="#8b5cf6" />

      {/* CTA headline */}
      <text
        x={VIDEO_WIDTH / 2}
        y={textY}
        textAnchor="middle"
        fill="#f8fafc"
        fontSize={62}
        fontWeight={700}
        fontFamily="system-ui, -apple-system, sans-serif"
        opacity={textOpacity}
      >
        {ctaText}
      </text>

      {/* URL */}
      <text
        x={VIDEO_WIDTH / 2}
        y={urlY}
        textAnchor="middle"
        fill="#94a3b8"
        fontSize={32}
        fontWeight={400}
        fontFamily="system-ui, -apple-system, sans-serif"
        opacity={urlOpacity}
      >
        {ctaUrl}
      </text>

      {/* Button */}
      <g
        transform={`translate(${btnX + btnWidth / 2}, ${btnY + btnHeight / 2}) scale(${pulse}) translate(${-(btnX + btnWidth / 2)}, ${-(btnY + btnHeight / 2)})`}
        opacity={urlOpacity}
      >
        <rect
          x={btnX}
          y={btnY}
          width={btnWidth}
          height={btnHeight}
          rx={btnHeight / 2}
          fill="url(#cta-btn-grad)"
        />
        <text
          x={VIDEO_WIDTH / 2}
          y={btnY + btnHeight / 2 + 8}
          textAnchor="middle"
          fill="#fff"
          fontSize={28}
          fontWeight={600}
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          Try it free
        </text>
      </g>

      {/* Down arrow */}
      <text
        x={VIDEO_WIDTH / 2}
        y={btnY + btnHeight + 50 + arrowBounce}
        textAnchor="middle"
        fill="#64748b"
        fontSize={36}
        fontFamily="system-ui, -apple-system, sans-serif"
        opacity={urlOpacity * 0.7}
      >
        {'↓'}
      </text>
    </svg>
  );
};
