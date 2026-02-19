import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import Check from 'lucide-react/dist/esm/icons/check';
import Eye from 'lucide-react/dist/esm/icons/eye';
import Globe from 'lucide-react/dist/esm/icons/globe';
import Lock from 'lucide-react/dist/esm/icons/lock';
import { ChartActionsMenu } from './ChartActionsMenu';
import type { ChartResponse } from '../../services/api';
import { useDashboardStore } from '../../stores/dashboardStore';
import { MiniChartPreview } from '../MiniChartPreview';
import './DashboardChartCard.css';

interface DashboardChartCardProps {
  chart: ChartResponse;
  onUpdate?: (chart: ChartResponse) => void;
  onDelete?: (chartId: string) => void;
  showAuthor?: boolean;
}

export function DashboardChartCard({ chart, onUpdate, onDelete, showAuthor = false }: DashboardChartCardProps) {
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const { selectedIds, toggleSelect, isSelecting } = useDashboardStore();

  const isSelected = selectedIds.has(chart.id);

  const handleCardClick = (e: React.MouseEvent) => {
    if (isSelecting || e.ctrlKey || e.metaKey) {
      e.preventDefault();
      toggleSelect(chart.id);
      return;
    }
    navigate(`/chart/${chart.id}`);
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleSelect(chart.id);
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
      className={`dashboard-chart-card ${isSelected ? 'dashboard-chart-card--selected' : ''}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleCardClick}
    >
      <MiniChartPreview
        className="dashboard-chart-card__preview"
        data={chart.data}
        config={chart.config}
        minHeight={88}
      >
        {/* Checkbox */}
        <button
          className={`dashboard-chart-card__checkbox ${isSelected || isHovered || isSelecting ? 'dashboard-chart-card__checkbox--visible' : ''}`}
          onClick={handleCheckboxClick}
          aria-label={isSelected ? 'Deselect chart' : 'Select chart'}
        >
          {isSelected && <Check size={14} />}
        </button>

        {/* Actions menu */}
        <div className={`dashboard-chart-card__menu-trigger ${isHovered || isMenuOpen ? 'dashboard-chart-card__menu-trigger--visible' : ''}`}>
          <ChartActionsMenu
            chart={chart}
            isOpen={isMenuOpen}
            onOpenChange={setIsMenuOpen}
            onUpdate={onUpdate}
            onDelete={onDelete}
          />
        </div>

        {/* Badges */}
        <div className="dashboard-chart-card__badges">
          <div className="dashboard-chart-card__type-badge">{chart.config.type}</div>
          {chart.is_public ? (
            <div className="dashboard-chart-card__visibility-badge dashboard-chart-card__visibility-badge--public" title="Public">
              <Globe size={10} />
            </div>
          ) : (
            <div className="dashboard-chart-card__visibility-badge dashboard-chart-card__visibility-badge--private" title="Private">
              <Lock size={10} />
            </div>
          )}
        </div>
      </MiniChartPreview>

      <div className="dashboard-chart-card__content">
        <h3 className="dashboard-chart-card__title">
          {chart.title || chart.config.title || 'Untitled Chart'}
        </h3>

        <div className="dashboard-chart-card__meta">
          {showAuthor && chart.user && (
            <span className="dashboard-chart-card__author">
              {chart.user.name || 'Anonymous'}
            </span>
          )}
          <span className="dashboard-chart-card__date">{formatDate(chart.created_at)}</span>
          <span className="dashboard-chart-card__stat">
            <Eye size={12} />
            {chart.view_count}
          </span>
        </div>
      </div>
    </motion.article>
  );
}
