import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import BarChart3 from 'lucide-react/dist/esm/icons/bar-chart-3';
import BarChart2 from 'lucide-react/dist/esm/icons/bar-chart-2';
import LineChart from 'lucide-react/dist/esm/icons/line-chart';
import AreaChart from 'lucide-react/dist/esm/icons/area-chart';
import PieChart from 'lucide-react/dist/esm/icons/pie-chart';
import Table2 from 'lucide-react/dist/esm/icons/table-2';
import Hexagon from 'lucide-react/dist/esm/icons/hexagon';
import Circle from 'lucide-react/dist/esm/icons/circle';
import Grid from 'lucide-react/dist/esm/icons/grid';
import Hash from 'lucide-react/dist/esm/icons/hash';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles';
import MapPin from 'lucide-react/dist/esm/icons/map-pin';
import Globe from 'lucide-react/dist/esm/icons/globe';
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
import type { ChartConfig, ChartType, StyleVariant, ChartData, AiMode, MapVariant, MapScope, YAxisBaselineMode, SeriesChartType, AxisSide, SeriesOverride } from '../types';
import { STYLE_VARIANTS, getEffectiveColors, isComboChart, resolveSeriesConfig, suggestComboConfig } from '../types';
import { createFixedNumberFormatter, getAdaptiveDecimalPlaces } from '../utils/numberFormat';
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
  { id: 'histogram', icon: BarChart2, label: 'Histogram' },
  { id: 'radar', icon: Hexagon, label: 'Radar' },
  { id: 'scatter', icon: Circle, label: 'Scatter' },
  { id: 'table', icon: Table2, label: 'Table' },
  { id: 'map', icon: Globe, label: 'Map' },
  { id: 'infographic', icon: Sparkles, label: 'AI Magic', special: true },
];

const MAP_SCOPE_OPTIONS: { id: MapScope; icon: typeof Globe; label: string; description: string }[] = [
  { id: 'us-states', icon: MapPin, label: 'US States', description: 'United States by state' },
  { id: 'world', icon: Globe, label: 'World', description: 'World countries' },
];

const MAP_VARIANT_OPTIONS: { id: MapVariant; label: string; description: string }[] = [
  { id: 'choropleth', label: 'Choropleth', description: 'Color-filled regions' },
  { id: 'bubble', label: 'Bubble', description: 'Sized circles on map' },
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

const Y_AXIS_BASELINE_OPTIONS: { id: YAxisBaselineMode; label: string }[] = [
  { id: 'auto', label: 'Auto (smart)' },
  { id: 'zero', label: 'Start at 0' },
  { id: 'data', label: 'Data range' },
];

const COMBO_CHART_TYPES: { id: SeriesChartType; icon: typeof BarChart3; label: string }[] = [
  { id: 'bar', icon: BarChart3, label: 'Bar' },
  { id: 'line', icon: LineChart, label: 'Line' },
  { id: 'area', icon: AreaChart, label: 'Area' },
];

const COMBO_ELIGIBLE_TYPES: Set<ChartType> = new Set(['bar', 'line', 'area']);

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

  const showComboControls =
    COMBO_ELIGIBLE_TYPES.has(config.type) &&
    data.series.length >= 2 &&
    config.barLayout !== 'horizontal';

  const combo = isComboChart(config);
  const hasRightAxis = combo && data.series.some(
    (s) => resolveSeriesConfig(s.name, config).axis === 'right',
  );

  // Show a "use dual axis" suggestion when we detect mixed-unit data but user hasn't configured it
  const comboSuggestion = !combo && showComboControls
    ? suggestComboConfig(data, config.type)
    : null;

  const applyComboSuggestion = () => {
    if (!comboSuggestion) return;
    updateConfig({
      seriesConfig: comboSuggestion.seriesConfig,
      rightYAxisLabel: comboSuggestion.rightYAxisLabel,
    });
  };

  const updateSeriesConfig = (seriesName: string, patch: Partial<SeriesOverride>) => {
    const prev = config.seriesConfig ?? {};
    const current = prev[seriesName] ?? {};
    const merged = { ...current, ...patch };
    // Derive the base type for cleanup
    const baseType = (config.type === 'bar' || config.type === 'line' || config.type === 'area')
      ? config.type : 'bar';
    // Strip defaults so empty entries don't linger
    if (merged.chartType === baseType) delete merged.chartType;
    if (merged.axis === 'left') delete merged.axis;
    const next = { ...prev };
    if (Object.keys(merged).length === 0) {
      delete next[seriesName];
    } else {
      next[seriesName] = merged;
    }
    updateConfig({
      seriesConfig: Object.keys(next).length > 0 ? next : undefined,
    });
  };

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
                aiMode: type.id === 'infographic' ? (config.aiMode || 'chart') : undefined,
                aiReadyToGenerate: type.id === 'infographic' ? false : undefined,
                mapVariant: type.id === 'map' ? (config.mapVariant || 'choropleth') : undefined,
                mapScope: type.id === 'map' ? (config.mapScope || data.mapScope || 'us-states') : undefined,
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

      {/* Map options (only when map is selected) */}
      {config.type === 'map' && (
        <div className="controls-map-options">
          <div className="map-options-row">
            <div className="map-option-group">
              <span className="map-option-label">Scope</span>
              <div className="map-scope-grid">
                {MAP_SCOPE_OPTIONS.map((scopeOpt) => (
                  <button
                    key={scopeOpt.id}
                    className={`map-scope-button ${config.mapScope === scopeOpt.id ? 'active' : ''}`}
                    onClick={() => updateConfig({ mapScope: scopeOpt.id })}
                    title={scopeOpt.description}
                  >
                    <scopeOpt.icon size={14} />
                    <span>{scopeOpt.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="map-option-group">
              <span className="map-option-label">Style</span>
              <div className="map-variant-grid">
                {MAP_VARIANT_OPTIONS.map((variantOpt) => (
                  <button
                    key={variantOpt.id}
                    className={`map-variant-button ${config.mapVariant === variantOpt.id ? 'active' : ''}`}
                    onClick={() => updateConfig({ mapVariant: variantOpt.id })}
                    title={variantOpt.description}
                  >
                    <span>{variantOpt.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          {(!data.mapRegions || data.mapRegions.length === 0) && (
            <div className="map-no-data-hint">
              <MapPin size={14} />
              <span>Use an AI prompt like "US population by state" to generate map data</span>
            </div>
          )}
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

            {config.type === 'bar' && data.series.length > 1 && (
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

            {config.type === 'bar' && (
              <label className="toggle-item">
                <input
                  type="checkbox"
                  checked={config.barLayout === 'horizontal'}
                  onChange={(e) => updateConfig({ barLayout: e.target.checked ? 'horizontal' : 'vertical' })}
                />
                <span className="toggle-switch" />
                <span className="toggle-label">Horizontal</span>
              </label>
            )}
          </div>
          {(config.type === 'bar' || config.type === 'histogram') && (
            <label className="baseline-mode-control">
              <span className="baseline-mode-label">Value axis baseline</span>
              <select
                className="baseline-mode-select"
                value={config.yAxisBaselineMode ?? 'auto'}
                onChange={(e) => updateConfig({ yAxisBaselineMode: e.target.value as YAxisBaselineMode })}
                aria-label="Value axis baseline mode"
              >
                {Y_AXIS_BASELINE_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <div className="control-section data-summary full-width">
          <SectionHeader icon={Hash} label="Data Summary" />
          {comboSuggestion && (
            <button className="combo-suggest-banner" onClick={applyComboSuggestion}>
              <Sparkles size={12} />
              <span>
                Mixed units detected — use <strong>Dual Axis</strong> to show{' '}
                {Object.keys(comboSuggestion.seriesConfig).join(', ')} as % on the right
              </span>
            </button>
          )}
          <div className="data-grid">
            {data.series.map((series, idx) => {
              const resolved = resolveSeriesConfig(series.name, config);
              return (
                <div key={series.name} className="data-series-item">
                  <div
                    className="series-color"
                    style={{ background: effectiveColors[idx % effectiveColors.length] }}
                  />
                  <span className="series-name">{series.name}</span>
                  <span className="series-stats">
                    {(() => {
                      const numericValues = series.data.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
                      if (numericValues.length === 0) return 'No numeric data';
                      const formatter = createFixedNumberFormatter(getAdaptiveDecimalPlaces(numericValues));
                      const min = Math.min(...numericValues);
                      const max = Math.max(...numericValues);
                      return `${formatter.format(min)} — ${formatter.format(max)}`;
                    })()}
                  </span>
                  {showComboControls && (
                    <div className="combo-series-controls">
                      <div className="combo-type-selector" role="group" aria-label={`Chart type for ${series.name}`}>
                        {COMBO_CHART_TYPES.map((ct) => (
                          <button
                            key={ct.id}
                            className={`combo-type-btn ${resolved.chartType === ct.id ? 'active' : ''}`}
                            onClick={() => updateSeriesConfig(series.name, { chartType: ct.id })}
                            aria-label={`${ct.label} chart for ${series.name}`}
                            aria-pressed={resolved.chartType === ct.id}
                            title={ct.label}
                          >
                            <ct.icon size={12} />
                          </button>
                        ))}
                      </div>
                      <div className="combo-axis-selector" role="group" aria-label={`Axis for ${series.name}`}>
                        {(['left', 'right'] as AxisSide[]).map((side) => (
                          <button
                            key={side}
                            className={`combo-axis-btn ${resolved.axis === side ? 'active' : ''}`}
                            onClick={() => updateSeriesConfig(series.name, { axis: side })}
                            aria-label={`${side === 'left' ? 'Left' : 'Right'} axis for ${series.name}`}
                            aria-pressed={resolved.axis === side}
                            title={`${side === 'left' ? 'Left' : 'Right'} axis`}
                          >
                            {side === 'left' ? 'L' : 'R'}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {showComboControls && hasRightAxis && (
            <div className="combo-right-axis-label">
              <input
                type="text"
                className="combo-right-axis-input"
                placeholder="Right axis label..."
                value={config.rightYAxisLabel ?? ''}
                onChange={(e) => updateConfig({ rightYAxisLabel: e.target.value || undefined })}
                spellCheck={false}
              />
            </div>
          )}
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
