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

export interface VerticalValueAxisConfig {
  leftMargin: number;
  labelOffset: number;
  preferOutsideLabel: boolean;
  dy: number;
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
    const displayLength = Math.min(maxLabelLength, MAX_TICK_LENGTH);
    const bottomMargin = Math.min(
      Math.round(displayLength * estimateCharWidth(fontSize) * SIN_45) + 8,
      120,
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
  const displayLength = Math.min(maxLabelLength, MAX_TICK_LENGTH);
  const bottomMargin = Math.min(
    Math.round(displayLength * CHAR_WIDTH_PX * SIN_45) + 8,
    120,
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

export function computeVerticalValueAxisConfig(
  axisLabel?: string,
): VerticalValueAxisConfig {
  const hasAxisLabel = Boolean(axisLabel && axisLabel.trim());
  const axisLabelLength = hasAxisLabel ? axisLabel!.trim().length : 0;
  const preferOutsideLabel = hasAxisLabel;
  const baseLeftMargin = hasAxisLabel
    ? Math.max(14, Math.min(24, Math.round(axisLabelLength * 0.35) + 12))
    : 8;
  const leftMargin = baseLeftMargin + (preferOutsideLabel ? 8 : 0);
  const labelOffset = preferOutsideLabel
    ? Math.max(8, Math.min(14, Math.round(axisLabelLength * 0.2) + 8))
    : 8;
  const dy = Math.min(10, Math.max(2, Math.floor(axisLabelLength / 10)));

  return {
    leftMargin,
    labelOffset,
    preferOutsideLabel,
    dy,
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

  return {
    offset: adaptiveAxis.angle !== 0 ? -24 : -10,
    extraBottomMargin: adaptiveAxis.angle !== 0 ? 30 : 20,
  };
}
