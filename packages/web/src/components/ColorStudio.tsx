import { useState } from 'react';
import { Sun, Moon, RotateCcw, ChevronDown } from 'lucide-react';
import type { ChartConfig, CustomColors, ColorScheme } from '../types';
import { COLOR_PALETTES, PRESET_PALETTES, getTheme } from '../types';
import './ColorStudio.css';

interface ColorStudioProps {
  config: ChartConfig;
  onChange: (config: ChartConfig) => void;
  seriesNames: string[];
}

const SCHEMES: { id: ColorScheme; label: string }[] = [
  { id: 'default', label: 'Default' },
  { id: 'cool', label: 'Cool' },
  { id: 'warm', label: 'Warm' },
  { id: 'editorial', label: 'Editorial' },
  { id: 'monochrome', label: 'Mono' },
  { id: 'muted', label: 'Muted' },
];

export function ColorStudio({ config, onChange, seriesNames }: ColorStudioProps) {
  const [showCustom, setShowCustom] = useState(false);

  const theme = getTheme(config.colorScheme, config.themeMode);
  const palette = config.customColors?.seriesColors || COLOR_PALETTES[config.colorScheme];
  const hasCustomColors = !!config.customColors && Object.keys(config.customColors).length > 0;

  const update = (u: Partial<ChartConfig>) => onChange({ ...config, ...u });

  const setCustom = (u: Partial<CustomColors>) => {
    const merged = { ...config.customColors, ...u };
    update({ customColors: merged });
  };

  const setSeriesColor = (i: number, color: string) => {
    const next = [...palette];
    next[i] = color;
    setCustom({ seriesColors: next });
  };

  const resetColors = () => update({ customColors: undefined });

  const applyPreset = (colors: string[]) => {
    setCustom({ seriesColors: colors.slice(0, Math.max(seriesNames.length, 4)) });
  };

  return (
    <div className="cstudio">
      {/* ── Section 1: Theme ── */}
      <div className="cstudio-section">
        <div className="cstudio-section-head">
          <span className="cstudio-section-label">Theme</span>
          <div className="cstudio-mode">
            <button
              className={`cstudio-mode-btn ${config.themeMode === 'light' ? 'active' : ''}`}
              onClick={() => update({ themeMode: 'light' })}
              aria-label="Light theme"
              aria-pressed={config.themeMode === 'light'}
            >
              <Sun size={11} />
              Light
            </button>
            <button
              className={`cstudio-mode-btn ${config.themeMode === 'dark' ? 'active' : ''}`}
              onClick={() => update({ themeMode: 'dark' })}
              aria-label="Dark theme"
              aria-pressed={config.themeMode === 'dark'}
            >
              <Moon size={11} />
              Dark
            </button>
          </div>
        </div>
        <div className="cstudio-schemes">
          {SCHEMES.map((s) => (
            <button
              key={s.id}
              className={`cstudio-scheme ${config.colorScheme === s.id ? 'active' : ''}`}
              onClick={() => update({ colorScheme: s.id })}
              aria-label={`${s.label} color scheme`}
              aria-pressed={config.colorScheme === s.id}
            >
              <span className="cstudio-scheme-dots">
                {COLOR_PALETTES[s.id].slice(0, 4).map((c, i) => (
                  <span key={i} className="cstudio-dot" style={{ background: c }} />
                ))}
              </span>
              <span className="cstudio-scheme-label">{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Section 2: Data Palette ── */}
      <div className="cstudio-section">
        <span className="cstudio-section-label">Data Palette</span>
        <div className="cstudio-series">
          {seriesNames.slice(0, 8).map((name, i) => (
            <label key={i} className="cstudio-swatch" title={name}>
              <input
                type="color"
                value={palette[i % palette.length]}
                onChange={(e) => setSeriesColor(i, e.target.value)}
                className="cstudio-color-input"
              />
              <span className="cstudio-swatch-name">{name}</span>
            </label>
          ))}
        </div>
        <div className="cstudio-presets">
          {PRESET_PALETTES.map((p) => (
            <button
              key={p.id}
              className="cstudio-preset"
              onClick={() => applyPreset(p.colors)}
              title={p.name}
              aria-label={`Apply ${p.name} palette`}
            >
              {p.colors.slice(0, 5).map((c, i) => (
                <span key={i} className="cstudio-preset-dot" style={{ background: c }} />
              ))}
            </button>
          ))}
        </div>
      </div>

      {/* ── Section 3: Customize ── */}
      <div className="cstudio-section">
        <button
          className="cstudio-section-head cstudio-section-toggle"
          onClick={() => setShowCustom(!showCustom)}
          aria-expanded={showCustom}
        >
          <span className="cstudio-section-label">Customize</span>
          <div className="cstudio-section-right">
            {hasCustomColors && (
              <button
                className="cstudio-reset"
                onClick={(e) => { e.stopPropagation(); resetColors(); }}
                aria-label="Reset to defaults"
              >
                <RotateCcw size={11} />
              </button>
            )}
            <ChevronDown size={12} className={`cstudio-chevron ${showCustom ? 'open' : ''}`} />
          </div>
        </button>
        {showCustom && (
          <div className="cstudio-custom">
            <ColorField
              label="BG"
              value={config.customColors?.background || theme.background}
              onChange={(v) => setCustom({ background: v })}
            />
            <ColorField
              label="Card"
              value={config.customColors?.cardBackground || theme.cardBackground}
              onChange={(v) => setCustom({ cardBackground: v })}
            />
            <ColorField
              label="Text"
              value={config.customColors?.text || theme.text}
              onChange={(v) => setCustom({ text: v })}
            />
            <ColorField
              label="Grid"
              value={config.customColors?.grid || theme.grid}
              onChange={(v) => setCustom({ grid: v })}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/** Compact inline color field: [swatch] #hex */
function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="cstudio-field">
      <span className="cstudio-field-label">{label}</span>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="cstudio-field-color"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="cstudio-field-hex"
        spellCheck={false}
      />
    </label>
  );
}
