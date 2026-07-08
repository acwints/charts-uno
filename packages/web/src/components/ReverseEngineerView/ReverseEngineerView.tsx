import { motion } from 'motion/react';
import { ChartPreview, type ChartLogoOption } from '../ChartPreview';
import { ChartControls } from '../ChartControls';
import type { ChartData, ChartConfig } from '../../types';
import type { WatermarkSettings } from '../../services/exportService';
import './ReverseEngineerView.css';

interface ReverseEngineerViewProps {
  initialData: ChartData;
  config: ChartConfig;
  onConfigChange: (config: ChartConfig) => void;
  chartRef: React.RefObject<HTMLDivElement | null>;
  watermark?: WatermarkSettings;
  logoOptions?: ChartLogoOption[];
  logoSelectionValue?: string;
  canCustomizeBranding?: boolean;
  onLogoSelectionChange?: (value: string) => void;
}

export function ReverseEngineerView({
  initialData,
  config,
  onConfigChange,
  chartRef,
  watermark,
  logoOptions,
  logoSelectionValue,
  canCustomizeBranding,
  onLogoSelectionChange,
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
              <div className="re-ai-summary">
                <span className="section-label re-ai-label">AI Insight</span>
                <p className="re-ai-text">{initialData.aiSummary}</p>
              </div>
            )}
            <ChartPreview
              data={initialData}
              config={config}
              watermark={watermark}
            />
          </div>
          <div className="re-controls-area">
            <ChartControls
              config={config}
              onChange={onConfigChange}
              data={initialData}
              watermark={watermark}
              logoOptions={logoOptions}
              logoSelectionValue={logoSelectionValue}
              canCustomizeBranding={canCustomizeBranding}
              onLogoSelectionChange={onLogoSelectionChange}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
