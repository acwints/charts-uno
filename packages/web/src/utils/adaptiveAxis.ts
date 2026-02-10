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

const CHART_WIDTH_ESTIMATE = 650;
const CHAR_WIDTH_PX = 7; // approximate px per char at fontSize 12
const MAX_TICK_LENGTH = 25;
const SIN_45 = Math.sin(Math.PI / 4);

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

  // Tick interval for very dense label sets (40+)
  const tickInterval =
    labels.length >= 40 ? Math.ceil(labels.length / 20) - 1 : undefined;

  if (density <= 1.0) {
    // Everything fits horizontally at default size
    return {
      ...defaults,
      tickInterval,
      needsCustomTick: tickInterval !== undefined || maxLabelLength > MAX_TICK_LENGTH,
    };
  }

  if (density <= 1.5) {
    // Shrink font to fit horizontally
    return {
      ...defaults,
      fontSize: 10,
      tickInterval,
      needsCustomTick: true,
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
