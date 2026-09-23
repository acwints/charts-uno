import type { ChartData, DataSeries } from './types.js';

/**
 * Code-driven population for leaderboard race charts.
 *
 * Every other chart type in the app can be populated from code — a service
 * fetches rows and hands back `{ labels, series }`. This is that primitive for
 * races. It exists because a race is the one chart type whose input is almost
 * never already in its final shape.
 *
 * Real data arrives in three shapes:
 *
 *   wide    a grid of periods x entities. Already a race; may need transposing.
 *   long    tidy rows of (entity, period, value). What SQL, exports and most
 *           public datasets give you.
 *   events  tidy rows where the value is a per-period *increment* rather than a
 *           standing, so the race is the running total.
 *
 * The accumulator is what turns the last two into a leaderboard. "Sales this
 * month" becomes a race by cumulative sum; "this episode scored 8.7" becomes
 * one by cumulative mean. Getting that wrong is the difference between a race
 * and a noisy line chart, so it is an explicit input rather than a guess.
 *
 * Design rules this module holds to:
 *
 *   - Pure and deterministic. Same input, same output; inputs are never
 *     mutated. Nothing here touches the DOM, the clock or the network.
 *   - Data problems are reported, not thrown. A CSV with twelve unparseable
 *     cells is still a race; the caller gets the race and a report saying
 *     twelve cells were dropped and why. Only programmer errors (an impossible
 *     option) throw.
 *   - The builder shapes data; the renderer animates it. Rank interpolation,
 *     easing and frame timing live in the renderer where they can respond to
 *     the display. The builder's job ends at "here are the standings at every
 *     period".
 *   - Ordered means ordered. Periods are sorted by what they mean, so
 *     "Season 10" follows "Season 9" and "2019-Q4" precedes "2020-Q1". A plain
 *     string sort is the classic way a race ends up scrambled.
 */

/** How to combine duplicate rows for the same (entity, period). */
export type RaceAggregate = 'sum' | 'mean' | 'min' | 'max' | 'count' | 'first' | 'last';

/** How a period's value relates to the periods before it. */
export type RaceAccumulator =
  /** The value is already the standing: a rating, a total, a score. */
  | 'none'
  /** Per-period increments become a running total — sales, goals, signups. */
  | 'cumulative-sum'
  /** Per-period scores become a running average — the "rating after N" case. */
  | 'cumulative-mean'
  /** Running best so far. */
  | 'cumulative-max'
  /** Running worst so far. */
  | 'cumulative-min';

/**
 * What to put in a period where an entity has no data of its own.
 *
 *   hold  carry the last known standing forward. A finished contender keeps
 *         its place and can still be overtaken. This is the default because a
 *         contender vanishing mid-race reads as a bug, not a story.
 *   gap   leave it null; the renderer treats the entity as absent that period.
 *   zero  treat missing as zero. Right for counts where absence means none.
 */
export type RaceFill = 'hold' | 'gap' | 'zero';

/**
 * How `limit` decides which entities to keep.
 *
 *   ever-on-board  keep any entity that is inside the top N at *any* period.
 *                  Preserves the early leader who fades, which is usually the
 *                  best moment in the race. Default.
 *   final          keep the top N by final standing only. Smaller output; loses
 *                  every contender who peaked early.
 */
export type RaceLimitMode = 'ever-on-board' | 'final';

export interface RaceBuildOptions {
  /** Combine duplicate rows for the same entity and period. Default 'sum'. */
  aggregate?: RaceAggregate;
  /** Default 'none'. */
  accumulate?: RaceAccumulator;
  /** Missing-value policy. Default 'hold'. */
  fill?: RaceFill;
  /** Keep only N entities. Off by default: the renderer already shows a top N. */
  limit?: number;
  /** Default 'ever-on-board'. */
  limitMode?: RaceLimitMode;
  /** Drop entities with fewer than this many periods of their own data. */
  minPeriods?: number;
  /** Force the period order; otherwise it is inferred from the labels. */
  periodOrder?: string[];
  /** Rewrite period labels for display, e.g. an ISO date to "Mar 2020". */
  formatPeriod?: (period: string) => string;
  /** Populates ChartData.sourceType. Default 'csv'. */
  sourceType?: ChartData['sourceType'];
  title?: string;
}

export interface RaceRow {
  entity: string;
  period: string;
  value: number;
}

export interface RaceColumns {
  entity: string;
  period: string;
  value: string;
}

export type RaceDropReason =
  | 'non-numeric-value'
  | 'missing-entity'
  | 'missing-period'
  | 'period-not-in-order';

export interface RaceBuildReport {
  rowsRead: number;
  rowsUsed: number;
  /** Rows discarded, by reason. Zero-count reasons are omitted. */
  dropped: Partial<Record<RaceDropReason, number>>;
  periods: number;
  /** Whether the period order was given or inferred, and how. */
  periodOrder: 'given' | 'inferred-ordinal' | 'inferred-first-seen';
  entitiesRead: number;
  entitiesKept: number;
  /** Entities removed by `minPeriods`. */
  entitiesBelowMinPeriods: string[];
  /** Entities removed by `limit`. */
  entitiesOverLimit: string[];
  /** Cells filled by the fill policy rather than by data. */
  cellsFilled: number;
  /** Human-readable notes worth surfacing to a user. */
  warnings: string[];
}

export interface RaceBuildResult {
  data: ChartData;
  report: RaceBuildReport;
}

/** Labels commonly used for an ordered axis: "Season 3", "Ep 12", "Q2", "Week 4". */
const ORDINAL_LABEL =
  /^(?:s|season|e|ep|episode|w|week|d|day|q|quarter|r|round|game|match|year|yr|month|m|stage|lap|period|p)\s*[-_]?\s*(\d+(?:\.\d+)?)$/i;

/**
 * Parse a label to a sortable number, or null when the label carries no order.
 */
export function parseOrdinalValue(value: string): number | null {
  const text = String(value ?? '').trim();
  if (!text) return null;

  const ordinal = ORDINAL_LABEL.exec(text);
  if (ordinal) return Number(ordinal[1]);

  const numeric = Number(text.replace(/,/g, ''));
  if (Number.isFinite(numeric)) return numeric;

  const yearQuarter = /^(\d{4})[\s-]*q([1-4])$/i.exec(text);
  if (yearQuarter) return Number(yearQuarter[1]) * 4 + Number(yearQuarter[2]);

  const timestamp = Date.parse(text);
  if (Number.isFinite(timestamp)) return timestamp;

  return null;
}

/**
 * Order periods by what they mean when every one of them parses, otherwise by
 * first appearance. Mixing the two would silently reorder a partly-parseable
 * axis, which is worse than either alone.
 */
export function orderPeriods(periods: string[]): {
  ordered: string[];
  how: 'inferred-ordinal' | 'inferred-first-seen';
} {
  const unique = Array.from(new Set(periods));
  const parsed = unique.map((period) => ({ period, rank: parseOrdinalValue(period) }));

  if (unique.length > 0 && parsed.every((entry) => entry.rank !== null)) {
    const ordered = parsed
      .slice()
      .sort((a, b) => (a.rank as number) - (b.rank as number) || unique.indexOf(a.period) - unique.indexOf(b.period))
      .map((entry) => entry.period);
    return { ordered, how: 'inferred-ordinal' };
  }
  return { ordered: unique, how: 'inferred-first-seen' };
}

/** Lenient numeric parse: tolerates currency symbols, thousands separators, percent signs. */
export function toRaceNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value !== 'string') return null;
  const cleaned = value.trim().replace(/^[$€£¥]/, '').replace(/[,%\s]/g, '');
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function applyAggregate(values: readonly number[], how: RaceAggregate): number {
  switch (how) {
    case 'mean':
      return values.reduce((total, value) => total + value, 0) / values.length;
    case 'min':
      return Math.min(...values);
    case 'max':
      return Math.max(...values);
    case 'count':
      return values.length;
    case 'first':
      return values[0];
    case 'last':
      return values[values.length - 1];
    case 'sum':
      return values.reduce((total, value) => total + value, 0);
  }
}

const AGGREGATES: ReadonlySet<RaceAggregate> = new Set(['sum', 'mean', 'min', 'max', 'count', 'first', 'last']);
const ACCUMULATORS: ReadonlySet<RaceAccumulator> = new Set([
  'none',
  'cumulative-sum',
  'cumulative-mean',
  'cumulative-max',
  'cumulative-min',
]);
const FILLS: ReadonlySet<RaceFill> = new Set(['hold', 'gap', 'zero']);
const LIMIT_MODES: ReadonlySet<RaceLimitMode> = new Set(['ever-on-board', 'final']);

/** Programmer errors throw; data problems are reported. */
function validateOptions(options: RaceBuildOptions): void {
  if (options.aggregate !== undefined && !AGGREGATES.has(options.aggregate)) {
    throw new RangeError(`Unknown race aggregate "${options.aggregate}"`);
  }
  if (options.accumulate !== undefined && !ACCUMULATORS.has(options.accumulate)) {
    throw new RangeError(`Unknown race accumulator "${options.accumulate}"`);
  }
  if (options.fill !== undefined && !FILLS.has(options.fill)) {
    throw new RangeError(`Unknown race fill "${options.fill}"`);
  }
  if (options.limitMode !== undefined && !LIMIT_MODES.has(options.limitMode)) {
    throw new RangeError(`Unknown race limit mode "${options.limitMode}"`);
  }
  if (options.limit !== undefined && (!Number.isInteger(options.limit) || options.limit < 1)) {
    throw new RangeError(`Race limit must be a positive integer, got ${options.limit}`);
  }
  if (options.minPeriods !== undefined && (!Number.isInteger(options.minPeriods) || options.minPeriods < 0)) {
    throw new RangeError(`Race minPeriods must be a non-negative integer, got ${options.minPeriods}`);
  }
  if (options.periodOrder !== undefined && new Set(options.periodOrder).size !== options.periodOrder.length) {
    throw new RangeError('Race periodOrder contains duplicate periods');
  }
}

/**
 * Build race-ready ChartData from tidy rows, with a report of what happened.
 *
 * `labels` are the ordered periods and there is one series per entity, which
 * is the orientation the race renderer reads directly.
 */
export function buildRace(rows: readonly RaceRow[], options: RaceBuildOptions = {}): RaceBuildResult {
  validateOptions(options);
  const {
    aggregate = 'sum',
    accumulate = 'none',
    fill = 'hold',
    limit,
    limitMode = 'ever-on-board',
    minPeriods = 0,
    periodOrder,
    formatPeriod,
    sourceType = 'csv',
    title,
  } = options;

  const dropped: Partial<Record<RaceDropReason, number>> = {};
  const drop = (reason: RaceDropReason) => {
    dropped[reason] = (dropped[reason] ?? 0) + 1;
  };
  const warnings: string[] = [];

  // Period axis.
  let periods: string[];
  let periodOrderHow: RaceBuildReport['periodOrder'];
  if (periodOrder) {
    periods = periodOrder.slice();
    periodOrderHow = 'given';
  } else {
    const inferred = orderPeriods(rows.map((row) => String(row.period)));
    periods = inferred.ordered;
    periodOrderHow = inferred.how;
    if (inferred.how === 'inferred-first-seen' && periods.length > 1) {
      warnings.push(
        'Period labels do not all carry an order, so they are in first-seen order. Pass periodOrder to be explicit.'
      );
    }
  }
  const periodIndex = new Map(periods.map((period, index) => [period, index]));

  // entity -> period index -> raw values landing in that cell
  const cells = new Map<string, Map<number, number[]>>();
  const entityOrder: string[] = [];
  let rowsUsed = 0;

  for (const row of rows) {
    const entity = row.entity == null ? '' : String(row.entity).trim();
    if (!entity) {
      drop('missing-entity');
      continue;
    }
    const periodLabel = row.period == null ? '' : String(row.period);
    if (!periodLabel.trim()) {
      drop('missing-period');
      continue;
    }
    const index = periodIndex.get(periodLabel);
    if (index === undefined) {
      drop('period-not-in-order');
      continue;
    }
    const value = toRaceNumber(row.value);
    if (value === null) {
      drop('non-numeric-value');
      continue;
    }

    let byPeriod = cells.get(entity);
    if (!byPeriod) {
      byPeriod = new Map();
      cells.set(entity, byPeriod);
      entityOrder.push(entity);
    }
    const bucket = byPeriod.get(index);
    if (bucket) bucket.push(value);
    else byPeriod.set(index, [value]);
    rowsUsed += 1;
  }

  // Standings per entity per period.
  const entitiesBelowMinPeriods: string[] = [];
  const series: DataSeries[] = [];
  let cellsFilled = 0;

  for (const entity of entityOrder) {
    const byPeriod = cells.get(entity)!;
    if (byPeriod.size < minPeriods) {
      entitiesBelowMinPeriods.push(entity);
      continue;
    }

    const data: Array<number | null> = new Array(periods.length);
    let runningTotal = 0;
    let runningCount = 0;
    let runningMax = Number.NEGATIVE_INFINITY;
    let runningMin = Number.POSITIVE_INFINITY;
    let lastKnown: number | null = null;

    for (let index = 0; index < periods.length; index += 1) {
      const bucket = byPeriod.get(index);

      if (bucket === undefined) {
        // A cumulative standing persists by definition; a plain value follows
        // the fill policy.
        if (accumulate !== 'none' || fill === 'hold') {
          data[index] = lastKnown;
        } else if (fill === 'zero') {
          data[index] = 0;
        } else {
          data[index] = null;
        }
        if (data[index] !== null) cellsFilled += 1;
        continue;
      }

      const periodValue = applyAggregate(bucket, aggregate);
      let standing: number;
      switch (accumulate) {
        case 'cumulative-sum':
          runningTotal += periodValue;
          standing = runningTotal;
          break;
        case 'cumulative-mean':
          runningTotal += periodValue;
          runningCount += 1;
          standing = runningTotal / runningCount;
          break;
        case 'cumulative-max':
          runningMax = Math.max(runningMax, periodValue);
          standing = runningMax;
          break;
        case 'cumulative-min':
          runningMin = Math.min(runningMin, periodValue);
          standing = runningMin;
          break;
        case 'none':
          standing = periodValue;
          break;
      }

      lastKnown = standing;
      data[index] = standing;
    }

    series.push({ name: entity, data });
  }

  // Optional pruning.
  let kept = series;
  const entitiesOverLimit: string[] = [];
  if (limit !== undefined && series.length > limit) {
    const keepNames = limitMode === 'final' ? topByFinal(series, limit) : everOnBoard(series, limit);
    kept = series.filter((entry) => keepNames.has(entry.name));
    for (const entry of series) {
      if (!keepNames.has(entry.name)) entitiesOverLimit.push(entry.name);
    }
  }

  if (periods.length < 2) {
    warnings.push('Fewer than two periods: there is nothing to animate between.');
  }
  if (kept.length < 2) {
    warnings.push('Fewer than two entities: there is nothing to race.');
  }

  const labels = formatPeriod ? periods.map(formatPeriod) : periods;

  const data: ChartData = {
    labels,
    series: kept,
    sourceType,
    suggestedType: 'race',
    ...(title ? { suggestedTitle: title } : {}),
  };

  return {
    data,
    report: {
      rowsRead: rows.length,
      rowsUsed,
      dropped,
      periods: periods.length,
      periodOrder: periodOrderHow,
      entitiesRead: entityOrder.length,
      entitiesKept: kept.length,
      entitiesBelowMinPeriods,
      entitiesOverLimit,
      cellsFilled,
      warnings,
    },
  };
}

function finalValue(series: DataSeries): number {
  for (let index = series.data.length - 1; index >= 0; index -= 1) {
    const value = series.data[index];
    if (typeof value === 'number') return value;
  }
  return Number.NEGATIVE_INFINITY;
}

function topByFinal(series: readonly DataSeries[], limit: number): Set<string> {
  return new Set(
    series
      .slice()
      .sort((a, b) => finalValue(b) - finalValue(a))
      .slice(0, limit)
      .map((entry) => entry.name)
  );
}

/** Every entity that is inside the top `limit` at any period. */
function everOnBoard(series: readonly DataSeries[], limit: number): Set<string> {
  const keep = new Set<string>();
  const periodCount = series[0]?.data.length ?? 0;
  for (let index = 0; index < periodCount; index += 1) {
    series
      .map((entry) => ({ name: entry.name, value: entry.data[index] }))
      .filter((entry): entry is { name: string; value: number } => typeof entry.value === 'number')
      .sort((a, b) => b.value - a.value)
      .slice(0, limit)
      .forEach((entry) => keep.add(entry.name));
  }
  return keep;
}

/** Convenience: `buildRace` returning only the data. */
export function buildRaceFromRows(rows: readonly RaceRow[], options: RaceBuildOptions = {}): ChartData {
  return buildRace(rows, options).data;
}

/**
 * Build a race from a table of records plus the columns that hold the entity,
 * period and value — the shape a SQL result or a parsed tidy CSV arrives in.
 */
export function buildRaceFromTable(
  records: ReadonlyArray<Record<string, unknown>>,
  columns: RaceColumns,
  options: RaceBuildOptions = {}
): RaceBuildResult {
  const rows: RaceRow[] = records.map((record) => ({
    entity: String(record[columns.entity] ?? ''),
    period: String(record[columns.period] ?? ''),
    // Passed through raw so the builder reports non-numeric cells itself.
    value: record[columns.value] as number,
  }));
  return buildRace(rows, options);
}

/**
 * Re-key an existing wide ChartData as a race, optionally re-accumulating it.
 * Use when `labels` are already the periods and each series is a contender.
 */
export function buildRaceFromWide(data: ChartData, options: RaceBuildOptions = {}): RaceBuildResult {
  const rows: RaceRow[] = [];
  data.series.forEach((series) => {
    series.data.forEach((value, index) => {
      if (typeof value === 'number' && Number.isFinite(value)) {
        rows.push({ entity: series.name, period: data.labels[index], value });
      }
    });
  });
  const result = buildRace(rows, {
    ...options,
    periodOrder: options.periodOrder ?? data.labels,
    aggregate: options.aggregate ?? 'last',
    sourceType: options.sourceType ?? data.sourceType,
  });
  if (data.suggestedTitle && !result.data.suggestedTitle) {
    result.data.suggestedTitle = data.suggestedTitle;
  }
  return result;
}

export interface RaceColumnInference {
  columns: RaceColumns;
  /** 0–1. Below ~0.6 the guess should be confirmed with the user. */
  confidence: number;
  reasons: string[];
}

/** Headers that name an identifier rather than a thing: "show_id", "user key", "slug". */
const looksLikeIdHeader = (header: string) => /(^|[_\s-])(id|key|code|uuid|slug)$/i.test(header.trim());

function groupByEntity(
  records: ReadonlyArray<Record<string, unknown>>,
  entityHeader: string,
  header: string
): Map<string, string[]> {
  const perEntity = new Map<string, string[]>();
  for (const record of records) {
    const entity = String(record[entityHeader] ?? '');
    const values = perEntity.get(entity);
    const value = String(record[header] ?? '');
    if (values) values.push(value);
    else perEntity.set(entity, [value]);
  }
  return perEntity;
}

/**
 * How completely a column's values run through every entity, 0–1. A period
 * scores near 1: every show has all twelve seasons. A per-entity attribute or
 * a per-row value scores low, because each entity only ever sees its own.
 */
function coverageWithinEntity(
  records: ReadonlyArray<Record<string, unknown>>,
  entityHeader: string,
  header: string
): number {
  const overall = new Set(records.map((record) => String(record[header] ?? ''))).size;
  if (overall <= 1) return 0;
  const perEntity = groupByEntity(records, entityHeader, header);
  let total = 0;
  for (const values of perEntity.values()) total += new Set(values).size;
  return total / perEntity.size / overall;
}

/**
 * Whether a column changes *inside* an entity at all, 0–1. An attribute such
 * as a show's vote count is constant within the show and scores 0; a standing
 * that moves period to period scores above it, even when it plateaus late.
 */
function movementWithinEntity(
  records: ReadonlyArray<Record<string, unknown>>,
  entityHeader: string,
  header: string
): number {
  const perEntity = groupByEntity(records, entityHeader, header);
  let total = 0;
  let counted = 0;
  for (const values of perEntity.values()) {
    if (values.length < 2) continue;
    total += (new Set(values).size - 1) / (values.length - 1);
    counted += 1;
  }
  return counted === 0 ? 0 : total / counted;
}

/**
 * Guess which columns of a tidy table hold the entity, period and value.
 *
 * Entity first: the most distinct text column, preferring a readable name to
 * an identifier. Then period: an ordered column that varies within each
 * entity, favouring the fewest distinct values among those. Then value: the
 * most varied numeric column that also varies within each entity, so a
 * per-entity attribute like a vote count is never mistaken for the standing.
 * Returns null when the table does not look tidy, so callers can fall back
 * rather than build something wrong.
 */
export function inferRaceColumns(records: ReadonlyArray<Record<string, unknown>>): RaceColumnInference | null {
  if (records.length < 6) return null;
  const headers = Object.keys(records[0] ?? {});
  if (headers.length < 3) return null;

  const sample = records.slice(0, 500);
  const stats = headers.map((header) => {
    const values = sample.map((record) => record[header]);
    const distinct = new Set(values.map((value) => String(value ?? ''))).size;
    const numeric = values.filter((value) => toRaceNumber(value) !== null).length;
    const ordered = values.filter((value) => parseOrdinalValue(String(value ?? '')) !== null).length;
    return { header, distinct, numericRatio: numeric / values.length, orderedRatio: ordered / values.length };
  });

  const reasons: string[] = [];

  // Entity: text, names at least three things, readable over identifier.
  // Entities are nominal, so an ordered column ("Season 3", "S7", "2019-Q4")
  // is never one — without this, a textual period label with more distinct
  // values than the contenders gets picked as the entity.
  const entityCandidates = stats
    .filter(
      (stat) =>
        stat.numericRatio < 0.05 &&
        stat.orderedRatio < 0.5 &&
        stat.distinct >= 3 &&
        stat.distinct <= sample.length / 2
    )
    .sort(
      (a, b) =>
        Number(looksLikeIdHeader(a.header)) - Number(looksLikeIdHeader(b.header)) || b.distinct - a.distinct
    );
  const entity = entityCandidates[0];
  if (!entity) return null;
  reasons.push(`"${entity.header}" names ${entity.distinct} distinct contenders`);

  const coverage = new Map(
    stats.map((stat) => [stat.header, coverageWithinEntity(sample, entity.header, stat.header)] as const)
  );
  const movement = new Map(
    stats.map((stat) => [stat.header, movementWithinEntity(sample, entity.header, stat.header)] as const)
  );

  // Period: ordered, repeats across rows, and varies inside each entity.
  const periodCandidates = stats
    .filter(
      (stat) =>
        stat.header !== entity.header &&
        stat.orderedRatio > 0.95 &&
        stat.distinct > 1 &&
        stat.distinct <= sample.length / 2 &&
        (coverage.get(stat.header) ?? 0) >= 0.8
    )
    .sort((a, b) => a.distinct - b.distinct);
  const period = periodCandidates[0];
  if (!period) return null;
  reasons.push(`"${period.header}" is ordered and runs through every contender`);

  // Value: numeric, varies inside each entity, and the most varied of those.
  const valueCandidates = stats
    .filter(
      (stat) =>
        stat.header !== entity.header &&
        stat.header !== period.header &&
        stat.numericRatio > 0.95 &&
        (movement.get(stat.header) ?? 0) > 0.05
    )
    .sort((a, b) => b.distinct - a.distinct);
  const value = valueCandidates[0];
  if (!value) return null;
  reasons.push(`"${value.header}" is numeric and changes period to period`);

  // Confidence: high when there is one clear value column and the table is a
  // near-complete grid; lower when several numeric columns could be the value.
  let confidence = 0.65;
  if (valueCandidates.length === 1) confidence += 0.2;
  else confidence -= 0.1 * Math.min(2, valueCandidates.length - 1);
  if (period.distinct * entity.distinct <= sample.length * 1.5) confidence += 0.1;
  confidence = Math.max(0, Math.min(1, confidence));

  return { columns: { entity: entity.header, period: period.header, value: value.header }, confidence, reasons };
}
