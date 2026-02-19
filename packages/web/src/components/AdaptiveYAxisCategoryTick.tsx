interface AdaptiveYAxisCategoryTickProps {
  x?: number;
  y?: number;
  payload?: { value: string };
  fill?: string;
  fontSize: 10 | 11 | 12;
  maxTickLength: number;
}

function normalizeLabel(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function truncateLabel(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}\u2026` : value;
}

export function AdaptiveYAxisCategoryTick({
  x = 0,
  y = 0,
  payload,
  fill,
  fontSize,
  maxTickLength,
}: AdaptiveYAxisCategoryTickProps) {
  const rawLabel = normalizeLabel(String(payload?.value ?? ''));
  const displayLabel = truncateLabel(rawLabel, maxTickLength);
  const wasTruncated = rawLabel !== displayLabel;

  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dx={-6}
        dy={4}
        textAnchor="end"
        fill={fill}
        fontSize={fontSize}
        fontFamily="var(--font-mono)"
      >
        {wasTruncated ? <title>{rawLabel}</title> : null}
        {displayLabel}
      </text>
    </g>
  );
}
