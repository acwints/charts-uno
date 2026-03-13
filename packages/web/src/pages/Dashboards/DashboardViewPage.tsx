import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import ArrowLeft from 'lucide-react/dist/esm/icons/arrow-left';
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw';
import Globe from 'lucide-react/dist/esm/icons/globe';
import Pencil from 'lucide-react/dist/esm/icons/pencil';
import { getDashboard, type DashboardResponse } from '../../services/api';
import { ChartPreview } from '../../components/ChartPreview';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import type { ChartData, ChartConfig } from '@chartsuno/shared';
import './DashboardViewPage.css';

export function DashboardViewPage() {
  const { id } = useParams<{ id: string }>();
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getDashboard(id);
      setDashboard(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  if (isLoading) {
    return (
      <div className="dbview-loading"><LoadingSpinner size="lg" /></div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="dbview-error">
        <p>{error || 'Dashboard not found'}</p>
        <Link to="/dashboards">Back to dashboards</Link>
      </div>
    );
  }

  const items = dashboard.items || [];

  return (
    <div className="dbview-page">
      <div className="dbview-header">
        <Link to="/dashboards" className="dbview-back" aria-label="Back to dashboards">
          <ArrowLeft size={18} />
        </Link>
        <div className="dbview-header-info">
          <h1 className="dbview-title">{dashboard.name}</h1>
          {dashboard.description && (
            <p className="dbview-description">{dashboard.description}</p>
          )}
        </div>
        <div className="dbview-header-badges">
          {dashboard.auto_refresh && (
            <span className="dbview-badge" title="Auto-refresh enabled">
              <RefreshCw size={14} />
              <span>Auto-refresh</span>
            </span>
          )}
          {dashboard.is_public && (
            <span className="dbview-badge" title="Public dashboard">
              <Globe size={14} />
              <span>Public</span>
            </span>
          )}
        </div>
        <Link to={`/dashboards/${dashboard.id}/edit`} className="dbview-edit-link">
          <Pencil size={14} />
          <span>Edit</span>
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="dbview-empty">
          <p>This dashboard has no charts yet.</p>
          <Link to={`/dashboards/${dashboard.id}/edit`}>Add some charts</Link>
        </div>
      ) : (
        <motion.div
          className="dbview-grid"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          {items.map((item) => (
            <div
              key={item.id}
              className="dbview-item"
              style={{
                gridColumn: `span ${item.width}`,
                gridRow: `span ${item.height}`,
              }}
            >
              {item.chart ? (
                <Link to={`/chart/${item.chart.id}`} className="dbview-item-link">
                  <div className="dbview-item-title">
                    {item.chart.title || 'Untitled'}
                  </div>
                  <div className="dbview-item-chart">
                    <ChartPreview
                      data={item.chart.data as ChartData}
                      config={item.chart.config as ChartConfig}
                      animate={false}
                    />
                  </div>
                </Link>
              ) : (
                <div className="dbview-item-missing">Chart unavailable</div>
              )}
            </div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
