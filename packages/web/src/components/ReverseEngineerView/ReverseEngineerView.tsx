import { motion } from 'motion/react';
import { ChartPreview } from '../ChartPreview';
import { ChartControls } from '../ChartControls';
import type { ChartData, ChartConfig } from '../../types';
import './ReverseEngineerView.css';

interface ReverseEngineerViewProps {
  initialData: ChartData;
  config: ChartConfig;
  onConfigChange: (config: ChartConfig) => void;
  chartRef: React.RefObject<HTMLDivElement | null>;
  viewMode: 'chart' | 'table';
}

export function ReverseEngineerView({
  initialData,
  config,
  onConfigChange,
  chartRef,
  viewMode,
}: ReverseEngineerViewProps) {
  return (
    <motion.div
      className="reverse-engineer-view"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="re-main-content">
        <div className="re-workspace">
          <div className="re-chart-area" ref={chartRef}>
            {initialData.aiSummary && (
              <div className="chart-ai-summary">
                <span className="chart-ai-label">AI Insight</span>
                <p className="chart-ai-text">{initialData.aiSummary}</p>
              </div>
            )}
            <ChartPreview data={initialData} config={config} viewMode={viewMode} />
          </div>
          <div className="re-controls-area">
            <ChartControls
              config={config}
              onChange={onConfigChange}
              data={initialData}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
