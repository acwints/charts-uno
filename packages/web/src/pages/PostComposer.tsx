import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ChartPreview } from '../components/ChartPreview';
import { MiniChartPreview } from '../components/MiniChartPreview';
import { getChart, getMyCharts, previewPublication, publishChart, type ChartResponse, type PublicationPreview, type PublicationProposal, type PublicationSource } from '../services/api';
import { nativeFeedPages } from '../services/nativeNavigationSession';
import { ApiError } from '../services/apiBase';
import { safeSourceUrl, chartProvenanceNote } from '../utils/chartSources';
import { useAuth } from '../hooks/useAuth';
import type { ChartConfig, ChartData } from '../types';
import './PostComposer.css';

const TYPES = ['bar', 'line', 'area', 'pie', 'table'] as const;
const emptySource: PublicationSource = { kind: 'own_data', title: 'My own data', description: '' };

export function PublicationTable({ chart }: { chart: ChartResponse }) {
  const [limit, setLimit] = useState(50);
  const { data } = chart;
  return <section className="post-table">
    <h2>Public table</h2>
    <p>{data.labels.length} rows · — means missing, not zero.</p>
    {(data.yAxisLabel || data.yAxisPrefix || data.yAxisSuffix) && <p>Units: {[data.yAxisLabel, data.yAxisPrefix, data.yAxisSuffix].filter(Boolean).join(' ')}</p>}
    <div className="post-table__scroll" role="region" aria-label="Public chart data" tabIndex={0}>
      <table><caption>{chart.title || 'Chart data'}</caption><thead><tr><th scope="col">{data.xAxisLabel || 'Category'}</th>{data.series.map((s, i) => <th scope="col" key={i}>{s.name}</th>)}{data.categoricalColumns?.map((c, i) => <th scope="col" key={`c${i}`}>{c.name}</th>)}</tr></thead>
        <tbody>{data.labels.slice(0, limit).map((label, row) => <tr key={row}><th scope="row">{label}</th>{data.series.map((s, i) => <td key={i}>{s.data[row] == null ? '—' : String(s.data[row])}</td>)}{data.categoricalColumns?.map((c, i) => <td key={`c${i}`}>{c.data[row] || '—'}</td>)}</tr>)}</tbody>
      </table>
    </div>
    {limit < data.labels.length && <button type="button" onClick={() => setLimit(n => n + 50)}>Show more rows ({limit} of {data.labels.length})</button>}
  </section>;
}

export function PostComposer() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const requestedId = params.get('chart');
  const [charts, setCharts] = useState<ChartResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [chart, setChart] = useState<ChartResponse>();
  const [step, setStep] = useState<'choose' | 'source' | 'presentation' | 'review' | 'done'>('choose');
  const [source, setSource] = useState<PublicationSource>(emptySource);
  const [type, setType] = useState<PublicationProposal['chart_type']>('bar');
  const [caption, setCaption] = useState('');
  const [correction, setCorrection] = useState('');
  const [publicFeed, setPublicFeed] = useState(true);
  const [review, setReview] = useState<PublicationPreview>();
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const active = useRef(true);
  const heading = useRef<HTMLHeadingElement>(null);
  const inFlight = useRef(false);
  const returnTo = typeof location.state?.returnTo === 'string' && location.state.returnTo.startsWith('/') ? location.state.returnTo : '/feed';

  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => { heading.current?.focus(); window.scrollTo(0, 0); }, [step]);
  useEffect(() => {
    let current = true;
    setBusy(true); setError('');
    const load = requestedId ? getChart(requestedId).then(c => {
      if (!current) return;
      if (c.user_id !== user?.id) throw new Error('Choose a chart from your own library.');
      select(c);
    }) : getMyCharts(20, 0).then(page => { if (current) { setCharts(page.charts); setTotal(page.total); } });
    load.catch(e => { if (current) setError(e instanceof Error ? e.message : 'Could not load your charts. Try again.'); })
      .finally(() => { if (current) setBusy(false); });
    return () => { current = false; };
  }, [requestedId, user?.id, reload]);

  function select(c: ChartResponse) {
    setChart(c); setSource(c.source_declaration || { ...emptySource });
    setType(TYPES.includes(c.config.type) ? c.config.type : 'bar');
    setCaption(c.description || ''); setCorrection(''); setReview(undefined); setReviewed(false); setError(''); setStep('source');
  }
  async function choose(id: string) {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError('');
    try { const c = await getChart(id); if (active.current) select(c); }
    catch (e) { if (active.current) setError(e instanceof Error ? e.message : 'Could not load this chart.'); }
    finally { inFlight.current = false; if (active.current) setBusy(false); }
  }
  async function loadMore() {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError('');
    try { const page = await getMyCharts(20, charts.length); if (active.current) { setCharts(c => [...c, ...page.charts]); setTotal(page.total); } }
    catch { if (active.current) setError('Could not load more charts. Try again.'); }
    finally { inFlight.current = false; if (active.current) setBusy(false); }
  }
  const proposal: PublicationProposal = { is_public: publicFeed, source: { ...source, title: source.kind === 'own_data' ? 'My own data' : source.title.trim(), description: source.description.trim(), url: source.kind === 'external' ? source.url?.trim() : undefined }, chart_type: type, caption: caption.trim() };
  async function preview() {
    if (!chart || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError('');
    try {
      const result = await previewPublication(chart.id, proposal);
      if (active.current) { setReview(result); setReviewed(false); setStep('review'); }
    } catch (e) { if (active.current) setError(e instanceof Error ? e.message : 'Could not prepare your post. Try again.'); }
    finally { inFlight.current = false; if (active.current) setBusy(false); }
  }
  async function publish() {
    if (!chart || !review || !reviewed || review.errors.length || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError('');
    try {
      const result = await publishChart(chart.id, { ...proposal, expected_draft_hash: review.draft_hash, correction_note: correction.trim() || undefined, is_public: publicFeed });
      if (active.current) { nativeFeedPages.clear(); setChart(result); setStep('done'); }
    } catch (e) {
      if (!active.current) return;
      if (e instanceof ApiError && e.status === 409) { setReview(undefined); setReviewed(false); setStep('presentation'); setError('This chart changed since your review. Preview it again before publishing.'); }
      else setError(e instanceof Error ? e.message : 'Could not publish. Your review is still here; try again.');
    } finally { inFlight.current = false; if (active.current) setBusy(false); }
  }
  const validSource = source.description.trim().length > 0 && (source.kind === 'own_data' || (source.title.trim().length > 0 && Boolean(safeSourceUrl(source.url))));
  const cancel = () => { if (!busy && (step === 'choose' || step === 'done' || window.confirm('Discard this post setup? Your saved chart will stay in your library.'))) navigate(returnTo, { replace: true }); };
  const title = step === 'choose' ? 'Choose a chart' : step === 'source' ? 'Data & source' : step === 'presentation' ? 'Make your post' : step === 'review' ? 'Review your post' : publicFeed ? 'Your post is live' : 'Your chart is ready to share';
  const previewChart = review?.chart;

  return <div className="post-composer">
    <header className="post-composer__nav">
      <button type="button" disabled={busy} onClick={step === 'presentation' ? () => { setError(''); setStep('source'); } : step === 'review' ? () => { setReviewed(false); setError(''); setStep('presentation'); } : cancel}>{step === 'presentation' || step === 'review' ? 'Back' : step === 'done' ? 'Done' : 'Cancel'}</button>
      <span>{chart?.is_public && step !== 'done' ? 'Update post' : 'New post'}</span><span aria-hidden="true" />
    </header>
    <div className="post-composer__body">
      <h1 ref={heading} tabIndex={-1}>{title}</h1>
      {error && <p className="post-composer__error" role="alert">{error}</p>}
      {step === 'choose' && <>
        <p>Start with a chart saved in your library. Its data and source will be part of the post.</p>
        {!busy && !charts.length && !error && <div className="post-composer__empty"><h2>No saved charts yet</h2><p>Create and save a chart at chartsuno.com, then return here to post it.</p></div>}
        {error && !charts.length && <button type="button" disabled={busy} onClick={() => setReload(n => n + 1)}>Try again</button>}
        <div className="post-composer__library">{charts.map(c => <button type="button" key={c.id} disabled={busy} className="post-composer__choice" onClick={() => choose(c.id)}><MiniChartPreview data={c.data} config={c.config} minHeight={100} /><span><strong>{c.title || 'Untitled chart'}</strong><small>{c.is_public ? 'Published · review an update' : `${c.data.labels.length} rows`}</small></span></button>)}</div>
        {charts.length < total && <button type="button" disabled={busy} onClick={loadMore}>Load more charts</button>}
      </>}
      {step === 'source' && chart && <>
        <p>Tell readers where these numbers came from. Only the table shown in your final review will be public.</p>
        <label>Data source<select disabled={busy} value={source.kind} onChange={e => setSource({ kind: e.target.value as PublicationSource['kind'], title: e.target.value === 'own_data' ? 'My own data' : '', description: '', url: '' })}><option value="own_data">My own data</option><option value="external">External source</option></select></label>
        {source.kind === 'external' && <><label>Source name<input disabled={busy} value={source.title} maxLength={200} onChange={e => setSource({ ...source, title: e.target.value })} placeholder="Organization or dataset" /></label><label>Source link<input disabled={busy} type="url" inputMode="url" autoCapitalize="none" autoCorrect="off" value={source.url || ''} onChange={e => setSource({ ...source, url: e.target.value })} placeholder="https://…" /></label></>}
        <label>{source.kind === 'own_data' ? 'How did you collect this data?' : 'What does this data cover?'}<textarea disabled={busy} value={source.description} maxLength={2000} rows={4} onChange={e => setSource({ ...source, description: e.target.value })} placeholder={source.kind === 'own_data' ? 'Describe your method, dates, and what you measured.' : 'Include the period, units, and any changes you made.'} /></label>
        <p className="post-composer__note">This is your source disclosure, not independent verification.</p>
        {chartProvenanceNote(chart.source_type) && <p>{chartProvenanceNote(chart.source_type)}</p>}
        <button type="button" className="post-composer__primary" disabled={!validSource || busy} onClick={() => { setError(''); setStep('presentation'); }}>Continue</button>
        {!requestedId && <button type="button" onClick={() => { setChart(undefined); setStep('choose'); }}>Choose another chart</button>}
      </>}
      {step === 'presentation' && chart && <>
        <label>Chart style<select disabled={busy} value={type} onChange={e => setType(e.target.value as PublicationProposal['chart_type'])}>{TYPES.map(t => <option value={t} key={t}>{t[0].toUpperCase() + t.slice(1)}</option>)}</select></label>
        <p className="post-composer__note">The preview checks that this style fits your data. Advanced editing is available on web.</p>
        <label>Audience<select disabled={busy} value={publicFeed ? 'public' : 'private'} onChange={e => setPublicFeed(e.target.value === 'public')}><option value="public">Public feed</option><option value="private">Prepare for link or team sharing</option></select></label>
        {!publicFeed && <p className="post-composer__note">This review prepares a fixed version without listing it in the feed. You can create a share link or choose a team afterward.</p>}
        <label>Caption<textarea disabled={busy} rows={4} maxLength={2000} value={caption} onChange={e => setCaption(e.target.value)} placeholder="What should people notice?" /></label>
        {(chart.is_public || chart.revision_id) && <label>What changed?<textarea disabled={busy} rows={3} maxLength={1000} value={correction} onChange={e => setCorrection(e.target.value)} placeholder="Explain this correction for readers." /></label>}
        <button type="button" className="post-composer__primary" disabled={busy || ((chart.is_public || Boolean(chart.revision_id)) && !correction.trim())} onClick={preview}>Preview post</button>
      </>}
      {step === 'review' && previewChart && review && <>
        {review.errors.length > 0 ? <div role="alert"><h2>This chart needs changes</h2><ul>{review.errors.map((e, i) => <li key={i}>{e}</li>)}</ul><p>Go back to adjust your post, or edit the saved chart on web.</p></div> : <>
          <div className="post-composer__preview"><ChartPreview data={{ ...previewChart.data, sourceType: previewChart.source_type as ChartData['sourceType'] }} config={{ ...previewChart.config, animate: false } as ChartConfig} readOnly /></div>
          {previewChart.description && <p>{previewChart.description}</p>}
          <h2>{proposal.source.title}</h2><p>{proposal.source.description}</p>
          {proposal.source.url && <a href={safeSourceUrl(proposal.source.url)} target="_blank" rel="noopener noreferrer">View source</a>}
          <PublicationTable key={review.draft_hash} chart={previewChart} />
          <p>{publicFeed ? 'Everyone will be able to see this chart, table, caption, and source.' : 'Anyone you share this version with can see its chart, table, caption, and source. It will not appear in the feed.'} Your private editor inputs are not included.</p>
          <label className="post-composer__check"><input disabled={busy} type="checkbox" checked={reviewed} onChange={e => setReviewed(e.target.checked)} />I reviewed the chart, table, and source, and I’m ready to share this version.</label>
          <button type="button" className="post-composer__primary" disabled={!reviewed || busy} onClick={publish}>{busy ? 'Publishing…' : !publicFeed ? 'Prepare sharing version' : chart?.is_public ? 'Publish correction' : 'Publish post'}</button>
        </>}
      </>}
      {step === 'done' && chart && <><p>{publicFeed ? 'Your chart, data table, and source are published together.' : 'Your reviewed chart is ready. Open it to create a share link, or choose a team from the publish menu on web.'} Future draft edits will stay private until you review an update.</p><Link className="post-composer__primary" to={`/chart/${chart.id}`} replace state={{ returnTo: '/feed' }}>{publicFeed ? 'View post' : 'View chart'}</Link><Link to="/feed" replace>Back to feed</Link></>}
      {busy && step !== 'done' && <p role="status">{step === 'review' ? 'Publishing your post…' : 'Loading…'}</p>}
    </div>
  </div>;
}
