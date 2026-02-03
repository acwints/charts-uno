import { useMemo, useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  ResponsiveContainer,
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
import { RefreshCw, ExternalLink } from 'lucide-react';
import type { ChartData, ChartConfig, ColorTheme } from '../types';
import { COLOR_GRADIENTS, STYLE_VARIANTS, getTheme, applyCustomColors, getEffectiveColors } from '../types';
import { generateInfographic } from '../services/infographicGenerator';
import { AIProcessingIndicator } from './AIProcessingIndicator';
import { Button } from './Button';
import './ChartPreview.css';

interface ChartPreviewProps {
  data: ChartData;
  config: ChartConfig;
}

export function ChartPreview({ data, config }: ChartPreviewProps) {
  // Get base theme based on scheme and mode
  const baseTheme = getTheme(config.colorScheme, config.themeMode);

  // Apply custom color overrides
  const theme: ColorTheme = applyCustomColors(baseTheme, config.customColors);

  // Get effective colors for series (custom or from palette)
  const colors = getEffectiveColors(config.colorScheme, config.customColors?.seriesColors);
  const gradients = COLOR_GRADIENTS[config.colorScheme];
  const styleConfig = STYLE_VARIANTS[config.styleVariant];

  const [infographicSvg, setInfographicSvg] = useState<string | null>(null);
  const [infographicLoading, setInfographicLoading] = useState(false);
  const [infographicError, setInfographicError] = useState<string | null>(null);

  useEffect(() => {
    if (config.type === 'infographic' && !infographicSvg && !infographicLoading) {
      generateInfographicSvg();
    }
  }, [config.type]);

  const generateInfographicSvg = async () => {
    setInfographicLoading(true);
    setInfographicError(null);
    try {
      const svg = await generateInfographic(
        data,
        config.title,
        config.colorScheme,
        config.themeMode,
        data.sourceImage
      );
      setInfographicSvg(svg);
    } catch (err) {
      setInfographicError(err instanceof Error ? err.message : 'Failed to generate infographic');
    } finally {
      setInfographicLoading(false);
    }
  };

  const regenerateInfographic = () => {
    setInfographicSvg(null);
    generateInfographicSvg();
  };

  // Check if all labels can be parsed as numbers
  const isNumericLabels = useMemo(() => {
    return data.labels.length > 0 &&
      data.labels.every(label => !isNaN(parseFloat(label)) && isFinite(Number(label)));
  }, [data.labels]);

  const chartData = useMemo(() => {
    return data.labels.map((label, idx) => {
      const point: Record<string, string | number> = {
        name: label,
        x: isNumericLabels ? parseFloat(label) : idx,
      };
      data.series.forEach((series) => {
        point[series.name] = series.data[idx];
      });
      return point;
    });
  }, [data, isNumericLabels]);

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

  const xAxisLabel = data.xAxisLabel;
  const yAxisLabel = data.yAxisLabel ?? (data.series.length === 1 ? data.series[0].name : undefined);
  const chartMargins = {
    top: 20,
    right: 5,
    bottom: xAxisLabel ? 25 : 5,
    left: yAxisLabel ? 15 : 5,
  };

  const pieData = useMemo(() => {
    if (config.type !== 'pie') return [];
    return data.series[0].data.map((value, idx) => ({
      name: data.labels[idx],
      value,
    }));
  }, [data, config.type]);

  const radarData = useMemo(() => {
    if (config.type !== 'radar') return [];
    return data.labels.map((label, idx) => {
      const point: Record<string, string | number> = { subject: label };
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
      offset: -10,
      fill: theme.textMuted,
      fontSize: 11,
      fontFamily: 'var(--font-mono)',
    } : undefined;

    const xAxisElement = isNumericLabels ? (
      <XAxis
        type="number"
        dataKey="x"
        domain={numericDomain}
        stroke={theme.textMuted}
        tick={{ fill: theme.textMuted, fontSize: 12 }}
        tickLine={{ stroke: theme.textMuted }}
        axisLine={{ stroke: theme.border, strokeOpacity: 0.5 }}
        label={xAxisLabelConfig}
      />
    ) : (
      <XAxis
        dataKey="name"
        stroke={theme.textMuted}
        tick={{ fill: theme.textMuted, fontSize: 12 }}
        tickLine={{ stroke: theme.textMuted }}
        axisLine={{ stroke: theme.border, strokeOpacity: 0.5 }}
        padding={{ left: 20, right: 20 }}
        label={xAxisLabelConfig}
      />
    );

    const yAxisElement = (
      <YAxis
        stroke={theme.textMuted}
        tick={{ fill: theme.textMuted, fontSize: 12 }}
        tickLine={{ stroke: theme.textMuted }}
        axisLine={{ stroke: theme.border, strokeOpacity: 0.5 }}
        label={yAxisLabel ? {
          value: yAxisLabel,
          angle: -90,
          position: 'insideLeft',
          offset: 12,
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
        return null;

      case 'bar':
        return (
          <BarChart {...commonProps}>
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
                radius={styleConfig.chart.barRadius}
                animationDuration={config.animate ? 800 : 0}
                animationBegin={idx * 100}
                {...(config.stacked ? { stackId: 'stack' } : {})}
              >
                {config.showValues && (
                  <LabelList
                    dataKey={series.name}
                    position="top"
                    fill={theme.textMuted}
                    fontSize={11}
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
                dot={styleConfig.chart.dotRadius > 0 ? {
                  fill: colors[idx % colors.length],
                  strokeWidth: 0,
                  r: styleConfig.chart.dotRadius
                } : false}
                activeDot={{
                  r: styleConfig.chart.activeDotRadius,
                  stroke: colors[idx % colors.length],
                  strokeWidth: 2,
                  fill: theme.background
                }}
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
                data={series.data.map((value, i) => ({ x: i + 1, y: value, name: data.labels[i] }))}
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
        </div>
        <div className="chart-meta">
          <span className="chart-meta-item">
            <span className="meta-label" style={{ color: theme.textMuted }}>Source:</span>
            <span className="meta-value" style={{ color: theme.text }}>{data.sourceType.toUpperCase()}</span>
          </span>
          <span className="chart-meta-item">
            <span className="meta-label" style={{ color: theme.textMuted }}>Points:</span>
            <span className="meta-value" style={{ color: theme.text }}>{data.labels.length}</span>
          </span>
          <span className="chart-meta-item">
            <span className="meta-label" style={{ color: theme.textMuted }}>Series:</span>
            <span className="meta-value" style={{ color: theme.text }}>{data.series.length}</span>
          </span>
        </div>
      </div>

      <div
        className={`chart-container ${isTableView ? 'chart-container--scroll' : 'chart-container--no-scroll'}`}
        style={{ background: theme.background }}
      >
        {config.type === 'infographic' ? (
          renderInfographic()
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
                    {data.series.map((series) => (
                      <td key={series.name} className="table-cell" style={{ color: theme.textMuted, borderColor: theme.border }}>
                        {typeof series.data[rowIdx] === 'number' ? series.data[rowIdx].toLocaleString() : series.data[rowIdx]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
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

      {config.type !== 'infographic' && config.type !== 'table' && (
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
