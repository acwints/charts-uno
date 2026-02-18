import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
} from 'recharts';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles';
import type { ChartStyleOption, ChartData } from '../../types';
import { COLOR_PALETTES } from '../../types';
import { SafeResponsiveContainer } from '../SafeResponsiveContainer';

interface ChartStyleCardProps {
  option: ChartStyleOption;
  data: ChartData;
  isSelected: boolean;
  isRecommended?: boolean;
  onClick: () => void;
}

export function ChartStyleCard({
  option,
  data,
  isSelected,
  isRecommended,
  onClick,
}: ChartStyleCardProps) {
  const colors = COLOR_PALETTES[option.colorScheme];

  const chartData = useMemo(() => {
    // Use a subset of data for mini preview
    const maxPoints = 6;
    const step = Math.max(1, Math.floor(data.labels.length / maxPoints));
    return data.labels
      .filter((_, idx) => idx % step === 0)
      .slice(0, maxPoints)
      .map((label, idx) => {
        const point: Record<string, string | number | null> = { name: label };
        data.series.forEach((series) => {
          point[series.name] = series.data[idx * step];
        });
        return point;
      });
  }, [data]);

  const renderMiniChart = () => {
    const commonAxisProps = {
      hide: true,
    };

    switch (option.type) {
      case 'bar':
        return (
          <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <XAxis {...commonAxisProps} dataKey="name" />
            <YAxis {...commonAxisProps} />
            {data.series.slice(0, 3).map((series, idx) => (
              <Bar
                key={series.name}
                dataKey={series.name}
                fill={colors[idx % colors.length]}
                radius={[2, 2, 0, 0]}
                animationDuration={0}
              />
            ))}
          </BarChart>
        );

      case 'line':
        return (
          <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <XAxis {...commonAxisProps} dataKey="name" />
            <YAxis {...commonAxisProps} />
            {data.series.slice(0, 3).map((series, idx) => (
              <Line
                key={series.name}
                type="monotone"
                dataKey={series.name}
                stroke={colors[idx % colors.length]}
                strokeWidth={2}
                dot={false}
                animationDuration={0}
              />
            ))}
          </LineChart>
        );

      case 'area':
        return (
          <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <XAxis {...commonAxisProps} dataKey="name" />
            <YAxis {...commonAxisProps} />
            {data.series.slice(0, 3).map((series, idx) => (
              <Area
                key={series.name}
                type="monotone"
                dataKey={series.name}
                stroke={colors[idx % colors.length]}
                fill={colors[idx % colors.length]}
                fillOpacity={0.4}
                strokeWidth={2}
                animationDuration={0}
              />
            ))}
          </AreaChart>
        );

      default:
        return (
          <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <XAxis {...commonAxisProps} dataKey="name" />
            <YAxis {...commonAxisProps} />
            {data.series.slice(0, 3).map((series, idx) => (
              <Bar
                key={series.name}
                dataKey={series.name}
                fill={colors[idx % colors.length]}
                radius={[2, 2, 0, 0]}
                animationDuration={0}
              />
            ))}
          </BarChart>
        );
    }
  };

  return (
    <button
      className={`style-card ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
      type="button"
    >
      {isRecommended && (
        <div className="recommended-badge">
          <Sparkles size={10} />
          <span>AI Pick</span>
        </div>
      )}
      <div className="style-card-preview">
        <SafeResponsiveContainer minWidth={0} minHeight={64}>
          {renderMiniChart()}
        </SafeResponsiveContainer>
      </div>
      <div className="style-card-info">
        <span className="style-card-label">{option.label}</span>
      </div>
    </button>
  );
}
