export interface AdaptiveAxisConfig {
  angle: 0 | -45;
  fontSize: 10 | 11 | 12;
  textAnchor: 'middle' | 'end';
  dy: number;
  bottomMargin: number;
  needsCustomTick: boolean;
  tickInterval: number | undefined;
  maxTickLength: number;
}

export interface HorizontalCategoryAxisConfig {
  axisWidth: number;
  leftMargin: number;
  labelOffset: number;
  preferOutsideLabel: boolean;
  fontSize: 10 | 11 | 12;
  maxTickLength: number;
}

/**
 * Tick-width-aware value axis config for all cartesian chart types.
 * Replaces the old `computeVerticalValueAxisConfig` which ignored tick content.
 */
export interface ValueAxisConfig {
  /** Left margin for the chart container */
  leftMargin: number;
  /** Recharts `width` prop for the YAxis element */
  axisWidth: number;
  /** Y-axis label offset from the axis line */
  labelOffset: number;
  /** Whether to position the axis label outside the plot area */
  preferOutsideLabel: boolean;
  /** Y-axis tick font size (adaptive based on tick width) */
  tickFontSize: 10 | 11 | 12;
}

export interface CartesianXAxisLabelConfig {
  offset: number;
  extraBottomMargin: number;
}

const CHART_WIDTH_ESTIMATE = 650;
const CHAR_WIDTH_PX = 7; // approximate px per char at fontSize 12
const MAX_TICK_LENGTH = 25;
const SIN_45 = Math.sin(Math.PI / 4);
const HORIZONTAL_AXIS_MIN_WIDTH = 88;
const HORIZONTAL_AXIS_MAX_WIDTH = 170;

function estimateCharWidth(fontSize: number): number {
  return fontSize * 0.58;
}

function getLabelLengths(labels: string[]): number[] {
  return labels
    .map((label) => label.replace(/\s+/g, ' ').trim().length)
    .filter((length) => length > 0)
    .sort((a, b) => a - b);
}

function getLengthAtPercentile(lengths: number[], percentile: number): number {
  if (lengths.length === 0) return 0;
  const idx = Math.max(0, Math.min(lengths.length - 1, Math.floor((lengths.length - 1) * percentile)));
  return lengths[idx];
}

export function computeAdaptiveAxisConfig(
  labels: string[],
  isHorizontal: boolean,
): AdaptiveAxisConfig {
  const defaults: AdaptiveAxisConfig = {
    angle: 0,
    fontSize: 12,
    textAnchor: 'middle',
    dy: 12,
    bottomMargin: 5,
    needsCustomTick: false,
    tickInterval: undefined,
    maxTickLength: MAX_TICK_LENGTH,
  };

  // Horizontal bar charts use a category Y-axis, not X
  if (isHorizontal || labels.length === 0) {
    return defaults;
  }

  const avgCharLength =
    labels.reduce((sum, l) => sum + l.length, 0) / labels.length;
  const maxLabelLength = Math.max(...labels.map((l) => l.length));
  const totalWidth = labels.length * avgCharLength * CHAR_WIDTH_PX;
  const density = totalWidth / CHART_WIDTH_ESTIMATE;
  const slotWidth = CHART_WIDTH_ESTIMATE / Math.max(labels.length, 1);
  const averageLabelWidth = avgCharLength * CHAR_WIDTH_PX;
  const maxLabelWidth = maxLabelLength * CHAR_WIDTH_PX;
  const overlapRatio = averageLabelWidth / Math.max(slotWidth, 1);
  const maxOverlapRatio = maxLabelWidth / Math.max(slotWidth, 1);
  const dynamicMaxTickLength = Math.min(60, Math.max(MAX_TICK_LENGTH, Math.floor(slotWidth / CHAR_WIDTH_PX)));

  // Tick interval for very dense label sets (40+)
  const tickInterval =
    labels.length >= 40 ? Math.ceil(labels.length / 20) - 1 : undefined;

  // If average label width is already larger than available slot width,
  // rotate early to avoid collisions for dense categorical axes.
  if (overlapRatio > 0.85) {
    const fontSize: 10 | 11 = maxLabelLength > 14 ? 10 : 11;
    const lengths = getLabelLengths(labels);
    const p80Length = getLengthAtPercentile(lengths, 0.8);
    const displayLength = Math.min(p80Length, MAX_TICK_LENGTH);
    const bottomMargin = Math.min(
      Math.round(displayLength * estimateCharWidth(fontSize) * SIN_45) + 6,
      90,
    );

    return {
      angle: -45,
      fontSize,
      textAnchor: 'end',
      dy: 6,
      bottomMargin,
      needsCustomTick: true,
      tickInterval,
      maxTickLength: MAX_TICK_LENGTH,
    };
  }

  if (density <= 1.0) {
    // Everything fits horizontally at default size
    return {
      ...defaults,
      tickInterval,
      needsCustomTick: tickInterval !== undefined || maxOverlapRatio > 1.2,
      maxTickLength: dynamicMaxTickLength,
    };
  }

  if (density <= 1.5) {
    // Shrink font to fit horizontally
    const shrunkenMaxTickLength = Math.min(50, Math.max(MAX_TICK_LENGTH, Math.floor(slotWidth / estimateCharWidth(10))));
    return {
      ...defaults,
      fontSize: 10,
      tickInterval,
      needsCustomTick: shrunkenMaxTickLength < maxLabelLength,
      maxTickLength: shrunkenMaxTickLength,
    };
  }

  // Rotate -45deg
  const fontSize: 10 | 11 = maxLabelLength > 15 ? 10 : 11;
  const lengths = getLabelLengths(labels);
  const p80Length = getLengthAtPercentile(lengths, 0.8);
  const displayLength = Math.min(p80Length, MAX_TICK_LENGTH);
  const bottomMargin = Math.min(
    Math.round(displayLength * CHAR_WIDTH_PX * SIN_45) + 6,
    90,
  );

  return {
    angle: -45,
    fontSize,
    textAnchor: 'end',
    dy: 6,
    bottomMargin,
    needsCustomTick: true,
    tickInterval,
    maxTickLength: MAX_TICK_LENGTH,
  };
}

export function computeHorizontalCategoryAxisConfig(
  labels: string[],
  axisLabel?: string,
): HorizontalCategoryAxisConfig {
  const lengths = getLabelLengths(labels);
  const longestLabelLength = lengths.length > 0 ? lengths[lengths.length - 1] : 0;
  const p80Length = getLengthAtPercentile(lengths, 0.8);
  const hasAxisLabel = Boolean(axisLabel && axisLabel.trim());

  let fontSize: 10 | 11 | 12 = 12;
  if (longestLabelLength > 18) fontSize = 11;
  if (longestLabelLength > 28) fontSize = 10;

  // Use a robust length estimate so one outlier label doesn't force huge left margins.
  const targetTickLength = Math.max(
    10,
    Math.min(16, Math.min(longestLabelLength, Math.max(p80Length + 2, 12)))
  );

  const charWidth = estimateCharWidth(fontSize);
  const rawAxisWidth = Math.round(targetTickLength * charWidth + 12);
  const axisWidth = Math.max(
    76,
    Math.min(HORIZONTAL_AXIS_MAX_WIDTH, Math.max(HORIZONTAL_AXIS_MIN_WIDTH - 8, rawAxisWidth))
  );
  const maxTickLength = Math.max(8, Math.min(targetTickLength, Math.floor((axisWidth - 12) / charWidth)));
  const axisLabelLength = hasAxisLabel ? axisLabel!.trim().length : 0;
  const preferOutsideLabel = hasAxisLabel;
  const baseLeftMargin = hasAxisLabel
    ? Math.max(10, Math.min(18, Math.round(axisLabelLength * 0.25) + 8))
    : 8;
  const leftMargin = baseLeftMargin + (preferOutsideLabel ? 6 : 0);
  const labelOffset = preferOutsideLabel
    ? Math.max(8, Math.min(14, Math.round(axisWidth * 0.08) + 6))
    : Math.max(2, Math.min(8, Math.round(axisWidth * 0.05)));

  return {
    axisWidth,
    leftMargin,
    labelOffset,
    preferOutsideLabel,
    fontSize,
    maxTickLength,
  };
}

/**
 * Compute tick-width-aware value axis config for any vertical cartesian chart.
 *
 * @param axisLabel   The Y-axis title text (e.g., "Revenue", "male_births")
 * @param maxTickStr  The widest formatted tick string (e.g., "$15.2M", "20M").
 *                    When provided, axis width and font size adapt to the content.
 */
export function computeValueAxisConfig(
  axisLabel?: string,
  maxTickStr?: string,
): ValueAxisConfig {
  const hasAxisLabel = Boolean(axisLabel && axisLabel.trim());
  const tickLen = maxTickStr ? maxTickStr.length : 4; // fallback "1.2K" = 4 chars

  // Adaptive tick font size based on tick string width
  let tickFontSize: 10 | 11 | 12 = 12;
  if (tickLen > 10) tickFontSize = 10;
  else if (tickLen > 7) tickFontSize = 11;

  // Estimate pixel width of widest tick value
  const charWidth = estimateCharWidth(tickFontSize);
  const tickPxWidth = Math.round(tickLen * charWidth);

  // Axis width: enough room for ticks + internal padding.
  // Recharts default is 60; we derive from content.
  const axisWidth = Math.max(
    40,
    Math.min(90, tickPxWidth + 14),
  );

  // Left margin: accounts for the axis label sitting outside the axis area
  const preferOutsideLabel = hasAxisLabel;
  const axisLabelLength = hasAxisLabel ? axisLabel!.trim().length : 0;
  let leftMargin: number;
  if (hasAxisLabel) {
    // The rotated axis label needs space proportional to its character count,
    // but clamped so very long labels don't blow out the chart.
    const labelExtra = Math.max(10, Math.min(22, Math.round(axisLabelLength * 0.3) + 8));
    leftMargin = labelExtra + (preferOutsideLabel ? 6 : 0);
  } else {
    leftMargin = 5;
  }

  const labelOffset = preferOutsideLabel
    ? Math.max(6, Math.min(14, Math.round(axisWidth * 0.1) + 4))
    : 6;

  return {
    leftMargin,
    axisWidth,
    labelOffset,
    preferOutsideLabel,
    tickFontSize,
  };
}

export function computeCartesianXAxisLabelConfig(
  adaptiveAxis: AdaptiveAxisConfig,
  axisLabel?: string,
): CartesianXAxisLabelConfig {
  const hasAxisLabel = Boolean(axisLabel && axisLabel.trim());

  if (!hasAxisLabel) {
    return {
      offset: adaptiveAxis.angle !== 0 ? -14 : -10,
      extraBottomMargin: 0,
    };
  }

  // Scale offset with rotated label height so the axis title clears tick labels
  const rotatedOffset = Math.min(-18, -(adaptiveAxis.bottomMargin * 0.35 + 10));
  return {
    offset: adaptiveAxis.angle !== 0 ? rotatedOffset : -10,
    extraBottomMargin: adaptiveAxis.angle !== 0 ? 20 : 18,
  };
}
