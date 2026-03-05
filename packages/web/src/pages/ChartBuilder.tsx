import { useCallback, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { motion } from 'motion/react';
import { Hero } from '../components/Hero';
import { DataInput } from '../components/DataInput';
import { ValueOfCharts } from '../components/ValueOfCharts';
import { Features } from '../components/Features';
import { BottomCTA } from '../components/BottomCTA';
import { useAuth } from '../hooks/useAuth';
import { useChartStore } from '../stores/chartStore';
import { recommendChartType } from '../services/chartTypeRecommender';
import type { ChartData } from '../types';
import { suggestComboConfig } from '../types';

interface OutletContextType {
  openAuthModal: () => void;
}

export function ChartBuilder() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const context = useOutletContext<OutletContextType>();
  const [isProcessing, setIsProcessing] = useState(false);
  const { setChartData, setChartConfig } = useChartStore();

  const handleDataSubmit = useCallback(async (data: ChartData) => {
    // For structured data sources (stocks, sheets), skip AI recommendation
    // These sources already have a known chart type and don't need analysis
    const skipAI = data.sourceType === 'stocks' || data.sourceType === 'sheets';

    if (skipAI) {
      const chartType = data.suggestedType ?? 'line';
      const comboHint = suggestComboConfig(data, chartType);
      setChartData(data);
      setChartConfig((prev) => ({
        ...prev,
        title: data.suggestedTitle || prev.title,
        type: chartType,
        ...(data.suggestedStacked != null ? { stacked: data.suggestedStacked } : {}),
        ...(data.suggestedBarLayout ? { barLayout: data.suggestedBarLayout } : {}),
        ...(data.sourceLink ? { sourceLink: data.sourceLink } : {}),
        ...(comboHint ? { seriesConfig: comboHint.seriesConfig, rightYAxisLabel: comboHint.rightYAxisLabel } : {}),
      }));
      navigate('/chart');
      return;
    }

    setIsProcessing(true);
    try {
      const recommendation = await recommendChartType(data, { preferredType: data.suggestedType });
      const chosenType = data.suggestedType ?? recommendation.type;
      const enrichedData: ChartData = {
        ...data,
        suggestedType: chosenType,
        aiReasoning: data.aiReasoning || recommendation.reasoning,
        aiSummary: recommendation.summary,
      };
      const comboHint = suggestComboConfig(enrichedData, chosenType);
      setChartData(enrichedData);
      setChartConfig((prev) => ({
        ...prev,
        title: data.suggestedTitle || prev.title,
        type: chosenType,
        ...(data.suggestedStacked != null ? { stacked: data.suggestedStacked } : {}),
        ...(data.suggestedBarLayout ? { barLayout: data.suggestedBarLayout } : {}),
        ...(data.sourceLink ? { sourceLink: data.sourceLink } : {}),
        ...(comboHint ? { seriesConfig: comboHint.seriesConfig, rightYAxisLabel: comboHint.rightYAxisLabel } : {}),
      }));
      navigate('/chart');
    } catch (error) {
      console.error('AI recommendation failed:', error);
      const fallbackType = data.suggestedType ?? 'bar';
      const comboHint = suggestComboConfig(data, fallbackType);
      setChartData(data);
      setChartConfig((prev) => ({
        ...prev,
        title: data.suggestedTitle || prev.title,
        type: fallbackType,
        ...(data.suggestedStacked != null ? { stacked: data.suggestedStacked } : {}),
        ...(data.suggestedBarLayout ? { barLayout: data.suggestedBarLayout } : {}),
        ...(data.sourceLink ? { sourceLink: data.sourceLink } : {}),
        ...(comboHint ? { seriesConfig: comboHint.seriesConfig, rightYAxisLabel: comboHint.rightYAxisLabel } : {}),
      }));
      navigate('/chart');
    } finally {
      setIsProcessing(false);
    }
  }, [navigate, setChartData, setChartConfig]);

  return (
    <motion.div
      key="input"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="input-view"
    >
      <Hero showAuthCta={!isAuthenticated} onAuthOpen={context?.openAuthModal} />
      <DataInput onSubmit={handleDataSubmit} isProcessing={isProcessing} />
      {!isAuthenticated && (
        <>
          <Features />
          <ValueOfCharts />
          <BottomCTA onAuthOpen={context?.openAuthModal} isAuthenticated={false} />
        </>
      )}
    </motion.div>
  );
}
