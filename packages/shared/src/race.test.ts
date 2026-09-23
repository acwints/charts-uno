import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRace,
  buildRaceFromRows,
  buildRaceFromTable,
  buildRaceFromWide,
  inferRaceColumns,
  orderPeriods,
  parseOrdinalValue,
  toRaceNumber,
  type RaceRow,
} from './race.js';
import type { ChartData } from './types.js';

const seriesByName = (data: ChartData, name: string) => {
  const found = data.series.find((series) => series.name === name);
  assert.ok(found, `series "${name}" missing`);
  return found;
};

test('parseOrdinalValue reads seasons, episodes, years, quarters, dates and bare numbers', () => {
  assert.equal(parseOrdinalValue('Season 3'), 3);
  assert.equal(parseOrdinalValue('S12'), 12);
  assert.equal(parseOrdinalValue('Ep 7'), 7);
  assert.equal(parseOrdinalValue('2019'), 2019);
  assert.equal(parseOrdinalValue('1,200'), 1200);
  assert.equal(parseOrdinalValue('2019-Q4'), 2019 * 4 + 4);
  assert.ok((parseOrdinalValue('2020-03-01') as number) > (parseOrdinalValue('2020-02-01') as number));
  assert.equal(parseOrdinalValue('Breaking Bad'), null);
  assert.equal(parseOrdinalValue(''), null);
});

test('orderPeriods sorts by meaning, so Season 10 follows Season 9', () => {
  const { ordered, how } = orderPeriods(['Season 10', 'Season 2', 'Season 9', 'Season 1']);
  assert.deepEqual(ordered, ['Season 1', 'Season 2', 'Season 9', 'Season 10']);
  assert.equal(how, 'inferred-ordinal');
});

test('orderPeriods falls back to first-seen order when any label is unordered', () => {
  const { ordered, how } = orderPeriods(['Spring', 'Summer', '3', 'Autumn']);
  assert.deepEqual(ordered, ['Spring', 'Summer', '3', 'Autumn']);
  assert.equal(how, 'inferred-first-seen');
});

test('orderPeriods de-duplicates', () => {
  assert.deepEqual(orderPeriods(['2', '1', '2', '1']).ordered, ['1', '2']);
});

test('toRaceNumber tolerates currency, thousands separators and percent', () => {
  assert.equal(toRaceNumber('$1,234.5'), 1234.5);
  assert.equal(toRaceNumber('42%'), 42);
  assert.equal(toRaceNumber(' -7 '), -7);
  assert.equal(toRaceNumber('n/a'), null);
  // Labels and identifiers must not pass as numbers just because they end in digits.
  assert.equal(toRaceNumber('S1'), null);
  assert.equal(toRaceNumber('tt1000'), null);
  assert.equal(toRaceNumber('Season 3'), null);
  assert.equal(toRaceNumber(Number.NaN), null);
  assert.equal(toRaceNumber(undefined), null);
});

test('long rows pivot into periods-as-labels, entities-as-series', () => {
  const rows: RaceRow[] = [
    { entity: 'A', period: 'Season 2', value: 20 },
    { entity: 'A', period: 'Season 1', value: 10 },
    { entity: 'B', period: 'Season 1', value: 5 },
    { entity: 'B', period: 'Season 2', value: 30 },
  ];
  const { data, report } = buildRace(rows);
  assert.deepEqual(data.labels, ['Season 1', 'Season 2']);
  assert.deepEqual(seriesByName(data, 'A').data, [10, 20]);
  assert.deepEqual(seriesByName(data, 'B').data, [5, 30]);
  assert.equal(data.suggestedType, 'race');
  assert.equal(report.rowsRead, 4);
  assert.equal(report.rowsUsed, 4);
  assert.equal(report.periodOrder, 'inferred-ordinal');
});

test('cumulative-mean reproduces the "rating after N episodes" formula', () => {
  // A 10.0 then a 9.0 averages to 9.5 after two units.
  const rows: RaceRow[] = [
    { entity: 'Show', period: 'E1', value: 10 },
    { entity: 'Show', period: 'E2', value: 9 },
    { entity: 'Show', period: 'E3', value: 8 },
  ];
  const data = buildRaceFromRows(rows, { accumulate: 'cumulative-mean' });
  assert.deepEqual(seriesByName(data, 'Show').data, [10, 9.5, 9]);
});

test('cumulative-sum turns per-period increments into a running total', () => {
  const rows: RaceRow[] = [
    { entity: 'Shop', period: '2020', value: 100 },
    { entity: 'Shop', period: '2021', value: 50 },
    { entity: 'Shop', period: '2022', value: 25 },
  ];
  const data = buildRaceFromRows(rows, { accumulate: 'cumulative-sum' });
  assert.deepEqual(seriesByName(data, 'Shop').data, [100, 150, 175]);
});

test('cumulative-max and cumulative-min track the running extreme', () => {
  const rows: RaceRow[] = [
    { entity: 'X', period: '1', value: 3 },
    { entity: 'X', period: '2', value: 7 },
    { entity: 'X', period: '3', value: 5 },
  ];
  assert.deepEqual(seriesByName(buildRaceFromRows(rows, { accumulate: 'cumulative-max' }), 'X').data, [3, 7, 7]);
  assert.deepEqual(seriesByName(buildRaceFromRows(rows, { accumulate: 'cumulative-min' }), 'X').data, [3, 3, 3]);
});

test('duplicate (entity, period) rows are aggregated as asked', () => {
  const rows: RaceRow[] = [
    { entity: 'A', period: '1', value: 2 },
    { entity: 'A', period: '1', value: 4 },
    { entity: 'B', period: '1', value: 1 },
  ];
  assert.equal(seriesByName(buildRaceFromRows(rows), 'A').data[0], 6);
  assert.equal(seriesByName(buildRaceFromRows(rows, { aggregate: 'mean' }), 'A').data[0], 3);
  assert.equal(seriesByName(buildRaceFromRows(rows, { aggregate: 'max' }), 'A').data[0], 4);
  assert.equal(seriesByName(buildRaceFromRows(rows, { aggregate: 'count' }), 'A').data[0], 2);
  assert.equal(seriesByName(buildRaceFromRows(rows, { aggregate: 'first' }), 'A').data[0], 2);
  assert.equal(seriesByName(buildRaceFromRows(rows, { aggregate: 'last' }), 'A').data[0], 4);
});

test('fill=hold carries a finished entity forward; gap leaves null; zero fills zero', () => {
  const rows: RaceRow[] = [
    { entity: 'Short', period: '1', value: 9 },
    { entity: 'Long', period: '1', value: 1 },
    { entity: 'Long', period: '2', value: 2 },
    { entity: 'Long', period: '3', value: 3 },
  ];
  assert.deepEqual(seriesByName(buildRaceFromRows(rows), 'Short').data, [9, 9, 9]);
  assert.deepEqual(seriesByName(buildRaceFromRows(rows, { fill: 'gap' }), 'Short').data, [9, null, null]);
  assert.deepEqual(seriesByName(buildRaceFromRows(rows, { fill: 'zero' }), 'Short').data, [9, 0, 0]);

  const { report } = buildRace(rows);
  assert.equal(report.cellsFilled, 2);
});

test('a cumulative standing persists through missing periods regardless of fill', () => {
  const rows: RaceRow[] = [
    { entity: 'A', period: '1', value: 5 },
    { entity: 'A', period: '3', value: 5 },
    { entity: 'B', period: '2', value: 1 },
  ];
  const data = buildRaceFromRows(rows, { accumulate: 'cumulative-sum', fill: 'gap' });
  assert.deepEqual(seriesByName(data, 'A').data, [5, 5, 10]);
});

test('minPeriods drops entities without enough of their own data and reports them', () => {
  const rows: RaceRow[] = [
    { entity: 'Staying', period: '1', value: 1 },
    { entity: 'Staying', period: '2', value: 2 },
    { entity: 'Staying', period: '3', value: 3 },
    { entity: 'Brief', period: '1', value: 99 },
  ];
  const { data, report } = buildRace(rows, { minPeriods: 3 });
  assert.deepEqual(
    data.series.map((series) => series.name),
    ['Staying']
  );
  assert.deepEqual(report.entitiesBelowMinPeriods, ['Brief']);
  assert.equal(report.entitiesRead, 2);
  assert.equal(report.entitiesKept, 1);
});

test('limit=ever-on-board keeps an early leader who fades; limit=final drops them', () => {
  // "Flash" leads at period 1 then collapses; "Steady" and "Slow" finish 1-2.
  const rows: RaceRow[] = [
    { entity: 'Flash', period: '1', value: 100 },
    { entity: 'Flash', period: '2', value: 1 },
    { entity: 'Steady', period: '1', value: 50 },
    { entity: 'Steady', period: '2', value: 60 },
    { entity: 'Slow', period: '1', value: 10 },
    { entity: 'Slow', period: '2', value: 55 },
    { entity: 'Never', period: '1', value: 5 },
    { entity: 'Never', period: '2', value: 6 },
  ];
  const everOnBoard = buildRace(rows, { limit: 2 });
  assert.deepEqual(
    everOnBoard.data.series.map((series) => series.name).sort(),
    ['Flash', 'Slow', 'Steady']
  );
  assert.deepEqual(everOnBoard.report.entitiesOverLimit, ['Never']);

  const finalOnly = buildRace(rows, { limit: 2, limitMode: 'final' });
  assert.deepEqual(
    finalOnly.data.series.map((series) => series.name).sort(),
    ['Slow', 'Steady']
  );
});

test('bad cells are reported by reason rather than thrown', () => {
  const rows = [
    { entity: 'A', period: '1', value: 1 },
    { entity: 'A', period: '2', value: 'n/a' as unknown as number },
    { entity: '', period: '1', value: 3 },
    { entity: 'B', period: '', value: 4 },
    { entity: 'B', period: '1', value: 5 },
  ];
  const { report } = buildRace(rows);
  assert.equal(report.rowsRead, 5);
  assert.equal(report.rowsUsed, 2);
  assert.deepEqual(report.dropped, {
    'non-numeric-value': 1,
    'missing-entity': 1,
    'missing-period': 1,
  });
});

test('rows whose period is not in an explicit periodOrder are dropped and counted', () => {
  const rows: RaceRow[] = [
    { entity: 'A', period: '2019', value: 1 },
    { entity: 'A', period: '2020', value: 2 },
    { entity: 'A', period: '2099', value: 3 },
  ];
  const { data, report } = buildRace(rows, { periodOrder: ['2019', '2020'] });
  assert.deepEqual(data.labels, ['2019', '2020']);
  assert.equal(report.periodOrder, 'given');
  assert.equal(report.dropped['period-not-in-order'], 1);
});

test('formatPeriod rewrites labels without changing the order they were computed in', () => {
  const rows: RaceRow[] = [
    { entity: 'A', period: '2020-03-01', value: 1 },
    { entity: 'A', period: '2020-01-01', value: 2 },
  ];
  const data = buildRaceFromRows(rows, {
    formatPeriod: (period) => period.slice(0, 7),
  });
  assert.deepEqual(data.labels, ['2020-01', '2020-03']);
  assert.deepEqual(seriesByName(data, 'A').data, [2, 1]);
});

test('inputs are not mutated', () => {
  const rows: RaceRow[] = [
    { entity: 'A', period: '2', value: 1 },
    { entity: 'A', period: '1', value: 2 },
  ];
  const snapshot = JSON.stringify(rows);
  const order = ['1', '2'];
  buildRace(rows, { periodOrder: order });
  assert.equal(JSON.stringify(rows), snapshot);
  assert.deepEqual(order, ['1', '2']);
});

test('buildRaceFromWide round-trips wide ChartData and can re-accumulate it', () => {
  const wide: ChartData = {
    labels: ['E1', 'E2', 'E3'],
    series: [
      { name: 'Show', data: [10, 9, 8] },
      { name: 'Other', data: [7, 7, 7] },
    ],
    sourceType: 'paste',
    suggestedTitle: 'Ratings',
  };
  const identity = buildRaceFromWide(wide).data;
  assert.deepEqual(identity.labels, ['E1', 'E2', 'E3']);
  assert.deepEqual(seriesByName(identity, 'Show').data, [10, 9, 8]);
  assert.equal(identity.sourceType, 'paste');
  assert.equal(identity.suggestedTitle, 'Ratings');

  const averaged = buildRaceFromWide(wide, { accumulate: 'cumulative-mean' }).data;
  assert.deepEqual(seriesByName(averaged, 'Show').data, [10, 9.5, 9]);
});

test('buildRaceFromTable reads named columns from records', () => {
  const records = [
    { show: 'A', season: 'S1', rating: '8.5' },
    { show: 'A', season: 'S2', rating: '9.0' },
    { show: 'B', season: 'S1', rating: '7.0' },
    { show: 'B', season: 'S2', rating: 'tbd' },
  ];
  const { data, report } = buildRaceFromTable(records, { entity: 'show', period: 'season', value: 'rating' });
  assert.deepEqual(data.labels, ['S1', 'S2']);
  assert.deepEqual(seriesByName(data, 'A').data, [8.5, 9]);
  assert.deepEqual(seriesByName(data, 'B').data, [7, 7]); // held
  assert.equal(report.dropped['non-numeric-value'], 1);
});

test('inferRaceColumns finds entity/period/value in a tidy table', () => {
  const records: Array<Record<string, unknown>> = [];
  const shows = ['Alpha', 'Beta', 'Gamma', 'Delta'];
  shows.forEach((show, showIndex) => {
    for (let season = 1; season <= 5; season += 1) {
      records.push({
        show_id: `tt${showIndex}`,
        show,
        season: `Season ${season}`,
        running_average: 8 + showIndex * 0.1 + season * 0.01,
        locked: 'false',
      });
    }
  });
  const inferred = inferRaceColumns(records);
  assert.ok(inferred);
  assert.equal(inferred.columns.period, 'season');
  assert.equal(inferred.columns.value, 'running_average');
  // Both "show" and "show_id" are text with the same cardinality; the
  // readable one must win so contenders are named, not numbered.
  assert.equal(inferred.columns.entity, 'show');
  assert.ok(inferred.confidence >= 0.6);
  assert.ok(inferred.reasons.length === 3);
});

test('inferRaceColumns is not fooled by per-entity attributes that are numeric and sorted', () => {
  // The real IMDb export: eleven columns, several of them numeric and ordered.
  // "seasons" (a per-show count), "start_year", "series_votes" and
  // "imdb_series_rating" are constant within a show and must never be chosen
  // as the period or the value. "show_id" must lose to "show".
  const records: Array<Record<string, unknown>> = [];
  const shows = ['Bleach', 'Attack on Titan', 'Dark', 'Breaking Bad', 'Mr. Robot', 'Daredevil', 'Aspirants'];
  shows.forEach((show, showIndex) => {
    for (let season = 1; season <= 12; season += 1) {
      records.push({
        show_id: `tt${1000 + showIndex}`,
        show,
        start_year: 2008 + showIndex,
        seasons: 3 + (showIndex % 4),
        episodes: 40 + showIndex * 7,
        series_votes: 100000 + showIndex * 50000,
        imdb_series_rating: 8 + showIndex * 0.1,
        season,
        marker: `S${season}`,
        running_average: 8 + showIndex * 0.05 + Math.min(season, 3 + (showIndex % 4)) * 0.01,
        locked: season > 3 + (showIndex % 4),
      });
    }
  });
  const inferred = inferRaceColumns(records);
  assert.ok(inferred);
  assert.equal(inferred.columns.entity, 'show');
  assert.ok(['season', 'marker'].includes(inferred.columns.period), `period was ${inferred.columns.period}`);
  assert.equal(inferred.columns.value, 'running_average');
  assert.ok(inferred.confidence >= 0.6, `confidence ${inferred.confidence}`);
});

test('inferRaceColumns returns null for a table that is not tidy', () => {
  const wide = Array.from({ length: 10 }, (_, index) => ({
    Show: `Show ${index}`,
    'Season 1': index,
    'Season 2': index + 1,
  }));
  assert.equal(inferRaceColumns(wide), null);
  assert.equal(inferRaceColumns([]), null);
});

test('impossible options are programmer errors and throw', () => {
  const rows: RaceRow[] = [{ entity: 'A', period: '1', value: 1 }];
  assert.throws(() => buildRace(rows, { aggregate: 'median' as never }), RangeError);
  assert.throws(() => buildRace(rows, { accumulate: 'running' as never }), RangeError);
  assert.throws(() => buildRace(rows, { fill: 'interpolate' as never }), RangeError);
  assert.throws(() => buildRace(rows, { limit: 0 }), RangeError);
  assert.throws(() => buildRace(rows, { limit: 2.5 }), RangeError);
  assert.throws(() => buildRace(rows, { minPeriods: -1 }), RangeError);
  assert.throws(() => buildRace(rows, { periodOrder: ['1', '1'] }), RangeError);
});

test('degenerate inputs produce warnings rather than failures', () => {
  const single = buildRace([{ entity: 'A', period: '1', value: 1 }]);
  assert.ok(single.report.warnings.some((warning) => /Fewer than two periods/.test(warning)));
  assert.ok(single.report.warnings.some((warning) => /Fewer than two entities/.test(warning)));

  const empty = buildRace([]);
  assert.deepEqual(empty.data.labels, []);
  assert.deepEqual(empty.data.series, []);
});
