import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ChartPreview } from '../components/ChartPreview';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { getChart } from '../services/api';
import type { ChartData, ChartConfig } from '../types';
import './EmbedView.css';

export function EmbedView() {
  const { id } = useParams<{ id: string }>();
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [chartConfig, setChartConfig] = useState<ChartConfig | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(id));
  const [error, setError] = useState<string | null>(id ? null : 'No chart ID provided');

  useEffect(() => {
    if (!id) return;

    let cancelled = false;
    getChart(id)
      .then((chart) => {
        if (cancelled) return;
        const data: ChartData = {
          ...chart.data,
          sourceType: (chart.source_type as ChartData['sourceType']) || 'paste',
          suggestedTitle: chart.title || (chart.config as ChartConfig).title,
        };
        setChartData(data);

        const rawConfig = chart.config as Record<string, unknown>;
        const config: ChartConfig = {
          ...(chart.config as ChartConfig),
          themeMode: (rawConfig.themeMode as ChartConfig['themeMode']) || 'dark',
          showBorder: (rawConfig.showBorder as boolean) ?? true,
          showPoints: (rawConfig.showPoints as boolean) ?? true,
        };
        setChartConfig(config);
      })
      .catch(() => {
        if (!cancelled) setError('Chart not found');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [id]);

  if (isLoading) {
    return (
      <div className="embed-view embed-view--loading">
        <LoadingSpinner size="md" />
      </div>
    );
  }

  if (error || !chartData || !chartConfig) {
    return (
      <div className="embed-view embed-view--error">
        <p className="embed-error-text">{error || 'Failed to load chart'}</p>
      </div>
    );
  }

  return (
    <div className="embed-view" data-theme-mode={chartConfig.themeMode}>
      <div className="embed-chart-wrapper">
        <ChartPreview
          data={chartData}
          config={chartConfig}
          watermark={{ enabled: true, customLogoUrl: null }}
        />
      </div>
    </div>
  );
}
