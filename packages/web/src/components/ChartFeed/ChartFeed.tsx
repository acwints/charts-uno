import { nativeFeedPages } from '../../services/nativeNavigationSession';
import { isNativeApp } from '../../services/native';
import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import TrendingUp from 'lucide-react/dist/esm/icons/trending-up';
import Bookmark from 'lucide-react/dist/esm/icons/bookmark';
import Heart from 'lucide-react/dist/esm/icons/heart';
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw';
import ChevronLeft from 'lucide-react/dist/esm/icons/chevron-left';
import { ChartCard } from './ChartCard';
import { InstaChartCard } from './InstaChartCard';
import { FeedSkeleton } from './FeedSkeleton';
import type { ChartResponse } from '../../services/api';
import { getPublicCharts, getSavedCharts, getLikedCharts } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import './ChartFeed.css';

type FeedTab = 'explore' | 'saved' | 'liked';

// Older releases persisted whole API documents, including editor metadata.
// Purge that cache. Session-only pages above preserve navigation without
// retaining private import material on disk or trusting a stale API response.
function removeLegacyFeedCache(): void {
  try { localStorage.removeItem('chartsuno_feed_explore_v1'); } catch { /* Storage unavailable. */ }
}

interface ChartFeedProps {
  initialTab?: FeedTab;
  onChartSelect?: (chart: ChartResponse) => void;
  onBack?: () => void;
  onAuthRequired?: () => void;
}

export function ChartFeed({ onChartSelect, onBack, onAuthRequired, initialTab = 'explore' }: ChartFeedProps) {
  const { user } = useAuth();
  const isMobile = useMediaQuery('(max-width: 640px)');
  const [activeTab, setActiveTab] = useState<FeedTab>(initialTab);
  const cachedPage = isNativeApp() ? nativeFeedPages.get(`${user?.id ?? 'anonymous'}:${initialTab}`) : undefined;
  const [charts, setCharts] = useState<ChartResponse[]>(() => { removeLegacyFeedCache(); return cachedPage?.charts ?? []; });
  const [isLoading, setIsLoading] = useState(!cachedPage);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(cachedPage?.hasMore ?? true);
  const offsetRef = useRef(cachedPage?.offset ?? 0);
  const pullStart = useRef<{ x: number; y: number } | null>(null);
  const [pullReady, setPullReady] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const LIMIT = 20;
  const scope = `${user?.id ?? 'anonymous'}:${activeTab}`;
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const [chartScope, setChartScope] = useState(scope);
  const generationRef = useRef(0);
  const inFlightScope = useRef<string | null>(null);
  const visibleCharts = chartScope === scope ? charts : [];
  useEffect(() => () => { generationRef.current++; }, []);

  const fetchCharts = useCallback(async (tab: FeedTab, resetOffset = true) => {
    const requestScope = `${user?.id ?? 'anonymous'}:${tab}`;
    if (!resetOffset && inFlightScope.current === requestScope) return;
    const generation = ++generationRef.current;
    const isCurrent = () => generation === generationRef.current && requestScope === scopeRef.current;
    inFlightScope.current = requestScope;
    setIsLoading(true);
    setError(null);

    const currentOffset = resetOffset ? 0 : offsetRef.current;

    try {
      let fetchedCharts: ChartResponse[] = [];
      let nextHasMore = false;

      switch (tab) {
        case 'explore': {
          const response = await getPublicCharts(LIMIT, currentOffset);
          fetchedCharts = response.charts;
          nextHasMore = response.charts.length === LIMIT;
          break;
        }
        case 'saved': {
          const response = await getSavedCharts();
          fetchedCharts = response.map((item) => item.chart);
          nextHasMore = false;
          break;
        }
        case 'liked': {
          fetchedCharts = await getLikedCharts();
          nextHasMore = false;
          break;
        }
      }

      if (!isCurrent()) return;
      setChartScope(requestScope);
      setHasMore(nextHasMore);
      if (resetOffset) {
        setCharts(fetchedCharts);
        offsetRef.current = LIMIT;
      } else {
        setCharts((prev) => [...prev, ...fetchedCharts]);
        offsetRef.current += LIMIT;
      }
    } catch (err) {
      if (!isCurrent()) return;
      console.error('Failed to fetch charts:', err);
      setError(err instanceof Error ? err.message : 'Failed to load charts');
    } finally {
      if (isCurrent()) { setIsLoading(false); inFlightScope.current = null; }
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id && activeTab !== 'explore') { setActiveTab('explore'); return; }
    const cached = isNativeApp() ? nativeFeedPages.get(scope) : undefined;
    if (cached) {
      setCharts(cached.charts);
      setChartScope(scope);
      setHasMore(cached.hasMore);
      offsetRef.current = cached.offset;
      setIsLoading(false);
      setError(null);
    } else { fetchCharts(activeTab, true); }
  }, [activeTab, fetchCharts, user?.id, scope]);

  useEffect(() => {
    if (isNativeApp() && chartScope === scope && !isLoading && !error) {
      nativeFeedPages.set(scope, { charts, offset: offsetRef.current, hasMore });
    }
  }, [charts, hasMore, chartScope, scope, isLoading, error]);

  const handleTabChange = (tab: FeedTab) => {
    if (tab !== 'explore' && !user) {
      return;
    }
    setActiveTab(tab);
  };

  const handleLoadMore = () => {
    if (!isLoading && hasMore) {
      fetchCharts(activeTab, false);
    }
  };

  // Mobile: replace the Load More button with scroll-triggered pagination.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!isMobile || !sentinel || activeTab !== 'explore') return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting) && !isLoading && hasMore) {
          fetchCharts('explore', false);
        }
      },
      { rootMargin: '400px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [isMobile, activeTab, isLoading, hasMore, fetchCharts]);

  const handleRefresh = () => {
    fetchCharts(activeTab, true);
  };

  useEffect(() => {
    const refresh = () => { void fetchCharts(activeTab, true); };
    window.addEventListener('chartsuno:refresh-feed', refresh);
    return () => window.removeEventListener('chartsuno:refresh-feed', refresh);
  }, [activeTab, fetchCharts]);

  const handleDismiss = ({ chartId, userId }: { chartId: string; userId?: string }) => {
    setCharts((prev) => prev.filter((chart) => (userId ? chart.user_id !== userId : chart.id !== chartId)));
  };

  const handleChartUpdate = (updatedChart: ChartResponse) => {
    setCharts((prev) =>
      prev.map((chart) =>
        chart.id === updatedChart.id ? updatedChart : chart
      )
    );
  };

  const tabs: { id: FeedTab; label: string; icon: typeof TrendingUp; requiresAuth: boolean }[] = [
    { id: 'explore', label: 'Explore', icon: TrendingUp, requiresAuth: false },
    { id: 'saved', label: 'Saved', icon: Bookmark, requiresAuth: true },
    { id: 'liked', label: 'Liked', icon: Heart, requiresAuth: true },
  ];

  return (
    <div className="chart-feed"
      onTouchStart={event => {
        const touch = event.touches[0];
        pullStart.current = isNativeApp() && window.scrollY <= 0 && !isLoading && event.touches.length === 1 ? { x: touch.clientX, y: touch.clientY } : null;
      }}
      onTouchMove={event => {
        if (!pullStart.current) return;
        const touch = event.touches[0];
        setPullReady(touch.clientY - pullStart.current.y > 80 && Math.abs(touch.clientX - pullStart.current.x) < 40);
      }}
      onTouchEnd={() => {
        if (pullReady && !isLoading) handleRefresh();
        pullStart.current = null; setPullReady(false);
      }}
      onTouchCancel={() => { pullStart.current = null; setPullReady(false); }}
    >
      {pullReady && <p className="chart-feed__pull" role="status">Release to refresh</p>}
      {!isNativeApp() && <header className="chart-feed__header">
        <div className="chart-feed__header-top">
          {onBack && (
            <button className="chart-feed__back-btn" onClick={onBack}>
              <ChevronLeft size={20} />
              <span>Back</span>
            </button>
          )}
          <h1 className="chart-feed__title">{initialTab === 'saved' ? 'Saved' : isNativeApp() ? 'Feed' : 'Chart Feed'}</h1>
          <button
            className="chart-feed__refresh-btn"
            onClick={handleRefresh}
            disabled={isLoading}
            aria-label="Refresh"
          >
            <RefreshCw size={18} className={isLoading ? 'spinning' : ''} />
          </button>
        </div>

        {!isNativeApp() && <nav className="chart-feed__tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`chart-feed__tab ${activeTab === tab.id ? 'chart-feed__tab--active' : ''} ${tab.requiresAuth && !user ? 'chart-feed__tab--disabled' : ''}`}
              onClick={() => handleTabChange(tab.id)}
              disabled={tab.requiresAuth && !user}
              title={tab.requiresAuth && !user ? 'Sign in to view' : undefined}
            >
              <tab.icon size={16} />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>}
      </header>}

      <main className={`chart-feed__content ${isMobile ? 'chart-feed__content--mobile' : ''}`}>
        {error && visibleCharts.length === 0 && (
          <div className="chart-feed__error">
            <p>{error}</p>
            <button onClick={handleRefresh} className="chart-feed__retry-btn">
              Try Again
            </button>
          </div>
        )}

        {error && visibleCharts.length > 0 && (
          <p className="chart-feed__stale" role="status">Showing saved charts. <button type="button" className="chart-feed__retry-link" onClick={handleRefresh}>Try again</button></p>
        )}

        {!error && isLoading && visibleCharts.length === 0 && (
          isMobile ? (
            <FeedSkeleton />
          ) : (
            <div className="chart-feed__loading">
              <Loader2 size={32} className="spinning" />
              <span>Loading charts...</span>
            </div>
          )
        )}

        {!error && !isLoading && visibleCharts.length === 0 && (
          <div className="chart-feed__empty">
            {activeTab === 'explore' && (
              <>
                <TrendingUp size={48} />
                <h2>No charts yet</h2>
                <p>Be the first to share a chart with the community.</p>
              </>
            )}
            {activeTab === 'saved' && (
              <>
                <Bookmark size={48} />
                <h2>No saved charts</h2>
                <p>Save charts you want to revisit later.</p>
              </>
            )}
            {activeTab === 'liked' && (
              <>
                <Heart size={48} />
                <h2>No liked charts</h2>
                <p>Like charts to show appreciation and find them here.</p>
              </>
            )}
          </div>
        )}

        <AnimatePresence mode="wait">
          {visibleCharts.length > 0 && (
            <motion.div
              key={`${activeTab}-${isMobile ? 'mobile' : 'desktop'}`}
              className={isMobile ? 'chart-feed__stream' : 'chart-feed__grid'}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {visibleCharts.map((chart, index) => (
                <motion.div
                  key={chart.id}
                  initial={isNativeApp() ? false : { opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index, 8) * 0.05, duration: 0.3 }}
                >
                  {isMobile ? (
                    <InstaChartCard
                      chart={chart}
                      onChartClick={onChartSelect}
                      onUpdate={handleChartUpdate}
                      onAuthRequired={onAuthRequired}
                      onDismiss={handleDismiss}
                    />
                  ) : (
                    <ChartCard
                      chart={chart}
                      onChartClick={onChartSelect}
                      onUpdate={handleChartUpdate}
                      onAuthRequired={onAuthRequired}
                      onDismiss={handleDismiss}
                    />
                  )}
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {isMobile && <div ref={sentinelRef} className="chart-feed__sentinel" aria-hidden="true" />}

        {!isMobile && hasMore && visibleCharts.length > 0 && activeTab === 'explore' && (
          <div className="chart-feed__load-more">
            <button
              className="chart-feed__load-more-btn"
              onClick={handleLoadMore}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="spinning" />
                  <span>Loading...</span>
                </>
              ) : (
                <span>Load More</span>
              )}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
