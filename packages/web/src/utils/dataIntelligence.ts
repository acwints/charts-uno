import type { XAxisType } from '../types';

/**
 * Data Intelligence Layer
 *
 * Analyzes the dataset BEFORE rendering to produce informed rendering hints.
 * This acts as a "metaprompt" — reasoning about the data's structure, temporality,
 * granularity, and distribution to guide axis configuration, tick placement,
 * and label formatting decisions.
 *
 * Designed to be general-purpose: handles decades, years, quarters, months,
 * irregular time series, and non-temporal numeric data without overfitting
 * to any single pattern.
 */

export type TemporalGranularity =
  | 'decade'
  | 'year'
  | 'quarter'
  | 'month'
  | 'week'
  | 'day'
  | null;

export interface DataRenderingHints {
  /** Cleaned labels (e.g., "1910.0" → "1910", trimmed whitespace) */
  cleanedLabels: string[];
  /** Whether labels were modified during normalization */
  labelsNormalized: boolean;
  /** Detected temporal granularity (null if not temporal) */
  temporalGranularity: TemporalGranularity;
  /** Whether to force categorical axis even for numeric-looking labels */
  forceCategorical: boolean;
  /** Suggested xAxisType override (null = don't override) */
  suggestedXAxisType: XAxisType | null;
  /** Suggested x-axis label (null = don't override) */
  suggestedXAxisLabel: string | null;
  /** Short reasoning string for debugging / tooltips */
  reasoning: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Strip trailing ".0" from numeric strings: "1920.0" → "1920" */
function normalizeNumericLabel(label: string): string {
  const trimmed = label.trim();
  // Match integers with trailing .0 (including multiple: "1920.00")
  if (/^-?\d+\.0+$/.test(trimmed)) {
    return trimmed.replace(/\.0+$/, '');
  }
  return trimmed;
}

/** Check if a string is a plausible 4-digit year */
function isYear(s: string): boolean {
  if (!/^\d{4}$/.test(s)) return false;
  const n = parseInt(s, 10);
  return n >= 1800 && n <= 2100;
}

/** Parse a cleaned label to a number, or NaN */
function toNum(s: string): number {
  const n = Number(s);
  return isFinite(n) ? n : NaN;
}

/**
 * Compute the greatest common divisor of an array of positive integers.
 * Used to detect uniform spacing (e.g., 10 → decades, 1 → years).
 */
function gcdArray(values: number[]): number {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  let result = values[0];
  for (let i = 1; i < values.length; i++) {
    result = gcd(result, values[i]);
    if (result === 1) return 1;
  }
  return result;
}

/**
 * Detect temporal granularity from an array of numeric values that look like years.
 * Returns the granularity and whether the spacing is uniform.
 */
function detectTemporalGranularity(
  values: number[],
): { granularity: TemporalGranularity; uniform: boolean } {
  if (values.length < 2) return { granularity: 'year', uniform: true };

  const sorted = [...values].sort((a, b) => a - b);
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i] - sorted[i - 1];
    if (gap > 0) gaps.push(gap);
  }

  if (gaps.length === 0) return { granularity: 'year', uniform: true };

  const allSame = gaps.every((g) => g === gaps[0]);
  const step = allSame ? gaps[0] : gcdArray(gaps.map(Math.round));

  if (step >= 10 && step % 10 === 0) return { granularity: 'decade', uniform: allSame };
  if (step >= 4 && step <= 5) return { granularity: 'year', uniform: allSame }; // ~5-year intervals, still year-level
  if (step === 1) return { granularity: 'year', uniform: allSame };
  if (step === 0.25) return { granularity: 'quarter', uniform: allSame };

  // Default: if the values span many years with small step, it's yearly
  return { granularity: 'year', uniform: allSame };
}

/**
 * Determine whether numeric labels represent discrete data points that should
 * each appear as ticks (categorical treatment) vs. truly continuous data that
 * benefits from Recharts' interpolated axis.
 *
 * Key heuristics:
 * - Few data points (≤ 30) with round numbers → categorical
 * - Evenly-spaced values → categorical (each value is meaningful)
 * - Year-like values → always categorical (avoid "2020.5" ticks)
 * - Large, dense, irregular datasets → continuous
 */
function shouldForceCategorical(
  numericValues: number[],
  areYears: boolean,
): boolean {
  // Year-like data should always be categorical to avoid decimal years
  if (areYears) return true;

  // Few data points: show each one
  if (numericValues.length <= 30) return true;

  // Check if values are evenly spaced — suggests intentional discrete points
  if (numericValues.length <= 100) {
    const sorted = [...numericValues].sort((a, b) => a - b);
    const gaps = new Set<number>();
    for (let i = 1; i < sorted.length; i++) {
      gaps.add(Math.round((sorted[i] - sorted[i - 1]) * 1000) / 1000);
    }
    // Uniform or near-uniform spacing with ≤ 3 distinct gap sizes → categorical
    if (gaps.size <= 3) return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Main analysis function
// ---------------------------------------------------------------------------

export function analyzeDataForRendering(
  labels: string[],
  xAxisType?: XAxisType,
): DataRenderingHints {
  if (labels.length === 0) {
    return {
      cleanedLabels: [],
      labelsNormalized: false,
      temporalGranularity: null,
      forceCategorical: false,
      suggestedXAxisType: null,
      suggestedXAxisLabel: null,
      reasoning: 'No labels to analyze.',
    };
  }

  // Step 1: Normalize labels (strip trailing .0, trim whitespace)
  const cleanedLabels = labels.map(normalizeNumericLabel);
  const labelsNormalized = cleanedLabels.some((cl, i) => cl !== labels[i]);

  // Step 2: Parse as numbers (on the cleaned labels)
  const numericValues = cleanedLabels.map(toNum);
  const allNumeric = numericValues.every((n) => !isNaN(n));

  // Step 3: Check if labels are years (after cleaning)
  const allYears = cleanedLabels.every(isYear);

  // Step 4: If the explicit xAxisType is set and labels don't contradict it,
  //         respect it but still provide cleaning and granularity hints.
  if (xAxisType === 'category' && !allYears) {
    return {
      cleanedLabels,
      labelsNormalized,
      temporalGranularity: null,
      forceCategorical: false,
      suggestedXAxisType: null,
      suggestedXAxisLabel: null,
      reasoning: 'Explicit category axis type; no overrides needed.',
    };
  }

  // Step 5: Temporal analysis for year-like labels
  if (allYears) {
    const yearValues = numericValues as number[];
    const { granularity, uniform } = detectTemporalGranularity(yearValues);

    const xAxisLabel =
      granularity === 'decade'
        ? 'Decade'
        : xAxisType === 'year' || !xAxisType
          ? undefined // let existing logic provide "Year"
          : null;

    return {
      cleanedLabels,
      labelsNormalized,
      temporalGranularity: granularity,
      forceCategorical: true,
      suggestedXAxisType: 'year',
      suggestedXAxisLabel: xAxisLabel ?? null,
      reasoning: `Year-like labels detected with ${granularity}-level granularity (${uniform ? 'uniform' : 'irregular'} spacing). Using categorical axis to show each data point as a tick.`,
    };
  }

  // Step 6: Non-year numeric labels — decide categorical vs continuous
  if (allNumeric) {
    const force = shouldForceCategorical(numericValues as number[], false);
    return {
      cleanedLabels,
      labelsNormalized,
      temporalGranularity: null,
      forceCategorical: force,
      suggestedXAxisType: force ? 'category' : 'number',
      suggestedXAxisLabel: null,
      reasoning: force
        ? `${labels.length} numeric labels with regular structure — using categorical axis to preserve exact data point ticks.`
        : `Dense numeric labels (${labels.length} points) — using continuous axis for readability.`,
    };
  }

  // Step 7: Non-numeric labels — pure categorical
  return {
    cleanedLabels,
    labelsNormalized,
    temporalGranularity: null,
    forceCategorical: false,
    suggestedXAxisType: null,
    suggestedXAxisLabel: null,
    reasoning: 'Non-numeric labels; standard categorical axis.',
  };
}
