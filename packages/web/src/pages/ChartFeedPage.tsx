import { useCallback } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { motion } from 'motion/react';
import { isNativeApp } from '../services/native';
import { ChartFeed } from '../components/ChartFeed';
import type { ChartResponse } from '../services/api';

interface OutletContextType {
  openAuthModal: () => void;
}

export function ChartFeedPage({ initialTab = 'explore' }: { initialTab?: 'explore' | 'saved' }) {
  const navigate = useNavigate();
  const outlet = useOutletContext<OutletContextType | undefined>();

  // Open the canonical chart URL: ChartView fetches the chart there, which
  // also counts the view server-side.
  const handleChartSelect = useCallback(
    (chart: ChartResponse) => {
      navigate(`/chart/${chart.id}`);
    },
    [navigate]
  );

  const handleBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  return (
    <motion.div
      key="feed"
      initial={isNativeApp() ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="feed-view"
    >
      <ChartFeed
        key={initialTab}
        initialTab={initialTab}
        onChartSelect={handleChartSelect}
        onBack={isNativeApp() ? undefined : handleBack}
        onAuthRequired={outlet?.openAuthModal}
      />
    </motion.div>
  );
}
