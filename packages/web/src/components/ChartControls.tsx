import { motion } from 'motion/react';
import {
  BarChart3,
  LineChart,
  AreaChart,
  PieChart,
  Hexagon,
  Circle,
  Grid,
  Hash,
  Palette,
  Type,
  Sparkles,
  Briefcase,
  Smile,
  Newspaper,
  Minus,
  Paintbrush,
  Zap,
} from 'lucide-react';
import type { ChartConfig, ChartType, ColorScheme, StyleVariant, ChartData } from '../types';
import { COLOR_PALETTES, STYLE_VARIANTS } from '../types';
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
  { id: 'infographic', icon: Sparkles, label: 'AI Magic', special: true },
];

const COLOR_SCHEMES: { id: ColorScheme; label: string }[] = [
  { id: 'default', label: 'Default' },
  { id: 'cool', label: 'Cool' },
  { id: 'warm', label: 'Warm' },
  { id: 'editorial', label: 'Editorial' },
  { id: 'monochrome', label: 'Mono' },
  { id: 'muted', label: 'Muted' },
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

  return (
    <motion.div
      className="chart-controls"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
    >
      <div className="controls-header">
        <h3 className="controls-title">Customize</h3>
        <span className="controls-badge">{data.series.length} series</span>
      </div>

      <div className="control-section">
        <label className="control-label">
          <Type size={14} />
          <span>Chart Title</span>
        </label>
        <input
          type="text"
          className="control-input"
          placeholder="Enter a title..."
          value={config.title}
          onChange={(e) => updateConfig({ title: e.target.value })}
        />
      </div>

      <div className="control-section">
        <label className="control-label">
          <BarChart3 size={14} />
          <span>Chart Type</span>
        </label>
        <div className="chart-type-grid">
          {CHART_TYPES.map((type) => (
            <button
              key={type.id}
              className={`type-button ${config.type === type.id ? 'active' : ''} ${type.special ? 'special' : ''}`}
              onClick={() => updateConfig({ type: type.id })}
              title={type.label}
            >
              <type.icon size={20} />
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


      <div className="control-section">
        <label className="control-label">
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
        <label className="control-label">
          <Palette size={14} />
          <span>Color Scheme</span>
        </label>
        <div className="color-scheme-list">
          {COLOR_SCHEMES.map((scheme) => (
            <button
              key={scheme.id}
              className={`color-scheme-button ${config.colorScheme === scheme.id ? 'active' : ''}`}
              onClick={() => updateConfig({ colorScheme: scheme.id })}
            >
              <div className="color-preview">
                {COLOR_PALETTES[scheme.id].slice(0, 4).map((color, idx) => (
                  <div
                    key={idx}
                    className="color-dot"
                    style={{ background: color }}
                  />
                ))}
              </div>
              <span className="scheme-label">{scheme.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="control-section">
        <label className="control-label">
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
              checked={config.animate}
              onChange={(e) => updateConfig({ animate: e.target.checked })}
            />
            <span className="toggle-switch" />
            <span className="toggle-label">Animations</span>
          </label>
        </div>
      </div>

      <div className="control-section data-summary">
        <label className="control-label">
          <Hash size={14} />
          <span>Data Summary</span>
        </label>
        <div className="data-grid">
          {data.series.map((series, idx) => (
            <div key={series.name} className="data-series-item">
              <div
                className="series-color"
                style={{ background: COLOR_PALETTES[config.colorScheme][idx % COLOR_PALETTES[config.colorScheme].length] }}
              />
              <span className="series-name">{series.name}</span>
              <span className="series-stats">
                {Math.min(...series.data).toLocaleString()} — {Math.max(...series.data).toLocaleString()}
              </span>
            </div>
          ))}
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
