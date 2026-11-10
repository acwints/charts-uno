import { racePreviewRows } from '../utils/racePreview';
import { RACE_DEFAULTS } from '../types';
import './MiniChartPreview.css';
import { useMemo, type ReactNode } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
  Legend,
} from 'recharts';
import type { ChartType, ColorScheme, ThemeMode } from '../types';
import { COLOR_PALETTES, applyCustomColors, getEffectiveColors, getNumericDomainFromValues, getTheme } from '../types';
import { SafeResponsiveContainer } from './SafeResponsiveContainer';

interface MiniChartPreviewData {
  labels: string[];
  xAxisLabel?: string;
  yAxisLabel?: string;
  series: { name: string; data: Array<number | null> }[];
}

interface MiniChartPreviewConfig {
  type?: ChartType;
  colorScheme?: ColorScheme;
  themeMode?: ThemeMode;
  barLayout?: 'horizontal' | 'vertical';
  stacked?: boolean;
  raceHoldLast?: boolean;
  yAxisBaselineMode?: 'auto' | 'zero' | 'data';
  customColors?: {
    background?: string;
    cardBackground?: string;
    text?: string;
    textMuted?: string;
    grid?: string;
    border?: string;
    seriesColors?: string[];
  };
}

interface MiniChartPreviewProps {
  data: MiniChartPreviewData;
  config: MiniChartPreviewConfig;
  minHeight: number;
  className?: string;
  children?: ReactNode;
  readable?: boolean;
}

export function MiniChartPreview({ data, config, minHeight, className, children, readable = false }: MiniChartPreviewProps) {
  const colorScheme = useMemo(() => {
    const scheme = config.colorScheme;
    return typeof scheme === 'string' && scheme in COLOR_PALETTES
      ? (scheme as keyof typeof COLOR_PALETTES)
      : 'default';
  }, [config.colorScheme]);

  const themeMode = config.themeMode === 'light' ? 'light' : 'dark';
  const theme = applyCustomColors(getTheme(colorScheme, themeMode), config.customColors);
  const colors = getEffectiveColors(colorScheme, config.customColors?.seriesColors);

  const chartData = useMemo(() => {
    return data.labels.map((label, idx) => {
      const point: Record<string, string | number | null> = { name: label };
      data.series.forEach((series) => {
        point[series.name] = series.data[idx];
      });
      return point;
    });
  }, [data.labels, data.series]);

  const raceFinishData = useMemo(
    () => racePreviewRows(data, config.raceHoldLast ?? RACE_DEFAULTS.holdLast),
    [data, config.raceHoldLast],
  );

  const pieData = useMemo(
    () =>
      data.series[0]?.data
        .map((value, idx) => ({
          name: data.labels[idx],
          value,
        }))
        .filter((point): point is { name: string; value: number } => typeof point.value === 'number') || [],
    [data.labels, data.series]
  );

  const numericDomain = useMemo(() => {
    const rawValues = data.series.flatMap((series) => series.data);
    return getNumericDomainFromValues(rawValues, {
      mode: config.yAxisBaselineMode ?? 'auto',
    });
  }, [data.series, config.yAxisBaselineMode]);

  const tick = { fill: theme.text, fontSize: 12 };
  const numberTick = (value: number) => new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(value);
  const margin = readable ? { top: 12, right: 16, bottom: 8, left: 0 } : { top: 5, right: 5, bottom: 5, left: 5 };
  const legend = readable ? <Legend iconSize={10} wrapperStyle={{ fontSize: 12, color: theme.text }} /> : null;
  const renderMiniChart = () => {
    const chartType = config.type;
    const isHorizontalBar = chartType === 'bar' && config.barLayout === 'horizontal';

    switch (chartType) {
      case 'race':
        return (
          <BarChart
            data={raceFinishData}
            layout="vertical"
            margin={margin}
          >
            <XAxis type="number" hide domain={['dataMin', 'dataMax']} />
            <YAxis dataKey="name" type="category" hide={!readable} tick={tick} width={readable ? 96 : 0} tickFormatter={(value: string) => value.length > 13 ? `${value.slice(0, 12)}…` : value} />
            <Bar dataKey="value" radius={[0, 2, 2, 0]}>
              {raceFinishData.map((row, idx) => (
                <Cell key={row.name} fill={colors[idx % colors.length]} />
              ))}
            </Bar>
          </BarChart>
        );

      case 'bar':
        return (
          <BarChart
            data={chartData}
            margin={margin}
            {...(isHorizontalBar ? { layout: 'vertical' as const } : {})}
          >
            {isHorizontalBar ? (
              <>
                <XAxis type="number" hide={!readable} tick={tick} tickFormatter={numberTick} domain={numericDomain} />
                <YAxis dataKey="name" type="category" hide={!readable} tick={tick} width={readable ? 96 : 0} tickFormatter={(value: string) => value.length > 13 ? `${value.slice(0, 12)}…` : value} />
              </>
            ) : (
              <>
                <XAxis dataKey="name" type="category" hide={!readable} tick={tick} minTickGap={24} interval="preserveStartEnd" tickFormatter={(value: string) => value.length > 12 ? `${value.slice(0, 11)}…` : value} />
                <YAxis type="number" hide={!readable} tick={tick} tickCount={4} width={48} tickFormatter={numberTick} domain={numericDomain} />
              </>
            )}
            {legend}
            {data.series.map((series, idx) => (
              <Bar
                key={series.name}
                dataKey={series.name}
                stackId={config.stacked ? "stack" : undefined}
                isAnimationActive={!readable}
                fill={colors[idx % colors.length]}
                radius={[2, 2, 0, 0]}
              />
            ))}
          </BarChart>
        );

      case 'line':
        return (
          <LineChart data={chartData} margin={margin}>
            <XAxis dataKey="name" type="category" hide={!readable} tick={tick} minTickGap={24} interval="preserveStartEnd" tickFormatter={(value: string) => value.length > 12 ? `${value.slice(0, 11)}…` : value} />
            <YAxis type="number" hide={!readable} tick={tick} tickCount={4} width={48} tickFormatter={numberTick} domain={numericDomain} />
            {legend}
            {data.series.map((series, idx) => (
              <Line
                key={series.name}
                type="monotone"
                dataKey={series.name}
                stroke={colors[idx % colors.length]}
                isAnimationActive={!readable}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        );

      case 'area':
        return (
          <AreaChart data={chartData} margin={margin}>
            <XAxis dataKey="name" type="category" hide={!readable} tick={tick} minTickGap={24} interval="preserveStartEnd" tickFormatter={(value: string) => value.length > 12 ? `${value.slice(0, 11)}…` : value} />
            <YAxis type="number" hide={!readable} tick={tick} tickCount={4} width={48} tickFormatter={numberTick} domain={numericDomain} />
            {legend}
            {data.series.map((series, idx) => (
              <Area
                key={series.name}
                type="monotone"
                dataKey={series.name}
                stroke={colors[idx % colors.length]}
                fill={colors[idx % colors.length]}
                fillOpacity={0.3}
                isAnimationActive={!readable}
                strokeWidth={2}
              />
            ))}
          </AreaChart>
        );

      case 'pie':
        return (
          <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={25}
              outerRadius={50}
              paddingAngle={2}
              dataKey="value"
              isAnimationActive={!readable}
              label={readable ? ({ name, value }) => `${name}: ${value}` : false}
            >
              {pieData.map((_, idx) => (
                <Cell key={`cell-${idx}`} fill={colors[idx % colors.length]} />
              ))}
            </Pie>
          </PieChart>
        );

      default:
        return (
          <BarChart data={chartData} margin={margin}>
            <XAxis dataKey="name" type="category" hide={!readable} tick={tick} minTickGap={24} interval="preserveStartEnd" tickFormatter={(value: string) => value.length > 12 ? `${value.slice(0, 11)}…` : value} />
            <YAxis type="number" hide={!readable} tick={tick} tickCount={4} width={48} tickFormatter={numberTick} domain={numericDomain} />
            {legend}
            {data.series.map((series, idx) => (
              <Bar
                key={series.name}
                dataKey={series.name}
                stackId={config.stacked ? "stack" : undefined}
                isAnimationActive={!readable}
                fill={colors[idx % colors.length]}
                radius={[2, 2, 0, 0]}
              />
            ))}
          </BarChart>
        );
    }
  };

  if (readable && (config.stacked || (config.type === 'pie' && data.labels.length > 5) || !['bar', 'line', 'area', 'pie'].includes(config.type ?? ''))) {
    return <div className={className} style={{ background: theme.background, color: theme.text }}>
      <table className="reading-preview-table"><thead><tr><th>{data.xAxisLabel || 'Category'}</th>{data.series.slice(0, 2).map((series, i) => <th key={i}>{series.name}</th>)}</tr></thead>
        <tbody>{data.labels.slice(0, 4).map((label, i) => <tr key={i}><th>{label}</th>{data.series.slice(0, 2).map((series, j) => <td key={j}>{series.data[i] == null ? '—' : String(series.data[i])}</td>)}</tr>)}</tbody></table>
      <p>Data preview · Open chart for full details</p>{children}
    </div>;
  }

  return (
    <div className={className} style={{ background: theme.background, color: theme.text }}>
      {readable && data.yAxisLabel && <p className="reading-preview-units">{data.yAxisLabel}</p>}
      <SafeResponsiveContainer minWidth={0} minHeight={minHeight}>
        {renderMiniChart()}
      </SafeResponsiveContainer>
      {children}
    </div>
  );
}
