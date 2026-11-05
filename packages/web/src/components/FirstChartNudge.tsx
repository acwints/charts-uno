import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createChart, getMyCharts } from '../services/api';
import { sampleChartCreatePayload, sampleMonthlySales } from '../content/sampleChart';
import { useChartStore } from '../stores/chartStore';
import { Button } from './Button';
import './FirstChartNudge.css';

const DISMISS_KEY = 'chartsuno_first_chart_nudge_v1';

export function FirstChartNudge() {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === '1');
  const [empty, setEmpty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (dismissed) return undefined;
    let active = true;
    getMyCharts(1, 0)
      .then((page) => {
        if (active) setEmpty(page.total === 0);
      })
      .catch(() => {
        if (active) setEmpty(false);
      });
    return () => {
      active = false;
    };
  }, [dismissed]);

  if (dismissed || !empty) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  };

  const makeFirstChart = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const { data, config } = sampleMonthlySales();
      const saved = await createChart(sampleChartCreatePayload());
      useChartStore.getState().loadDocument(saved.id, data, config);
      setEmpty(false);
      navigate(`/chart/${saved.id}`);
    } catch (err) {
      setSaving(false);
      setError(err instanceof Error ? err.message : 'Could not save the sample chart. Try again.');
    }
  };

  return (
    <div className="nudge" role="region" aria-label="Make your first chart">
      <p className="nudge-copy">You don't have a saved chart yet.</p>
      <Button variant="primary" size="lg" onClick={() => { void makeFirstChart(); }} disabled={saving} aria-busy={saving}>
        {saving ? 'Saving your chart…' : 'Make your first chart in one click'}
      </Button>
      <button type="button" className="nudge-dismiss" onClick={dismiss}>
        Dismiss
      </button>
      {error && <p className="nudge-error" role="alert">{error}</p>}
    </div>
  );
}
