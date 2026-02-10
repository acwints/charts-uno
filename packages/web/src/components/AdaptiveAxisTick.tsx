import type { AdaptiveAxisConfig } from '../utils/adaptiveAxis';

interface AdaptiveXAxisTickProps {
  x?: number;
  y?: number;
  payload?: { value: string };
  fill?: string;
  config: AdaptiveAxisConfig;
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1) + '\u2026' : text;
}

export function AdaptiveXAxisTick({
  x = 0,
  y = 0,
  payload,
  fill,
  config,
}: AdaptiveXAxisTickProps) {
  const label = payload?.value ?? '';
  const display = truncate(label, config.maxTickLength);

  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={config.dy}
        textAnchor={config.textAnchor}
        fill={fill}
        fontSize={config.fontSize}
        fontFamily="var(--font-mono)"
        transform={config.angle !== 0 ? `rotate(${config.angle})` : undefined}
      >
        {display}
      </text>
    </g>
  );
}
