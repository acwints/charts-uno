import { motion, AnimatePresence } from 'motion/react';
import X from 'lucide-react/dist/esm/icons/x';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2';
import Globe from 'lucide-react/dist/esm/icons/globe';
import Lock from 'lucide-react/dist/esm/icons/lock';
import { useDashboardStore } from '../../stores/dashboardStore';
import { batchDeleteCharts, batchPublishCharts } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { Button } from '../Button';
import './DashboardToolbar.css';

interface DashboardToolbarProps {
  onBatchAction?: () => void;
}

export function DashboardToolbar({ onBatchAction }: DashboardToolbarProps) {
  const { selectedIds, clearSelection, isSelecting } = useDashboardStore();
  const { showToast } = useToast();

  const count = selectedIds.size;

  const handleClear = () => {
    clearSelection();
  };

  const handleBatchDelete = async () => {
    if (count === 0) return;
    const confirmed = window.confirm(`Delete ${count} chart${count > 1 ? 's' : ''}? This cannot be undone.`);
    if (!confirmed) return;

    try {
      await batchDeleteCharts(Array.from(selectedIds));
      showToast('success', `${count} chart${count > 1 ? 's' : ''} deleted`);
      clearSelection();
      onBatchAction?.();
    } catch (error) {
      showToast('error', 'Failed to delete charts');
    }
  };

  const handleBatchPublish = async () => {
    if (count === 0) return;
    try {
      await batchPublishCharts(Array.from(selectedIds), true);
      showToast('success', `${count} chart${count > 1 ? 's' : ''} published`);
      clearSelection();
      onBatchAction?.();
    } catch (error) {
      showToast('error', 'Failed to publish charts');
    }
  };

  const handleBatchUnpublish = async () => {
    if (count === 0) return;
    try {
      await batchPublishCharts(Array.from(selectedIds), false);
      showToast('success', `${count} chart${count > 1 ? 's' : ''} made private`);
      clearSelection();
      onBatchAction?.();
    } catch (error) {
      showToast('error', 'Failed to update charts');
    }
  };

  return (
    <AnimatePresence>
      {isSelecting && count > 0 && (
        <motion.div
          className="dashboard-toolbar"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.2 }}
        >
          <div className="dashboard-toolbar-content">
            <button className="dashboard-toolbar-close" onClick={handleClear} aria-label="Clear selection">
              <X size={16} />
            </button>

            <span className="dashboard-toolbar-count">
              {count} selected
            </span>

            <div className="dashboard-toolbar-divider" />

            <div className="dashboard-toolbar-actions">
              <Button size="sm" onClick={handleBatchPublish}>
                <Globe size={14} />
                <span>Publish</span>
              </Button>

              <Button size="sm" onClick={handleBatchUnpublish}>
                <Lock size={14} />
                <span>Make Private</span>
              </Button>

              <Button size="sm" variant="danger" onClick={handleBatchDelete}>
                <Trash2 size={14} />
                <span>Delete</span>
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
