import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Check from 'lucide-react/dist/esm/icons/check';
import Eye from 'lucide-react/dist/esm/icons/eye';
import Globe from 'lucide-react/dist/esm/icons/globe';
import Lock from 'lucide-react/dist/esm/icons/lock';
import { ChartActionsMenu } from './ChartActionsMenu';
import type { ChartResponse } from '../../services/api';
import { useDashboardStore } from '../../stores/dashboardStore';
import './ChartListView.css';

interface ChartListViewProps {
  charts: ChartResponse[];
  onUpdate?: (chart: ChartResponse) => void;
  onDelete?: (chartId: string) => void;
  showAuthor?: boolean;
}

interface ChartListItemProps {
  chart: ChartResponse;
  onUpdate?: (chart: ChartResponse) => void;
  onDelete?: (chartId: string) => void;
  showAuthor?: boolean;
}

function ChartListItem({ chart, onUpdate, onDelete, showAuthor }: ChartListItemProps) {
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { selectedIds, toggleSelect, isSelecting } = useDashboardStore();

  const isSelected = selectedIds.has(chart.id);

  const handleRowClick = (e: React.MouseEvent) => {
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
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div
      className={`chart-list-item ${isSelected ? 'chart-list-item--selected' : ''}`}
      onClick={handleRowClick}
    >
      <button
        className={`chart-list-checkbox ${isSelected || isSelecting ? 'chart-list-checkbox--visible' : ''}`}
        onClick={handleCheckboxClick}
        aria-label={isSelected ? 'Deselect chart' : 'Select chart'}
      >
        {isSelected && <Check size={12} />}
      </button>

      <div className="chart-list-title">
        <span className="chart-list-title-text">
          {chart.title || chart.config.title || 'Untitled Chart'}
        </span>
        {chart.is_public ? (
          <Globe size={12} className="chart-list-visibility chart-list-visibility--public" />
        ) : (
          <Lock size={12} className="chart-list-visibility chart-list-visibility--private" />
        )}
      </div>

      <div className="chart-list-type">{chart.config.type}</div>

      {showAuthor && (
        <div className="chart-list-author">
          {chart.user?.name || 'Anonymous'}
        </div>
      )}

      <div className="chart-list-date">{formatDate(chart.created_at)}</div>

      <div className="chart-list-views">
        <Eye size={12} />
        <span>{chart.view_count}</span>
      </div>

      <div className="chart-list-actions" onClick={(e) => e.stopPropagation()}>
        <ChartActionsMenu
          chart={chart}
          isOpen={isMenuOpen}
          onOpenChange={setIsMenuOpen}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      </div>
    </div>
  );
}

export function ChartListView({ charts, onUpdate, onDelete, showAuthor = false }: ChartListViewProps) {
  return (
    <div className="chart-list">
      <div className="chart-list-header">
        <div className="chart-list-header-checkbox" />
        <div className="chart-list-header-title">Name</div>
        <div className="chart-list-header-type">Type</div>
        {showAuthor && <div className="chart-list-header-author">Author</div>}
        <div className="chart-list-header-date">Modified</div>
        <div className="chart-list-header-views">Views</div>
        <div className="chart-list-header-actions" />
      </div>

      <div className="chart-list-body">
        {charts.map((chart) => (
          <ChartListItem
            key={chart.id}
            chart={chart}
            onUpdate={onUpdate}
            onDelete={onDelete}
            showAuthor={showAuthor}
          />
        ))}
      </div>
    </div>
  );
}
