import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ChartPreview } from '../components/ChartPreview';
import { ShareMenu } from '../components/ShareMenu';
import { getChart, type ChartResponse } from '../services/api';
import { safeSourceUrl } from '../utils/chartSources';
import { useAuth } from '../hooks/useAuth';
import type { ChartConfig, ChartData } from '../types';
import './ChartDetail.css';

// Reading a saved chart must not replace the editor's in-progress document.
export function ChartDetail() {
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const { user, isAuthenticated } = useAuth();
  const [result, setResult] = useState<{ scope: string; chart?: ChartResponse; error?: string }>();
  const [rowLimit, setRowLimit] = useState(50);
  const [attempt, setAttempt] = useState(0);
  const captureRef = useRef<HTMLDivElement>(null);
  const scope = `${user?.id}:${id}`;
  useEffect(() => {
    if (!id) return;
    let active = true;
    getChart(id).then(chart => { if (active) setResult({ scope, chart }); })
      .catch(() => { if (active) setResult({ scope, error: 'Could not load this chart. It may be private or unavailable.' }); });
    return () => { active = false; };
  }, [id, scope, attempt]);

  if (result?.scope !== scope) return <p className="chart-reading__status" role="status">Loading chart…</p>;
  if (!result.chart) return <div className="chart-reading__status" role="alert"><p>{result.error}</p><button type="button" onClick={() => { setResult(undefined); setAttempt(n => n + 1); }}>Try again</button></div>;
  const chart = result.chart;
  const data: ChartData = { ...chart.data, sourceType: (chart.source_type || 'paste') as ChartData['sourceType'] };
  const config: ChartConfig = { ...chart.config, title: chart.title || chart.config.title || 'Untitled Chart', showAxisLabels: true, showAxisTitles: true, showLegend: true, showValues: false, animate: false };
  // Generated artwork is not stored on saved chart records. Never regenerate
  // paid artwork, or display an unrelated editor SVG, just by opening a chart.
  if (config.type === 'infographic') config.type = 'table';
  config.sourceLink = safeSourceUrl(config.sourceLink);
  data.sourceLink = safeSourceUrl(data.sourceLink);
  data.sources = data.sources?.filter(source => safeSourceUrl(source.url));
  const sources = [config.sourceLink, data.sourceLink, ...(data.sources?.map(source => source.url) ?? [])].map(safeSourceUrl).filter(Boolean);
  const owner = chart.user_id === user?.id;

  return <article className="chart-reading">
    <div ref={captureRef} data-chart-capture="full" className="chart-reading__capture">
    <header className="chart-reading__header">
      <h1>{config.title}</h1>
      <p>{chart.user?.name || 'Chartsuno member'} · {new Date(chart.created_at).toLocaleDateString()}</p>
      {chart.description && <p className="chart-reading__description">{chart.description}</p>}
    </header>
    <div className="chart-reading__visual"><ChartPreview data={data} config={config} readOnly /></div>
    {!sources.length && <p className="chart-reading__provenance">Source not provided</p>}
    {data.sourceType === 'prompt' && !data.verifiedData && <p className="chart-reading__provenance">AI-generated data · Not verified against a source</p>}
    </div>
    <div className="chart-reading__actions">
      <Link to={`/chart/${chart.id}/edit`} state={{ returnTo: location.pathname, readerReturnTo: location.state?.returnTo }}>{owner ? 'Edit chart' : 'Customize a copy'}</Link>
      <ShareMenu chartRef={captureRef} chartId={chart.id} isPublic={chart.is_public} title={config.title} isAuthenticated={isAuthenticated} canManageLink={owner} />
    </div>
    <details className="chart-reading__data">
      <summary>View data · {data.labels.length} rows</summary>
      <div className="chart-reading__table-scroll" role="region" aria-label="Chart data" tabIndex={0}>
        <table><caption>{data.yAxisLabel || config.title}</caption>
          <thead><tr><th scope="col">{data.xAxisLabel || 'Category'}</th>{data.series.map((series, j) => <th scope="col" key={j}>{series.name}</th>)}</tr></thead>
          <tbody>{data.labels.slice(0, rowLimit).map((label, i) => <tr key={i}><th scope="row">{label}</th>{data.series.map((series, j) => <td key={j}>{series.data[i]?.toLocaleString() ?? '—'}</td>)}</tr>)}</tbody>
        </table>
      </div>
      {data.labels.length > rowLimit && <button className="chart-reading__more" type="button" onClick={() => setRowLimit(n => n + 50)}>Show more rows ({Math.min(rowLimit, data.labels.length)} of {data.labels.length})</button>}
    </details>
  </article>;
}
