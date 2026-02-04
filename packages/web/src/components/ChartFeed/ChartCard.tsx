import { useState } from 'react';
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
  Cell,
} from 'recharts';
import Heart from 'lucide-react/dist/esm/icons/heart';
import Bookmark from 'lucide-react/dist/esm/icons/bookmark';
import Eye from 'lucide-react/dist/esm/icons/eye';
import User from 'lucide-react/dist/esm/icons/user';
import type { ChartResponse } from '../../services/api';
import { likeChart, unlikeChart, saveChart, unsaveChart } from '../../services/api';
import { COLOR_PALETTES } from '../../types';
import './ChartCard.css';

interface ChartCardProps {
  chart: ChartResponse;
  onChartClick?: (chart: ChartResponse) => void;
  onUpdate?: (chart: ChartResponse) => void;
}

export function ChartCard({ chart, onChartClick, onUpdate }: ChartCardProps) {
  const [isLiked, setIsLiked] = useState(chart.is_liked);
  const [isSaved, setIsSaved] = useState(chart.is_saved);
  const [likeCount, setLikeCount] = useState(chart.like_count);
  const [isLikeLoading, setIsLikeLoading] = useState(false);
  const [isSaveLoading, setIsSaveLoading] = useState(false);

  const colors = COLOR_PALETTES[(chart.config.colorScheme as keyof typeof COLOR_PALETTES) || 'default'];

  const chartData = chart.data.labels.map((label, idx) => {
    const point: Record<string, string | number> = { name: label };
    chart.data.series.forEach((series) => {
      point[series.name] = series.data[idx];
    });
    return point;
  });

  const pieData = chart.data.series[0]?.data.map((value, idx) => ({
    name: chart.data.labels[idx],
    value,
  })) || [];

  const handleLikeClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLikeLoading) return;

    setIsLikeLoading(true);
    try {
      if (isLiked) {
        await unlikeChart(chart.id);
        setLikeCount((prev) => prev - 1);
      } else {
        await likeChart(chart.id);
        setLikeCount((prev) => prev + 1);
      }
      setIsLiked(!isLiked);
      onUpdate?.({ ...chart, is_liked: !isLiked, like_count: isLiked ? likeCount - 1 : likeCount + 1 });
    } catch (error) {
      console.error('Failed to toggle like:', error);
    } finally {
      setIsLikeLoading(false);
    }
  };

  const handleSaveClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSaveLoading) return;

    setIsSaveLoading(true);
    try {
      if (isSaved) {
        await unsaveChart(chart.id);
      } else {
        await saveChart(chart.id);
      }
      setIsSaved(!isSaved);
      onUpdate?.({ ...chart, is_saved: !isSaved });
    } catch (error) {
      console.error('Failed to toggle save:', error);
    } finally {
      setIsSaveLoading(false);
    }
  };

  const renderMiniChart = () => {
    const chartType = chart.config.type;

    switch (chartType) {
      case 'bar':
        return (
          <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            {chart.data.series.map((series, idx) => (
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
            {chart.data.series.map((series, idx) => (
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
            {chart.data.series.map((series, idx) => (
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
            {chart.data.series.map((series, idx) => (
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  return (
    <motion.article
      className="chart-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      onClick={() => onChartClick?.(chart)}
    >
      <div className="chart-card__preview">
        <ResponsiveContainer width="100%" height="100%">
          {renderMiniChart()}
        </ResponsiveContainer>
        <div className="chart-card__type-badge">{chart.config.type}</div>
      </div>

      <div className="chart-card__content">
        <h3 className="chart-card__title">
          {chart.title || chart.config.title || 'Untitled Chart'}
        </h3>

        {chart.description && (
          <p className="chart-card__description">{chart.description}</p>
        )}

        <div className="chart-card__meta">
          <div className="chart-card__author">
            {chart.user?.picture ? (
              <img
                src={chart.user.picture}
                alt={chart.user.name || 'User'}
                className="chart-card__avatar"
              />
            ) : (
              <div className="chart-card__avatar-placeholder">
                <User size={12} />
              </div>
            )}
            <span className="chart-card__author-name">
              {chart.user?.name || 'Anonymous'}
            </span>
          </div>
          <span className="chart-card__date">{formatDate(chart.created_at)}</span>
        </div>
      </div>

      <div className="chart-card__actions">
        <button
          className={`chart-card__action ${isLiked ? 'chart-card__action--active' : ''}`}
          onClick={handleLikeClick}
          disabled={isLikeLoading}
          aria-label={isLiked ? 'Unlike' : 'Like'}
        >
          <Heart size={16} fill={isLiked ? 'currentColor' : 'none'} />
          <span>{likeCount}</span>
        </button>

        <button
          className={`chart-card__action ${isSaved ? 'chart-card__action--active' : ''}`}
          onClick={handleSaveClick}
          disabled={isSaveLoading}
          aria-label={isSaved ? 'Unsave' : 'Save'}
        >
          <Bookmark size={16} fill={isSaved ? 'currentColor' : 'none'} />
        </button>

        <div className="chart-card__stat">
          <Eye size={14} />
          <span>{chart.view_count}</span>
        </div>
      </div>
    </motion.article>
  );
}
