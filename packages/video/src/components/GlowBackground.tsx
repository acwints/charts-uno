import React from 'react';
import { interpolate } from 'remotion';
import { VIDEO_WIDTH, VIDEO_HEIGHT } from '../lib/constants.js';

interface GlowBackgroundProps {
  /** 0→1 progress for subtle glow animation */
  progress: number;
  baseColor?: string;
  glowColor?: string;
}

export const GlowBackground: React.FC<GlowBackgroundProps> = ({
  progress,
  baseColor = '#0a0a0f',
  glowColor = '#3b82f6',
}) => {
  // Animate glow position and intensity
  const glowX = interpolate(progress, [0, 0.5, 1], [0.3, 0.6, 0.4]);
  const glowY = interpolate(progress, [0, 0.5, 1], [0.3, 0.4, 0.35]);
  const glowOpacity = interpolate(progress, [0, 0.3, 0.7, 1], [0.05, 0.15, 0.12, 0.08]);

  // Second glow orb
  const glow2X = interpolate(progress, [0, 0.5, 1], [0.7, 0.4, 0.65]);
  const glow2Y = interpolate(progress, [0, 0.5, 1], [0.6, 0.5, 0.55]);

  return (
    <g>
      <rect width={VIDEO_WIDTH} height={VIDEO_HEIGHT} fill={baseColor} />
      {/* Primary glow */}
      <ellipse
        cx={VIDEO_WIDTH * glowX}
        cy={VIDEO_HEIGHT * glowY}
        rx={VIDEO_WIDTH * 0.5}
        ry={VIDEO_HEIGHT * 0.35}
        fill={glowColor}
        opacity={glowOpacity}
        style={{ filter: 'blur(100px)' }}
      />
      {/* Secondary glow */}
      <ellipse
        cx={VIDEO_WIDTH * glow2X}
        cy={VIDEO_HEIGHT * glow2Y}
        rx={VIDEO_WIDTH * 0.35}
        ry={VIDEO_HEIGHT * 0.25}
        fill="#8b5cf6"
        opacity={glowOpacity * 0.6}
        style={{ filter: 'blur(80px)' }}
      />
    </g>
  );
};
