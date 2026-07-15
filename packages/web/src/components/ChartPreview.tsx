import { useMemo, useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  ComposedChart,
  PieChart,
  Pie,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
  LabelList,
} from 'recharts';
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw';
import ExternalLink from 'lucide-react/dist/esm/icons/external-link';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles';
import Check from 'lucide-react/dist/esm/icons/check';
import type { ChartData, ChartConfig, ColorTheme } from '../types';
import type { WatermarkSettings } from '../services/exportService';
import { COLOR_GRADIENTS, STYLE_VARIANTS, getTheme, applyCustomColors, getEffectiveColors, getNumericDomainFromValues, isComboChart, resolveSeriesConfig, getSeriesForAxis } from '../types';
import { generateInfographic } from '../services/infographicGenerator';
import { useChartStore } from '../stores/chartStore';
import {
  computeAdaptiveAxisConfig,
  computeCartesianXAxisLabelConfig,
  computeHorizontalCategoryAxisConfig,
  computeValueAxisConfig,
} from '../utils/adaptiveAxis';
import { createFixedNumberFormatter, getAdaptiveDecimalPlaces, formatCompactAxisValue, estimateMaxTickString } from '../utils/numberFormat';
import { analyzeDataForRendering } from '../utils/dataIntelligence';
import { AdaptiveXAxisTick } from './AdaptiveAxisTick';
import { AdaptiveYAxisCategoryTick } from './AdaptiveYAxisCategoryTick';
import { AIProcessingIndicator } from './AIProcessingIndicator';
import { Button } from './Button';
import { MapChart } from './MapChart';
import { SafeResponsiveContainer } from './SafeResponsiveContainer';
import './ChartPreview.css';

interface ChartPreviewProps {
  data: ChartData;
  config: ChartConfig;
  watermark?: WatermarkSettings;
}

interface ValueLabelProps {
  x?: number | string;
  y?: number | string;
  value?: unknown;
  index?: number | string;
}

const POINT_DETAIL_KEY = '__pointDetail';

export interface ChartLogoOption {
  teamId: string;
  teamName: string;
  logoUrl: string;
}

function getNiceStep(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const exponent = Math.floor(Math.log10(value));
  const magnitude = 10 ** exponent;
  const residual = value / magnitude;
  if (residual <= 1) return magnitude;
  if (residual <= 2) return 2 * magnitude;
  if (residual <= 5) return 5 * magnitude;
  return 10 * magnitude;
}

function toNiceDomain(
  domain: [number, number] | undefined,
  options?: { tickCount?: number; lockZeroMin?: boolean },
): [number, number] | undefined {
  if (!domain) return undefined;
  let [min, max] = domain;
  if (!Number.isFinite(min) || !Number.isFinite(max)) return domain;
  if (max < min) [min, max] = [max, min];

  const tickCount = Math.max(options?.tickCount ?? 5, 2);
  const lockZeroMin = options?.lockZeroMin === true && min >= 0;
  const baseMin = lockZeroMin ? 0 : min;
  const range = Math.max(max - baseMin, 1e-9);
  const step = getNiceStep(range / (tickCount - 1));

  let niceMin = lockZeroMin ? 0 : Math.floor(baseMin / step) * step;
  let niceMax = Math.ceil(max / step) * step;
  if (niceMax <= niceMin) {
    niceMax = niceMin + step;
  }

  // Ensure nice bounds fully contain the data — prevents Recharts from
  // auto-extending the axis with ugly fractional tick values.
  if (niceMax < max) niceMax += step;
  if (!lockZeroMin && niceMin > min) niceMin -= step;

  return [niceMin, niceMax];
}

function isLikelyDateLabel(label: string): boolean {
  const trimmed = label.trim();
  if (!trimmed) return false;
  // Support common chart date formats without forcing strict parsing rules.
  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(trimmed)) return true;
  if (/^\d{1,2}[-/]\d{1,2}([-/]\d{2,4})?$/.test(trimmed)) return true;
  if (/^(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\b/i.test(trimmed)) return true;
  return Number.isFinite(Date.parse(trimmed));
}

export function ChartPreview({
  data,
  config,
  watermark,
}: ChartPreviewProps) {
  // Get base theme based on scheme and mode
  const baseTheme = getTheme(config.colorScheme, config.themeMode);

  // Apply custom color overrides
  const theme: ColorTheme = applyCustomColors(baseTheme, config.customColors);

  // Get effective colors for series (custom or from palette)
  const colors = getEffectiveColors(config.colorScheme, config.customColors?.seriesColors);
  const gradients = COLOR_GRADIENTS[config.colorScheme];
  const styleConfig = STYLE_VARIANTS[config.styleVariant];

  const { infographicSvg, setInfographicSvg } = useChartStore();
  const [infographicLoading, setInfographicLoading] = useState(false);
  const [infographicError, setInfographicError] = useState<string | null>(null);

  const generateInfographicSvg = useCallback(async () => {
    setInfographicLoading(true);
    setInfographicError(null);
    try {
      const svg = await generateInfographic(
        data,
        config.title,
        config.colorScheme,
        config.themeMode,
        data.sourceImage,
        config.aiMode || 'chart',
        config.aiCustomPrompt
      );
      setInfographicSvg(svg);
    } catch (err) {
      setInfographicError(err instanceof Error ? err.message : 'Failed to generate infographic');
    } finally {
      setInfographicLoading(false);
    }
  }, [data, config.title, config.colorScheme, config.themeMode, config.aiMode, config.aiCustomPrompt, setInfographicSvg]);

  useEffect(() => {
    if (config.type === 'infographic' && config.aiReadyToGenerate && !infographicSvg && !infographicLoading) {
      generateInfographicSvg();
    }
  }, [config.type, config.aiReadyToGenerate, infographicSvg, infographicLoading, generateInfographicSvg]);

  // Regenerate when aiMode or customPrompt changes
  useEffect(() => {
    if (config.type === 'infographic' && infographicSvg) {
      setInfographicSvg(null);
    }
  }, [config.aiMode, config.aiCustomPrompt, config.type, setInfographicSvg, infographicSvg]);

  const regenerateInfographic = () => {
    setInfographicSvg(null);
  };

  // Data Intelligence Layer: analyze the dataset to inform rendering decisions.
  // Handles label normalization (e.g., "1910.0" → "1910"), temporal granularity
  // detection (decade vs year vs month), and axis strategy (categorical vs continuous).
  const dataHints = useMemo(
    () => analyzeDataForRendering(data.labels, data.xAxisType),
    [data.labels, data.xAxisType],
  );

  // Use cleaned labels throughout (strips trailing .0, trims whitespace)
  const effectiveLabels = dataHints.cleanedLabels;

  // Check if all labels can be parsed as numbers (on cleaned labels)
  const isNumericLabels = useMemo(() => {
    if (dataHints.forceCategorical) return false;
    return effectiveLabels.length > 0 &&
      effectiveLabels.every(label => !isNaN(parseFloat(label)) && isFinite(Number(label)));
  }, [effectiveLabels, dataHints.forceCategorical]);

  // Detect if labels are years — intelligence layer handles ".0" cleaning & decade detection
  const isYearLabels = useMemo(() => {
    if (dataHints.suggestedXAxisType === 'year') return true;
    // Explicit type hint takes precedence
    if (data.xAxisType === 'year') return true;
    if (data.xAxisType === 'date' || data.xAxisType === 'category' || data.xAxisType === 'number') return false;
    // Auto-detect: all cleaned labels are 4-digit years in reasonable range
    return effectiveLabels.length > 0 &&
      effectiveLabels.every(label => {
        if (!/^\d{4}$/.test(label)) return false;
        const year = parseInt(label, 10);
        return year >= 1800 && year <= 2100;
      });
  }, [effectiveLabels, data.xAxisType, dataHints.suggestedXAxisType]);

  // Detect Y-axis format from data hints or infer from yAxisLabel
  const yAxisFormat = useMemo(() => {
    if (data.yAxisFormat) return data.yAxisFormat;
    // Infer from axis label text
    const label = (data.yAxisLabel || '').toLowerCase();
    if (/(\$|usd|eur|gbp|price|cost|revenue|salary|income|spend|budget|dollar|euro|pound)/.test(label)) {
      return 'currency';
    }
    if (/(percent|%|rate|ratio|share|proportion)/.test(label)) {
      return 'percentage';
    }
    return 'number';
  }, [data.yAxisFormat, data.yAxisLabel]);

  // Get prefix/suffix for Y-axis values
  const yAxisPrefix = useMemo(() => {
    if (data.yAxisPrefix) return data.yAxisPrefix;
    if (yAxisFormat === 'currency') {
      // Try to infer currency symbol from label
      const label = (data.yAxisLabel || '').toLowerCase();
      if (/eur|euro|€/.test(label)) return '€';
      if (/gbp|pound|£/.test(label)) return '£';
      return '$'; // Default to USD
    }
    return '';
  }, [data.yAxisPrefix, yAxisFormat, data.yAxisLabel]);

  const yAxisSuffix = useMemo(() => {
    if (data.yAxisSuffix) return data.yAxisSuffix;
    if (yAxisFormat === 'percentage') return '%';
    return '';
  }, [data.yAxisSuffix, yAxisFormat]);

  const numericSeriesValues = useMemo(() => {
    return data.series.flatMap((series) =>
      series.data.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
    );
  }, [data.series]);

  // Keep axes readable with adaptive precision while preserving trailing zeros for consistency.
  const axisDecimalPlaces = useMemo(() => {
    return getAdaptiveDecimalPlaces(numericSeriesValues);
  }, [numericSeriesValues]);

  const axisNumberFormatter = useMemo(() => {
    return createFixedNumberFormatter(axisDecimalPlaces);
  }, [axisDecimalPlaces]);

  // Format Y-axis tick values with compact notation for large numbers.
  // Uses shared formatter to eliminate trailing ".0" (15.0M → 15M).
  const formatYAxisTick = useCallback((value: number): string => {
    return formatCompactAxisValue(value, yAxisPrefix, yAxisSuffix, axisNumberFormatter);
  }, [axisNumberFormatter, yAxisPrefix, yAxisSuffix]);

  // Match tooltip precision with axis/data labels so values stay consistent across views.
  const formatTooltipValue = useCallback((value: number): string => {
    const formatted = axisNumberFormatter.format(value);
    return `${yAxisPrefix}${formatted}${yAxisSuffix}`;
  }, [axisNumberFormatter, yAxisPrefix, yAxisSuffix]);

  // --- Combo chart (dual-axis) memos ---
  const comboCompatibleBase =
    (config.type === 'bar' || config.type === 'line' || config.type === 'area') &&
    config.barLayout !== 'horizontal';
  const combo = comboCompatibleBase && isComboChart(config);
  const rightAxisSeriesList = useMemo(() => {
    if (!combo) return [] as string[];
    return getSeriesForAxis(data, config, 'right');
  }, [combo, data, config]);
  const rightYAxisLabel = config.rightYAxisLabel ?? rightAxisSeriesList[0];

  const rightYAxisFormat = useMemo(() => {
    const label = (rightYAxisLabel || '').toLowerCase();
    if (/(\$|usd|eur|gbp|price|cost|revenue|salary|income|spend|budget|dollar|euro|pound)/.test(label)) return 'currency';
    if (/(percent|%|rate|ratio|share|proportion)/.test(label)) return 'percentage';
    // Heuristic: if the label contains savings/margin/growth/etc. and all right-axis values
    // are in 0-100 range, treat as percentage
    if (/\b(savings?|margin|efficiency|utilization|growth|change|returns?|yield)\b/i.test(label)) {
      const rightNames = new Set(rightAxisSeriesList);
      const vals = data.series
        .filter((s) => rightNames.has(s.name))
        .flatMap((s) => s.data.filter((v): v is number => typeof v === 'number' && Number.isFinite(v)));
      if (vals.length > 0 && vals.every((v) => v >= 0 && v <= 100)) return 'percentage';
    }
    return 'number';
  }, [data, rightAxisSeriesList, rightYAxisLabel]);

  const rightYAxisPrefix = useMemo(() => {
    if (rightYAxisFormat === 'currency') {
      const label = (rightYAxisLabel || '').toLowerCase();
      if (/eur|euro|€/.test(label)) return '€';
      if (/gbp|pound|£/.test(label)) return '£';
      return '$';
    }
    return '';
  }, [rightYAxisFormat, rightYAxisLabel]);

  const rightYAxisSuffix = useMemo(() => {
    return rightYAxisFormat === 'percentage' ? '%' : '';
  }, [rightYAxisFormat]);

  const rightSeriesValues = useMemo(() => {
    if (!combo) return [];
    const rightNames = new Set(rightAxisSeriesList);
    return data.series
      .filter((s) => rightNames.has(s.name))
      .flatMap((s) => s.data.filter((v): v is number => typeof v === 'number' && Number.isFinite(v)));
  }, [combo, data, rightAxisSeriesList]);

  const leftAxisSeriesNames = useMemo(() => {
    if (!combo) return [] as string[];
    return getSeriesForAxis(data, config, 'left');
  }, [combo, data, config]);

  const rightAxisDecimalPlaces = useMemo(() => getAdaptiveDecimalPlaces(rightSeriesValues), [rightSeriesValues]);
  const rightAxisNumberFormatter = useMemo(() => createFixedNumberFormatter(rightAxisDecimalPlaces), [rightAxisDecimalPlaces]);

  const formatRightYAxisTick = useCallback((value: number): string => {
    return formatCompactAxisValue(value, rightYAxisPrefix, rightYAxisSuffix, rightAxisNumberFormatter);
  }, [rightAxisNumberFormatter, rightYAxisPrefix, rightYAxisSuffix]);

  const formatRightTooltipValue = useCallback((value: number): string => {
    const formatted = rightAxisNumberFormatter.format(value);
    return `${rightYAxisPrefix}${formatted}${rightYAxisSuffix}`;
  }, [rightAxisNumberFormatter, rightYAxisPrefix, rightYAxisSuffix]);

  const leftSeriesDomain = useMemo((): [number, number] | undefined => {
    if (!combo) return undefined;
    const leftNames = new Set(leftAxisSeriesNames);
    const values = data.series
      .filter((s) => leftNames.has(s.name))
      .flatMap((s) => s.data);
    const domain = getNumericDomainFromValues(values, { mode: config.yAxisBaselineMode ?? 'auto' });
    // Keep zero baseline for bar-like comparisons, but snap to human-friendly tick bounds.
    const lockZeroMin = (config.yAxisBaselineMode ?? 'auto') === 'zero' || ((config.yAxisBaselineMode ?? 'auto') === 'auto' && (domain?.[0] ?? 0) === 0);
    return toNiceDomain(domain, { lockZeroMin });
  }, [combo, data, config, leftAxisSeriesNames]);

  const rightSeriesDomain = useMemo((): [number, number] | undefined => {
    if (!combo) return undefined;
    const values = rightSeriesValues;
    if (values.length === 0) return undefined;
    const domain = getNumericDomainFromValues(values, { mode: config.yAxisBaselineMode ?? 'auto' });
    const lockZeroMin = (config.yAxisBaselineMode ?? 'auto') === 'zero' || ((config.yAxisBaselineMode ?? 'auto') === 'auto' && (domain?.[0] ?? 0) === 0);
    return toNiceDomain(domain, { lockZeroMin });
  }, [combo, rightSeriesValues, config.yAxisBaselineMode]);

  // Reverse right axis when all values are negative (e.g. decline %) so largest magnitude is at top
  const rightAxisReversed = useMemo(() => {
    if (!combo) return false;
    const values = rightSeriesValues;
    if (values.length === 0) return false;
    return values.every(v => typeof v === 'number' && v < 0);
  }, [combo, rightSeriesValues]);

  // Set of right-axis series names for tooltip formatting
  const rightAxisSeriesNames = useMemo(() => {
    if (!combo) return new Set<string>();
    return new Set(rightAxisSeriesList);
  }, [combo, rightAxisSeriesList]);

  const crowdedPointLabelOffsets = useMemo(() => {
    const offsets = new Map<string, number>();
    const lineLikeSeries = data.series
      .map((series) => {
        if (combo) {
          const resolved = resolveSeriesConfig(series.name, config);
          if (resolved.chartType !== 'line' && resolved.chartType !== 'area') return null;
          return { name: series.name, axis: resolved.axis as 'left' | 'right' };
        }
        if (config.type !== 'line' && config.type !== 'area') return null;
        return { name: series.name, axis: 'left' as const };
      })
      .filter((series): series is { name: string; axis: 'left' | 'right' } => series !== null);

    if (lineLikeSeries.length < 2) return offsets;

    const axisRanges = new Map<'left' | 'right', number>();
    (['left', 'right'] as const).forEach((axis) => {
      const axisValues = lineLikeSeries
        .filter((series) => series.axis === axis)
        .flatMap((series) => {
          const match = data.series.find((entry) => entry.name === series.name);
          if (!match) return [] as number[];
          return match.data.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
        });
      if (axisValues.length === 0) {
        axisRanges.set(axis, 0);
        return;
      }
      const min = Math.min(...axisValues);
      const max = Math.max(...axisValues);
      axisRanges.set(axis, Math.max(max - min, 0));
    });

    for (let index = 0; index < data.labels.length; index += 1) {
      (['left', 'right'] as const).forEach((axis) => {
        const points = lineLikeSeries
          .filter((series) => series.axis === axis)
          .map((series) => {
            const match = data.series.find((entry) => entry.name === series.name);
            const raw = match?.data[index];
            if (typeof raw !== 'number' || !Number.isFinite(raw)) return null;
            return { name: series.name, value: raw };
          })
          .filter((point): point is { name: string; value: number } => point !== null);

        if (points.length < 2) return;

        const sorted = [...points].sort((a, b) => b.value - a.value);
        const axisRange = axisRanges.get(axis) ?? 0;
        const crowdedThreshold = Math.max(axisRange * 0.06, 1);

        sorted.forEach((point, rank) => {
          const nearestGap = Math.min(
            ...sorted
              .filter((candidate) => candidate.name !== point.name)
              .map((candidate) => Math.abs(candidate.value - point.value)),
          );

          if (!Number.isFinite(nearestGap) || nearestGap > crowdedThreshold) return;

          const band = Math.floor(rank / 2);
          const isUpperSlot = rank % 2 === 0;
          const dy = isUpperSlot ? -(8 + band * 8) : (14 + band * 8);
          offsets.set(`${point.name}:${index}`, dy);
        });
      });
    }

    return offsets;
  }, [combo, config, data]);

  const renderSmartValueLabel = useCallback(
    (seriesName: string, formatter: (value: number) => string, pointLabels?: string[]) =>
      ({ x, y, value, index }: ValueLabelProps) => {
        const xNum = typeof x === 'number' ? x : Number(x);
        const yNum = typeof y === 'number' ? y : Number(y);
        const valueNum = typeof value === 'number' ? value : Number(value);
        const indexNum = typeof index === 'number' ? index : Number(index);
        if (!Number.isFinite(xNum) || !Number.isFinite(yNum)) return '';
        if (!Number.isFinite(valueNum) || !Number.isFinite(indexNum)) return '';

        const directLabelOffset = pointLabels
          ? [-8, -28, -48][indexNum % 3]
          : undefined;
        const dy = crowdedPointLabelOffsets.get(`${seriesName}:${indexNum}`) ?? directLabelOffset ?? -8;
        const textAnchor = pointLabels
          ? (indexNum === 0 ? 'start' : indexNum === pointLabels.length - 1 ? 'end' : 'middle')
          : 'middle';

        return (
          <text
            x={xNum}
            y={yNum + dy}
            textAnchor={textAnchor}
            dominantBaseline={dy > 0 ? 'hanging' : 'auto'}
            fill={theme.textMuted}
            fontSize={pointLabels ? 10 : 11}
            fontFamily="var(--font-mono)"
            pointerEvents="none"
          >
            {pointLabels?.[indexNum] || formatter(valueNum)}
          </text>
        );
      },
    [crowdedPointLabelOffsets, theme.textMuted],
  );

  // Format X-axis year ticks as integers (no decimals)
  const formatXAxisYearTick = useCallback((value: number): string => {
    return String(Math.round(value));
  }, []);

  const pointDetailColumn = useMemo(() => {
    const columns = data.categoricalColumns ?? [];
    return columns.find((column) => /^(player|winner|name)$/i.test(column.name.trim()))
      ?? columns.find((column) => column.data.some((value) => value.trim()))
      ?? null;
  }, [data.categoricalColumns]);
  const showPointDetailLabels = data.xAxisType === 'year' && pointDetailColumn !== null;

  const chartData = useMemo(() => {
    return data.labels.map((label, idx) => {
      const cleanLabel = effectiveLabels[idx] ?? label;
      const point: Record<string, string | number | null> = {
        name: cleanLabel,
        x: isNumericLabels ? parseFloat(cleanLabel) : idx,
      };
      data.series.forEach((series) => {
        point[series.name] = series.data[idx];
      });
      if (pointDetailColumn) {
        point[POINT_DETAIL_KEY] = pointDetailColumn.data[idx] ?? '';
      }
      return point;
    });
  }, [data, effectiveLabels, isNumericLabels, pointDetailColumn]);

  const isBarLike = config.type === 'bar' || config.type === 'histogram';
  const canStack = data.series.length > 1;

  const barValueAxisDomain = useMemo((): [number, number] | undefined => {
    if (!isBarLike) return undefined;
    const values = data.series.flatMap((series) => series.data);
    const domain = getNumericDomainFromValues(values, { mode: config.yAxisBaselineMode ?? 'auto' });
    const lockZeroMin = (config.yAxisBaselineMode ?? 'auto') === 'zero' || ((config.yAxisBaselineMode ?? 'auto') === 'auto' && (domain?.[0] ?? 0) === 0);
    return toNiceDomain(domain, { lockZeroMin });
  }, [config.yAxisBaselineMode, data.series, isBarLike]);

  // Calculate domain with padding for numeric axes
  const numericDomain = useMemo((): [number, number] | undefined => {
    if (!isNumericLabels) return undefined;
    const values = effectiveLabels.map(l => parseFloat(l));
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    const padding = Math.max(range * 0.1, 1); // 10% padding or at least 1
    return [min - padding, max + padding];
  }, [effectiveLabels, isNumericLabels]);

  const isHorizontal = config.type === 'bar' && config.barLayout === 'horizontal';
  const adaptiveAxis = useMemo(
    () => computeAdaptiveAxisConfig(effectiveLabels, isHorizontal),
    [effectiveLabels, isHorizontal],
  );
  const preferPreserveEndTicks = useMemo(() => {
    if (isYearLabels || data.xAxisType === 'date') return effectiveLabels.length >= 16;
    if (effectiveLabels.length < 16) return false;
    const dateLikeCount = effectiveLabels.filter(isLikelyDateLabel).length;
    return dateLikeCount / effectiveLabels.length >= 0.7;
  }, [effectiveLabels, data.xAxisType, isYearLabels]);

  const xAxisLabel = data.xAxisLabel
    ?? dataHints.suggestedXAxisLabel
    ?? (isYearLabels ? 'Year' : undefined)
    ?? (data.xAxisType === 'date' ? 'Date' : undefined);
  const yAxisLabel = data.yAxisLabel
    ?? (combo ? leftAxisSeriesNames[0] : undefined)
    ?? (data.series.length === 1 ? data.series[0].name : undefined);
  const hideAxisLabels = config.showAxisLabels === false;
  const hideAxisTitles = config.showAxisTitles === false;
  const xAxisLabelLayout = useMemo(
    () => computeCartesianXAxisLabelConfig(adaptiveAxis, xAxisLabel),
    [adaptiveAxis, xAxisLabel],
  );
  const horizontalCategoryAxis = useMemo(
    () => computeHorizontalCategoryAxisConfig(data.labels, xAxisLabel),
    [data.labels, xAxisLabel],
  );
  // Estimate the widest Y-axis tick string so axis width and font size
  // adapt to the actual data magnitude (e.g., "$15.2M" vs "5").
  const maxLeftTickStr = useMemo(() => {
    // For combo charts, use left series domain; for single-axis, use bar or general domain
    const domain = combo ? leftSeriesDomain : (isBarLike ? barValueAxisDomain : undefined);
    // If no explicit domain, estimate from raw data range
    if (!domain) {
      const vals = numericSeriesValues;
      if (vals.length === 0) return '0';
      return estimateMaxTickString(
        [Math.min(...vals), Math.max(...vals)],
        yAxisPrefix,
        yAxisSuffix,
        axisNumberFormatter,
      );
    }
    return estimateMaxTickString(domain, yAxisPrefix, yAxisSuffix, axisNumberFormatter);
  }, [combo, leftSeriesDomain, isBarLike, barValueAxisDomain, numericSeriesValues, yAxisPrefix, yAxisSuffix, axisNumberFormatter]);

  // Tick-width-aware value axis config for all vertical cartesian charts
  const valueAxisConfig = useMemo(
    () => computeValueAxisConfig(yAxisLabel, maxLeftTickStr),
    [yAxisLabel, maxLeftTickStr],
  );
  const sourceLinks = useMemo(() => {
    const links: Array<{ title: string; url: string }> = [];
    const seen = new Set<string>();
    const add = (title: string, url?: string) => {
      if (!url || seen.has(url)) return;
      seen.add(url);
      links.push({ title, url });
    };
    add('Primary source', config.sourceLink);
    data.sources?.forEach((source) => add(source.title, source.url));
    add('Primary source', data.sourceLink);
    return links;
  }, [config.sourceLink, data.sourceLink, data.sources]);
  const sourceDomain = useMemo(() => {
    const link = sourceLinks[0]?.url;
    if (!link) return null;
    try {
      return new URL(link).hostname.replace(/^www\./, '');
    } catch {
      return link;
    }
  }, [sourceLinks]);
  const verifiedLabel = sourceDomain
    ? `Verified real data source (${sourceDomain})`
    : 'Verified real data source';
  const showUnverifiedBadge = data.sourceType === 'prompt' && data.verifiedData !== true;
  const unverifiedLabel = 'Unverified AI-generated estimate. Verify with a trusted source before publishing as factual.';
  const lowConfidenceCount = useMemo(() => {
    let count = 0;
    data.series.forEach((series) => {
      series.confidence?.forEach((value) => {
        if (typeof value === 'number' && value < 0.5) count += 1;
      });
    });
    return count;
  }, [data.series]);
  const adaptiveBottom = adaptiveAxis.bottomMargin + xAxisLabelLayout.extraBottomMargin;
  // Right margin: ensure last X-axis tick doesn't clip.
  // For categorical axes the last label is centered, so half its width can overflow.
  const rightMarginBuffer = useMemo(() => {
    if (isHorizontal) return 30;
    if (combo) return rightYAxisLabel ? 14 : 8;
    const lastLabel = effectiveLabels[effectiveLabels.length - 1] ?? '';
    // Half the last label width (centered tick) + small padding
    return Math.max(8, Math.min(20, Math.ceil(lastLabel.length * 3.5) + 2));
  }, [isHorizontal, combo, rightYAxisLabel, effectiveLabels]);
  const chartMargins = isHorizontal
    ? {
        top: 20,
        right: rightMarginBuffer,
        bottom: yAxisLabel ? 25 : 5,
        left: horizontalCategoryAxis.leftMargin + (horizontalCategoryAxis.preferOutsideLabel ? 16 : 0),
      }
    : {
        top: 20,
        right: rightMarginBuffer,
        bottom: adaptiveBottom,
        left: valueAxisConfig.leftMargin,
      };

  const pieData = useMemo(() => {
    if (config.type !== 'pie') return [];
    return data.series[0].data
      .map((value, idx) => ({
        name: data.labels[idx],
        value,
      }))
      .filter((point): point is { name: string; value: number } => typeof point.value === 'number');
  }, [data, config.type]);

  const radarData = useMemo(() => {
    if (config.type !== 'radar') return [];
    return data.labels.map((label, idx) => {
      const point: Record<string, string | number | null> = { subject: label };
      data.series.forEach((series) => {
        point[series.name] = series.data[idx];
      });
      return point;
    });
  }, [data, config.type]);

  const gridStrokeDasharray = useMemo(() => {
    switch (styleConfig.chart.gridStyle) {
      case 'solid': return '0';
      case 'dashed': return '3 3';
      case 'dotted': return '1 3';
      case 'none': return '3 3'; // Fall back to dashed when style says none but user enabled grid
      default: return '3 3';
    }
  }, [styleConfig.chart.gridStyle]);

  const renderInfographic = () => {
    // Show placeholder if user hasn't clicked Generate yet
    if (!config.aiReadyToGenerate && !infographicSvg && !infographicLoading) {
      return (
        <div className="infographic-placeholder">
          <div className="infographic-placeholder-content">
            <Sparkles size={32} className="infographic-placeholder-icon" />
            <h3>AI Magic</h3>
            <p>Select a generation mode and click Generate to create your visualization.</p>
          </div>
        </div>
      );
    }

    if (infographicLoading) {
      return (
        <div className="infographic-loading">
          <AIProcessingIndicator
            size="lg"
            label="Creating your infographic..."
            hint="This may take a few seconds"
            statusMessages={[
              'Designing layout...',
              'Generating visual elements...',
              'Applying color scheme...',
              'Adding finishing touches...',
              'Rendering final output...',
            ]}
          />
        </div>
      );
    }

    if (infographicError) {
      return (
        <div className="infographic-error">
          <span>{infographicError}</span>
          <Button size="sm" onClick={regenerateInfographic}>
            <RefreshCw size={16} />
            Try Again
          </Button>
        </div>
      );
    }

    if (infographicSvg) {
      return (
        <div className="infographic-container">
          <div
            className="infographic-svg"
            dangerouslySetInnerHTML={{ __html: infographicSvg }}
          />
          <Button size="sm" className="regenerate-button" onClick={regenerateInfographic}>
            <RefreshCw size={14} />
            Regenerate
          </Button>
        </div>
      );
    }

    return null;
  };

  const renderGradientDefs = () => {
    if (!styleConfig.decorations.useGradients) return null;

    return (
      <defs>
        {gradients.slice(0, data.series.length).map(([start, end], idx) => (
          <linearGradient key={idx} id={`gradient-${idx}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={start} stopOpacity={1} />
            <stop offset="100%" stopColor={end} stopOpacity={0.8} />
          </linearGradient>
        ))}
      </defs>
    );
  };

  const renderChart = () => {
    const commonProps = {
      data: chartData,
      margin: chartMargins,
    };

    const gridElement = (
      <CartesianGrid
        strokeDasharray={gridStrokeDasharray}
        stroke={theme.grid}
        strokeOpacity={config.showGrid ? theme.gridOpacity : 0}
        className="chart-grid"
      />
    );

    const xAxisLabelConfig = xAxisLabel && !hideAxisTitles ? {
      value: xAxisLabel,
      position: 'insideBottom' as const,
      offset: xAxisLabelLayout.offset,
      fill: theme.textMuted,
      fontSize: 11,
      fontFamily: 'var(--font-mono)',
    } : undefined;

    // For year labels, treat as categorical to avoid decimal interpolation (2020.3)
    // For other numeric labels, use continuous numeric axis
    const adaptiveTick = adaptiveAxis.needsCustomTick
      ? <AdaptiveXAxisTick fill={theme.textMuted} config={adaptiveAxis} />
      : undefined;
    // Year labels are always 4 chars — they fit comfortably even at high density.
    // Use an explicit numeric interval instead of Recharts' auto-hide modes
    // ('preserveEnd'/'preserveStartEnd') which over-aggressively drop labels.
    const categoricalInterval: number | 'preserveEnd' | 'preserveStartEnd' =
      isYearLabels
        ? (adaptiveAxis.tickInterval ?? 0)
        : adaptiveAxis.tickInterval !== undefined
          ? (preferPreserveEndTicks ? 'preserveEnd' : adaptiveAxis.tickInterval)
          : (preferPreserveEndTicks ? 'preserveEnd' : 'preserveStartEnd');

    const xAxisElement = isYearLabels ? (
      <XAxis
        dataKey="name"
        stroke={theme.textMuted}
        tick={hideAxisLabels ? false : (adaptiveTick ?? { fill: theme.textMuted, fontSize: adaptiveAxis.fontSize })}
        tickLine={hideAxisLabels ? false : { stroke: theme.textMuted }}
        axisLine={{ stroke: theme.border, strokeOpacity: 0.5 }}
        padding={{ left: 12, right: 4 }}
        interval={categoricalInterval}
        label={xAxisLabelConfig}
      />
    ) : isNumericLabels ? (
      <XAxis
        type="number"
        dataKey="x"
        domain={numericDomain}
        stroke={theme.textMuted}
        tick={hideAxisLabels ? false : { fill: theme.textMuted, fontSize: adaptiveAxis.fontSize }}
        tickLine={hideAxisLabels ? false : { stroke: theme.textMuted }}
        axisLine={{ stroke: theme.border, strokeOpacity: 0.5 }}
        allowDecimals={false}
        tickFormatter={formatXAxisYearTick}
        label={xAxisLabelConfig}
      />
    ) : (
      <XAxis
        dataKey="name"
        stroke={theme.textMuted}
        tick={hideAxisLabels ? false : (adaptiveTick ?? { fill: theme.textMuted, fontSize: adaptiveAxis.fontSize })}
        tickLine={hideAxisLabels ? false : { stroke: theme.textMuted }}
        axisLine={{ stroke: theme.border, strokeOpacity: 0.5 }}
        padding={{ left: 12, right: 4 }}
        interval={categoricalInterval}
        label={xAxisLabelConfig}
      />
    );

    // Y-axis label config — uses tick-width-aware valueAxisConfig for all chart types.
    // dy=0 lets Recharts handle vertical centering for rotated labels (the old
    // label-length-based dy heuristic produced inconsistent positioning).
    const preferOutsideYLabel = valueAxisConfig.preferOutsideLabel;
    const yAxisLabelConfig = yAxisLabel && !hideAxisTitles ? {
      value: yAxisLabel,
      angle: -90,
      position: (preferOutsideYLabel ? 'left' as const : 'insideLeft' as const),
      offset: valueAxisConfig.labelOffset,
      dy: 0,
      fill: theme.textMuted,
      fontSize: 11,
      fontFamily: 'var(--font-mono)',
    } : undefined;

    const yAxisElement = (
      <YAxis
        width={valueAxisConfig.axisWidth}
        stroke={theme.textMuted}
        tick={hideAxisLabels ? false : { fill: theme.textMuted, fontSize: valueAxisConfig.tickFontSize }}
        tickLine={hideAxisLabels ? false : { stroke: theme.textMuted }}
        axisLine={{ stroke: theme.border, strokeOpacity: 0.5 }}
        domain={!isHorizontal && isBarLike ? barValueAxisDomain : undefined}
        tickFormatter={formatYAxisTick}
        label={yAxisLabelConfig}
      />
    );

    // Horizontal bar axes: X = numeric (values), Y = category (labels)
    const horizontalXAxis = (
      <XAxis
        type="number"
        domain={isHorizontal && isBarLike ? barValueAxisDomain : undefined}
        stroke={theme.textMuted}
        tick={hideAxisLabels ? false : { fill: theme.textMuted, fontSize: valueAxisConfig.tickFontSize }}
        tickLine={hideAxisLabels ? false : { stroke: theme.textMuted }}
        axisLine={{ stroke: theme.border, strokeOpacity: 0.5 }}
        tickFormatter={formatYAxisTick}
        label={yAxisLabel && !hideAxisTitles ? {
          value: yAxisLabel,
          position: 'insideBottom' as const,
          offset: -10,
          fill: theme.textMuted,
          fontSize: 11,
          fontFamily: 'var(--font-mono)',
        } : undefined}
      />
    );

    const horizontalYAxis = (
      <YAxis
        type="category"
        dataKey="name"
        width={horizontalCategoryAxis.axisWidth}
        stroke={theme.textMuted}
        tick={hideAxisLabels ? false :
          <AdaptiveYAxisCategoryTick
            fill={theme.textMuted}
            fontSize={horizontalCategoryAxis.fontSize}
            maxTickLength={horizontalCategoryAxis.maxTickLength}
          />
        }
        tickLine={hideAxisLabels ? false : { stroke: theme.textMuted }}
        axisLine={{ stroke: theme.border, strokeOpacity: 0.5 }}
        label={xAxisLabel && !hideAxisTitles ? {
          value: xAxisLabel,
          angle: -90,
          position: horizontalCategoryAxis.preferOutsideLabel ? 'left' : 'insideLeft',
          offset: horizontalCategoryAxis.labelOffset,
          fill: theme.textMuted,
          fontSize: 11,
          fontFamily: 'var(--font-mono)',
        } : undefined}
      />
    );

    const tooltipElement = (
      <Tooltip
        contentStyle={{
          background: theme.cardBackground,
          border: `1px solid ${theme.border}`,
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-card)',
        }}
        labelStyle={{ color: theme.text, fontWeight: 600 }}
        itemStyle={{ color: theme.textMuted }}
        labelFormatter={(label, payload) => {
          const detail = payload?.[0]?.payload?.[POINT_DETAIL_KEY];
          return typeof detail === 'string' && detail ? `${label} · ${detail}` : label;
        }}
        formatter={(value) => typeof value === 'number' ? [formatTooltipValue(value), undefined] : value}
      />
    );

    const legendElement = config.showLegend ? (
      <Legend
        verticalAlign="top"
        wrapperStyle={{
          paddingBottom: 16,
        }}
        formatter={(value) => (
          <span style={{ color: theme.textMuted, fontSize: '0.8rem' }}>{value}</span>
        )}
      />
    ) : null;

    const getBarFill = (idx: number) => {
      if (styleConfig.decorations.useGradients && !config.customColors?.seriesColors) {
        return `url(#gradient-${idx})`;
      }
      return colors[idx % colors.length];
    };

    // --- Combo chart (dual-axis, mixed series types) ---
    if (combo) {
      const maxRightTickStr = estimateMaxTickString(
        rightSeriesDomain,
        rightYAxisPrefix,
        rightYAxisSuffix,
        rightAxisNumberFormatter,
      );
      const rightAxisConfig = computeValueAxisConfig(rightYAxisLabel, maxRightTickStr);
      const rightYAxisLabelConfig = rightYAxisLabel && !hideAxisTitles ? {
        value: rightYAxisLabel,
        angle: 90,
        position: 'insideRight' as const,
        offset: Math.max(6, Math.min(14, Math.round(rightAxisConfig.axisWidth * 0.12) + 2)),
        fill: theme.textMuted,
        fontSize: 11,
        fontFamily: 'var(--font-mono)',
      } : undefined;

      const comboTooltip = (
        <Tooltip
          contentStyle={{
            background: theme.cardBackground,
            border: `1px solid ${theme.border}`,
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-card)',
          }}
          labelStyle={{ color: theme.text, fontWeight: 600 }}
          itemStyle={{ color: theme.textMuted }}
          formatter={(value, name) => {
            if (typeof value !== 'number') return value;
            const formatted = typeof name === 'string' && rightAxisSeriesNames.has(name)
              ? formatRightTooltipValue(value)
              : formatTooltipValue(value);
            return [formatted, undefined];
          }}
        />
      );

      return (
        <ComposedChart {...commonProps}>
          {renderGradientDefs()}
          {gridElement}
          {xAxisElement}
          <YAxis
            yAxisId="left"
            width={valueAxisConfig.axisWidth}
            stroke={theme.textMuted}
            tick={hideAxisLabels ? false : { fill: theme.textMuted, fontSize: valueAxisConfig.tickFontSize }}
            tickLine={hideAxisLabels ? false : { stroke: theme.textMuted }}
            axisLine={{ stroke: theme.border, strokeOpacity: 0.5 }}
            domain={leftSeriesDomain}
            tickFormatter={formatYAxisTick}
            label={yAxisLabelConfig}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            width={rightAxisConfig.axisWidth}
            stroke={theme.textMuted}
            tick={hideAxisLabels ? false : { fill: theme.textMuted, fontSize: rightAxisConfig.tickFontSize }}
            tickLine={hideAxisLabels ? false : { stroke: theme.textMuted }}
            axisLine={{ stroke: theme.border, strokeOpacity: 0.5 }}
            domain={rightSeriesDomain}
            reversed={rightAxisReversed}
            tickFormatter={formatRightYAxisTick}
            label={rightYAxisLabelConfig}
          />
          {comboTooltip}
          {legendElement}
          {data.series.map((series, idx) => {
            const resolved = resolveSeriesConfig(series.name, config);
            const yAxisId = resolved.axis;
            const stackId = config.stacked && resolved.chartType === 'bar'
              ? `stack-${resolved.axis}`
              : undefined;
            const color = colors[idx % colors.length];

            switch (resolved.chartType) {
              case 'bar':
                return (
                  <Bar
                    key={series.name}
                    yAxisId={yAxisId}
                    dataKey={series.name}
                    fill={getBarFill(idx)}
                    radius={styleConfig.chart.barRadius}
                    animationDuration={config.animate ? 800 : 0}
                    animationBegin={idx * 100}
                    stackId={stackId}
                  >
                    {config.showValues && (
                      <LabelList
                        dataKey={series.name}
                        position="top"
                        fill={theme.textMuted}
                        fontSize={11}
                        formatter={(value) =>
                          typeof value === 'number'
                            ? (resolved.axis === 'right' ? formatRightYAxisTick(value) : formatYAxisTick(value))
                            : value
                        }
                      />
                    )}
                  </Bar>
                );
              case 'line':
                return (
                  <Line
                    key={series.name}
                    yAxisId={yAxisId}
                    type="monotone"
                    dataKey={series.name}
                    stroke={color}
                    strokeWidth={styleConfig.chart.strokeWidth}
                    dot={config.showPoints && styleConfig.chart.dotRadius > 0 ? {
                      fill: color,
                      strokeWidth: 0,
                      r: styleConfig.chart.dotRadius,
                    } : false}
                    activeDot={config.showPoints ? {
                      r: styleConfig.chart.activeDotRadius,
                      stroke: color,
                      strokeWidth: 2,
                      fill: theme.background,
                    } : false}
                    animationDuration={config.animate ? 1200 : 0}
                    animationBegin={idx * 200}
                  >
                    {config.showValues && (
                      <LabelList
                        dataKey={series.name}
                        content={renderSmartValueLabel(
                          series.name,
                          resolved.axis === 'right' ? formatRightYAxisTick : formatYAxisTick,
                        )}
                      />
                    )}
                  </Line>
                );
              case 'area':
                return (
                  <Area
                    key={series.name}
                    yAxisId={yAxisId}
                    type="monotone"
                    dataKey={series.name}
                    stroke={color}
                    fill={styleConfig.decorations.useGradients && !config.customColors?.seriesColors ? `url(#gradient-${idx})` : color}
                    fillOpacity={styleConfig.decorations.useGradients ? 0.6 : 0.3}
                    strokeWidth={styleConfig.chart.strokeWidth}
                    dot={config.showPoints && styleConfig.chart.dotRadius > 0 ? {
                      fill: color,
                      strokeWidth: 0,
                      r: styleConfig.chart.dotRadius,
                    } : false}
                    activeDot={config.showPoints ? {
                      r: styleConfig.chart.activeDotRadius,
                      stroke: color,
                      strokeWidth: 2,
                      fill: theme.background,
                    } : false}
                    animationDuration={config.animate ? 1000 : 0}
                    animationBegin={idx * 150}
                  >
                    {config.showValues && (
                      <LabelList
                        dataKey={series.name}
                        content={renderSmartValueLabel(
                          series.name,
                          resolved.axis === 'right' ? formatRightYAxisTick : formatYAxisTick,
                        )}
                      />
                    )}
                  </Area>
                );
              default:
                return null;
            }
          })}
        </ComposedChart>
      );
    }

    switch (config.type) {
      case 'infographic':
      case 'map':
        return null;

      case 'bar':
        return (
          <BarChart {...commonProps} {...(isHorizontal ? { layout: 'vertical' as const } : {})}>
            {renderGradientDefs()}
            {gridElement}
            {isHorizontal ? horizontalXAxis : xAxisElement}
            {isHorizontal ? horizontalYAxis : yAxisElement}
            {tooltipElement}
            {legendElement}
            {data.series.map((series, idx) => (
              <Bar
                key={series.name}
                dataKey={series.name}
                fill={getBarFill(idx)}
                radius={styleConfig.chart.barRadius}
                animationDuration={config.animate ? 800 : 0}
                animationBegin={idx * 100}
                {...(config.stacked && canStack ? { stackId: 'stack' } : {})}
              >
                {config.showValues && (
                  showPointDetailLabels ? (
                    <LabelList
                      dataKey={POINT_DETAIL_KEY}
                      position={isHorizontal ? 'right' : 'top'}
                      fill={theme.textMuted}
                      fontSize={10}
                    />
                  ) : (
                    <LabelList
                      dataKey={series.name}
                      position={isHorizontal ? 'right' : 'top'}
                      fill={theme.textMuted}
                      fontSize={11}
                      formatter={(value) => typeof value === 'number' ? formatYAxisTick(value) : value}
                    />
                  )
                )}
              </Bar>
            ))}
          </BarChart>
        );

      case 'histogram':
        return (
          <BarChart {...commonProps} barGap={0} barCategoryGap={0}>
            {renderGradientDefs()}
            {gridElement}
            {xAxisElement}
            {yAxisElement}
            {tooltipElement}
            {legendElement}
            {data.series.map((series, idx) => (
              <Bar
                key={series.name}
                dataKey={series.name}
                fill={getBarFill(idx)}
                radius={0}
                animationDuration={config.animate ? 800 : 0}
                animationBegin={idx * 100}
                {...(config.stacked && canStack ? { stackId: 'stack' } : {})}
              >
                {config.showValues && (
                  <LabelList
                    dataKey={series.name}
                    position="top"
                    fill={theme.textMuted}
                    fontSize={11}
                    formatter={(value) => typeof value === 'number' ? formatYAxisTick(value) : value}
                  />
                )}
              </Bar>
            ))}
          </BarChart>
        );

      case 'line':
        return (
          <LineChart {...commonProps}>
            {renderGradientDefs()}
            {gridElement}
            {xAxisElement}
            {yAxisElement}
            {tooltipElement}
            {legendElement}
            {data.series.map((series, idx) => (
              <Line
                key={series.name}
                type="monotone"
                dataKey={series.name}
                stroke={colors[idx % colors.length]}
                strokeWidth={styleConfig.chart.strokeWidth}
                dot={config.showPoints && styleConfig.chart.dotRadius > 0 ? {
                  fill: colors[idx % colors.length],
                  strokeWidth: 0,
                  r: styleConfig.chart.dotRadius
                } : false}
                activeDot={config.showPoints ? {
                  r: styleConfig.chart.activeDotRadius,
                  stroke: colors[idx % colors.length],
                  strokeWidth: 2,
                  fill: theme.background
                } : false}
                animationDuration={config.animate ? 1200 : 0}
                animationBegin={idx * 200}
              >
                {config.showValues && (
                  <LabelList
                    dataKey={series.name}
                    content={renderSmartValueLabel(
                      series.name,
                      formatYAxisTick,
                      showPointDetailLabels ? pointDetailColumn?.data : undefined,
                    )}
                  />
                )}
              </Line>
            ))}
          </LineChart>
        );

      case 'area':
        return (
          <AreaChart {...commonProps}>
            {renderGradientDefs()}
            {gridElement}
            {xAxisElement}
            {yAxisElement}
            {tooltipElement}
            {legendElement}
            {data.series.map((series, idx) => (
              <Area
                key={series.name}
                type="monotone"
                dataKey={series.name}
                stroke={colors[idx % colors.length]}
                fill={styleConfig.decorations.useGradients && !config.customColors?.seriesColors ? `url(#gradient-${idx})` : colors[idx % colors.length]}
                fillOpacity={styleConfig.decorations.useGradients ? 0.6 : 0.3}
                strokeWidth={styleConfig.chart.strokeWidth}
                dot={config.showPoints && styleConfig.chart.dotRadius > 0 ? {
                  fill: colors[idx % colors.length],
                  strokeWidth: 0,
                  r: styleConfig.chart.dotRadius
                } : false}
                activeDot={config.showPoints ? {
                  r: styleConfig.chart.activeDotRadius,
                  stroke: colors[idx % colors.length],
                  strokeWidth: 2,
                  fill: theme.background
                } : false}
                animationDuration={config.animate ? 1000 : 0}
                animationBegin={idx * 150}
              >
                {config.showValues && (
                  <LabelList
                    dataKey={series.name}
                    content={renderSmartValueLabel(
                      series.name,
                      formatYAxisTick,
                      showPointDetailLabels ? pointDetailColumn?.data : undefined,
                    )}
                  />
                )}
              </Area>
            ))}
          </AreaChart>
        );

      case 'pie':
        return (
          <PieChart>
            {renderGradientDefs()}
            {tooltipElement}
            {legendElement}
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={120}
              paddingAngle={styleConfig.id === 'playful' ? 4 : 2}
              dataKey="value"
              animationDuration={config.animate ? 1000 : 0}
              label={config.showValues ? ({ name, percent }: { name?: string; percent?: number }) => `${name ?? ''} (${((percent ?? 0) * 100).toFixed(0)}%)` : false}
              labelLine={config.showValues}
            >
              {pieData.map((_, idx) => (
                <Cell
                  key={`cell-${idx}`}
                  fill={styleConfig.decorations.useGradients && !config.customColors?.seriesColors ? `url(#gradient-${idx})` : colors[idx % colors.length]}
                />
              ))}
            </Pie>
          </PieChart>
        );

      case 'radar':
        return (
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
            <PolarGrid stroke={theme.grid} strokeOpacity={theme.gridOpacity * 2} />
            <PolarAngleAxis
              dataKey="subject"
              tick={hideAxisLabels ? false : { fill: theme.textMuted, fontSize: 12 }}
            />
            {tooltipElement}
            {legendElement}
            {data.series.map((series, idx) => (
              <Radar
                key={series.name}
                name={series.name}
                dataKey={series.name}
                stroke={colors[idx % colors.length]}
                fill={colors[idx % colors.length]}
                fillOpacity={0.3}
                strokeWidth={styleConfig.chart.strokeWidth}
                animationDuration={config.animate ? 800 : 0}
              />
            ))}
          </RadarChart>
        );

      case 'scatter':
        return (
          <ScatterChart>
            {gridElement}
            {xAxisElement}
            {yAxisElement}
            {tooltipElement}
            {legendElement}
            {data.series.map((series, idx) => (
              <Scatter
                key={series.name}
                name={series.name}
                data={series.data
                  .map((value, i) => ({ x: i + 1, y: value, name: data.labels[i] }))
                  .filter((point): point is { x: number; y: number; name: string } => typeof point.y === 'number')}
                fill={colors[idx % colors.length]}
                animationDuration={config.animate ? 800 : 0}
              />
            ))}
          </ScatterChart>
        );

      default:
        return null;
    }
  };

  const isTableView = config.type === 'table';
  const previewClassName = `chart-preview ${isTableView ? 'chart-preview--table' : ''} ${styleConfig.decorations.useGlow ? 'chart-preview--glow' : ''} ${styleConfig.decorations.useShadows ? 'chart-preview--shadow' : ''}`;

  return (
    <motion.div
      className={previewClassName}
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      data-style-variant={config.styleVariant}
      data-theme-mode={config.themeMode}
      style={{
        background: theme.background,
        borderColor: theme.border,
      }}
    >
      <div className="chart-header" style={{
        background: theme.cardBackground,
        borderColor: theme.border,
      }}>
        <div className="chart-header-top">
          {config.title ? (
            <h2 className="chart-title" style={{ color: theme.text }}>{config.title}</h2>
          ) : (
            <h2 className="chart-title-placeholder" style={{ color: theme.textMuted }}>Your Chart</h2>
          )}
          <div className="chart-brand-area">
            {watermark?.enabled !== false && (
              <div className="chart-brand" style={{ color: theme.textMuted }}>
                {watermark?.customLogoUrl ? (
                  <img src={watermark.customLogoUrl} alt="Selected logo" className="chart-brand-logo" />
                ) : (
                  <>
                    <Sparkles size={12} />
                    <span>Chartsuno</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="chart-meta">
          <span className="chart-meta-item">
            <span className="meta-label" style={{ color: theme.textMuted }}>Source:</span>
            <span className="meta-value" style={{ color: theme.text }}>{data.sourceType.toUpperCase()}</span>
          </span>
          {data.verifiedData && (
            <span
              className="chart-meta-item chart-meta-item--verified"
              style={{ borderColor: theme.border, color: theme.text }}
              aria-label={verifiedLabel}
              title={verifiedLabel}
            >
              <Check size={12} />
              <span>Verified</span>
            </span>
          )}
          {showUnverifiedBadge && (
            <span
              className="chart-meta-item chart-meta-item--unverified"
              aria-label={unverifiedLabel}
              title={unverifiedLabel}
            >
              <span>Unverified</span>
            </span>
          )}
          <span className="chart-meta-item">
            <span className="meta-label" style={{ color: theme.textMuted }}>Points:</span>
            <span className="meta-value" style={{ color: theme.text }}>{data.labels.length}</span>
          </span>
          <span className="chart-meta-item">
            <span className="meta-label" style={{ color: theme.textMuted }}>Series:</span>
            <span className="meta-value" style={{ color: theme.text }}>{data.series.length}</span>
          </span>
          {lowConfidenceCount > 0 && (
            <span
              className="chart-meta-item"
              style={{ borderColor: theme.border, color: theme.text }}
              title="AI flagged these points as uncertain; verify in the data editor."
              aria-label={`${lowConfidenceCount} low-confidence points`}
            >
              <span className="meta-label" style={{ color: theme.textMuted }}>Low conf:</span>
              <span className="meta-value" style={{ color: theme.text }}>{lowConfidenceCount}</span>
            </span>
          )}
        </div>
      </div>

      <div
        className={`chart-container ${isTableView ? 'chart-container--scroll' : 'chart-container--no-scroll'}`}
        style={{ background: theme.background }}
      >
        {config.type === 'infographic' ? (
          renderInfographic()
        ) : config.type === 'map' ? (
          <MapChart data={data} config={config} theme={theme} colors={colors} />
        ) : isTableView ? (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="table-header-cell sticky-col" style={{ color: theme.textMuted, background: theme.cardBackground }}>{data.xAxisLabel || 'Label'}</th>
                  {data.categoricalColumns?.map((column) => (
                    <th key={column.name} className="table-header-cell" style={{ color: theme.textMuted, background: theme.cardBackground }}>
                      {column.name}
                    </th>
                  ))}
                  {data.series.map((series, idx) => (
                    <th key={series.name} className="table-header-cell" style={{ color: theme.textMuted, background: theme.cardBackground }}>
                      <span className="series-indicator" style={{ display: 'inline-block', background: colors[idx % colors.length] }} />
                      {' '}{series.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.labels.map((label, rowIdx) => (
                  <tr key={label}>
                    <td className="table-cell sticky-col" style={{ color: theme.text, background: theme.background, fontWeight: 500 }}>{label}</td>
                    {data.categoricalColumns?.map((column) => (
                      <td key={column.name} className="table-cell" style={{ color: theme.textMuted, borderColor: theme.border }}>
                        {column.data[rowIdx] || '—'}
                      </td>
                    ))}
                    {data.series.map((series) => {
                      const value = series.data[rowIdx];
                      const confidence = series.confidence?.[rowIdx];
                      const isLowConfidence = typeof confidence === 'number' && confidence < 0.5;
                      return (
                        <td
                          key={series.name}
                          className={`table-cell ${isLowConfidence ? 'table-cell--low-confidence' : ''}`}
                          style={{ color: theme.textMuted, borderColor: theme.border }}
                        >
                          <span className="table-cell-value">
                            {typeof value === 'number' ? formatTooltipValue(value) : 'N/A'}
                            {isLowConfidence && (
                              <span
                                className="low-confidence-dot"
                                aria-label="Low-confidence value"
                                title={`Low confidence${typeof confidence === 'number' ? ` (${Math.round(confidence * 100)}%)` : ''}`}
                              />
                            )}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <SafeResponsiveContainer minWidth={0} minHeight={200}>
            {renderChart()}
          </SafeResponsiveContainer>
        )}
      </div>

      {sourceLinks.length > 0 && (
        <div className="chart-source" style={{ borderColor: theme.border }}>
          <span className="chart-source-label" style={{ color: theme.textMuted }}>
            {sourceLinks.length === 1 ? 'Source:' : 'Sources:'}
          </span>
          <span className="chart-source-list">
            {sourceLinks.map((source) => (
              <a
                key={source.url}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="chart-source-link"
                style={{ color: theme.textMuted }}
                title={source.title}
              >
                <span className="chart-source-domain">{(() => {
                  try { return new URL(source.url).hostname.replace(/^www\./, ''); }
                  catch { return source.title; }
                })()}</span>
                <ExternalLink size={10} />
              </a>
            ))}
          </span>
        </div>
      )}

      {config.type !== 'infographic' && config.type !== 'table' && config.type !== 'map' && (
        <div className="chart-color-bar">
          {colors.slice(0, data.series.length).map((color, idx) => (
            <div
              key={idx}
              className="color-segment"
              style={{ background: styleConfig.decorations.useGradients && !config.customColors?.seriesColors ? `linear-gradient(90deg, ${gradients[idx % gradients.length][0]}, ${gradients[idx % gradients.length][1]})` : color }}
            />
          ))}
        </div>
      )}

    </motion.div>
  );
}
