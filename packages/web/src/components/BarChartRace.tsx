import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Pause from 'lucide-react/dist/esm/icons/pause';
import Play from 'lucide-react/dist/esm/icons/play';
import RotateCcw from 'lucide-react/dist/esm/icons/rotate-ccw';
import type { ChartData, ChartConfig, ColorTheme } from '../types';
import { RACE_DEFAULTS } from '../types';
import { createFixedNumberFormatter, getAdaptiveDecimalPlaces } from '../utils/numberFormat';
import './BarChartRace.css';

interface BarChartRaceProps {
  data: ChartData;
  config: ChartConfig;
  theme: ColorTheme;
  colors: string[];
}

const ROW_GAP = 6;
const MIN_ROW_HEIGHT = 26;
const MAX_ROW_HEIGHT = 56;
const AXIS_HEIGHT = 26;
const NAME_COLUMN = 0.3;
const VALUE_COLUMN = 76;

/**
 * Rows hold their position for most of a frame and then cross quickly. Easing
 * the movement across the whole frame instead leaves many rows permanently
 * mid-slide, which reads as gaps and doubled ranks rather than as a race.
 */
const MOVE_START = 0.34;
const MOVE_END = 0.8;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Round a bound outward to a readable step. */
const niceBound = (value: number, direction: 'floor' | 'ceil') => {
  if (value === 0) return 0;
  const magnitude = Math.pow(10, Math.floor(Math.log10(Math.abs(value))) - 1);
  const step = magnitude <= 0 ? 1 : magnitude;
  return direction === 'floor'
    ? Math.floor(value / step) * step
    : Math.ceil(value / step) * step;
};

export function BarChartRace({ data, config, theme, colors }: BarChartRaceProps) {
  const frameCount = data.labels.length;
  const frameMs = config.raceFrameMs ?? RACE_DEFAULTS.frameMs;
  const holdLast = config.raceHoldLast ?? RACE_DEFAULTS.holdLast;
  const loop = config.raceLoop ?? RACE_DEFAULTS.loop;
  const topN = Math.max(1, config.raceTopN ?? RACE_DEFAULTS.topN);
  const visibleRows = Math.min(topN, data.series.length);

  const prefersReducedMotion = useMemo(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  );

  const lastFrame = Math.max(0, frameCount - 1);
  // With reduced motion the race is shown resolved rather than animated.
  const [frame, setFrame] = useState(() => (prefersReducedMotion ? lastFrame : 0));
  const [playing, setPlaying] = useState(() => !prefersReducedMotion);

  // Restart cleanly when the data changes shape. Adjusting state during render
  // is React's documented pattern for this; doing it in an effect would
  // trigger a second render pass every time the data changes.
  const [seenFrameCount, setSeenFrameCount] = useState(frameCount);
  if (seenFrameCount !== frameCount) {
    setSeenFrameCount(frameCount);
    setFrame(prefersReducedMotion ? Math.max(0, frameCount - 1) : 0);
  }

  /**
   * Resolved values per series per frame. `holdLast` carries a series' final
   * value forward once its own data runs out, so a finished contender keeps
   * its place and can still be passed. `locked` marks those carried frames.
   */
  const { values, locked } = useMemo(() => {
    const resolvedValues: Array<Array<number | null>> = [];
    const resolvedLocked: boolean[][] = [];

    data.series.forEach((series) => {
      const rowValues: Array<number | null> = [];
      const rowLocked: boolean[] = [];
      let carried: number | null = null;
      let exhausted = false;

      for (let index = 0; index < frameCount; index += 1) {
        const raw = series.data[index];
        if (typeof raw === 'number' && Number.isFinite(raw)) {
          carried = raw;
          rowValues.push(raw);
          rowLocked.push(false);
        } else if (holdLast && carried !== null) {
          exhausted = true;
          rowValues.push(carried);
          rowLocked.push(true);
        } else {
          rowValues.push(null);
          rowLocked.push(exhausted);
        }
      }

      resolvedValues.push(rowValues);
      resolvedLocked.push(rowLocked);
    });

    return { values: resolvedValues, locked: resolvedLocked };
  }, [data.series, frameCount, holdLast]);

  /** Rank of each series at each whole frame; series with no value sit last. */
  const ranks = useMemo(() => {
    const perFrame: number[][] = [];
    for (let index = 0; index < frameCount; index += 1) {
      const order = values
        .map((row, seriesIndex) => ({ seriesIndex, value: row[index] }))
        .sort((a, b) => {
          if (a.value === null && b.value === null) return a.seriesIndex - b.seriesIndex;
          if (a.value === null) return 1;
          if (b.value === null) return -1;
          return b.value - a.value || a.seriesIndex - b.seriesIndex;
        });
      const rankForSeries = new Array<number>(values.length).fill(values.length);
      order.forEach((entry, position) => {
        rankForSeries[entry.seriesIndex] = position;
      });
      perFrame.push(rankForSeries);
    }
    return perFrame;
  }, [values, frameCount]);

  const onBoardValues = useMemo(() => {
    const collected: number[] = [];
    for (let index = 0; index < frameCount; index += 1) {
      values.forEach((row, seriesIndex) => {
        const value = row[index];
        if (value !== null && ranks[index][seriesIndex] < visibleRows) collected.push(value);
      });
    }
    return collected;
  }, [values, ranks, frameCount, visibleRows]);

  /**
   * A bar drawn from a truncated baseline overstates small gaps, so a domain
   * that does not reach zero is drawn as a dot on a track instead.
   */
  const domain = useMemo(() => {
    if (onBoardValues.length === 0) return { min: 0, max: 1 };
    const dataMin = Math.min(...onBoardValues);
    const dataMax = Math.max(...onBoardValues);
    const baselineMode = config.yAxisBaselineMode ?? 'auto';

    if (baselineMode === 'zero' || dataMin <= 0) {
      return { min: Math.min(0, niceBound(dataMin, 'floor')), max: niceBound(dataMax, 'ceil') || 1 };
    }
    // 'auto' keeps zero when the data is already close to it; a tall baseline
    // only earns its truncation when zero is far away.
    if (baselineMode === 'auto' && dataMin / (dataMax || 1) < 0.35) {
      return { min: 0, max: niceBound(dataMax, 'ceil') || 1 };
    }
    const min = niceBound(dataMin, 'floor');
    const max = niceBound(dataMax, 'ceil');
    return { min, max: max > min ? max : min + 1 };
  }, [onBoardValues, config.yAxisBaselineMode]);

  const markMode = config.raceMark ?? RACE_DEFAULTS.mark;
  const useBars = markMode === 'bar' || (markMode === 'auto' && domain.min === 0);

  const decimals = useMemo(() => getAdaptiveDecimalPlaces(onBoardValues), [onBoardValues]);
  const formatter = useMemo(() => createFixedNumberFormatter(decimals), [decimals]);

  const [size, setSize] = useState({ width: 640, height: 360 });
  const containerRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (box && box.width > 0 && box.height > 0) {
        setSize({ width: box.width, height: box.height });
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const plotHeight = Math.max(80, size.height - AXIS_HEIGHT);
  const rowHeight = clamp(plotHeight / Math.max(1, visibleRows), MIN_ROW_HEIGHT, MAX_ROW_HEIGHT);
  const nameWidth = clamp(size.width * NAME_COLUMN, 90, 220);
  const trackLeft = nameWidth + 12;
  const trackWidth = Math.max(40, size.width - trackLeft - VALUE_COLUMN - 12);

  const valueToX = useCallback(
    (value: number) =>
      trackLeft +
      ((clamp(value, domain.min, domain.max) - domain.min) / (domain.max - domain.min || 1)) *
        trackWidth,
    [domain.max, domain.min, trackLeft, trackWidth]
  );

  // A non-looping race that has reached the end is derived, not stored, so the
  // playback effect tears itself down instead of writing state from inside a
  // state updater.
  const atEnd = !loop && frame >= lastFrame;

  // Playback. The frame counter advances in real time, so the speed control is
  // in milliseconds rather than in repaints.
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number | null>(null);

  useEffect(() => {
    if (!playing || atEnd || frameCount < 2) return;

    const tick = (now: number) => {
      const previous = lastTickRef.current;
      lastTickRef.current = now;
      const elapsed = previous === null ? 0 : now - previous;

      setFrame((current) => {
        const next = current + elapsed / Math.max(60, frameMs);
        if (next < lastFrame) return next;
        return loop ? next - lastFrame : lastFrame;
      });

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      lastTickRef.current = null;
    };
  }, [playing, atEnd, frameMs, lastFrame, loop, frameCount]);

  const frameIndex = clamp(Math.floor(frame), 0, lastFrame);
  const nextIndex = Math.min(lastFrame, frameIndex + 1);
  const settled = easeInOutCubic(
    clamp((frame - frameIndex - MOVE_START) / (MOVE_END - MOVE_START), 0, 1)
  );
  const displayIndex = settled < 0.5 ? frameIndex : nextIndex;

  const axisTicks = useMemo(() => {
    const count = 5;
    return Array.from({ length: count }, (_, index) =>
      domain.min + ((domain.max - domain.min) * index) / (count - 1)
    );
  }, [domain.max, domain.min]);

  const handleScrub = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPlaying(false);
    setFrame(Number(event.target.value));
  };

  const handleRestart = () => {
    setFrame(0);
    setPlaying(true);
  };

  // Pressing play on a finished race starts it again rather than doing nothing.
  const handlePlayToggle = () => {
    if (!playing && atEnd) {
      setFrame(0);
      setPlaying(true);
      return;
    }
    setPlaying((current) => !current);
  };

  if (frameCount === 0 || data.series.length === 0) {
    return (
      <div className="race-empty" style={{ color: theme.textMuted }}>
        Add at least one frame and one series to run a race.
      </div>
    );
  }

  return (
    <div className="race-root">
      <div className="race-plot" ref={containerRef}>
        <div className="race-axis" style={{ height: AXIS_HEIGHT }}>
          {axisTicks.map((tick, index) => (
            <span
              key={tick}
              className="race-axis-tick"
              style={{
                left: valueToX(tick),
                color: theme.textMuted,
                transform:
                  index === 0
                    ? 'translateX(0)'
                    : index === axisTicks.length - 1
                      ? 'translateX(-100%)'
                      : 'translateX(-50%)',
              }}
            >
              {formatter.format(tick)}
            </span>
          ))}
        </div>

        <div className="race-rows" style={{ top: AXIS_HEIGHT }}>
          {config.showGrid &&
            axisTicks.map((tick) => (
              <span
                key={`grid-${tick}`}
                className="race-gridline"
                style={{ left: valueToX(tick), background: theme.grid, opacity: theme.gridOpacity }}
              />
            ))}

          {data.series.map((series, seriesIndex) => {
            const startRank = Math.min(ranks[frameIndex][seriesIndex], visibleRows);
            const endRank = Math.min(ranks[nextIndex][seriesIndex], visibleRows);
            const slot = lerp(startRank, endRank, settled);

            // Fade out as a row slides past the last on-board position, which
            // covers both dropping out of the top N and running out of data.
            const presence = clamp((visibleRows - slot) / 0.45, 0, 1);
            if (presence <= 0.01) return null;

            const startValue = values[seriesIndex][frameIndex];
            const endValue = values[seriesIndex][nextIndex];
            if (startValue === null && endValue === null) return null;
            const value = lerp(startValue ?? endValue ?? 0, endValue ?? startValue ?? 0, settled);

            const isLocked = locked[seriesIndex][displayIndex];
            const color = colors[seriesIndex % colors.length];
            const markX = valueToX(value);

            return (
              <div
                key={series.name}
                className="race-row"
                style={{
                  height: rowHeight - ROW_GAP,
                  opacity: presence,
                  zIndex: 40 - endRank,
                  transform: `translateY(${slot * rowHeight}px)`,
                  background: theme.cardBackground,
                }}
              >
                <span className="race-rank" style={{ width: 22, color: theme.textMuted }}>
                  {Math.round(settled < 0.5 ? startRank : endRank) + 1}
                </span>
                <span
                  className="race-name"
                  style={{ width: nameWidth - 22, color: theme.text }}
                  title={series.name}
                >
                  {series.name}
                </span>

                {useBars ? (
                  <span
                    className="race-bar"
                    style={{
                      left: trackLeft,
                      width: Math.max(2, markX - trackLeft),
                      background: color,
                      opacity: isLocked ? 0.55 : 1,
                    }}
                  />
                ) : (
                  <>
                    <span
                      className="race-track"
                      style={{ left: trackLeft, width: trackWidth, background: theme.grid }}
                    />
                    <span
                      className="race-dot"
                      style={{
                        left: markX,
                        background: isLocked ? theme.cardBackground : color,
                        boxShadow: `inset 0 0 0 3px ${color}`,
                      }}
                    />
                  </>
                )}

                <span className="race-value" style={{ width: VALUE_COLUMN, color: theme.text }}>
                  {formatter.format(value)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="race-controls">
        <button
          type="button"
          className="race-button"
          onClick={handlePlayToggle}
          aria-label={playing && !atEnd ? 'Pause race' : 'Play race'}
          style={{ color: theme.text, borderColor: theme.border }}
        >
          {playing && !atEnd ? <Pause size={14} /> : <Play size={14} />}
        </button>
        <button
          type="button"
          className="race-button"
          onClick={handleRestart}
          aria-label="Restart race"
          style={{ color: theme.text, borderColor: theme.border }}
        >
          <RotateCcw size={14} />
        </button>
        <input
          className="race-scrubber"
          type="range"
          min={0}
          max={lastFrame}
          step={0.01}
          value={frame}
          onChange={handleScrub}
          aria-label="Race position"
        />
        <span className="race-frame-label" style={{ color: theme.textMuted }}>
          {data.labels[displayIndex]}
        </span>
      </div>
    </div>
  );
}
