import React from 'react';
import { interpolate } from 'remotion';
import { VIDEO_WIDTH } from '../lib/constants.js';

interface TextRevealProps {
  text: string;
  /** 0→1 progress for word-by-word reveal */
  progress: number;
  fontSize?: number;
  color?: string;
  /** Center Y position */
  y?: number;
  fontWeight?: number;
  maxWidth?: number;
}

export const TextReveal: React.FC<TextRevealProps> = ({
  text,
  progress,
  fontSize = 64,
  color = '#f8fafc',
  y = 960,
  fontWeight = 700,
  maxWidth = VIDEO_WIDTH - 120,
}) => {
  const words = text.split(/\s+/);
  const wordCount = words.length;

  // Word-wrap into lines
  const lines: string[][] = [];
  let currentLine: string[] = [];
  const approxCharWidth = fontSize * 0.52;

  for (const word of words) {
    const lineWidth = [...currentLine, word].join(' ').length * approxCharWidth;
    if (lineWidth > maxWidth && currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = [word];
    } else {
      currentLine.push(word);
    }
  }
  if (currentLine.length > 0) lines.push(currentLine);

  const lineHeight = fontSize * 1.35;
  const totalHeight = lines.length * lineHeight;
  const startY = y - totalHeight / 2;

  let wordIndex = 0;

  return (
    <g>
      {lines.map((line, lineIdx) => {
        const lineY = startY + lineIdx * lineHeight + fontSize;

        return (
          <text
            key={lineIdx}
            x={VIDEO_WIDTH / 2}
            y={lineY}
            textAnchor="middle"
            fontFamily="system-ui, -apple-system, sans-serif"
            fontWeight={fontWeight}
            fontSize={fontSize}
          >
            {line.map((word, wi) => {
              const globalIdx = wordIndex;
              wordIndex++;

              // Each word fades in based on its position
              const wordStart = globalIdx / wordCount;
              const wordEnd = (globalIdx + 1) / wordCount;
              const opacity = interpolate(progress, [wordStart, wordEnd], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              });
              const yOffset = interpolate(opacity, [0, 1], [12, 0]);

              return (
                <tspan
                  key={wi}
                  fill={color}
                  opacity={opacity}
                  dy={wi === 0 ? 0 : 0}
                  dx={wi === 0 ? 0 : fontSize * 0.3}
                  style={{ transform: `translateY(${yOffset}px)` }}
                >
                  {word}
                </tspan>
              );
            })}
          </text>
        );
      })}
    </g>
  );
};
