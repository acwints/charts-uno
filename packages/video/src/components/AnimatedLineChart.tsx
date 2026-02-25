import React from 'react';
import { interpolate } from 'remotion';
import { VIDEO_WIDTH, VIDEO_HEIGHT } from '../lib/constants.js';

export interface LineChartData {
  labels: string[];
  series: { name: string; values: number[]; color: string }[];
}

interface AnimatedLineChartProps {
  data: LineChartData;
  /** 0→1 controls line drawing progress via stroke-dashoffset */
  progress: number;
  title?: string;
}

const CHART_PADDING = { top: 140, right: 80, bottom: 120, left: 100 };
const CHART_WIDTH = VIDEO_WIDTH - CHART_PADDING.left - CHART_PADDING.right;
const CHART_HEIGHT = VIDEO_HEIGHT * 0.45;

export const AnimatedLineChart: React.FC<AnimatedLineChartProps> = ({
  data,
  progress,
  title,
}) => {
  const { labels, series } = data;
  const allValues = series.flatMap((s) => s.values);
  const maxValue = Math.max(...allValues, 1);
  const pointCount = labels.length;

  // Grid
  const gridLines = 5;
  const gridElements: React.ReactNode[] = [];
  for (let i = 0; i <= gridLines; i++) {
    const y = CHART_PADDING.top + (CHART_HEIGHT / gridLines) * i;
    gridElements.push(
      <line
        key={`grid-${i}`}
        x1={CHART_PADDING.left}
        y1={y}
        x2={CHART_PADDING.left + CHART_WIDTH}
        y2={y}
        stroke="rgba(59, 130, 246, 0.12)"
        strokeWidth={1}
      />,
    );
  }

  return (
    <svg
      width={VIDEO_WIDTH}
      height={VIDEO_HEIGHT}
      viewBox={`0 0 ${VIDEO_WIDTH} ${VIDEO_HEIGHT}`}
      style={{ backgroundColor: '#0f0f1e' }}
    >
      <defs>
        <radialGradient id="line-bg-glow" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="100%" stopColor="#0f0f1e" />
        </radialGradient>
      </defs>
      <rect width={VIDEO_WIDTH} height={VIDEO_HEIGHT} fill="url(#line-bg-glow)" />

      {/* Title */}
      {title && (
        <text
          x={VIDEO_WIDTH / 2}
          y={80}
          textAnchor="middle"
          fill="#e2e8f0"
          fontSize={40}
          fontFamily="system-ui, -apple-system, sans-serif"
          fontWeight={600}
        >
          {title}
        </text>
      )}

      {/* Grid */}
      {gridElements}

      {/* Labels */}
      {labels.map((label, i) => {
        const x = CHART_PADDING.left + (i / (pointCount - 1)) * CHART_WIDTH;
        return (
          <text
            key={`label-${i}`}
            x={x}
            y={CHART_PADDING.top + CHART_HEIGHT + 40}
            textAnchor="middle"
            fill="#94a3b8"
            fontSize={22}
            fontFamily="system-ui, -apple-system, sans-serif"
          >
            {label}
          </text>
        );
      })}

      {/* Lines */}
      {series.map((s, si) => {
        const points = s.values.map((v, i) => {
          const x = CHART_PADDING.left + (i / (pointCount - 1)) * CHART_WIDTH;
          const y = CHART_PADDING.top + CHART_HEIGHT - (v / maxValue) * CHART_HEIGHT;
          return { x, y };
        });

        const pathD = points
          .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
          .join(' ');

        // Approximate total path length
        let totalLength = 0;
        for (let i = 1; i < points.length; i++) {
          const dx = points[i].x - points[i - 1].x;
          const dy = points[i].y - points[i - 1].y;
          totalLength += Math.sqrt(dx * dx + dy * dy);
        }

        // Stagger each series slightly
        const stagger = interpolate(si, [0, Math.max(series.length - 1, 1)], [0, 0.15]);
        const lineProgress = interpolate(progress, [stagger, stagger + 0.85], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });

        const dashOffset = totalLength * (1 - lineProgress);

        return (
          <g key={si}>
            <path
              d={pathD}
              fill="none"
              stroke={s.color}
              strokeWidth={4}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={totalLength}
              strokeDashoffset={dashOffset}
            />
            {/* Dots */}
            {points.map((p, i) => {
              const dotProgress = interpolate(
                lineProgress,
                [(i / (pointCount - 1)) * 0.9, (i / (pointCount - 1)) * 0.9 + 0.1],
                [0, 1],
                { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
              );
              return (
                <circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r={6 * dotProgress}
                  fill={s.color}
                  opacity={dotProgress}
                />
              );
            })}
          </g>
        );
      })}
    </svg>
  );
};
