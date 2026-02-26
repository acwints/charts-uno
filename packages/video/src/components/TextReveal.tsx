import React from 'react';
import { interpolate } from 'remotion';
import { VIDEO_WIDTH } from '../lib/constants';

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

  // Compute per-line word x positions so words are centered as a group
  const lineWordPositions = lines.map((line) => {
    const lineText = line.join(' ');
    const lineWidth = lineText.length * approxCharWidth;
    const lineStartX = (VIDEO_WIDTH - lineWidth) / 2;
    let cursor = lineStartX;
    return line.map((word) => {
      const x = cursor;
      cursor += word.length * approxCharWidth + fontSize * 0.3;
      return x;
    });
  });

  return (
    <g>
      {lines.map((line, lineIdx) => {
        const lineY = startY + lineIdx * lineHeight + fontSize;

        return line.map((word, wi) => {
          const globalIdx = wordIndex;
          wordIndex++;

          const wordStart = globalIdx / wordCount;
          const wordEnd = (globalIdx + 1) / wordCount;
          const opacity = interpolate(progress, [wordStart, wordEnd], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          const yOffset = interpolate(opacity, [0, 1], [12, 0]);

          return (
            <text
              key={`${lineIdx}-${wi}`}
              x={lineWordPositions[lineIdx][wi]}
              y={lineY + yOffset}
              fill={color}
              opacity={opacity}
              fontFamily="system-ui, -apple-system, sans-serif"
              fontWeight={fontWeight}
              fontSize={fontSize}
            >
              {word}
            </text>
          );
        });
      })}
    </g>
  );
};
