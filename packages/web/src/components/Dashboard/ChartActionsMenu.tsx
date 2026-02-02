import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  MoreHorizontal,
  Edit,
  Copy,
  Globe,
  Lock,
  Trash2,
} from 'lucide-react';
import type { ChartResponse } from '../../services/api';
import { updateChart, deleteChart, duplicateChart } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import './ChartActionsMenu.css';

interface ChartActionsMenuProps {
  chart: ChartResponse;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onUpdate?: (chart: ChartResponse) => void;
  onDelete?: (chartId: string) => void;
}

export function ChartActionsMenu({
  chart,
  isOpen,
  onOpenChange,
  onUpdate,
  onDelete,
}: ChartActionsMenuProps) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const menuRef = useRef<HTMLDivElement>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onOpenChange(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onOpenChange]);

  const handleTriggerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onOpenChange(!isOpen);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onOpenChange(false);
    navigate(`/chart/${chart.id}`);
  };

  const handleDuplicate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    onOpenChange(false);
    try {
      const newChart = await duplicateChart(chart.id);
      showToast('success', 'Chart duplicated');
      onUpdate?.(newChart);
    } catch (error) {
      showToast('error', 'Failed to duplicate chart');
    }
  };

  const handleTogglePublish = async (e: React.MouseEvent) => {
    e.stopPropagation();
    onOpenChange(false);
    try {
      const updated = await updateChart(chart.id, { is_public: !chart.is_public });
      showToast('success', chart.is_public ? 'Chart unpublished' : 'Chart published');
      onUpdate?.(updated);
    } catch (error) {
      showToast('error', 'Failed to update chart');
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDeleting) return;

    setIsDeleting(true);
    try {
      await deleteChart(chart.id);
      showToast('success', 'Chart deleted');
      onDelete?.(chart.id);
    } catch (error) {
      showToast('error', 'Failed to delete chart');
    } finally {
      setIsDeleting(false);
      onOpenChange(false);
    }
  };

  return (
    <div className="chart-actions-menu" ref={menuRef}>
      <button
        className="chart-actions-trigger"
        onClick={handleTriggerClick}
        aria-label="Chart actions"
      >
        <MoreHorizontal size={16} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="chart-actions-dropdown"
            initial={{ opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            <button className="chart-actions-item" onClick={handleEdit}>
              <Edit size={14} />
              <span>Edit</span>
            </button>

            <button className="chart-actions-item" onClick={handleDuplicate}>
              <Copy size={14} />
              <span>Duplicate</span>
            </button>

            <button className="chart-actions-item" onClick={handleTogglePublish}>
              {chart.is_public ? (
                <>
                  <Lock size={14} />
                  <span>Make Private</span>
                </>
              ) : (
                <>
                  <Globe size={14} />
                  <span>Publish</span>
                </>
              )}
            </button>

            <div className="chart-actions-divider" />

            <button
              className="chart-actions-item chart-actions-item--danger"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              <Trash2 size={14} />
              <span>{isDeleting ? 'Deleting...' : 'Delete'}</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
