import { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { MiniChartPreview } from '../MiniChartPreview';
import { STARTER_TEMPLATES, saveStarterTemplate, starterChart, type StarterTemplate } from '../../content/starterTemplates';
import './StarterPicker.css';

interface StarterPickerProps {
  onSaved: (chartId: string) => void;
  onPaste: () => void;
}

export function StarterPicker({ onSaved, onPaste }: StarterPickerProps) {
  const { theme } = useTheme();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pick = async (template: StarterTemplate) => {
    if (savingId) return;
    setSavingId(template.id);
    setError(null);
    try {
      const id = await saveStarterTemplate(template);
      onSaved(id);
    } catch (err) {
      setSavingId(null);
      setError(err instanceof Error ? err.message : 'Could not save that chart. Try again.');
    }
  };

  return (
    <section className="starters" aria-labelledby="starters-title">
      <div className="starters-copy">
        <h2 id="starters-title" className="starters-title">Start from an example</h2>
        <p className="starters-detail">One click saves it to My Charts. Change the title or the numbers after that.</p>
      </div>
      <ul className="starters-grid">
        {STARTER_TEMPLATES.map((template) => {
          const { data, config } = starterChart(template);
          const busy = savingId === template.id;
          return (
            <li key={template.id}>
              <button
                type="button"
                className="starters-card"
                onClick={() => { void pick(template); }}
                disabled={savingId !== null}
                aria-busy={busy}
              >
                <span className="starters-preview" aria-hidden="true">
                  <MiniChartPreview
                    data={{ labels: data.labels, series: data.series }}
                    config={{ ...config, themeMode: theme }}
                    minHeight={96}
                  />
                </span>
                <span className="starters-card-title">{busy ? 'Saving…' : template.title}</span>
                <span className="starters-card-detail">{template.detail}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {error && <p className="starters-error" role="alert">{error}</p>}
      <button type="button" className="starters-paste" onClick={onPaste} disabled={savingId !== null}>
        Paste from a spreadsheet
      </button>
    </section>
  );
}
