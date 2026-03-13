import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import Plus from 'lucide-react/dist/esm/icons/plus';
import LayoutDashboard from 'lucide-react/dist/esm/icons/layout-dashboard';
import { getDashboards, createDashboard, deleteDashboard, type DashboardResponse } from '../../services/api';
import { DashboardCard } from '../../components/Dashboards/DashboardCard';
import { Button } from '../../components/Button';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { useToast } from '../../contexts/ToastContext';
import './DashboardsListPage.css';

export function DashboardsListPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [dashboards, setDashboards] = useState<DashboardResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  const fetchDashboards = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getDashboards(50, 0);
      setDashboards(result.dashboards);
    } catch {
      setDashboards([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboards();
  }, [fetchDashboards]);

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      const dashboard = await createDashboard({ name: 'Untitled Dashboard' });
      navigate(`/dashboards/${dashboard.id}/edit`);
    } catch {
      toast.error('Failed to create dashboard');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDashboard(id);
      setDashboards((prev) => prev.filter((d) => d.id !== id));
      toast.success('Dashboard deleted');
    } catch {
      toast.error('Failed to delete dashboard');
    }
  };

  return (
    <div className="dblist-page">
      <div className="dblist-header">
        <div className="dblist-header-title">
          <h1>Dashboards</h1>
          <span className="dblist-header-count">
            {!isLoading && `${dashboards.length} dashboards`}
          </span>
        </div>
        <Button variant="primary" onClick={handleCreate} disabled={isCreating}>
          <Plus size={16} />
          <span>New Dashboard</span>
        </Button>
      </div>

      {isLoading ? (
        <div className="dblist-loading"><LoadingSpinner size="lg" /></div>
      ) : dashboards.length === 0 ? (
        <div className="dblist-empty">
          <div className="dblist-empty-icon"><LayoutDashboard size={48} /></div>
          <h3 className="dblist-empty-title">No dashboards yet</h3>
          <p className="dblist-empty-description">
            Create a dashboard to group your charts into a single view
          </p>
          <Button variant="primary" size="lg" onClick={handleCreate} disabled={isCreating}>
            <Plus size={18} />
            <span>Create Dashboard</span>
          </Button>
        </div>
      ) : (
        <motion.div
          className="dblist-grid"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          {dashboards.map((dashboard) => (
            <DashboardCard
              key={dashboard.id}
              dashboard={dashboard}
              onDelete={handleDelete}
            />
          ))}
        </motion.div>
      )}
    </div>
  );
}
