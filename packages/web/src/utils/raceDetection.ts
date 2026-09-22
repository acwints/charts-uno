import type { ChartData } from '../types';
import { parseOrdinalValue } from '../types';
import { transposeChartData } from './transposeData';

/**
 * Detect data that wants to be an animated race, and work out which way round
 * it is.
 *
 * A race is a ranking that changes over an ordered axis, so the test has three
 * parts: one axis has to read as an ordered sequence (seasons, episodes,
 * years, quarters, dates, plain counting numbers), the other has to hold
 * several contenders, and — the part that actually matters — the ranking has
 * to change at least once. Data where the order never moves is a ranked bar
 * chart that happens to have a time axis; animating it would be motion for its
 * own sake, so it is not suggested.
 *
 * Orientation matters because people store this data both ways. The CSV
 * importer reads column 0 as the labels, so a file with years down the rows
 * arrives frame-per-label (correct), while one with contenders down the rows
 * arrives contender-per-label (transposed). Both are common, so both are
 * detected and the transposed case is corrected rather than rejected.
 */

const MIN_FRAMES = 5;
/*
 * Deliberately higher than the minimum a race can technically draw. Three
 * series over an ordered axis is a line chart; a race only starts to earn its
 * animation once there are enough contenders that a line chart turns into
 * spaghetti. Under-suggesting is cheap here — the Race type is still one click
 * away — whereas hijacking an ordinary yearly comparison is not.
 */
const MIN_CONTENDERS = 6;
/* One reshuffle can be noise; a race should be genuinely unstable. */
const MIN_ORDER_CHANGES = 2;

/**
 * True when the values read as an ordered sequence. Strictly increasing is
 * required rather than merely sortable, because an unordered set of numbers
 * (say, prices) is not a time axis.
 */
export function looksSequential(values: string[]): boolean {
  if (values.length < MIN_FRAMES) return false;

  const parsed = values.map(parseOrdinalValue);
  if (parsed.some((value) => value === null)) return false;

  const numbers = parsed as number[];
  for (let index = 1; index < numbers.length; index += 1) {
    if (numbers[index] <= numbers[index - 1]) return false;
  }
  return true;
}

/**
 * How many times the leader or the visible ordering changes across the
 * sequence. A race with no reordering is just a bar chart.
 */
function countRankChanges(data: ChartData, topN: number): { leaderChanges: number; orderChanges: number } {
  const frameCount = data.labels.length;
  let leaderChanges = 0;
  let orderChanges = 0;
  let previousOrder: string | null = null;
  let previousLeader: string | null = null;

  for (let frame = 0; frame < frameCount; frame += 1) {
    const ranked = data.series
      .map((series) => ({ name: series.name, value: series.data[frame] }))
      .filter((entry): entry is { name: string; value: number } => typeof entry.value === 'number')
      .sort((a, b) => b.value - a.value)
      .slice(0, topN)
      .map((entry) => entry.name);

    if (ranked.length === 0) continue;

    // A separator that cannot occur in a series name, so two different
    // orderings can never collapse to the same signature.
    const signature = ranked.join('\u0000');
    if (previousOrder !== null && signature !== previousOrder) orderChanges += 1;
    if (previousLeader !== null && ranked[0] !== previousLeader) leaderChanges += 1;
    previousOrder = signature;
    previousLeader = ranked[0];
  }

  return { leaderChanges, orderChanges };
}

function countNumericCells(data: ChartData): number {
  return data.series.reduce(
    (total, series) => total + series.data.filter((value) => typeof value === 'number').length,
    0
  );
}

export interface RaceDetection {
  /** The data is race-shaped and the ranking actually moves. */
  isRace: boolean;
  /** The frames are across the series rather than down the labels. */
  needsTranspose: boolean;
  frameCount: number;
  contenderCount: number;
  leaderChanges: number;
  orderChanges: number;
  reason: string;
}

const NOT_A_RACE = (reason: string): RaceDetection => ({
  isRace: false,
  needsTranspose: false,
  frameCount: 0,
  contenderCount: 0,
  leaderChanges: 0,
  orderChanges: 0,
  reason,
});

export function detectRaceShape(data: ChartData, topN = 12): RaceDetection {
  if (!data.labels?.length || !data.series?.length) return NOT_A_RACE('No data.');

  const framesAreLabels = looksSequential(data.labels);
  const framesAreSeries = looksSequential(data.series.map((series) => series.name));

  // If both axes look sequential the data is ambiguous (a numeric grid), so
  // prefer the reading with more contenders — a race wants several of them.
  let oriented = data;
  let needsTranspose = false;
  if (framesAreLabels && framesAreSeries) {
    needsTranspose = data.labels.length > data.series.length;
  } else if (framesAreSeries) {
    needsTranspose = true;
  } else if (!framesAreLabels) {
    return NOT_A_RACE('Neither axis reads as an ordered sequence.');
  }

  if (needsTranspose) oriented = transposeChartData(data);

  const frameCount = oriented.labels.length;
  const contenderCount = oriented.series.length;

  if (frameCount < MIN_FRAMES) {
    return NOT_A_RACE(`Only ${frameCount} frames; a race needs at least ${MIN_FRAMES}.`);
  }
  if (contenderCount < MIN_CONTENDERS) {
    return NOT_A_RACE(`Only ${contenderCount} contenders; a race needs at least ${MIN_CONTENDERS}.`);
  }

  // Guard against a grid that is mostly empty, which reorders for lack of data
  // rather than because anything overtook anything.
  const density = countNumericCells(oriented) / (frameCount * contenderCount);
  if (density < 0.5) {
    return NOT_A_RACE('Too many gaps to rank frame by frame.');
  }

  const { leaderChanges, orderChanges } = countRankChanges(oriented, topN);
  if (orderChanges < MIN_ORDER_CHANGES) {
    return NOT_A_RACE(
      orderChanges === 0
        ? 'The ranking never changes, so there is nothing to race.'
        : 'The ranking barely moves; a ranked bar chart tells this better.'
    );
  }

  return {
    isRace: true,
    needsTranspose,
    frameCount,
    contenderCount,
    leaderChanges,
    orderChanges,
    reason:
      `${contenderCount} contenders over ${frameCount} frames, ` +
      `with ${orderChanges} reshuffle${orderChanges === 1 ? '' : 's'}` +
      (leaderChanges > 0 ? ` and ${leaderChanges} lead change${leaderChanges === 1 ? '' : 's'}` : '') +
      '.',
  };
}

/**
 * Apply a detection result, returning data oriented frames-per-label so the
 * race renderer can read `labels` as its timeline.
 */
export function orientForRace(data: ChartData, detection: RaceDetection): ChartData {
  return detection.needsTranspose ? transposeChartData(data) : data;
}
