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
} from 'recharts';
import type { ChartType, ColorScheme, ThemeMode } from '../types';
import { COLOR_PALETTES, applyCustomColors, getEffectiveColors, getNumericDomainFromValues, getTheme } from '../types';
import { SafeResponsiveContainer } from './SafeResponsiveContainer';

interface MiniChartPreviewData {
  labels: string[];
  series: { name: string; data: Array<number | null> }[];
}

interface MiniChartPreviewConfig {
  type?: ChartType;
  colorScheme?: ColorScheme;
  themeMode?: ThemeMode;
  barLayout?: 'horizontal' | 'vertical';
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
}

export function MiniChartPreview({ data, config, minHeight, className, children }: MiniChartPreviewProps) {
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

  const renderMiniChart = () => {
    const chartType = config.type;
    const isHorizontalBar = chartType === 'bar' && config.barLayout === 'horizontal';

    switch (chartType) {
      case 'bar':
        return (
          <BarChart
            data={chartData}
            margin={{ top: 5, right: 5, bottom: 5, left: 5 }}
            {...(isHorizontalBar ? { layout: 'vertical' as const } : {})}
          >
            {isHorizontalBar ? (
              <>
                <XAxis type="number" hide domain={numericDomain} />
                <YAxis dataKey="name" type="category" hide width={0} />
              </>
            ) : (
              <>
                <XAxis dataKey="name" type="category" hide />
                <YAxis type="number" hide domain={numericDomain} />
              </>
            )}
            {data.series.map((series, idx) => (
              <Bar
                key={series.name}
                dataKey={series.name}
                fill={colors[idx % colors.length]}
                radius={[2, 2, 0, 0]}
              />
            ))}
          </BarChart>
        );

      case 'line':
        return (
          <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <XAxis dataKey="name" type="category" hide />
            <YAxis type="number" hide domain={numericDomain} />
            {data.series.map((series, idx) => (
              <Line
                key={series.name}
                type="monotone"
                dataKey={series.name}
                stroke={colors[idx % colors.length]}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        );

      case 'area':
        return (
          <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <XAxis dataKey="name" type="category" hide />
            <YAxis type="number" hide domain={numericDomain} />
            {data.series.map((series, idx) => (
              <Area
                key={series.name}
                type="monotone"
                dataKey={series.name}
                stroke={colors[idx % colors.length]}
                fill={colors[idx % colors.length]}
                fillOpacity={0.3}
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
            >
              {pieData.map((_, idx) => (
                <Cell key={`cell-${idx}`} fill={colors[idx % colors.length]} />
              ))}
            </Pie>
          </PieChart>
        );

      default:
        return (
          <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <XAxis dataKey="name" type="category" hide />
            <YAxis type="number" hide domain={numericDomain} />
            {data.series.map((series, idx) => (
              <Bar
                key={series.name}
                dataKey={series.name}
                fill={colors[idx % colors.length]}
                radius={[2, 2, 0, 0]}
              />
            ))}
          </BarChart>
        );
    }
  };

  return (
    <div className={className} style={{ background: theme.background }}>
      <SafeResponsiveContainer minWidth={0} minHeight={minHeight}>
        {renderMiniChart()}
      </SafeResponsiveContainer>
      {children}
    </div>
  );
}
