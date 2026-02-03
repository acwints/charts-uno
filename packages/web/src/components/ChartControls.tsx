import { motion } from 'motion/react';
import {
  BarChart3,
  LineChart,
  AreaChart,
  PieChart,
  Table2,
  Hexagon,
  Circle,
  Grid,
  Hash,
  Sparkles,
  Briefcase,
  Smile,
  Newspaper,
  Minus,
  Paintbrush,
  Zap,
} from 'lucide-react';
import type { ChartConfig, ChartType, StyleVariant, ChartData } from '../types';
import { STYLE_VARIANTS, getEffectiveColors } from '../types';
import { ColorStudio } from './ColorStudio';
import './ChartControls.css';

interface ChartControlsProps {
  config: ChartConfig;
  onChange: (config: ChartConfig) => void;
  data: ChartData;
}

const CHART_TYPES: { id: ChartType; icon: typeof BarChart3; label: string; special?: boolean }[] = [
  { id: 'bar', icon: BarChart3, label: 'Bar' },
  { id: 'line', icon: LineChart, label: 'Line' },
  { id: 'area', icon: AreaChart, label: 'Area' },
  { id: 'pie', icon: PieChart, label: 'Pie' },
  { id: 'radar', icon: Hexagon, label: 'Radar' },
  { id: 'scatter', icon: Circle, label: 'Scatter' },
  { id: 'table', icon: Table2, label: 'Table' },
  { id: 'infographic', icon: Sparkles, label: 'AI Magic', special: true },
];

const STYLE_VARIANT_OPTIONS: { id: StyleVariant; icon: typeof Briefcase; label: string }[] = [
  { id: 'professional', icon: Briefcase, label: 'Professional' },
  { id: 'playful', icon: Smile, label: 'Playful' },
  { id: 'editorial', icon: Newspaper, label: 'Editorial' },
  { id: 'minimalist', icon: Minus, label: 'Minimal' },
  { id: 'bold', icon: Zap, label: 'Bold' },
];

export function ChartControls({ config, onChange, data }: ChartControlsProps) {
  const updateConfig = (updates: Partial<ChartConfig>) => {
    onChange({ ...config, ...updates });
  };

  const effectiveColors = getEffectiveColors(config.colorScheme, config.customColors?.seriesColors);

  return (
    <motion.div
      className="chart-controls"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
    >
      {/* Full-width title */}
      <div className="controls-top-row">
        <input
          type="text"
          className="control-input-title"
          placeholder="Chart title..."
          value={config.title}
          onChange={(e) => updateConfig({ title: e.target.value })}
        />
      </div>

      {/* Full-width chart type */}
      <div className="controls-type-row">
        <div className="chart-type-grid">
          {CHART_TYPES.map((type) => (
            <button
              key={type.id}
              className={`type-button ${config.type === type.id ? 'active' : ''} ${type.special ? 'special' : ''}`}
              onClick={() => updateConfig({ type: type.id })}
              title={type.label}
            >
              <type.icon size={18} />
              <span className="type-label">{type.label}</span>
            </button>
          ))}
        </div>
        {data.aiReasoning && (
          <div className="ai-reasoning">
            <Sparkles size={12} />
            <span>{data.aiReasoning}</span>
          </div>
        )}
      </div>

      {/* Color Studio (always visible) */}
      <ColorStudio
        config={config}
        onChange={onChange}
        seriesNames={data.series.map(s => s.name)}
      />

      {/* Two-column grid for remaining controls */}
      <div className="controls-grid">
        <div className="control-section">
          <label className="control-label section-label">
            <Paintbrush size={14} />
            <span>Style Variant</span>
          </label>
          <div className="style-variant-grid">
            {STYLE_VARIANT_OPTIONS.map((variant) => {
              const variantConfig = STYLE_VARIANTS[variant.id];
              return (
                <button
                  key={variant.id}
                  className={`style-variant-button ${config.styleVariant === variant.id ? 'active' : ''}`}
                  onClick={() => updateConfig({ styleVariant: variant.id })}
                  title={variantConfig.description}
                >
                  <variant.icon size={16} />
                  <span className="variant-label">{variant.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="control-section">
          <label className="control-label section-label">
            <Grid size={14} />
            <span>Display Options</span>
          </label>
          <div className="toggle-list">
            <label className="toggle-item">
              <input
                type="checkbox"
                checked={config.showGrid}
                onChange={(e) => updateConfig({ showGrid: e.target.checked })}
              />
              <span className="toggle-switch" />
              <span className="toggle-label">Show Grid</span>
            </label>

            <label className="toggle-item">
              <input
                type="checkbox"
                checked={config.showLegend}
                onChange={(e) => updateConfig({ showLegend: e.target.checked })}
              />
              <span className="toggle-switch" />
              <span className="toggle-label">Show Legend</span>
            </label>

            <label className="toggle-item">
              <input
                type="checkbox"
                checked={config.showValues}
                onChange={(e) => updateConfig({ showValues: e.target.checked })}
              />
              <span className="toggle-switch" />
              <span className="toggle-label">Show Values</span>
            </label>

            <label className="toggle-item">
              <input
                type="checkbox"
                checked={config.showBorder}
                onChange={(e) => updateConfig({ showBorder: e.target.checked })}
              />
              <span className="toggle-switch" />
              <span className="toggle-label">Border</span>
            </label>
          </div>
        </div>

        <div className="control-section data-summary full-width">
          <label className="control-label section-label">
            <Hash size={14} />
            <span>Data Summary</span>
          </label>
          <div className="data-grid">
            {data.series.map((series, idx) => (
              <div key={series.name} className="data-series-item">
                <div
                  className="series-color"
                  style={{ background: effectiveColors[idx % effectiveColors.length] }}
                />
                <span className="series-name">{series.name}</span>
                <span className="series-stats">
                  {Math.min(...series.data).toLocaleString()} — {Math.max(...series.data).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="controls-footer">
        <div className="ai-badge">
          <Zap size={12} />
          <span>AI-Optimized Layout</span>
        </div>
      </div>
    </motion.div>
  );
}
