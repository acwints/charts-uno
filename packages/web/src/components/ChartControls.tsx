import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import BarChart3 from 'lucide-react/dist/esm/icons/bar-chart-3';
import LineChart from 'lucide-react/dist/esm/icons/line-chart';
import AreaChart from 'lucide-react/dist/esm/icons/area-chart';
import PieChart from 'lucide-react/dist/esm/icons/pie-chart';
import Table2 from 'lucide-react/dist/esm/icons/table-2';
import Hexagon from 'lucide-react/dist/esm/icons/hexagon';
import Circle from 'lucide-react/dist/esm/icons/circle';
import Grid from 'lucide-react/dist/esm/icons/grid';
import Hash from 'lucide-react/dist/esm/icons/hash';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles';
import ExternalLink from 'lucide-react/dist/esm/icons/external-link';
import Briefcase from 'lucide-react/dist/esm/icons/briefcase';
import Smile from 'lucide-react/dist/esm/icons/smile';
import Newspaper from 'lucide-react/dist/esm/icons/newspaper';
import Minus from 'lucide-react/dist/esm/icons/minus';
import Paintbrush from 'lucide-react/dist/esm/icons/paintbrush';
import Zap from 'lucide-react/dist/esm/icons/zap';
import Palette from 'lucide-react/dist/esm/icons/palette';
import Image from 'lucide-react/dist/esm/icons/image';
import MessageSquare from 'lucide-react/dist/esm/icons/message-square';
import Play from 'lucide-react/dist/esm/icons/play';
import type { ChartConfig, ChartType, StyleVariant, ChartData, AiMode } from '../types';
import { STYLE_VARIANTS, getEffectiveColors } from '../types';
import { ColorStudio } from './ColorStudio';
import { SectionHeader } from './SectionHeader';
import { useTeam } from '../contexts/TeamContext';
import { getTeamBranding, type TeamBranding } from '../services/api';
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

const BASE_STYLE_VARIANT_OPTIONS: { id: StyleVariant; icon: typeof Briefcase; label: string }[] = [
  { id: 'professional', icon: Briefcase, label: 'Professional' },
  { id: 'playful', icon: Smile, label: 'Playful' },
  { id: 'editorial', icon: Newspaper, label: 'Editorial' },
  { id: 'minimalist', icon: Minus, label: 'Minimal' },
  { id: 'bold', icon: Zap, label: 'Bold' },
];

const BRAND_STYLE_OPTION: { id: StyleVariant; icon: typeof Palette; label: string } = {
  id: 'brand', icon: Palette, label: 'Brand',
};

const AI_MODE_OPTIONS: { id: AiMode; icon: typeof BarChart3; label: string; description: string }[] = [
  { id: 'chart', icon: BarChart3, label: 'Chart', description: 'AI-enhanced chart visualization' },
  { id: 'infographic', icon: Image, label: 'Infographic', description: 'Visual infographic design' },
  { id: 'custom', icon: MessageSquare, label: 'Custom', description: 'Custom AI generation with prompt' },
];

export function ChartControls({ config, onChange, data }: ChartControlsProps) {
  const { currentTeam } = useTeam();
  const [branding, setBranding] = useState<TeamBranding | null>(null);

  // Fetch team branding to check for brand colors
  useEffect(() => {
    if (currentTeam?.id) {
      getTeamBranding(currentTeam.id)
        .then(setBranding)
        .catch(() => setBranding(null));
    }
  }, [currentTeam?.id]);

  const hasBrandColors = branding?.brand_colors && branding.brand_colors.length > 0;

  // Build style variant options - add brand option if team has brand colors
  const styleVariantOptions = hasBrandColors
    ? [BRAND_STYLE_OPTION, ...BASE_STYLE_VARIANT_OPTIONS]
    : BASE_STYLE_VARIANT_OPTIONS;

  const updateConfig = (updates: Partial<ChartConfig>) => {
    // When switching to brand style, apply brand colors as custom colors
    if (updates.styleVariant === 'brand' && branding?.brand_colors) {
      updates.customColors = {
        ...config.customColors,
        seriesColors: branding.brand_colors.slice(0, 3), // Use first 3 colors for series
        background: branding.brand_colors[3] || config.customColors?.background,
        text: branding.brand_colors[4] || config.customColors?.text,
      };
      // Set theme based on brand
      if (branding.brand_theme) {
        updates.themeMode = branding.brand_theme;
      }
    }
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
      {/* Full-width title + source link */}
      <div className="controls-top-row">
        <input
          type="text"
          className="control-input-title"
          placeholder="Chart title..."
          value={config.title}
          onChange={(e) => updateConfig({ title: e.target.value })}
        />
        <div className="control-source-link">
          <ExternalLink size={14} className="source-link-icon" />
          <input
            type="url"
            className="control-input-source"
            placeholder="Source URL (optional)"
            value={config.sourceLink ?? ''}
            onChange={(e) => updateConfig({ sourceLink: e.target.value || undefined })}
            spellCheck={false}
          />
        </div>
      </div>

      {/* Full-width chart type */}
      <div className="controls-type-row">
        <div className="chart-type-grid">
          {CHART_TYPES.map((type) => (
            <button
              key={type.id}
              className={`type-button ${config.type === type.id ? 'active' : ''} ${type.special ? 'special' : ''}`}
              onClick={() => updateConfig({
                type: type.id,
                aiMode: type.id === 'infographic' ? (config.aiMode || 'infographic') : undefined,
                aiReadyToGenerate: type.id === 'infographic' ? false : undefined
              })}
              title={type.label}
            >
              <type.icon size={18} />
              <span className="type-label">{type.label}</span>
            </button>
          ))}
        </div>
        {data.aiReasoning && config.type !== 'infographic' && (
          <div className="ai-reasoning">
            <Sparkles size={12} />
            <span>{data.aiReasoning}</span>
          </div>
        )}
      </div>

      {/* AI Mode selector (only when infographic/AI Magic is selected) */}
      {config.type === 'infographic' && (
        <div className="controls-ai-mode">
          <div className="ai-mode-grid">
            {AI_MODE_OPTIONS.map((mode) => (
              <button
                key={mode.id}
                className={`ai-mode-button ${config.aiMode === mode.id ? 'active' : ''}`}
                onClick={() => updateConfig({ aiMode: mode.id, aiReadyToGenerate: false })}
                title={mode.description}
              >
                <mode.icon size={16} />
                <span className="ai-mode-label">{mode.label}</span>
              </button>
            ))}
          </div>
          {config.aiMode === 'custom' && (
            <div className="ai-custom-prompt">
              <textarea
                className="ai-custom-prompt-input"
                placeholder="Describe how you want the AI to visualize your data..."
                value={config.aiCustomPrompt ?? ''}
                onChange={(e) => updateConfig({ aiCustomPrompt: e.target.value })}
                rows={3}
              />
            </div>
          )}
          <button
            className="ai-generate-button"
            onClick={() => updateConfig({ aiReadyToGenerate: true })}
            disabled={config.aiMode === 'custom' && !config.aiCustomPrompt?.trim()}
          >
            <Play size={16} />
            <span>Generate</span>
          </button>
        </div>
      )}

      {/* Color Studio (always visible) */}
      <ColorStudio
        config={config}
        onChange={onChange}
        seriesNames={data.series.map(s => s.name)}
      />

      {/* Two-column grid for remaining controls */}
      <div className="controls-grid">
        <div className="control-section">
          <SectionHeader icon={Paintbrush} label="Style Variant" />
          <div className="style-variant-grid">
            {styleVariantOptions.map((variant) => {
              const variantConfig = STYLE_VARIANTS[variant.id];
              const isBrand = variant.id === 'brand';
              return (
                <button
                  key={variant.id}
                  className={`style-variant-button ${config.styleVariant === variant.id ? 'active' : ''} ${isBrand ? 'brand' : ''}`}
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
          <SectionHeader icon={Grid} label="Display Options" />
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

            {(config.type === 'line' || config.type === 'area') && (
              <label className="toggle-item">
                <input
                  type="checkbox"
                  checked={config.showPoints}
                  onChange={(e) => updateConfig({ showPoints: e.target.checked })}
                />
                <span className="toggle-switch" />
                <span className="toggle-label">Show Points</span>
              </label>
            )}

            {config.type === 'bar' && (
              <label className="toggle-item">
                <input
                  type="checkbox"
                  checked={config.stacked}
                  onChange={(e) => updateConfig({ stacked: e.target.checked })}
                />
                <span className="toggle-switch" />
                <span className="toggle-label">Stacked</span>
              </label>
            )}
          </div>
        </div>

        <div className="control-section data-summary full-width">
          <SectionHeader icon={Hash} label="Data Summary" />
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
