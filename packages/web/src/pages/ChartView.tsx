import { useRef, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { ChartPreview } from '../components/ChartPreview';
import { ChartControls } from '../components/ChartControls';
import { ChatPanel } from '../components/ChatPanel';
import { ReverseEngineerView } from '../components/ReverseEngineerView/ReverseEngineerView';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { useChartStore } from '../stores/chartStore';
import { getChart } from '../services/api';
import type { ChartData, ChartConfig } from '../types';

export function ChartView() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const chartRef = useRef<HTMLDivElement>(null);
  const { chartData, chartConfig, setChartData, setChartConfig } = useChartStore();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If we have an ID in the URL, fetch the chart
  useEffect(() => {
    if (id) {
      setIsLoading(true);
      setError(null);
      getChart(id)
        .then((chart) => {
          // Populate the store with the loaded chart data
          const data: ChartData = {
            labels: chart.data.labels,
            series: chart.data.series,
            sourceType: (chart.source_type as ChartData['sourceType']) || 'paste',
            suggestedTitle: chart.title || chart.config.title,
            suggestedType: chart.data.suggestedType as ChartData['suggestedType'],
          };
          setChartData(data);
          setChartConfig(chart.config as ChartConfig);
        })
        .catch((err) => {
          console.error('Failed to load chart:', err);
          setError('Chart not found');
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [id, setChartData, setChartConfig]);

  // If no ID and no chart data, redirect to home
  useEffect(() => {
    if (!id && !chartData) {
      navigate('/');
    }
  }, [id, chartData, navigate]);

  const isImageSource = chartData?.sourceType === 'image';

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: '16px' }}>
        <p style={{ color: 'var(--text-muted)' }}>{error}</p>
        <button
          onClick={() => navigate('/dashboard')}
          style={{
            padding: '8px 16px',
            background: 'var(--accent)',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          Go to Dashboard
        </button>
      </div>
    );
  }

  if (!chartData) {
    return null;
  }

  if (isImageSource) {
    return (
      <motion.div
        key="reverse-engineer"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4 }}
        className="chart-view"
      >
        <ReverseEngineerView
          initialData={chartData}
          config={chartConfig}
          onConfigChange={setChartConfig}
          chartRef={chartRef}
        />
      </motion.div>
    );
  }

  return (
    <>
      <motion.div
        key="chart"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4 }}
        className="chart-view"
      >
        <div className="chart-workspace" ref={chartRef}>
          <div className="chart-column">
            {chartData.aiSummary && (
              <div className="chart-ai-summary">
                <span className="chart-ai-label">AI Insight</span>
                <p className="chart-ai-text">{chartData.aiSummary}</p>
              </div>
            )}
            <ChartPreview data={chartData} config={chartConfig} />
          </div>
          <div className="chart-sidebar">
            <ChartControls
              config={chartConfig}
              onChange={setChartConfig}
              data={chartData}
            />
          </div>
        </div>
      </motion.div>
      <ChatPanel
        data={chartData}
        config={chartConfig}
        onDataChange={setChartData}
        onConfigChange={setChartConfig}
      />
    </>
  );
}
