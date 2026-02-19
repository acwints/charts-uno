import { useState } from 'react';
import { motion } from 'motion/react';
import Heart from 'lucide-react/dist/esm/icons/heart';
import Eye from 'lucide-react/dist/esm/icons/eye';
import User from 'lucide-react/dist/esm/icons/user';
import type { ChartResponse } from '../../services/api';
import { likeChart, unlikeChart } from '../../services/api';
import { MiniChartPreview } from '../MiniChartPreview';
import './ChartCard.css';

interface ChartCardProps {
  chart: ChartResponse;
  onChartClick?: (chart: ChartResponse) => void;
  onUpdate?: (chart: ChartResponse) => void;
}

export function ChartCard({ chart, onChartClick, onUpdate }: ChartCardProps) {
  const [isLiked, setIsLiked] = useState(chart.is_liked);
  const [likeCount, setLikeCount] = useState(chart.like_count);
  const [isLikeLoading, setIsLikeLoading] = useState(false);

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
      <MiniChartPreview
        className="chart-card__preview"
        data={chart.data}
        config={chart.config}
        minHeight={96}
      >
        <div className="chart-card__type-badge">{chart.config.type}</div>
      </MiniChartPreview>

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

        <div className="chart-card__stat">
          <Eye size={14} />
          <span>{chart.view_count}</span>
        </div>
      </div>
    </motion.article>
  );
}
