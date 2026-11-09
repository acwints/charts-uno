import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import {
  reportHomepageChart,
  reportHomepageDownload,
  reportHomepageStart,
  reportHomepageView,
  type HomepageChartSource,
} from '../services/homepageChartEvent';
import { rememberPendingChart, readPendingChart } from '../services/pendingChart';
import type { CreateChartData } from '../services/api';
import {
  SAMPLE_CHART_TITLE,
  SAMPLE_DATASETS,
  SAMPLE_TABLE,
  chartFromText,
  matchingSampleDataset,
  requestedChartType,
  type InstantChartResult,
} from '../utils/instantTable';
import type { ChartType } from '../types';
import { Button } from './Button';
import './InstantChart.css';

const ChartPreview = lazy(() => import('./ChartPreview').then((module) => ({ default: module.ChartPreview })));

const CHART_TYPES: { id: ChartType; label: string }[] = [
  { id: 'bar', label: 'Bar' },
  { id: 'line', label: 'Line' },
  { id: 'area', label: 'Area' },
  { id: 'pie', label: 'Pie' },
];

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

function savedChartType(type: ChartType | undefined): ChartType | undefined {
  if (type === 'bar' || type === 'line' || type === 'area' || type === 'pie') return type;
  return 'bar';
}

export function InstantChart({ onRequestAuth }: InstantChartProps) {
  const { theme } = useTheme();
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const typeParam = params.get('type');
  const stackedParam = params.get('stacked');
  const pending = useMemo(() => readPendingChart(), []);
  const hasPending = Boolean(pending?.text);
  const [text, setText] = useState(hasPending ? pending?.text ?? '' : SAMPLE_TABLE);
  const [sourceType, setSourceType] = useState<'paste' | 'csv'>(pending?.payload.source_type === 'csv' ? 'csv' : 'paste');
  const [titleOverride, setTitleOverride] = useState<string | undefined>(
    hasPending ? pending?.payload.title : SAMPLE_CHART_TITLE,
  );
  const [chartType, setChartType] = useState<ChartType | undefined>(() => savedChartType(pending?.payload.config?.type));
  const [typeTouched, setTypeTouched] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [eventSource, setEventSource] = useState<HomepageChartSource>('sample');
  const [dragActive, setDragActive] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const restoredText = useRef(pending?.text ?? '');
  const userStarted = useRef(false);
  const selectArmed = useRef(true);
  const pasteRef = useRef<HTMLTextAreaElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  const resolvedType = typeTouched ? chartType : (requestedChartType(typeParam) ?? chartType);
  const options = useMemo(() => ({
    type: resolvedType,
    stacked: stackedParam === '1',
    sourceType,
    title: titleOverride,
  }), [resolvedType, sourceType, stackedParam, titleOverride]);

  const built = useMemo(() => (text.trim() ? chartFromText(text, options) : null), [options, text]);
  const chart = built && !('error' in built) ? built : null;
  const message = fileError || (built && 'error' in built && showParseError(text) ? built.error : null);
  const activeDataset = matchingSampleDataset(text);
  const onBuiltinSample = Boolean(activeDataset);
  const shownType = chart?.config.type ?? resolvedType;

  useEffect(() => {
    if (pathname === '/') reportHomepageView();
  }, [pathname]);

  useEffect(() => {
    if (!chart || !userStarted.current) return;
    if (restoredText.current && text === restoredText.current) return;
    restoredText.current = '';
    reportHomepageChart(eventSource);
  }, [chart, eventSource, text]);

  useEffect(() => {
    if (hasPending) return;
    if (typeof window.matchMedia !== 'function') return;
    const desktop = window.matchMedia('(min-width: 900px) and (hover: hover) and (pointer: fine)');
    if (!desktop.matches) return;
    pasteRef.current?.focus();
  }, [hasPending]);

  const applyText = (next: string, extra?: { sourceType?: 'paste' | 'csv'; title?: string; type?: ChartType; eventSource?: HomepageChartSource }) => {
    const source = extra?.eventSource ?? 'paste';
    setText(next);
    setSourceType(extra?.sourceType ?? 'paste');
    setTitleOverride(extra?.title);
    if (extra && 'type' in extra) {
      setTypeTouched(true);
      setChartType(extra.type);
    } else if (!typeTouched) {
      setChartType(undefined);
    }
    setEventSource(source);
    setFileError(null);
    userStarted.current = true;
    reportHomepageStart(source);
  };

  const chooseType = (type: ChartType) => {
    setTypeTouched(true);
    setChartType(type);
    setEventSource('sample');
    userStarted.current = true;
    reportHomepageStart('sample');
  };

  const selectSampleOnFocus = (element: HTMLTextAreaElement) => {
    if (!selectArmed.current || !matchingSampleDataset(element.value)) return;
    window.setTimeout(() => {
      if (!element.isConnected || !selectArmed.current || !matchingSampleDataset(element.value)) return;
      element.select();
      selectArmed.current = false;
    }, 0);
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

  const downloadChart = async () => {
    if (!chart || !frameRef.current || downloading) return;
    setDownloading(true);
    setFileError(null);
    try {
      const { exportToPNG } = await import('../services/exportService');
      const filename = (chart.config.title || 'chart').replace(/[^\w.-]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'chart';
      await exportToPNG(frameRef.current, filename);
      reportHomepageDownload();
      rememberPendingChart(text, payloadFor(chart, theme));
      setDownloaded(true);
    } catch (err) {
      setFileError(err instanceof Error ? err.message : 'Could not download the chart. Try again.');
    } finally {
      setDownloading(false);
    }
  };

  const keepChart = () => {
    if (!chart) return;
    rememberPendingChart(text, payloadFor(chart, theme));
    onRequestAuth?.();
  };

  const onPrimary = () => {
    if (!onBuiltinSample) {
      applyText(SAMPLE_TABLE, { title: SAMPLE_CHART_TITLE, type: 'bar', eventSource: 'sample' });
      return;
    }
    reportHomepageStart('paste');
    userStarted.current = true;
    pasteRef.current?.focus();
    pasteRef.current?.select();
    selectArmed.current = false;
  };

  const editExample = () => {
    if (!onBuiltinSample) return;
    reportHomepageStart('sample');
    userStarted.current = true;
    const field = pasteRef.current;
    field?.focus();
    field?.select();
    selectArmed.current = false;
  };

  return (
    <section
      className={`instant${onBuiltinSample ? ' instant--example' : ''}${dragActive ? ' instant--drag' : ''}`}
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
      <textarea
        id="instant-paste"
        ref={pasteRef}
        className="instant-paste"
        value={text}
        spellCheck={false}
        rows={7}
        placeholder={'Month,Sales\nJan,120\nFeb,180'}
        aria-label="Paste your data"
        aria-invalid={message ? true : undefined}
        aria-describedby={message ? 'instant-error' : undefined}
        onFocus={(event) => selectSampleOnFocus(event.currentTarget)}
        onChange={(event) => applyText(event.target.value)}
      />
      <div className="instant-types" role="group" aria-label="Chart type">
        {CHART_TYPES.map((type) => (
          <button
            key={type.id}
            type="button"
            className="instant-chip"
            aria-pressed={shownType === type.id}
            onClick={() => chooseType(type.id)}
          >
            {type.label}
          </button>
        ))}
      </div>
      <div className="instant-samples" role="group" aria-label="Sample data">
        {SAMPLE_DATASETS.map((dataset) => (
          <button
            key={dataset.id}
            type="button"
            className="instant-chip instant-chip--data"
            aria-pressed={activeDataset?.id === dataset.id}
            onClick={() => applyText(dataset.text, { title: dataset.title, type: dataset.type, eventSource: 'sample' })}
          >
            {dataset.label}
          </button>
        ))}
      </div>
      {onBuiltinSample && (
        <Button variant="primary" size="lg" fullWidth className="instant-edit" onClick={editExample}>
          Edit this example
        </Button>
      )}
      <div
        className="instant-frame"
        ref={frameRef}
        onClick={(event) => {
          if (!onBuiltinSample) return;
          const target = event.target;
          if (target instanceof Element && target.closest('a, button, input, textarea, select, label')) return;
          editExample();
        }}
      >
        {chart ? (
          <Suspense fallback={<p className="instant-drawing">Drawing your chart…</p>}>
            <ChartPreview data={chart.data} config={{ ...chart.config, themeMode: theme }} />
          </Suspense>
        ) : (
          <p className="instant-drawing">Paste a label column and at least one column of numbers.</p>
        )}
      </div>
      {message && <p id="instant-error" className="instant-error" role="alert">{message}</p>}
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
        <button type="button" className="instant-try" onClick={onPrimary}>
          {onBuiltinSample ? 'Try with your data' : 'Use sample'}
        </button>
      </div>
      <div className="instant-actions">
        <Button variant="primary" size="lg" onClick={() => { void downloadChart(); }} disabled={!chart || downloading} aria-busy={downloading}>
          {downloading ? 'Preparing your PNG…' : 'Save & download this chart'}
        </Button>
        {downloaded && (
          <Button variant="default" size="lg" onClick={keepChart}>
            Sign in with Google to keep it
          </Button>
        )}
      </div>
    </section>
  );
}
