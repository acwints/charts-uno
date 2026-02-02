import { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { DashboardHeader } from '../../components/Dashboard/DashboardHeader';
import { ChartGrid } from '../../components/Dashboard/ChartGrid';
import { ChartListView } from '../../components/Dashboard/ChartListView';
import { DashboardToolbar } from '../../components/Dashboard/DashboardToolbar';
import { EmptyState } from '../../components/Dashboard/EmptyState';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { useDashboardStore } from '../../stores/dashboardStore';
import {
  getMyChartsFiltered,
  getLikedCharts,
  getSavedCharts,
  type ChartResponse,
} from '../../services/api';
import './Dashboard.css';

type DashboardTab = 'all' | 'published' | 'drafts' | 'liked' | 'saved';

interface UserDashboardPageProps {
  tab?: DashboardTab;
}

const TAB_CONFIG: Record<DashboardTab, { title: string; subtitle?: string }> = {
  all: { title: 'My Charts', subtitle: 'All your charts in one place' },
  published: { title: 'Published', subtitle: 'Charts visible on the public feed' },
  drafts: { title: 'Drafts', subtitle: 'Private charts only you can see' },
  liked: { title: 'Liked', subtitle: 'Charts you\'ve liked from the feed' },
  saved: { title: 'Saved', subtitle: 'Bookmarked charts for later' },
};

export function UserDashboardPage({ tab = 'all' }: UserDashboardPageProps) {
  const { view, sort, order, search, clearSelection } = useDashboardStore();
  const [charts, setCharts] = useState<ChartResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const fetchCharts = useCallback(async () => {
    setIsLoading(true);
    clearSelection();

    try {
      if (tab === 'liked') {
        const likedCharts = await getLikedCharts();
        setCharts(likedCharts);
        setTotal(likedCharts.length);
      } else if (tab === 'saved') {
        const savedResult = await getSavedCharts();
        const savedCharts = savedResult.map((s) => s.chart);
        setCharts(savedCharts);
        setTotal(savedCharts.length);
      } else {
        const isPublicFilter =
          tab === 'published' ? true : tab === 'drafts' ? false : undefined;

        const result = await getMyChartsFiltered({
          limit: 50,
          offset: 0,
          sort,
          order,
          search: search || undefined,
          is_public: isPublicFilter,
        });
        setCharts(result.charts);
        setTotal(result.total);
      }
    } catch (error) {
      console.error('Failed to fetch charts:', error);
      setCharts([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  }, [tab, sort, order, search, clearSelection]);

  useEffect(() => {
    fetchCharts();
  }, [fetchCharts]);

  const handleChartUpdate = (updatedChart: ChartResponse) => {
    setCharts((prev) =>
      prev.map((c) => (c.id === updatedChart.id ? updatedChart : c))
    );
  };

  const handleChartDelete = (chartId: string) => {
    setCharts((prev) => prev.filter((c) => c.id !== chartId));
    setTotal((prev) => prev - 1);
  };

  const handleBatchAction = () => {
    fetchCharts();
  };

  const config = TAB_CONFIG[tab];

  // Filter charts by search (client-side for liked/saved)
  const filteredCharts =
    tab === 'liked' || tab === 'saved'
      ? charts.filter(
          (c) =>
            !search ||
            (c.title || c.config.title || '')
              .toLowerCase()
              .includes(search.toLowerCase())
        )
      : charts;

  return (
    <motion.div
      key={tab}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="dashboard-page"
    >
      <DashboardHeader
        title={config.title}
        subtitle={config.subtitle}
        chartCount={total}
      />

      {isLoading ? (
        <div className="dashboard-loading">
          <LoadingSpinner />
        </div>
      ) : filteredCharts.length === 0 ? (
        <EmptyState type={tab} searchQuery={search} />
      ) : view === 'grid' ? (
        <ChartGrid
          charts={filteredCharts}
          onUpdate={handleChartUpdate}
          onDelete={handleChartDelete}
        />
      ) : (
        <ChartListView
          charts={filteredCharts}
          onUpdate={handleChartUpdate}
          onDelete={handleChartDelete}
        />
      )}

      <DashboardToolbar onBatchAction={handleBatchAction} />
    </motion.div>
  );
}
