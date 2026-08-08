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

interface ChartFeedProps {
  onChartSelect?: (chart: ChartResponse) => void;
  onBack?: () => void;
  onAuthRequired?: () => void;
}

export function ChartFeed({ onChartSelect, onBack, onAuthRequired }: ChartFeedProps) {
  const { user } = useAuth();
  const isMobile = useMediaQuery('(max-width: 640px)');
  const [activeTab, setActiveTab] = useState<FeedTab>('explore');
  const [charts, setCharts] = useState<ChartResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(0);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const LIMIT = 20;

  const fetchCharts = useCallback(async (tab: FeedTab, resetOffset = true) => {
    setIsLoading(true);
    setError(null);

    const currentOffset = resetOffset ? 0 : offsetRef.current;

    try {
      let fetchedCharts: ChartResponse[] = [];

      switch (tab) {
        case 'explore': {
          const response = await getPublicCharts(LIMIT, currentOffset);
          fetchedCharts = response.charts;
          setHasMore(response.charts.length === LIMIT);
          break;
        }
        case 'saved': {
          const response = await getSavedCharts();
          fetchedCharts = response.map((item) => item.chart);
          setHasMore(false);
          break;
        }
        case 'liked': {
          fetchedCharts = await getLikedCharts();
          setHasMore(false);
          break;
        }
      }

      if (resetOffset) {
        setCharts(fetchedCharts);
        offsetRef.current = LIMIT;
      } else {
        setCharts((prev) => [...prev, ...fetchedCharts]);
        offsetRef.current += LIMIT;
      }
    } catch (err) {
      console.error('Failed to fetch charts:', err);
      setError(err instanceof Error ? err.message : 'Failed to load charts');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCharts(activeTab, true);
  }, [activeTab, fetchCharts]);

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
    <div className="chart-feed">
      <header className="chart-feed__header">
        <div className="chart-feed__header-top">
          {onBack && (
            <button className="chart-feed__back-btn" onClick={onBack}>
              <ChevronLeft size={20} />
              <span>Back</span>
            </button>
          )}
          <h1 className="chart-feed__title">Chart Feed</h1>
          <button
            className="chart-feed__refresh-btn"
            onClick={handleRefresh}
            disabled={isLoading}
            aria-label="Refresh"
          >
            <RefreshCw size={18} className={isLoading ? 'spinning' : ''} />
          </button>
        </div>

        <nav className="chart-feed__tabs">
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
        </nav>
      </header>

      <main className={`chart-feed__content ${isMobile ? 'chart-feed__content--mobile' : ''}`}>
        {error && (
          <div className="chart-feed__error">
            <p>{error}</p>
            <button onClick={handleRefresh} className="chart-feed__retry-btn">
              Try Again
            </button>
          </div>
        )}

        {!error && isLoading && charts.length === 0 && (
          isMobile ? (
            <FeedSkeleton />
          ) : (
            <div className="chart-feed__loading">
              <Loader2 size={32} className="spinning" />
              <span>Loading charts...</span>
            </div>
          )
        )}

        {!error && !isLoading && charts.length === 0 && (
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
          {charts.length > 0 && (
            <motion.div
              key={`${activeTab}-${isMobile ? 'mobile' : 'desktop'}`}
              className={isMobile ? 'chart-feed__stream' : 'chart-feed__grid'}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {charts.map((chart, index) => (
                <motion.div
                  key={chart.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index, 8) * 0.05, duration: 0.3 }}
                >
                  {isMobile ? (
                    <InstaChartCard
                      chart={chart}
                      onChartClick={onChartSelect}
                      onUpdate={handleChartUpdate}
                      onAuthRequired={onAuthRequired}
                    />
                  ) : (
                    <ChartCard
                      chart={chart}
                      onChartClick={onChartSelect}
                      onUpdate={handleChartUpdate}
                      onAuthRequired={onAuthRequired}
                    />
                  )}
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {isMobile && <div ref={sentinelRef} className="chart-feed__sentinel" aria-hidden="true" />}

        {!isMobile && hasMore && charts.length > 0 && activeTab === 'explore' && (
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
