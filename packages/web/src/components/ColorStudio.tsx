import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Palette,
  Sun,
  Moon,
  Pipette,
  RotateCcw,
  Sparkles,
  ChevronDown,
  Check,
} from 'lucide-react';
import type { ChartConfig, CustomColors, ColorScheme } from '../types';
import { COLOR_PALETTES, PRESET_PALETTES, getTheme } from '../types';
import './ColorStudio.css';

interface ColorStudioProps {
  config: ChartConfig;
  onChange: (config: ChartConfig) => void;
  seriesCount: number;
}

const COLOR_SCHEMES: { id: ColorScheme; label: string }[] = [
  { id: 'default', label: 'Default' },
  { id: 'cool', label: 'Cool' },
  { id: 'warm', label: 'Warm' },
  { id: 'editorial', label: 'Editorial' },
  { id: 'monochrome', label: 'Mono' },
  { id: 'muted', label: 'Muted' },
];

export function ColorStudio({ config, onChange, seriesCount }: ColorStudioProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>('palette');
  const [showPresets, setShowPresets] = useState(false);

  const theme = getTheme(config.colorScheme, config.themeMode);
  const currentColors = config.customColors?.seriesColors || COLOR_PALETTES[config.colorScheme];

  const updateConfig = (updates: Partial<ChartConfig>) => {
    onChange({ ...config, ...updates });
  };

  const updateCustomColors = (updates: Partial<CustomColors>) => {
    const newCustomColors = { ...config.customColors, ...updates };
    // Clean up empty values
    Object.keys(newCustomColors).forEach(key => {
      if (newCustomColors[key as keyof CustomColors] === undefined) {
        delete newCustomColors[key as keyof CustomColors];
      }
    });
    updateConfig({ customColors: Object.keys(newCustomColors).length > 0 ? newCustomColors : undefined });
  };

  const updateSeriesColor = (index: number, color: string) => {
    const newColors = [...currentColors];
    newColors[index] = color;
    updateCustomColors({ seriesColors: newColors });
  };

  const resetToDefaults = () => {
    updateConfig({ customColors: undefined });
  };

  const applyPreset = (presetColors: string[]) => {
    updateCustomColors({ seriesColors: presetColors.slice(0, seriesCount) });
    setShowPresets(false);
  };

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  return (
    <div className="color-studio">
      {/* Theme Mode Toggle */}
      <div className="studio-header">
        <div className="studio-title">
          <Sparkles size={14} />
          <span>Color Studio</span>
        </div>
        <div className="theme-mode-toggle">
          <button
            className={`mode-btn ${config.themeMode === 'light' ? 'active' : ''}`}
            onClick={() => updateConfig({ themeMode: 'light' })}
            title="Light Mode"
          >
            <Sun size={14} />
          </button>
          <button
            className={`mode-btn ${config.themeMode === 'dark' ? 'active' : ''}`}
            onClick={() => updateConfig({ themeMode: 'dark' })}
            title="Dark Mode"
          >
            <Moon size={14} />
          </button>
        </div>
      </div>

      {/* Color Scheme Selection */}
      <div className="studio-section">
        <button
          className="section-header"
          onClick={() => toggleSection('scheme')}
        >
          <div className="section-title">
            <Palette size={14} />
            <span>Color Scheme</span>
          </div>
          <ChevronDown
            size={14}
            className={`section-chevron ${expandedSection === 'scheme' ? 'expanded' : ''}`}
          />
        </button>
        <AnimatePresence>
          {expandedSection === 'scheme' && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="section-content"
            >
              <div className="scheme-grid">
                {COLOR_SCHEMES.map((scheme) => (
                  <button
                    key={scheme.id}
                    className={`scheme-btn ${config.colorScheme === scheme.id ? 'active' : ''}`}
                    onClick={() => updateConfig({ colorScheme: scheme.id })}
                  >
                    <div className="scheme-preview">
                      {COLOR_PALETTES[scheme.id].slice(0, 4).map((color, idx) => (
                        <div
                          key={idx}
                          className="preview-dot"
                          style={{ background: color }}
                        />
                      ))}
                    </div>
                    <span className="scheme-name">{scheme.label}</span>
                    {config.colorScheme === scheme.id && (
                      <Check size={12} className="scheme-check" />
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Series Colors */}
      <div className="studio-section">
        <button
          className="section-header"
          onClick={() => toggleSection('palette')}
        >
          <div className="section-title">
            <Pipette size={14} />
            <span>Data Colors</span>
          </div>
          <ChevronDown
            size={14}
            className={`section-chevron ${expandedSection === 'palette' ? 'expanded' : ''}`}
          />
        </button>
        <AnimatePresence>
          {expandedSection === 'palette' && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="section-content"
            >
              {/* Quick Presets */}
              <div className="presets-row">
                <button
                  className="presets-btn"
                  onClick={() => setShowPresets(!showPresets)}
                >
                  <Sparkles size={12} />
                  <span>Quick Presets</span>
                  <ChevronDown
                    size={12}
                    className={showPresets ? 'rotated' : ''}
                  />
                </button>
                <button
                  className="reset-btn"
                  onClick={resetToDefaults}
                  title="Reset to defaults"
                >
                  <RotateCcw size={12} />
                </button>
              </div>

              <AnimatePresence>
                {showPresets && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="presets-grid"
                  >
                    {PRESET_PALETTES.map((preset) => (
                      <button
                        key={preset.id}
                        className="preset-btn"
                        onClick={() => applyPreset(preset.colors)}
                        title={preset.name}
                      >
                        <div className="preset-colors">
                          {preset.colors.slice(0, 6).map((color, idx) => (
                            <div
                              key={idx}
                              className="preset-dot"
                              style={{ background: color }}
                            />
                          ))}
                        </div>
                        <span className="preset-name">{preset.name}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Individual Color Pickers */}
              <div className="color-pickers">
                {currentColors.slice(0, Math.max(seriesCount, 4)).map((color, idx) => (
                  <div key={idx} className="color-picker-item">
                    <div className="picker-label">Series {idx + 1}</div>
                    <div className="picker-controls">
                      <input
                        type="color"
                        value={color}
                        onChange={(e) => updateSeriesColor(idx, e.target.value)}
                        className="color-input"
                      />
                      <input
                        type="text"
                        value={color}
                        onChange={(e) => updateSeriesColor(idx, e.target.value)}
                        className="hex-input"
                        placeholder="#000000"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Background & Theme Colors */}
      <div className="studio-section">
        <button
          className="section-header"
          onClick={() => toggleSection('background')}
        >
          <div className="section-title">
            <Sun size={14} />
            <span>Background</span>
          </div>
          <ChevronDown
            size={14}
            className={`section-chevron ${expandedSection === 'background' ? 'expanded' : ''}`}
          />
        </button>
        <AnimatePresence>
          {expandedSection === 'background' && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="section-content"
            >
              <div className="bg-color-grid">
                <div className="bg-color-item">
                  <span className="bg-label">Background</span>
                  <div className="bg-controls">
                    <input
                      type="color"
                      value={config.customColors?.background || theme.background}
                      onChange={(e) => updateCustomColors({ background: e.target.value })}
                      className="color-input"
                    />
                    <input
                      type="text"
                      value={config.customColors?.background || theme.background}
                      onChange={(e) => updateCustomColors({ background: e.target.value })}
                      className="hex-input"
                    />
                  </div>
                </div>
                <div className="bg-color-item">
                  <span className="bg-label">Card</span>
                  <div className="bg-controls">
                    <input
                      type="color"
                      value={config.customColors?.cardBackground || theme.cardBackground}
                      onChange={(e) => updateCustomColors({ cardBackground: e.target.value })}
                      className="color-input"
                    />
                    <input
                      type="text"
                      value={config.customColors?.cardBackground || theme.cardBackground}
                      onChange={(e) => updateCustomColors({ cardBackground: e.target.value })}
                      className="hex-input"
                    />
                  </div>
                </div>
                <div className="bg-color-item">
                  <span className="bg-label">Text</span>
                  <div className="bg-controls">
                    <input
                      type="color"
                      value={config.customColors?.text || theme.text}
                      onChange={(e) => updateCustomColors({ text: e.target.value })}
                      className="color-input"
                    />
                    <input
                      type="text"
                      value={config.customColors?.text || theme.text}
                      onChange={(e) => updateCustomColors({ text: e.target.value })}
                      className="hex-input"
                    />
                  </div>
                </div>
                <div className="bg-color-item">
                  <span className="bg-label">Grid</span>
                  <div className="bg-controls">
                    <input
                      type="color"
                      value={config.customColors?.grid || theme.grid}
                      onChange={(e) => updateCustomColors({ grid: e.target.value })}
                      className="color-input"
                    />
                    <input
                      type="text"
                      value={config.customColors?.grid || theme.grid}
                      onChange={(e) => updateCustomColors({ grid: e.target.value })}
                      className="hex-input"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Live Preview Bar */}
      <div className="studio-preview">
        <div
          className="preview-card"
          style={{
            background: config.customColors?.cardBackground || theme.cardBackground,
            borderColor: config.customColors?.border || theme.border
          }}
        >
          <div
            className="preview-title"
            style={{ color: config.customColors?.text || theme.text }}
          >
            Preview
          </div>
          <div className="preview-bars">
            {currentColors.slice(0, seriesCount || 3).map((color, idx) => (
              <div
                key={idx}
                className="preview-bar"
                style={{
                  background: color,
                  height: `${40 + Math.random() * 40}%`
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
