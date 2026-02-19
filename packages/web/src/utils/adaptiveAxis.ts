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
  fontSize: 10 | 11 | 12;
  maxTickLength: number;
}

const CHART_WIDTH_ESTIMATE = 650;
const CHAR_WIDTH_PX = 7; // approximate px per char at fontSize 12
const MAX_TICK_LENGTH = 25;
const SIN_45 = Math.sin(Math.PI / 4);
const HORIZONTAL_AXIS_MIN_WIDTH = 88;
const HORIZONTAL_AXIS_MAX_WIDTH = 220;

function estimateCharWidth(fontSize: number): number {
  return fontSize * 0.58;
}

function getLongestNormalizedLabelLength(labels: string[]): number {
  return labels.reduce((max, label) => {
    const normalized = label.replace(/\s+/g, ' ').trim();
    return Math.max(max, normalized.length);
  }, 0);
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
  hasAxisLabel: boolean,
): HorizontalCategoryAxisConfig {
  const longestLabelLength = getLongestNormalizedLabelLength(labels);

  let fontSize: 10 | 11 | 12 = 12;
  if (longestLabelLength > 18) fontSize = 11;
  if (longestLabelLength > 28) fontSize = 10;

  const charWidth = estimateCharWidth(fontSize);
  const rawAxisWidth = Math.round(longestLabelLength * charWidth + 14);
  const axisWidth = Math.max(HORIZONTAL_AXIS_MIN_WIDTH, Math.min(HORIZONTAL_AXIS_MAX_WIDTH, rawAxisWidth));
  const maxTickLength = Math.max(8, Math.floor((axisWidth - 14) / charWidth));
  const labelAllowance = hasAxisLabel ? 30 : 10;
  const leftMargin = axisWidth + labelAllowance;
  const labelOffset = Math.max(8, Math.round(axisWidth * 0.1));

  return {
    axisWidth,
    leftMargin,
    labelOffset,
    fontSize,
    maxTickLength,
  };
}
