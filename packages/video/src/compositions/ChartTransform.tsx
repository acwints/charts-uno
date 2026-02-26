import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
  Easing,
} from 'remotion';
import { VIDEO_WIDTH, VIDEO_HEIGHT } from '../lib/constants';
import { AnimatedBarChart, type BarChartData } from '../components/AnimatedBarChart';
import { AnimatedLineChart, type LineChartData } from '../components/AnimatedLineChart';
import { UGLY_COLORS } from '../lib/colors';

function lerpColor(c1: string, c2: string, t: number): string {
  const parse = (hex: string) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
  const [r1, g1, b1] = parse(c1);
  const [r2, g2, b2] = parse(c2);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export interface ChartTransformProps {
  /** 'before-after' shows ugly→beautiful bar morph; 'line-showcase' shows a line chart */
  variant: 'before-after' | 'line-showcase';
  barData: BarChartData;
  lineData?: LineChartData;
  beautifulColors: string[];
  title?: string;
}

/**
 * Two-phase scene:
 * Phase 1 (0–40%): Ugly chart builds up
 * Phase 2 (40–100%): Colors morph to beautiful, chart re-animates
 *
 * For 'line-showcase': simply animates a beautiful line chart.
 */
export const ChartTransform: React.FC<ChartTransformProps> = ({
  variant,
  barData,
  lineData,
  beautifulColors,
  title,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  if (variant === 'line-showcase' && lineData) {
    const lineProgress = spring({
      frame: frame - 10,
      fps,
      config: { damping: 40, stiffness: 60, mass: 1 },
      durationInFrames: Math.round(durationInFrames * 0.8),
    });

    const fadeOut = interpolate(
      frame,
      [durationInFrames - 10, durationInFrames],
      [1, 0],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
    );

    return (
      <div style={{ opacity: fadeOut }}>
        <AnimatedLineChart data={lineData} progress={lineProgress} title={title} />
      </div>
    );
  }

  // before-after variant
  const midpoint = Math.round(durationInFrames * 0.4);

  // Phase 1: ugly chart builds
  const uglyProgress = spring({
    frame,
    fps,
    config: { damping: 30, stiffness: 100, mass: 1 },
    durationInFrames: midpoint,
  });

  // Phase 2: morph to beautiful
  const morphProgress = interpolate(frame, [midpoint, midpoint + 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });

  // Beautiful chart re-grows after morph
  const beautifulProgress = spring({
    frame: Math.max(0, frame - midpoint - 10),
    fps,
    config: { damping: 25, stiffness: 80, mass: 1 },
    durationInFrames: durationInFrames - midpoint - 10,
  });

  // Smoothly interpolate colors between ugly and beautiful
  const currentColors = barData.colors.map((_, i) => {
    const uglyColor = UGLY_COLORS[i % UGLY_COLORS.length];
    const prettyColor = beautifulColors[i % beautifulColors.length];
    return lerpColor(uglyColor, prettyColor, morphProgress);
  });

  const currentStyle = morphProgress < 0.5 ? 'ugly' : 'beautiful';
  const currentProgress = uglyProgress + (beautifulProgress - uglyProgress) * morphProgress;
  const titleOpacity = interpolate(morphProgress, [0.3, 0.6], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const currentTitle = titleOpacity > 0 ? title : undefined;

  // Flash effect at morph point
  const flashOpacity = interpolate(
    frame,
    [midpoint - 2, midpoint, midpoint + 8],
    [0, 0.4, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // Fade out
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 10, durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  return (
    <div style={{ position: 'relative', opacity: fadeOut }}>
      <AnimatedBarChart
        data={{ ...barData, colors: currentColors }}
        progress={currentProgress}
        style={currentStyle as 'ugly' | 'beautiful'}
        title={currentTitle}
      />
      {/* Flash overlay */}
      {flashOpacity > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: VIDEO_WIDTH,
            height: VIDEO_HEIGHT,
            backgroundColor: '#fff',
            opacity: flashOpacity,
          }}
        />
      )}
    </div>
  );
};
