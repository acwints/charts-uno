import React from 'react';
import { interpolate } from 'remotion';
import { VIDEO_WIDTH, VIDEO_HEIGHT } from '../lib/constants';

export interface BarChartData {
  labels: string[];
  values: number[];
  colors: string[];
}

interface AnimatedBarChartProps {
  data: BarChartData;
  /** 0→1 controls how much of the bars are revealed */
  progress: number;
  /** Optional style: 'ugly' renders flat grey, 'beautiful' renders with gradients */
  style?: 'ugly' | 'beautiful';
  title?: string;
}

const CHART_PADDING = { top: 140, right: 80, bottom: 120, left: 100 };
const CHART_WIDTH = VIDEO_WIDTH - CHART_PADDING.left - CHART_PADDING.right;
const CHART_HEIGHT = VIDEO_HEIGHT * 0.45;

export const AnimatedBarChart: React.FC<AnimatedBarChartProps> = ({
  data,
  progress,
  style = 'beautiful',
  title,
}) => {
  const { labels, values, colors } = data;
  const maxValue = Math.max(...values, 1);
  const barCount = values.length;
  const gap = 16;
  const barWidth = (CHART_WIDTH - gap * (barCount - 1)) / barCount;

  const isUgly = style === 'ugly';
  const bgColor = isUgly ? '#1a1a1a' : '#0f0f1e';
  const gridColor = isUgly ? '#333' : 'rgba(59, 130, 246, 0.12)';
  const labelColor = isUgly ? '#666' : '#94a3b8';
  const titleColor = isUgly ? '#555' : '#e2e8f0';

  // Grid lines
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
        stroke={gridColor}
        strokeWidth={1}
      />,
    );
  }

  return (
    <svg
      width={VIDEO_WIDTH}
      height={VIDEO_HEIGHT}
      viewBox={`0 0 ${VIDEO_WIDTH} ${VIDEO_HEIGHT}`}
      style={{ backgroundColor: bgColor }}
    >
      {/* Background gradient for beautiful mode */}
      {!isUgly && (
        <defs>
          <radialGradient id="bg-glow" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="100%" stopColor="#0f0f1e" />
          </radialGradient>
          {colors.map((color, i) => (
            <linearGradient key={`grad-${i}`} id={`bar-grad-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={1} />
              <stop offset="100%" stopColor={color} stopOpacity={0.6} />
            </linearGradient>
          ))}
        </defs>
      )}
      {!isUgly && (
        <rect width={VIDEO_WIDTH} height={VIDEO_HEIGHT} fill="url(#bg-glow)" />
      )}

      {/* Title */}
      {title && (
        <text
          x={VIDEO_WIDTH / 2}
          y={80}
          textAnchor="middle"
          fill={titleColor}
          fontSize={isUgly ? 32 : 40}
          fontFamily="system-ui, -apple-system, sans-serif"
          fontWeight={isUgly ? 400 : 600}
        >
          {title}
        </text>
      )}

      {/* Grid */}
      {gridElements}

      {/* Bars */}
      {values.map((value, i) => {
        // Stagger bar animations
        const stagger = interpolate(i, [0, barCount - 1], [0, 0.3]);
        const barProgress = interpolate(progress, [stagger, stagger + 0.7], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });

        const fullHeight = (value / maxValue) * CHART_HEIGHT;
        const barH = fullHeight * barProgress;
        const x = CHART_PADDING.left + i * (barWidth + gap);
        const y = CHART_PADDING.top + CHART_HEIGHT - barH;

        const fill = isUgly ? '#6b7280' : `url(#bar-grad-${i % colors.length})`;
        const rx = isUgly ? 0 : 6;

        return (
          <g key={i}>
            <rect x={x} y={y} width={barWidth} height={barH} fill={fill} rx={rx} />
            {/* Label */}
            <text
              x={x + barWidth / 2}
              y={CHART_PADDING.top + CHART_HEIGHT + 40}
              textAnchor="middle"
              fill={labelColor}
              fontSize={isUgly ? 18 : 22}
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              {labels[i]}
            </text>
          </g>
        );
      })}
    </svg>
  );
};
