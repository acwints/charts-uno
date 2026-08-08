import { useCallback } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { motion } from 'motion/react';
import { ChartFeed } from '../components/ChartFeed';
import type { ChartResponse } from '../services/api';

interface OutletContextType {
  openAuthModal: () => void;
}

export function ChartFeedPage() {
  const navigate = useNavigate();
  const { openAuthModal } = useOutletContext<OutletContextType>();

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
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="feed-view"
    >
      <ChartFeed
        onChartSelect={handleChartSelect}
        onBack={handleBack}
        onAuthRequired={openAuthModal}
      />
    </motion.div>
  );
}
