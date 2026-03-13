import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import ArrowLeft from 'lucide-react/dist/esm/icons/arrow-left';
import Plus from 'lucide-react/dist/esm/icons/plus';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2';
import GripVertical from 'lucide-react/dist/esm/icons/grip-vertical';
import Save from 'lucide-react/dist/esm/icons/save';
import Eye from 'lucide-react/dist/esm/icons/eye';
import {
  getDashboard,
  updateDashboard,
  addDashboardItems,
  updateDashboardItems,
  removeDashboardItem,
  type DashboardResponse,
  type DashboardItemResponse,
} from '../../services/api';
import { AddChartsModal } from '../../components/Dashboards/AddChartsModal';
import { Button } from '../../components/Button';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { useToast } from '../../contexts/ToastContext';
import './DashboardEditPage.css';

export function DashboardEditPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // Editable fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [isPublic, setIsPublic] = useState(false);

  const fetchDashboard = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const data = await getDashboard(id);
      setDashboard(data);
      setName(data.name);
      setDescription(data.description || '');
      setAutoRefresh(data.auto_refresh);
      setIsPublic(data.is_public);
    } catch {
      toast.error('Failed to load dashboard');
    } finally {
      setIsLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const existingChartIds = useMemo(() => {
    if (!dashboard?.items) return new Set<string>();
    return new Set(dashboard.items.map((item) => item.chart_id));
  }, [dashboard?.items]);

  const handleSave = async () => {
    if (!id) return;
    setIsSaving(true);
    try {
      const updated = await updateDashboard(id, {
        name: name.trim() || 'Untitled Dashboard',
        description: description.trim() || undefined,
        auto_refresh: autoRefresh,
        is_public: isPublic,
      });
      setDashboard(updated);
      toast.success('Dashboard saved');
    } catch {
      toast.error('Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddCharts = async (chartIds: string[]) => {
    if (!id || chartIds.length === 0) return;
    try {
      const items = chartIds.map((chart_id) => ({ chart_id }));
      const updated = await addDashboardItems(id, items);
      setDashboard(updated);
      toast.success(`Added ${chartIds.length} chart(s)`);
    } catch {
      toast.error('Failed to add charts');
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!id) return;
    try {
      await removeDashboardItem(id, itemId);
      setDashboard((prev) => {
        if (!prev?.items) return prev;
        return { ...prev, items: prev.items.filter((i) => i.id !== itemId), item_count: prev.item_count - 1 };
      });
    } catch {
      toast.error('Failed to remove chart');
    }
  };

  const handleMoveItem = async (itemId: string, direction: 'up' | 'down') => {
    if (!id || !dashboard?.items) return;
    const items = [...dashboard.items];
    const idx = items.findIndex((i) => i.id === itemId);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= items.length) return;

    // Swap positions
    const updates = [
      { id: items[idx].id, position: items[swapIdx].position },
      { id: items[swapIdx].id, position: items[idx].position },
    ];

    try {
      const updated = await updateDashboardItems(id, updates);
      setDashboard(updated);
    } catch {
      toast.error('Failed to reorder');
    }
  };

  const handleSizeChange = async (item: DashboardItemResponse, field: 'width' | 'height', value: number) => {
    if (!id) return;
    try {
      const updated = await updateDashboardItems(id, [{ id: item.id, [field]: value }]);
      setDashboard(updated);
    } catch {
      toast.error('Failed to resize');
    }
  };

  if (isLoading) {
    return <div className="dbedit-loading"><LoadingSpinner size="lg" /></div>;
  }

  if (!dashboard) {
    return (
      <div className="dbedit-error">
        <p>Dashboard not found</p>
        <Link to="/dashboards">Back to dashboards</Link>
      </div>
    );
  }

  const items = dashboard.items || [];

  return (
    <div className="dbedit-page">
      <div className="dbedit-header">
        <Link to={`/dashboards/${id}`} className="dbedit-back" aria-label="Back to dashboard">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="dbedit-header-title">Edit Dashboard</h1>
        <div className="dbedit-header-actions">
          <Link to={`/dashboards/${id}`} className="dbedit-view-btn" aria-label="View dashboard">
            <Eye size={14} />
            <span>View</span>
          </Link>
          <Button variant="primary" onClick={handleSave} disabled={isSaving}>
            <Save size={14} />
            <span>{isSaving ? 'Saving...' : 'Save'}</span>
          </Button>
        </div>
      </div>

      <div className="dbedit-body">
        <div className="dbedit-settings">
          <div className="dbedit-field">
            <label className="dbedit-label" htmlFor="db-name">Name</label>
            <input
              id="db-name"
              type="text"
              className="dbedit-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Dashboard name"
              spellCheck={false}
            />
          </div>
          <div className="dbedit-field">
            <label className="dbedit-label" htmlFor="db-desc">Description</label>
            <input
              id="db-desc"
              type="text"
              className="dbedit-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
            />
          </div>
          <div className="dbedit-toggles">
            <label className="dbedit-toggle">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
              />
              <span>Public</span>
            </label>
            <label className="dbedit-toggle">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              <span>Daily auto-refresh</span>
            </label>
          </div>
        </div>

        <div className="dbedit-items-section">
          <div className="dbedit-items-header">
            <h2>Charts ({items.length})</h2>
            <Button variant="ghost" onClick={() => setShowAddModal(true)}>
              <Plus size={14} />
              <span>Add Charts</span>
            </Button>
          </div>

          {items.length === 0 ? (
            <div className="dbedit-items-empty">
              <p>No charts added yet</p>
              <Button variant="primary" onClick={() => setShowAddModal(true)}>
                <Plus size={16} />
                <span>Add Charts</span>
              </Button>
            </div>
          ) : (
            <div className="dbedit-items-list">
              {items.map((item, idx) => (
                <div key={item.id} className="dbedit-item">
                  <div className="dbedit-item-grip">
                    <GripVertical size={16} />
                  </div>
                  <div className="dbedit-item-info">
                    <span className="dbedit-item-title">
                      {item.chart?.title || 'Untitled'}
                    </span>
                    <span className="dbedit-item-type">
                      {(item.chart?.config as Record<string, unknown>)?.type as string || 'chart'}
                    </span>
                  </div>
                  <div className="dbedit-item-size">
                    <label className="dbedit-size-label">
                      W
                      <select
                        value={item.width}
                        onChange={(e) => handleSizeChange(item, 'width', Number(e.target.value))}
                        className="dbedit-size-select"
                      >
                        {[1, 2, 3, 4].map((v) => (
                          <option key={v} value={v}>{v}</option>
                        ))}
                      </select>
                    </label>
                    <label className="dbedit-size-label">
                      H
                      <select
                        value={item.height}
                        onChange={(e) => handleSizeChange(item, 'height', Number(e.target.value))}
                        className="dbedit-size-select"
                      >
                        {[1, 2, 3].map((v) => (
                          <option key={v} value={v}>{v}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="dbedit-item-actions">
                    <button
                      className="dbedit-item-move"
                      onClick={() => handleMoveItem(item.id, 'up')}
                      disabled={idx === 0}
                      aria-label="Move up"
                      title="Move up"
                    >
                      ↑
                    </button>
                    <button
                      className="dbedit-item-move"
                      onClick={() => handleMoveItem(item.id, 'down')}
                      disabled={idx === items.length - 1}
                      aria-label="Move down"
                      title="Move down"
                    >
                      ↓
                    </button>
                    <button
                      className="dbedit-item-delete"
                      onClick={() => handleRemoveItem(item.id)}
                      aria-label={`Remove ${item.chart?.title || 'chart'}`}
                      title="Remove from dashboard"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <AddChartsModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddCharts}
        existingChartIds={existingChartIds}
      />
    </div>
  );
}
