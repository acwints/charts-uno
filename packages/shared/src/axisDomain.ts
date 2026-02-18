import type { YAxisBaselineMode } from './types.js';

export interface NumericDomainOptions {
  mode?: YAxisBaselineMode;
  spreadThreshold?: number;
  rangePaddingRatio?: number;
  minPaddingRatio?: number;
}

export function getNumericDomainFromValues(
  rawValues: Array<number | null | undefined>,
  options: NumericDomainOptions = {}
): [number, number] | undefined {
  const values = rawValues.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (values.length === 0) return undefined;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = Math.max(max - min, 0);
  const spreadThreshold = options.spreadThreshold ?? 0.25;
  const rangePaddingRatio = options.rangePaddingRatio ?? 0.08;
  const minPaddingRatio = options.minPaddingRatio ?? 0.02;
  const base = Math.max(Math.abs(max), 1);
  const padding = Math.max(spread * rangePaddingRatio, base * minPaddingRatio);
  const mode = resolveBaselineMode(min, max, spread, spreadThreshold, options.mode ?? 'auto');

  if (mode === 'zero') {
    if (max <= 0) return normalizeDomain(min - padding, 0);
    if (min >= 0) return normalizeDomain(0, max + padding);
    return normalizeDomain(min - padding, max + padding);
  }

  return normalizeDomain(min - padding, max + padding);
}

function resolveBaselineMode(
  min: number,
  max: number,
  spread: number,
  spreadThreshold: number,
  preferredMode: YAxisBaselineMode
): YAxisBaselineMode {
  if (preferredMode !== 'auto') return preferredMode;
  if (min < 0) return 'data';

  const ratio = spread / Math.max(Math.abs(max), 1);
  return ratio <= spreadThreshold ? 'data' : 'zero';
}

function normalizeDomain(min: number, max: number): [number, number] {
  if (min === max) {
    const bump = Math.max(Math.abs(min), 1) * 0.05;
    return [min - bump, max + bump];
  }
  return [min, max];
}
