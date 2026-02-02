import { useState, useCallback } from 'react';
import { motion } from 'motion/react';
import { BarChart3, Table2 } from 'lucide-react';
import { ChartPreview } from '../ChartPreview';
import { ChartControls } from '../ChartControls';
import { ChatPanel } from '../ChatPanel';
import { EditableSpreadsheet } from '../EditableSpreadsheet/EditableSpreadsheet';
import type { ChartData, ChartConfig, EditableChartState } from '../../types';
import './ReverseEngineerView.css';

type ViewMode = 'chart' | 'editor';

interface ReverseEngineerViewProps {
  initialData: ChartData;
  config: ChartConfig;
  onConfigChange: (config: ChartConfig) => void;
  chartRef: React.RefObject<HTMLDivElement | null>;
}

export function ReverseEngineerView({
  initialData,
  config,
  onConfigChange,
  chartRef,
}: ReverseEngineerViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('chart');
  const [editableState, setEditableState] = useState<EditableChartState>({
    original: initialData,
    current: initialData,
    isDirty: false,
  });

  const handleDataChange = useCallback((newData: ChartData) => {
    setEditableState((prev) => ({
      ...prev,
      current: newData,
      isDirty: true,
    }));
  }, []);

  const handleReset = useCallback(() => {
    setEditableState((prev) => ({
      ...prev,
      current: prev.original,
      isDirty: false,
    }));
  }, []);

  return (
    <motion.div
      className="reverse-engineer-view with-assistant"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="re-main-content">
        <div className="re-view-toggle">
          <button
            className={`re-toggle-btn ${viewMode === 'chart' ? 'active' : ''}`}
            onClick={() => setViewMode('chart')}
          >
            <BarChart3 size={18} />
            <span>Chart</span>
          </button>
          <button
            className={`re-toggle-btn ${viewMode === 'editor' ? 'active' : ''}`}
            onClick={() => setViewMode('editor')}
          >
            <Table2 size={18} />
            <span>Edit Data</span>
            {editableState.isDirty && <span className="re-dirty-indicator" />}
          </button>
        </div>

        {viewMode === 'chart' ? (
          <div className="re-workspace">
            <div className="re-chart-area" ref={chartRef}>
              {editableState.current.aiSummary && (
                <div className="chart-ai-summary">
                  <span className="chart-ai-label">AI Insight</span>
                  <p className="chart-ai-text">{editableState.current.aiSummary}</p>
                </div>
              )}
              <ChartPreview data={editableState.current} config={config} />
            </div>
            <div className="re-controls-area">
              <ChartControls
                config={config}
                onChange={onConfigChange}
                data={editableState.current}
              />
            </div>
          </div>
        ) : (
          <div className="re-editor-area">
            <EditableSpreadsheet
              data={editableState.current}
              colorScheme={config.colorScheme}
              isDirty={editableState.isDirty}
              onChange={handleDataChange}
              onReset={handleReset}
            />
          </div>
        )}
      </div>

      <ChatPanel
        data={editableState.current}
        config={config}
        onDataChange={handleDataChange}
        onConfigChange={onConfigChange}
      />
    </motion.div>
  );
}
