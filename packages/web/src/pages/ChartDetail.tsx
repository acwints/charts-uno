import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ChartPreview } from '../components/ChartPreview';
import { ShareMenu } from '../components/ShareMenu';
import { getChart, type ChartResponse } from '../services/api';
import { safeSourceUrl, collectChartSources, chartProvenanceNote } from '../utils/chartSources';
import { useAuth } from '../hooks/useAuth';
import type { ChartConfig, ChartData } from '../types';
import './ChartDetail.css';

// Reading a saved chart must not replace the editor's in-progress document.
export function ChartDetail() {
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const { user, isAuthenticated } = useAuth();
  const [result, setResult] = useState<{ scope: string; chart?: ChartResponse; error?: string }>();
  const [rowPage, setRowPage] = useState({ scope: '', limit: 50 });
  const [attempt, setAttempt] = useState(0);
  const captureRef = useRef<HTMLDivElement>(null);
  const dataRef = useRef<HTMLDetailsElement>(null);
  const scope = `${user?.id}:${id}`;
  const rowLimit = rowPage.scope === scope ? rowPage.limit : 50;
  useEffect(() => {
    if (!id) return;
    let active = true;
    getChart(id, 'published').then(chart => { if (active) setResult({ scope, chart }); })
      .catch(() => { if (active) setResult({ scope, error: 'Could not load this chart. It may be private or unavailable.' }); });
    return () => { active = false; };
  }, [id, scope, attempt]);

  useEffect(() => {
    if (location.hash === '#data' && result?.scope === scope && result.chart && dataRef.current) {
      dataRef.current.open = true;
      dataRef.current.scrollIntoView?.({ block: 'start' });
      dataRef.current.querySelector('summary')?.focus({ preventScroll: true });
    }
  }, [location.hash, result, scope]);

  if (result?.scope !== scope) return <p className="chart-reading__status" role="status">Loading chart…</p>;
  if (!result.chart) return <div className="chart-reading__status" role="alert"><p>{result.error}</p><button type="button" onClick={() => { setResult(undefined); setAttempt(n => n + 1); }}>Try again</button></div>;
  const chart = result.chart;
  const data: ChartData = { ...chart.data, sourceType: (chart.source_type || 'paste') as ChartData['sourceType'] };
  const config: ChartConfig = chart.revision_id && !chart.legacy_snapshot ? { ...chart.config, animate: false } : { ...chart.config, title: chart.title || chart.config.title || 'Untitled Chart', showAxisLabels: true, showAxisTitles: true, showLegend: true, showValues: false, animate: false };
  // Generated artwork is not stored on saved chart records. Never regenerate
  // paid artwork, or display an unrelated editor SVG, just by opening a chart.
  if (config.type === 'infographic') config.type = 'table';
  config.sourceLink = safeSourceUrl(config.sourceLink);
  data.sourceLink = safeSourceUrl(data.sourceLink);
  data.sources = data.sources?.filter(source => safeSourceUrl(source.url));
  const sources = collectChartSources(chart);
  const provenanceNote = chartProvenanceNote(chart.source_type);
  const owner = chart.user_id === user?.id;
  const hasSecondaryAxis = data.series.some(series => config.seriesConfig?.[series.name]?.axis === 'right');

  return <article className="chart-reading">
    <div ref={captureRef} data-chart-capture="full" className="chart-reading__capture">
    <header className="chart-reading__header">
      <h1>{config.title}</h1>
      <p>{chart.user?.name || 'Chartsuno member'} · {new Date(chart.created_at).toLocaleDateString()}</p>
      {chart.correction_note && <p className="chart-reading__description">Correction: {chart.correction_note}</p>}
      {chart.description && <p className="chart-reading__description">{chart.description}</p>}
    </header>
    <div className="chart-reading__visual"><ChartPreview data={data} config={config} readOnly /></div>
    {!sources.length && !chart.source_declaration && <p className="chart-reading__provenance">Source not provided</p>}
    {chart.source_declaration && <p className="chart-reading__provenance">{chart.source_declaration.title}: {chart.source_declaration.description}</p>}
    {provenanceNote && <p className="chart-reading__provenance">{provenanceNote}</p>}
    {sources.length > 0 && <p className="chart-reading__provenance">{sources.map(source => `${source.title}: ${new URL(source.url).hostname.replace(/^www\./, '')}`).join('; ')}</p>}
    </div>
    <div className="chart-reading__actions">
      {owner && <Link to={`/post?chart=${chart.id}`} state={{ returnTo: location.pathname }}>{chart.is_public ? 'Update post' : 'Publish chart'}</Link>}
      <ShareMenu chartRef={captureRef} chartId={chart.id} isPublic={chart.is_public} title={config.title} isAuthenticated={isAuthenticated} canManageLink={owner} />
    </div>
    <details ref={dataRef} id="chart-data" key={id} className="chart-reading__data">
      <summary>Data & sources · {data.labels.length} rows</summary>
      {sources.length > 0 && <ul className="chart-reading__sources" aria-label="Sources and references">{sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title} <span>({new URL(source.url).hostname.replace(/^www\./, '')})</span></a></li>)}</ul>}
      {!sources.length && !chart.source_declaration && <p className="chart-reading__provenance">Source not provided</p>}
      {chart.source_declaration && <p className="chart-reading__provenance">{chart.source_declaration.title}: {chart.source_declaration.description}</p>}
      {provenanceNote && <p className="chart-reading__provenance">{provenanceNote}</p>}
      <p className="chart-reading__provenance">Values are shown as stored. — means missing, not zero.</p>
      {(data.yAxisLabel || data.yAxisPrefix || data.yAxisSuffix || data.yAxisFormat === 'percentage') && <p className="chart-reading__provenance">{hasSecondaryAxis ? 'Primary axis' : 'Units'}: {[data.yAxisLabel, data.yAxisPrefix, data.yAxisSuffix || (data.yAxisFormat === 'percentage' ? '%' : '')].filter(Boolean).join(' ')}</p>}
      {hasSecondaryAxis && <p className="chart-reading__provenance">Secondary axis: {[config.rightYAxisLabel, config.rightYAxisPrefix, config.rightYAxisSuffix].filter(Boolean).join(' ') || 'Units not supplied'}</p>}
      <div className="chart-reading__table-scroll" role="region" aria-label="Chart data" tabIndex={0}>
        <table><caption>{config.title}</caption>
          <thead><tr><th scope="col">{data.xAxisLabel || 'Category'}</th>{data.series.map((series, j) => <th scope="col" key={j}>{series.name}{hasSecondaryAxis ? ` (${config.seriesConfig?.[series.name]?.axis === 'right' ? 'secondary' : 'primary'} axis)` : ''}</th>)}{data.categoricalColumns?.map((column, j) => <th scope="col" key={`category-${j}`}>{column.name}</th>)}</tr></thead>
          <tbody>{data.labels.slice(0, rowLimit).map((label, i) => <tr key={i}><th scope="row">{label}</th>{data.series.map((series, j) => <td key={j}>{series.data[i] == null ? '—' : String(series.data[i])}</td>)}{data.categoricalColumns?.map((column, j) => <td key={`category-${j}`}>{column.data[i] || '—'}</td>)}</tr>)}</tbody>
        </table>
      </div>
      {sources.length > 0 && <p className="chart-reading__provenance">Source links are supplied by the author, not independently verified.</p>}
      {data.labels.length > rowLimit && <button className="chart-reading__more" type="button" onClick={() => setRowPage({ scope, limit: rowLimit + 50 })}>Show more rows ({Math.min(rowLimit, data.labels.length)} of {data.labels.length})</button>}
    </details>
  </article>;
}
