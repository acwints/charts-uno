import { useMemo, useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
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
import Eye from 'lucide-react/dist/esm/icons/eye';
import EyeOff from 'lucide-react/dist/esm/icons/eye-off';
import Check from 'lucide-react/dist/esm/icons/check';
import type { ChartData, ChartConfig, ColorTheme } from '../types';
import type { WatermarkSettings } from '../services/exportService';
import { COLOR_GRADIENTS, STYLE_VARIANTS, getTheme, applyCustomColors, getEffectiveColors, getNumericDomainFromValues } from '../types';
import { generateInfographic } from '../services/infographicGenerator';
import { useChartStore } from '../stores/chartStore';
import { computeAdaptiveAxisConfig, computeHorizontalCategoryAxisConfig } from '../utils/adaptiveAxis';
import { createFixedNumberFormatter, getAdaptiveDecimalPlaces } from '../utils/numberFormat';
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
  canToggleLogo?: boolean;
  onToggleLogo?: () => void;
}

export function ChartPreview({ data, config, watermark, canToggleLogo, onToggleLogo }: ChartPreviewProps) {
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

  // Check if all labels can be parsed as numbers
  const isNumericLabels = useMemo(() => {
    return data.labels.length > 0 &&
      data.labels.every(label => !isNaN(parseFloat(label)) && isFinite(Number(label)));
  }, [data.labels]);

  // Detect if labels are years (4-digit integers like 1999, 2000, 2023)
  const isYearLabels = useMemo(() => {
    // Explicit type hint takes precedence
    if (data.xAxisType === 'year') return true;
    if (data.xAxisType === 'date' || data.xAxisType === 'category' || data.xAxisType === 'number') return false;
    // Auto-detect: all labels are 4-digit years in reasonable range
    return data.labels.length > 0 &&
      data.labels.every(label => {
        const trimmed = label.trim();
        if (!/^\d{4}$/.test(trimmed)) return false;
        const year = parseInt(trimmed, 10);
        return year >= 1800 && year <= 2100;
      });
  }, [data.labels, data.xAxisType]);

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

  // Format Y-axis tick values with compact notation for large numbers
  const formatYAxisTick = useCallback((value: number): string => {
    const absValue = Math.abs(value);
    let formatted: string;

    if (absValue >= 1_000_000_000) {
      formatted = `${(value / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`;
    } else if (absValue >= 1_000_000) {
      formatted = `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
    } else if (absValue >= 10_000) {
      formatted = `${(value / 1_000).toFixed(0)}K`;
    } else if (absValue >= 1_000) {
      formatted = `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
    } else {
      formatted = axisNumberFormatter.format(value);
    }

    return `${yAxisPrefix}${formatted}${yAxisSuffix}`;
  }, [axisNumberFormatter, yAxisPrefix, yAxisSuffix]);

  // Match tooltip precision with axis/data labels so values stay consistent across views.
  const formatTooltipValue = useCallback((value: number): string => {
    const formatted = axisNumberFormatter.format(value);
    return `${yAxisPrefix}${formatted}${yAxisSuffix}`;
  }, [axisNumberFormatter, yAxisPrefix, yAxisSuffix]);

  // Format X-axis year ticks as integers (no decimals)
  const formatXAxisYearTick = useCallback((value: number): string => {
    return String(Math.round(value));
  }, []);

  const chartData = useMemo(() => {
    return data.labels.map((label, idx) => {
      const point: Record<string, string | number | null> = {
        name: label,
        x: isNumericLabels ? parseFloat(label) : idx,
      };
      data.series.forEach((series) => {
        point[series.name] = series.data[idx];
      });
      return point;
    });
  }, [data, isNumericLabels]);

  const isBarLike = config.type === 'bar' || config.type === 'histogram';
  const canStack = data.series.length > 1;

  const barValueAxisDomain = useMemo((): [number, number] | undefined => {
    if (!isBarLike) return undefined;
    const values = data.series.flatMap((series) => series.data);
    return getNumericDomainFromValues(values, { mode: config.yAxisBaselineMode ?? 'auto' });
  }, [config.yAxisBaselineMode, data.series, isBarLike]);

  // Calculate domain with padding for numeric axes
  const numericDomain = useMemo((): [number, number] | undefined => {
    if (!isNumericLabels) return undefined;
    const values = data.labels.map(l => parseFloat(l));
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    const padding = Math.max(range * 0.1, 1); // 10% padding or at least 1
    return [min - padding, max + padding];
  }, [data.labels, isNumericLabels]);

  const isHorizontal = config.type === 'bar' && config.barLayout === 'horizontal';

  const adaptiveAxis = useMemo(
    () => computeAdaptiveAxisConfig(data.labels, isHorizontal),
    [data.labels, isHorizontal],
  );

  const xAxisLabel = data.xAxisLabel;
  const yAxisLabel = data.yAxisLabel ?? (data.series.length === 1 ? data.series[0].name : undefined);
  const horizontalCategoryAxis = useMemo(
    () => computeHorizontalCategoryAxisConfig(data.labels, xAxisLabel),
    [data.labels, xAxisLabel],
  );
  const sourceDomain = useMemo(() => {
    const link = config.sourceLink || data.sourceLink;
    if (!link) return null;
    try {
      return new URL(link).hostname.replace(/^www\./, '');
    } catch {
      return link;
    }
  }, [config.sourceLink, data.sourceLink]);
  const verifiedLabel = sourceDomain
    ? `Verified real data source (${sourceDomain})`
    : 'Verified real data source';
  const lowConfidenceCount = useMemo(() => {
    let count = 0;
    data.series.forEach((series) => {
      series.confidence?.forEach((value) => {
        if (typeof value === 'number' && value < 0.5) count += 1;
      });
    });
    return count;
  }, [data.series]);
  const adaptiveBottom = adaptiveAxis.angle !== 0
    ? adaptiveAxis.bottomMargin + (xAxisLabel ? 20 : 0)
    : (xAxisLabel ? 25 : 5);
  const chartMargins = isHorizontal
    ? { top: 20, right: 30, bottom: yAxisLabel ? 25 : 5, left: horizontalCategoryAxis.leftMargin }
    : { top: 20, right: 5, bottom: adaptiveBottom, left: yAxisLabel ? 15 : 5 };

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

    const xAxisLabelConfig = xAxisLabel ? {
      value: xAxisLabel,
      position: 'insideBottom' as const,
      offset: adaptiveAxis.angle !== 0 ? -14 : -10,
      fill: theme.textMuted,
      fontSize: 11,
      fontFamily: 'var(--font-mono)',
    } : undefined;

    // For year labels, treat as categorical to avoid decimal interpolation (2020.3)
    // For other numeric labels, use continuous numeric axis
    const adaptiveTick = adaptiveAxis.needsCustomTick
      ? <AdaptiveXAxisTick fill={theme.textMuted} config={adaptiveAxis} />
      : undefined;

    const xAxisElement = isYearLabels ? (
      <XAxis
        dataKey="name"
        stroke={theme.textMuted}
        tick={adaptiveTick ?? { fill: theme.textMuted, fontSize: adaptiveAxis.fontSize }}
        tickLine={{ stroke: theme.textMuted }}
        axisLine={{ stroke: theme.border, strokeOpacity: 0.5 }}
        padding={{ left: 20, right: 20 }}
        interval={adaptiveAxis.tickInterval ?? 0}
        label={xAxisLabelConfig}
      />
    ) : isNumericLabels ? (
      <XAxis
        type="number"
        dataKey="x"
        domain={numericDomain}
        stroke={theme.textMuted}
        tick={{ fill: theme.textMuted, fontSize: adaptiveAxis.fontSize }}
        tickLine={{ stroke: theme.textMuted }}
        axisLine={{ stroke: theme.border, strokeOpacity: 0.5 }}
        allowDecimals={false}
        tickFormatter={formatXAxisYearTick}
        label={xAxisLabelConfig}
      />
    ) : (
      <XAxis
        dataKey="name"
        stroke={theme.textMuted}
        tick={adaptiveTick ?? { fill: theme.textMuted, fontSize: adaptiveAxis.fontSize }}
        tickLine={{ stroke: theme.textMuted }}
        axisLine={{ stroke: theme.border, strokeOpacity: 0.5 }}
        padding={{ left: 20, right: 20 }}
        interval={adaptiveAxis.tickInterval ?? 0}
        label={xAxisLabelConfig}
      />
    );

    const yAxisLabelConfig = yAxisLabel ? {
      value: yAxisLabel,
      angle: -90,
      position: 'insideLeft' as const,
      offset: 8,
      dy: Math.min(10, Math.max(2, Math.floor(yAxisLabel.length / 10))),
      fill: theme.textMuted,
      fontSize: 11,
      fontFamily: 'var(--font-mono)',
    } : undefined;

    const yAxisElement = (
      <YAxis
        stroke={theme.textMuted}
        tick={{ fill: theme.textMuted, fontSize: 12 }}
        tickLine={{ stroke: theme.textMuted }}
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
        tick={{ fill: theme.textMuted, fontSize: 12 }}
        tickLine={{ stroke: theme.textMuted }}
        axisLine={{ stroke: theme.border, strokeOpacity: 0.5 }}
        tickFormatter={formatYAxisTick}
        label={yAxisLabel ? {
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
        tick={
          <AdaptiveYAxisCategoryTick
            fill={theme.textMuted}
            fontSize={horizontalCategoryAxis.fontSize}
            maxTickLength={horizontalCategoryAxis.maxTickLength}
          />
        }
        tickLine={{ stroke: theme.textMuted }}
        axisLine={{ stroke: theme.border, strokeOpacity: 0.5 }}
        label={xAxisLabel ? {
          value: xAxisLabel,
          angle: -90,
          position: 'insideLeft',
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
                  <LabelList
                    dataKey={series.name}
                    position={isHorizontal ? 'right' : 'top'}
                    fill={theme.textMuted}
                    fontSize={11}
                    formatter={(value) => typeof value === 'number' ? formatYAxisTick(value) : value}
                  />
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
                    position="top"
                    fill={theme.textMuted}
                    fontSize={11}
                    offset={8}
                    formatter={(value) => typeof value === 'number' ? formatYAxisTick(value) : value}
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
                    position="top"
                    fill={theme.textMuted}
                    fontSize={11}
                    offset={8}
                    formatter={(value) => typeof value === 'number' ? formatYAxisTick(value) : value}
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
              tick={{ fill: theme.textMuted, fontSize: 12 }}
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

  const previewClassName = `chart-preview ${styleConfig.decorations.useGlow ? 'chart-preview--glow' : ''} ${styleConfig.decorations.useShadows ? 'chart-preview--shadow' : ''}`;
  const isTableView = config.type === 'table';

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
                <Sparkles size={12} />
                <span>Chartsuno</span>
              </div>
            )}
            {onToggleLogo && (
              <button
                className="chart-brand-toggle"
                onClick={onToggleLogo}
                disabled={!canToggleLogo}
                aria-label={watermark?.enabled !== false ? 'Hide logo' : 'Show logo'}
                aria-pressed={watermark?.enabled !== false}
                title={canToggleLogo
                  ? (watermark?.enabled !== false ? 'Hide logo' : 'Show logo')
                  : 'Upgrade to Pro to toggle logo'
                }
                style={{ color: theme.textMuted }}
              >
                {watermark?.enabled !== false ? <Eye size={12} /> : <EyeOff size={12} />}
              </button>
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

      {config.sourceLink && (
        <div className="chart-source" style={{ borderColor: theme.border }}>
          <a
            href={config.sourceLink}
            target="_blank"
            rel="noopener noreferrer"
            className="chart-source-link"
            style={{ color: theme.textMuted }}
          >
            <span className="chart-source-label">Source:</span>
            <span className="chart-source-domain">{(() => {
              try { return new URL(config.sourceLink).hostname.replace(/^www\./, ''); }
              catch { return config.sourceLink; }
            })()}</span>
            <ExternalLink size={10} />
          </a>
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
