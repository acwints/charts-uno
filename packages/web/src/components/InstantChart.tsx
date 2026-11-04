import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { reportHomepageChart, type HomepageChartSource } from '../services/homepageChartEvent';
import { rememberPendingChart, readPendingChart } from '../services/pendingChart';
import type { CreateChartData } from '../services/api';
import {
  SAMPLE_CHART_TITLE,
  SAMPLE_TABLE,
  chartFromText,
  requestedChartType,
  type InstantChartResult,
} from '../utils/instantTable';
import type { ChartType } from '../types';
import { Button } from './Button';
import './InstantChart.css';

const ChartPreview = lazy(() => import('./ChartPreview').then((module) => ({ default: module.ChartPreview })));

interface InstantChartProps {
  onRequestAuth?: () => void;
}

function payloadFor(chart: InstantChartResult, themeMode: InstantChartResult['config']['themeMode']): CreateChartData {
  const { sourceType, ...stored } = chart.data;
  return {
    title: chart.config.title || 'Chart',
    data: stored,
    config: { ...chart.config, themeMode },
    source_type: sourceType,
    is_public: false,
  };
}

function showParseError(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return true;
  return trimmed.split(/\r?\n/).filter((line) => line.trim()).length >= 2;
}

export function InstantChart({ onRequestAuth }: InstantChartProps) {
  const { theme } = useTheme();
  const [params] = useSearchParams();
  const typeParam = params.get('type');
  const stackedParam = params.get('stacked');
  const pending = useMemo(() => readPendingChart(), []);
  const [text, setText] = useState(pending?.text ?? '');
  const [sourceType, setSourceType] = useState<'paste' | 'csv'>(pending?.payload.source_type === 'csv' ? 'csv' : 'paste');
  const [titleOverride, setTitleOverride] = useState<string | undefined>(pending?.payload.title);
  const [forcedType, setForcedType] = useState<ChartType | undefined>(
    pending?.payload.config?.type === 'bar' || pending?.payload.config?.type === 'line' || pending?.payload.config?.type === 'area' || pending?.payload.config?.type === 'pie'
      ? pending.payload.config.type
      : undefined,
  );
  const [fileError, setFileError] = useState<string | null>(null);
  const [eventSource, setEventSource] = useState<HomepageChartSource>('paste');
  const [dragActive, setDragActive] = useState(false);
  const restoredText = useRef(pending?.text ?? '');

  const options = useMemo(() => ({
    type: requestedChartType(typeParam) ?? forcedType,
    stacked: stackedParam === '1',
    sourceType,
    title: titleOverride,
  }), [forcedType, sourceType, stackedParam, titleOverride, typeParam]);

  const built = useMemo(() => (text.trim() ? chartFromText(text, options) : null), [options, text]);
  const chart = built && !('error' in built) ? built : null;
  const message = fileError || (built && 'error' in built && showParseError(text) ? built.error : null);

  useEffect(() => {
    if (!chart) return;
    if (restoredText.current && text === restoredText.current) return;
    restoredText.current = '';
    reportHomepageChart(eventSource);
  }, [chart, eventSource, text]);

  const applyText = (next: string, extra?: { sourceType?: 'paste' | 'csv'; title?: string; type?: ChartType; eventSource?: HomepageChartSource }) => {
    setText(next);
    setSourceType(extra?.sourceType ?? 'paste');
    setTitleOverride(extra?.title);
    setForcedType(extra?.type);
    setEventSource(extra?.eventSource ?? 'paste');
    setFileError(null);
  };

  const takeFile = async (file: File) => {
    const name = file.name.toLowerCase();
    const allowed = name.endsWith('.csv') || name.endsWith('.tsv') || name.endsWith('.txt') || name.endsWith('.json')
      || file.type === 'text/csv' || file.type === 'application/json' || file.type.startsWith('text/');
    if (!allowed) {
      setFileError('Drop a CSV, TSV, or JSON file.');
      return;
    }
    if (file.size > 2_000_000) {
      setFileError('That file is over 2MB. Paste a smaller table.');
      return;
    }
    try {
      const content = await file.text();
      const fromName = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim().slice(0, 180);
      applyText(content, {
        sourceType: name.endsWith('.json') ? 'paste' : 'csv',
        title: fromName || undefined,
        eventSource: 'drop',
      });
    } catch {
      setFileError('Could not read that file.');
    }
  };

  const save = () => {
    if (!chart) return;
    rememberPendingChart(text, payloadFor(chart, theme));
    onRequestAuth?.();
  };

  return (
    <section
      className={`instant ${dragActive ? 'instant--drag' : ''}`}
      aria-label="Make a chart from your data"
      onDragEnter={(event) => {
        event.preventDefault();
        setDragActive(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node)) return;
        setDragActive(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragActive(false);
        const file = event.dataTransfer.files?.[0];
        if (file) void takeFile(file);
      }}
    >
      <label className="instant-label" htmlFor="instant-paste">Paste your data</label>
      <textarea
        id="instant-paste"
        className="instant-paste"
        value={text}
        spellCheck={false}
        rows={5}
        placeholder={'Month,Sales\nJan,120\nFeb,180'}
        aria-invalid={message ? true : undefined}
        aria-describedby={message ? 'instant-error' : undefined}
        onChange={(event) => applyText(event.target.value)}
      />
      <div className="instant-tools">
        <label className="instant-drop">
          <input
            className="instant-file"
            type="file"
            accept=".csv,.tsv,.txt,.json,text/csv,text/tab-separated-values,text/plain,application/json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) void takeFile(file);
            }}
          />
          Drop a CSV here, or choose a file
        </label>
        <button
          type="button"
          className="instant-sample"
          onClick={() => applyText(SAMPLE_TABLE, { title: SAMPLE_CHART_TITLE, type: 'bar', eventSource: 'sample' })}
        >
          Try sample data
        </button>
      </div>
      {message && <p id="instant-error" className="instant-error" role="alert">{message}</p>}
      {chart && (
        <div className="instant-result">
          <div className="instant-frame">
            <Suspense fallback={<p className="instant-drawing">Drawing your chart…</p>}>
              <ChartPreview data={chart.data} config={{ ...chart.config, themeMode: theme }} />
            </Suspense>
          </div>
          <Button variant="primary" size="lg" onClick={save}>
            Save this chart
          </Button>
          <p className="instant-note">
            The preview is instant and stays on this device. Saving asks you to sign up, then keeps the chart on your account.
          </p>
        </div>
      )}
    </section>
  );
}
