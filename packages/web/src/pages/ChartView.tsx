import { useRef, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { Save, Plus, BarChart3, Table2 } from 'lucide-react';
import { ChartPreview } from '../components/ChartPreview';
import { ChartControls } from '../components/ChartControls';
import { ReverseEngineerView } from '../components/ReverseEngineerView/ReverseEngineerView';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ExportMenu } from '../components/ExportMenu';
import { Button } from '../components/Button';
import { useChartStore } from '../stores/chartStore';
import { useAuth } from '../hooks/useAuth';
import { useTeam } from '../contexts/TeamContext';
import { useToast } from '../contexts/ToastContext';
import { getChart, createChartWithTeam, getTeamBranding } from '../services/api';
import type { ChartData, ChartConfig } from '../types';
import type { WatermarkSettings } from '../services/exportService';

export function ChartView() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const chartRef = useRef<HTMLDivElement>(null);
  const { chartData, chartConfig, setChartData, setChartConfig } = useChartStore();
  const { isAuthenticated } = useAuth();
  const { currentTeam } = useTeam();
  const toast = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [watermarkSettings, setWatermarkSettings] = useState<WatermarkSettings>({ enabled: true, customLogoUrl: null });
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');

  // Fetch branding settings for watermark
  useEffect(() => {
    if (currentTeam?.id) {
      getTeamBranding(currentTeam.id)
        .then((branding) => {
          // For free plans, always enable watermark
          const canCustomize = branding.can_customize;
          setWatermarkSettings({
            enabled: canCustomize ? branding.watermark_enabled : true,
            customLogoUrl: canCustomize ? branding.custom_logo_url : null,
          });
        })
        .catch(() => {
          // Default to watermark enabled if fetch fails
          setWatermarkSettings({ enabled: true, customLogoUrl: null });
        });
    }
  }, [currentTeam?.id]);

  const handleSaveChart = async () => {
    if (!chartData || !isAuthenticated) return;

    setIsSaving(true);
    try {
      const result = await createChartWithTeam({
        title: chartConfig.title || 'Untitled Chart',
        data: {
          labels: chartData.labels,
          series: chartData.series,
          suggestedType: chartData.suggestedType,
        },
        config: chartConfig,
        source_type: chartData.sourceType || 'paste',
        is_public: false,
        team_id: currentTeam?.id,
      });
      toast.success('Chart saved to your profile');
      navigate(`/chart/${result.id}`);
    } catch (err) {
      console.error('Failed to save chart:', err);
      toast.error('Failed to save chart');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateNew = () => {
    navigate('/new');
  };

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
          // Ensure themeMode has a default value for charts created before it was added
          const rawConfig = chart.config as Record<string, unknown>;
          const configWithDefaults: ChartConfig = {
            ...chart.config as ChartConfig,
            themeMode: rawConfig.themeMode as ChartConfig['themeMode'] || 'dark',
            showBorder: rawConfig.showBorder as boolean ?? true,
          };
          setChartConfig(configWithDefaults);
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

  useEffect(() => {
    if (chartConfig?.type === 'infographic' && viewMode !== 'chart') {
      setViewMode('chart');
    }
  }, [chartConfig?.type, viewMode]);

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
        <div className="chart-toolbar">
          <div className="chart-toolbar-left">
            <Button variant="default" size="sm" onClick={handleCreateNew}>
              <Plus size={16} />
              New Chart
            </Button>
            {chartConfig.type !== 'infographic' && (
              <div className="view-toggle">
                <button
                  className={`view-toggle-btn ${viewMode === 'chart' ? 'active' : ''}`}
                  onClick={() => setViewMode('chart')}
                  aria-label="Chart view"
                  aria-pressed={viewMode === 'chart'}
                >
                  <BarChart3 size={14} />
                  Chart
                </button>
                <button
                  className={`view-toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
                  onClick={() => setViewMode('table')}
                  aria-label="Table view"
                  aria-pressed={viewMode === 'table'}
                >
                  <Table2 size={14} />
                  Data
                </button>
              </div>
            )}
          </div>
          <div className="chart-toolbar-right">
            <ExportMenu
              data={chartData}
              chartRef={chartRef}
              title={chartConfig.title}
              watermark={watermarkSettings}
            />
            {isAuthenticated && !id && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveChart}
                disabled={isSaving}
              >
                <Save size={16} />
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            )}
          </div>
        </div>
        <ReverseEngineerView
          initialData={chartData}
          config={chartConfig}
          onConfigChange={setChartConfig}
          chartRef={chartRef}
          viewMode={viewMode}
        />
      </motion.div>
    );
  }

  return (
    <motion.div
      key="chart"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="chart-view"
    >
      {/* Chart toolbar with actions */}
      <div className="chart-toolbar">
        <div className="chart-toolbar-left">
          <Button variant="default" size="sm" onClick={handleCreateNew}>
            <Plus size={16} />
            New Chart
          </Button>
          {chartConfig.type !== 'infographic' && (
            <div className="view-toggle">
              <button
                className={`view-toggle-btn ${viewMode === 'chart' ? 'active' : ''}`}
                onClick={() => setViewMode('chart')}
                aria-label="Chart view"
                aria-pressed={viewMode === 'chart'}
              >
                <BarChart3 size={14} />
                Chart
              </button>
              <button
                className={`view-toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
                onClick={() => setViewMode('table')}
                aria-label="Table view"
                aria-pressed={viewMode === 'table'}
              >
                <Table2 size={14} />
                Data
              </button>
            </div>
          )}
        </div>
        <div className="chart-toolbar-right">
          <ExportMenu
            data={chartData}
            chartRef={chartRef}
            title={chartConfig.title}
            watermark={watermarkSettings}
          />
          {isAuthenticated && !id && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleSaveChart}
              disabled={isSaving}
            >
              <Save size={16} />
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          )}
        </div>
      </div>

      <div className="chart-workspace" ref={chartRef}>
        <div className="chart-column">
          {chartData.aiSummary && (
            <div className="chart-ai-summary">
              <span className="chart-ai-label">AI Insight</span>
              <p className="chart-ai-text">{chartData.aiSummary}</p>
            </div>
          )}
          <ChartPreview data={chartData} config={chartConfig} viewMode={viewMode} />
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
  );
}
