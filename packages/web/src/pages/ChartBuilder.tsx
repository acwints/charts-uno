import { useCallback, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { motion } from 'motion/react';
import { Hero } from '../components/Hero';
import { DataInput } from '../components/DataInput';
import { useAuth } from '../hooks/useAuth';
import { useChartStore } from '../stores/chartStore';
import { recommendChartType } from '../services/chartTypeRecommender';
import type { ChartData } from '../types';

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
    setIsProcessing(true);
    try {
      const recommendation = await recommendChartType(data, { preferredType: data.suggestedType });
      const chosenType = data.suggestedType ?? recommendation.type;
      const enrichedData: ChartData = {
        ...data,
        suggestedType: chosenType,
        aiReasoning: recommendation.reasoning,
        aiSummary: recommendation.summary,
      };
      setChartData(enrichedData);
      setChartConfig((prev) => ({
        ...prev,
        title: data.suggestedTitle || prev.title,
        type: chosenType,
      }));
      navigate('/chart');
    } catch (error) {
      console.error('AI recommendation failed:', error);
      const fallbackType = data.suggestedType ?? 'bar';
      setChartData(data);
      setChartConfig((prev) => ({
        ...prev,
        title: data.suggestedTitle || prev.title,
        type: fallbackType,
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
    </motion.div>
  );
}
