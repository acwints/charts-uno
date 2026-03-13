import { useState, useEffect, useCallback } from 'react';
import X from 'lucide-react/dist/esm/icons/x';
import Check from 'lucide-react/dist/esm/icons/check';
import Search from 'lucide-react/dist/esm/icons/search';
import { getMyChartsFiltered, type ChartResponse } from '../../services/api';
import { Button } from '../Button';
import { LoadingSpinner } from '../LoadingSpinner';
import './AddChartsModal.css';

interface AddChartsModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (chartIds: string[]) => void;
  existingChartIds: Set<string>;
}

export function AddChartsModal({ open, onClose, onAdd, existingChartIds }: AddChartsModalProps) {
  const [charts, setCharts] = useState<ChartResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const fetchCharts = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getMyChartsFiltered({ limit: 50, offset: 0, search });
      setCharts(result.charts);
    } catch {
      setCharts([]);
    } finally {
      setIsLoading(false);
    }
  }, [search]);

  useEffect(() => {
    if (open) {
      fetchCharts();
      setSelected(new Set());
    }
  }, [open, fetchCharts]);

  const toggleChart = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAdd = () => {
    onAdd(Array.from(selected));
    onClose();
  };

  if (!open) return null;

  return (
    <div className="acm-overlay" onClick={onClose}>
      <div className="acm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="acm-header">
          <h2 className="acm-title">Add Charts</h2>
          <button className="acm-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="acm-search">
          <Search size={16} className="acm-search-icon" />
          <input
            type="text"
            className="acm-search-input"
            placeholder="Search your charts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            spellCheck={false}
          />
        </div>

        <div className="acm-list">
          {isLoading ? (
            <div className="acm-loading"><LoadingSpinner /></div>
          ) : charts.length === 0 ? (
            <div className="acm-empty">No charts found</div>
          ) : (
            charts.map((chart) => {
              const alreadyAdded = existingChartIds.has(chart.id);
              const isSelected = selected.has(chart.id);
              return (
                <button
                  key={chart.id}
                  className={`acm-item ${isSelected ? 'acm-item--selected' : ''} ${alreadyAdded ? 'acm-item--disabled' : ''}`}
                  onClick={() => !alreadyAdded && toggleChart(chart.id)}
                  disabled={alreadyAdded}
                  type="button"
                >
                  <div className="acm-item-check">
                    {(isSelected || alreadyAdded) && <Check size={14} />}
                  </div>
                  <div className="acm-item-info">
                    <span className="acm-item-title">{chart.title || 'Untitled'}</span>
                    <span className="acm-item-type">{chart.config?.type || 'chart'}</span>
                  </div>
                  {alreadyAdded && <span className="acm-item-badge">Added</span>}
                </button>
              );
            })
          )}
        </div>

        <div className="acm-footer">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={handleAdd}
            disabled={selected.size === 0}
          >
            Add {selected.size > 0 ? `(${selected.size})` : ''}
          </Button>
        </div>
      </div>
    </div>
  );
}
