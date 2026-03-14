const MAX_SUPPORTED_DECIMALS = 3;
const INTEGER_EPSILON = 1e-9;

function normalizeDecimalPlaces(decimalPlaces: number): number {
  if (!Number.isFinite(decimalPlaces)) return 0;
  const floored = Math.floor(decimalPlaces);
  return Math.max(0, Math.min(MAX_SUPPORTED_DECIMALS, floored));
}

function isIntegerLike(value: number): boolean {
  return Math.abs(value - Math.round(value)) < INTEGER_EPSILON;
}

export function getAdaptiveDecimalPlacesForRange(valueRange: number): number {
  const safeRange = Number.isFinite(valueRange) ? Math.abs(valueRange) : 0;
  if (safeRange <= 0.25) return 3;
  if (safeRange <= 5) return 2;
  if (safeRange <= 150) return 1;
  return 0;
}

export function getAdaptiveDecimalPlaces(values: number[]): number {
  const finiteValues = values.filter((value) => Number.isFinite(value));
  if (finiteValues.length === 0) return 0;
  if (finiteValues.every(isIntegerLike)) return 0;

  const min = Math.min(...finiteValues);
  const max = Math.max(...finiteValues);
  return getAdaptiveDecimalPlacesForRange(max - min);
}

export function createFixedNumberFormatter(
  decimalPlaces: number,
  locale?: string | string[]
): Intl.NumberFormat {
  const safeDecimals = normalizeDecimalPlaces(decimalPlaces);
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: safeDecimals,
    maximumFractionDigits: safeDecimals,
  });
}

/**
 * Format a number with compact notation (K, M, B) and strip trailing ".0".
 * "15.0M" → "15M", "15.2M" → "15.2M", "1.0K" → "1K"
 */
function compactFixed(value: number): string {
  const fixed = value.toFixed(1);
  return fixed.endsWith('.0') ? fixed.slice(0, -2) : fixed;
}

/**
 * Shared compact axis formatter: produces human-readable tick values
 * with optional prefix/suffix (e.g., "$15.2M", "42%").
 */
export function formatCompactAxisValue(
  value: number,
  prefix: string,
  suffix: string,
  smallNumberFormatter: Intl.NumberFormat,
): string {
  const absValue = Math.abs(value);
  let formatted: string;

  if (absValue >= 1_000_000_000) {
    formatted = `${compactFixed(value / 1_000_000_000)}B`;
  } else if (absValue >= 1_000_000) {
    formatted = `${compactFixed(value / 1_000_000)}M`;
  } else if (absValue >= 1_000) {
    formatted = `${compactFixed(value / 1_000)}K`;
  } else {
    formatted = smallNumberFormatter.format(value);
  }

  return `${prefix}${formatted}${suffix}`;
}

/**
 * Estimate the character length of the widest Y-axis tick value for a given
 * data range and formatting options. Used to drive dynamic axis width and margins.
 */
export function estimateMaxTickString(
  domain: [number, number] | undefined,
  prefix: string,
  suffix: string,
  smallNumberFormatter: Intl.NumberFormat,
): string {
  if (!domain) return '0';
  // Check both bounds — negative min may be wider due to minus sign
  const candidates = [domain[0], domain[1]];
  let widest = '';
  for (const v of candidates) {
    const s = formatCompactAxisValue(v, prefix, suffix, smallNumberFormatter);
    if (s.length > widest.length) widest = s;
  }
  return widest || '0';
}
