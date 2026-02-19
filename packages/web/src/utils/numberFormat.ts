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
