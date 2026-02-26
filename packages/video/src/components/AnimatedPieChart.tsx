import React from 'react';
import { interpolate } from 'remotion';
import { VIDEO_WIDTH, VIDEO_HEIGHT } from '../lib/constants';

export interface PieChartData {
  slices: { label: string; value: number; color: string }[];
}

interface AnimatedPieChartProps {
  data: PieChartData;
  /** 0→1 controls slice reveal (each slice sweeps in with stagger) */
  progress: number;
  title?: string;
  /** Radius of the pie relative to the shorter viewport axis */
  radiusFraction?: number;
  /** Show percentage labels on slices */
  showLabels?: boolean;
}

const CX = VIDEO_WIDTH / 2;
const CY = VIDEO_HEIGHT * 0.42;

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
): string {
  // Clamp to avoid degenerate arcs
  const sweep = Math.min(endAngle - startAngle, 359.999);
  const end = startAngle + sweep;
  const start = polarToCartesian(cx, cy, r, end);
  const finish = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = sweep > 180 ? 1 : 0;

  return [
    `M ${cx} ${cy}`,
    `L ${start.x} ${start.y}`,
    `A ${r} ${r} 0 ${largeArc} 0 ${finish.x} ${finish.y}`,
    'Z',
  ].join(' ');
}

export const AnimatedPieChart: React.FC<AnimatedPieChartProps> = ({
  data,
  progress,
  title,
  radiusFraction = 0.28,
  showLabels = true,
}) => {
  const { slices } = data;
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  const radius = Math.min(VIDEO_WIDTH, VIDEO_HEIGHT) * radiusFraction;
  const sliceCount = slices.length;

  let currentAngle = 0;

  return (
    <svg
      width={VIDEO_WIDTH}
      height={VIDEO_HEIGHT}
      viewBox={`0 0 ${VIDEO_WIDTH} ${VIDEO_HEIGHT}`}
      style={{ backgroundColor: '#0f0f1e' }}
    >
      <defs>
        <radialGradient id="pie-bg-glow" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="100%" stopColor="#0f0f1e" />
        </radialGradient>
      </defs>
      <rect width={VIDEO_WIDTH} height={VIDEO_HEIGHT} fill="url(#pie-bg-glow)" />

      {/* Title */}
      {title && (
        <text
          x={VIDEO_WIDTH / 2}
          y={80}
          textAnchor="middle"
          fill="#e2e8f0"
          fontSize={40}
          fontWeight={600}
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          {title}
        </text>
      )}

      {/* Slices */}
      {slices.map((slice, i) => {
        const sliceAngle = (slice.value / total) * 360;

        // Stagger each slice
        const stagger = interpolate(i, [0, Math.max(sliceCount - 1, 1)], [0, 0.35]);
        const sliceProgress = interpolate(progress, [stagger, stagger + 0.65], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });

        const animatedAngle = sliceAngle * sliceProgress;
        const startAngle = currentAngle;
        const endAngle = currentAngle + animatedAngle;
        currentAngle += sliceAngle;

        if (animatedAngle < 0.1) return null;

        const d = describeArc(CX, CY, radius, startAngle, endAngle);

        // Label position: midpoint of the arc, pushed outward
        const midAngle = startAngle + animatedAngle / 2;
        const labelRadius = radius * 1.25;
        const labelPos = polarToCartesian(CX, CY, labelRadius, midAngle);
        const pct = Math.round((slice.value / total) * 100);

        return (
          <g key={i}>
            <path d={d} fill={slice.color} opacity={0.9} />
            {/* Slice border */}
            <path d={d} fill="none" stroke="#0f0f1e" strokeWidth={2} />
            {/* Label */}
            {showLabels && sliceProgress > 0.5 && (
              <g opacity={interpolate(sliceProgress, [0.5, 0.8], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              })}>
                <text
                  x={labelPos.x}
                  y={labelPos.y - 10}
                  textAnchor="middle"
                  fill="#e2e8f0"
                  fontSize={22}
                  fontWeight={600}
                  fontFamily="system-ui, -apple-system, sans-serif"
                >
                  {slice.label}
                </text>
                <text
                  x={labelPos.x}
                  y={labelPos.y + 14}
                  textAnchor="middle"
                  fill="#94a3b8"
                  fontSize={18}
                  fontFamily="system-ui, -apple-system, sans-serif"
                >
                  {pct}%
                </text>
              </g>
            )}
          </g>
        );
      })}

      {/* Center circle (donut hole) */}
      <circle cx={CX} cy={CY} r={radius * 0.4} fill="#0f0f1e" />
      <circle cx={CX} cy={CY} r={radius * 0.4} fill="none" stroke="#1e293b" strokeWidth={2} />

      {/* Legend */}
      {slices.map((slice, i) => {
        const legendY = VIDEO_HEIGHT * 0.72 + i * 40;
        const legendOpacity = interpolate(progress, [0.6 + i * 0.05, 0.7 + i * 0.05], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });

        return (
          <g key={`legend-${i}`} opacity={legendOpacity}>
            <rect
              x={VIDEO_WIDTH * 0.25}
              y={legendY - 10}
              width={16}
              height={16}
              rx={3}
              fill={slice.color}
            />
            <text
              x={VIDEO_WIDTH * 0.25 + 28}
              y={legendY + 3}
              fill="#94a3b8"
              fontSize={20}
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              {slice.label} — {slice.value}
            </text>
          </g>
        );
      })}
    </svg>
  );
};
