import { Link } from 'react-router-dom';
import LayoutDashboard from 'lucide-react/dist/esm/icons/layout-dashboard';
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw';
import Globe from 'lucide-react/dist/esm/icons/globe';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2';
import type { DashboardResponse } from '../../services/api';
import './DashboardCard.css';

interface DashboardCardProps {
  dashboard: DashboardResponse;
  onDelete?: (id: string) => void;
}

export function DashboardCard({ dashboard, onDelete }: DashboardCardProps) {
  const updatedLabel = dashboard.updated_at
    ? new Date(dashboard.updated_at).toLocaleDateString()
    : new Date(dashboard.created_at).toLocaleDateString();

  return (
    <div className="dbcard">
      <Link to={`/dashboards/${dashboard.id}`} className="dbcard-link">
        <div className="dbcard-icon">
          <LayoutDashboard size={24} />
        </div>
        <div className="dbcard-info">
          <h3 className="dbcard-name">{dashboard.name}</h3>
          {dashboard.description && (
            <p className="dbcard-description">{dashboard.description}</p>
          )}
          <div className="dbcard-meta">
            <span className="dbcard-count">{dashboard.item_count} charts</span>
            <span className="dbcard-sep">·</span>
            <span className="dbcard-date">{updatedLabel}</span>
          </div>
        </div>
        <div className="dbcard-badges">
          {dashboard.auto_refresh && (
            <span className="dbcard-badge dbcard-badge--refresh" title="Auto-refresh enabled">
              <RefreshCw size={12} />
            </span>
          )}
          {dashboard.is_public && (
            <span className="dbcard-badge dbcard-badge--public" title="Public">
              <Globe size={12} />
            </span>
          )}
        </div>
      </Link>
      {onDelete && (
        <button
          className="dbcard-delete"
          onClick={(e) => { e.preventDefault(); onDelete(dashboard.id); }}
          aria-label={`Delete ${dashboard.name}`}
          title="Delete dashboard"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}
