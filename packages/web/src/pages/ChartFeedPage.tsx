import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ChartFeed } from '../components/ChartFeed';
import { useChartStore } from '../stores/chartStore';
import type { ChartResponse } from '../services/api';
import type { ChartData, ChartConfig } from '../types';

export function ChartFeedPage() {
  const navigate = useNavigate();
  const { setChartData, setChartConfig } = useChartStore();

  const handleChartSelect = useCallback(
    (chart: ChartResponse) => {
      const convertedData: ChartData = {
        labels: chart.data.labels,
        series: chart.data.series,
        sourceType: (chart.source_type as ChartData['sourceType']) || 'paste',
        suggestedTitle: chart.data.suggestedTitle,
        suggestedType: chart.data.suggestedType as ChartData['suggestedType'],
        ...(chart.data.sourceImage ? { sourceImage: chart.data.sourceImage } : {}),
      };

      const newConfig: ChartConfig = {
        type: (chart.config.type as ChartConfig['type']) || 'bar',
        colorScheme: (chart.config.colorScheme as ChartConfig['colorScheme']) || 'default',
        styleVariant: (chart.config.styleVariant as ChartConfig['styleVariant']) || 'professional',
        themeMode: ((chart.config as Record<string, unknown>).themeMode as ChartConfig['themeMode']) || 'dark',
        showGrid: chart.config.showGrid ?? true,
        showLegend: chart.config.showLegend ?? true,
        showValues: chart.config.showValues ?? false,
        showPoints: (chart.config as Record<string, unknown>).showPoints as boolean ?? true,
        showBorder: (chart.config as Record<string, unknown>).showBorder as boolean ?? true,
        animate: chart.config.animate ?? true,
        stacked: (chart.config as Record<string, unknown>).stacked as boolean ?? false,
        title: chart.config.title || chart.title || '',
      };

      setChartData(convertedData);
      setChartConfig(newConfig);
      navigate('/chart');
    },
    [navigate, setChartData, setChartConfig]
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
      <ChartFeed onChartSelect={handleChartSelect} onBack={handleBack} />
    </motion.div>
  );
}
