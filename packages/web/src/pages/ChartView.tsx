import { useRef, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import Save from 'lucide-react/dist/esm/icons/save';
import Check from 'lucide-react/dist/esm/icons/check';
import Plus from 'lucide-react/dist/esm/icons/plus';
import BarChart3 from 'lucide-react/dist/esm/icons/bar-chart-3';
import Table2 from 'lucide-react/dist/esm/icons/table-2';
import Image from 'lucide-react/dist/esm/icons/image';
import { ChartPreview, type ChartLogoOption } from '../components/ChartPreview';
import { ChartControls } from '../components/ChartControls';
import { EditableSpreadsheet } from '../components/EditableSpreadsheet/EditableSpreadsheet';
import { ImageReasoningPanel } from '../components/ImageReasoningPanel/ImageReasoningPanel';
import { ReverseEngineerView } from '../components/ReverseEngineerView/ReverseEngineerView';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ExportMenu } from '../components/ExportMenu';
import { ShareMenu } from '../components/ShareMenu';
import { PublishMenu } from '../components/PublishMenu';
import { Button } from '../components/Button';
import { useChartStore } from '../stores/chartStore';
import { useAuth } from '../hooks/useAuth';
import { useTeam } from '../contexts/TeamContext';
import { useToast } from '../contexts/ToastContext';
import { getChart, createChart, getTeamBranding, getChartPublishTargets, updateChart } from '../services/api';
import type { ChartData, ChartConfig } from '../types';
import type { WatermarkSettings } from '../services/exportService';

const BRANDING_NONE_VALUE = '__none__';
const BRANDING_CHARTSUNO_VALUE = '__chartsuno__';

function getSpreadsheetComparableData(data: ChartData) {
  return {
    labels: data.labels,
    series: data.series,
    xAxisLabel: data.xAxisLabel,
  };
}

export function ChartView() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const chartCaptureRef = useRef<HTMLDivElement>(null);
  const { chartData, chartConfig, setChartData, setChartConfig, setInfographicSvg } = useChartStore();
  const { isAuthenticated } = useAuth();
  const { teams } = useTeam();
  const toast = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishedToFeed, setIsPublishedToFeed] = useState(false);
  const [publishedTeamIds, setPublishedTeamIds] = useState<string[]>([]);
  const [watermarkSettings, setWatermarkSettings] = useState<WatermarkSettings>({ enabled: true, customLogoUrl: null });
  const [logoOptions, setLogoOptions] = useState<ChartLogoOption[]>([]);
  const [editorView, setEditorView] = useState<'chart' | 'data'>('chart');
  const [originalData, setOriginalData] = useState<ChartData | null>(null);
  const initTokenRef = useRef<string | null>(null);
  const justSavedIdRef = useRef<string | null>(null);

  const teamSpaces = useMemo(() => teams.filter((team) => !team.is_personal), [teams]);
  const publishTeamOptions = useMemo(
    () => teamSpaces.map((team) => ({ id: team.id, name: team.name })),
    [teamSpaces],
  );

  useEffect(() => {
    if (!isAuthenticated) {
      setLogoOptions([]);
      setWatermarkSettings({ enabled: true, customLogoUrl: null });
      return;
    }

    if (teamSpaces.length === 0) {
      setLogoOptions([]);
      setWatermarkSettings((previous) => ({ ...previous, customLogoUrl: null }));
      return;
    }

    let cancelled = false;

    const loadLogoOptions = async () => {
      const results = await Promise.all(
        teamSpaces.map(async (team) => {
          try {
            const branding = await getTeamBranding(team.id);
            if (!branding.custom_logo_url) return null;
            return {
              teamId: team.id,
              teamName: team.name,
              logoUrl: branding.custom_logo_url,
            } satisfies ChartLogoOption;
          } catch {
            return null;
          }
        }),
      );

      if (cancelled) return;
      const nextOptions = results.filter((option): option is ChartLogoOption => option !== null);
      setLogoOptions(nextOptions);
      setWatermarkSettings((previous) => {
        if (!previous.customLogoUrl) return previous;
        if (nextOptions.some((option) => option.logoUrl === previous.customLogoUrl)) return previous;
        return { ...previous, customLogoUrl: null };
      });
    };

    loadLogoOptions();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, teamSpaces]);

  const logoSelectionValue = watermarkSettings.enabled === false
    ? BRANDING_NONE_VALUE
    : (watermarkSettings.customLogoUrl ?? BRANDING_CHARTSUNO_VALUE);

  const handleLogoSelectionChange = (value: string) => {
    if (value === BRANDING_NONE_VALUE) {
      setWatermarkSettings({ enabled: false, customLogoUrl: null });
      return;
    }

    if (value === BRANDING_CHARTSUNO_VALUE) {
      setWatermarkSettings({ enabled: true, customLogoUrl: null });
      return;
    }

    setWatermarkSettings({ enabled: true, customLogoUrl: value });
  };

  const saveChart = async () => {
    if (!chartData) return null;
    if (!isAuthenticated) {
      toast.error('Please sign in to save and share charts');
      return null;
    }

    setIsSaving(true);
    try {
      if (id) {
        await updateChart(id, {
          title: chartConfig.title || 'Untitled Chart',
          data: {
            labels: chartData.labels,
            series: chartData.series,
            verifiedData: chartData.verifiedData,
            suggestedType: chartData.suggestedType,
            suggestedTitle: chartData.suggestedTitle,
            aiReasoning: chartData.aiReasoning,
            aiSummary: chartData.aiSummary,
            userPrompt: chartData.userPrompt,
            sourcePrompt: chartData.sourcePrompt,
            ...(chartData.sourceImage ? { sourceImage: chartData.sourceImage } : {}),
          },
          config: chartConfig,
        });
        toast.success('Chart updated');
        return id;
      }

      const result = await createChart({
        title: chartConfig.title || 'Untitled Chart',
        data: {
          labels: chartData.labels,
          series: chartData.series,
          verifiedData: chartData.verifiedData,
          suggestedType: chartData.suggestedType,
          suggestedTitle: chartData.suggestedTitle,
            aiReasoning: chartData.aiReasoning,
          aiSummary: chartData.aiSummary,
          userPrompt: chartData.userPrompt,
          sourcePrompt: chartData.sourcePrompt,
          ...(chartData.sourceImage ? { sourceImage: chartData.sourceImage } : {}),
        },
        config: chartConfig,
        source_type: chartData.sourceType || 'paste',
        is_public: false,
      });
      setIsPublishedToFeed(result.is_public);
      setPublishedTeamIds([]);
      toast.success('Chart saved to your profile');
      justSavedIdRef.current = result.id;
      navigate(`/chart/${result.id}`, { replace: true });
      return result.id;
    } catch (err) {
      console.error('Failed to save chart:', err);
      toast.error('Failed to save chart');
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveChart = async () => {
    await saveChart();
  };

  const handleCreateNew = () => {
    navigate('/new');
  };

  // If we have an ID in the URL, fetch the chart (skip if we just saved it)
  useEffect(() => {
    if (id) {
      if (justSavedIdRef.current === id) {
        justSavedIdRef.current = null;
        return;
      }
      setInfographicSvg(null);
      setIsLoading(true);
      setError(null);
      getChart(id)
        .then(async (chart) => {
          // Populate the store with the loaded chart data
        const data: ChartData = {
            labels: chart.data.labels,
            series: chart.data.series,
            sourceType: (chart.source_type as ChartData['sourceType']) || 'paste',
            verifiedData: chart.data.verifiedData,
            suggestedTitle: chart.title || chart.config.title,
            suggestedType: chart.data.suggestedType as ChartData['suggestedType'],
          aiReasoning: chart.data.aiReasoning,
            aiSummary: chart.data.aiSummary,
            userPrompt: chart.data.userPrompt,
            sourcePrompt: chart.data.sourcePrompt,
            ...(chart.data.sourceImage ? { sourceImage: chart.data.sourceImage } : {}),
          };
          setChartData(data);
          // Ensure themeMode has a default value for charts created before it was added
          const rawConfig = chart.config as Record<string, unknown>;
          const configWithDefaults = {
            ...chart.config as ChartConfig,
            themeMode: rawConfig.themeMode as ChartConfig['themeMode'] || 'dark',
            showBorder: rawConfig.showBorder as boolean ?? true,
            showPoints: rawConfig.showPoints as boolean ?? true,
          };
          setChartConfig(configWithDefaults);

          try {
            const targets = await getChartPublishTargets(chart.id);
            setIsPublishedToFeed(targets.is_public);
            setPublishedTeamIds(targets.team_ids);
          } catch {
            setIsPublishedToFeed(chart.is_public);
            setPublishedTeamIds([]);
          }
        })
        .catch((err) => {
          console.error('Failed to load chart:', err);
          setError('Chart not found');
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [id, setChartData, setChartConfig, setInfographicSvg]);

  useEffect(() => {
    if (!id) {
      setIsPublishedToFeed(false);
      setPublishedTeamIds([]);
    }
  }, [id]);

  // If no ID and no chart data, redirect to home
  useEffect(() => {
    if (!id && !chartData) {
      navigate('/');
    }
  }, [id, chartData, navigate]);

  const isImageSource = chartData?.sourceType === 'image';
  const isPromptSource = chartData?.sourceType === 'prompt';

  useEffect(() => {
    if (!chartData) {
      setOriginalData(null);
      initTokenRef.current = null;
      return;
    }

    const token = id ?? 'new';
    if (initTokenRef.current !== token) {
      setOriginalData(chartData);
      initTokenRef.current = token;
    }
  }, [chartData, id]);

  const isDataDirty = useMemo(() => {
    if (!chartData || !originalData) return false;
    return JSON.stringify(getSpreadsheetComparableData(chartData))
      !== JSON.stringify(getSpreadsheetComparableData(originalData));
  }, [chartData, originalData]);

  const handleDataReset = () => {
    if (originalData) {
      setChartData(originalData);
    }
  };

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

  return (
    <motion.div
      key={isImageSource ? 'reverse-engineer' : 'chart'}
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
        </div>
        <div className="chart-toolbar-center">
          <div className="chart-view-toggle">
            <button
              className={`chart-view-toggle-btn ${editorView === 'chart' ? 'is-active' : ''}`}
              onClick={() => setEditorView('chart')}
              aria-label="Chart view"
              aria-pressed={editorView === 'chart'}
            >
              <BarChart3 size={14} />
              Chart
            </button>
            <button
              className={`chart-view-toggle-btn ${editorView === 'data' ? 'is-active' : ''}`}
              onClick={() => setEditorView('data')}
              aria-label="Data editor view"
              aria-pressed={editorView === 'data'}
            >
              <Table2 size={14} />
              Data
            </button>
          </div>
        </div>
        <div className="chart-toolbar-right">
          {isAuthenticated && (
            <Button
              variant="default"
              size="sm"
              onClick={handleSaveChart}
              disabled={isSaving}
              title={id ? 'Update chart' : 'Save chart'}
            >
              {id ? <Check size={16} /> : <Save size={16} />}
              {isSaving ? 'Saving...' : id ? 'Update' : 'Save'}
            </Button>
          )}
          {id && isAuthenticated && (
            <PublishMenu
              chartId={id}
              isPublic={isPublishedToFeed}
              publishedTeamIds={publishedTeamIds}
              onTargetsChange={(targets) => {
                setIsPublishedToFeed(targets.isPublic);
                setPublishedTeamIds(targets.teamIds);
              }}
              teamOptions={publishTeamOptions}
              isAuthenticated={isAuthenticated}
            />
          )}
          {editorView === 'chart' && (
            <>
              <ExportMenu
                data={chartData}
                chartRef={chartCaptureRef}
                chartId={id}
                title={chartConfig.title}
                watermark={watermarkSettings}
                isAuthenticated={isAuthenticated}
              />
              <ShareMenu
                chartRef={chartCaptureRef}
                title={chartConfig.title}
                watermark={watermarkSettings}
                isAuthenticated={isAuthenticated}
              />
            </>
          )}
        </div>
      </div>

      {editorView === 'data' ? (
        <div className="chart-data-editor">
          {isImageSource && (
            <div className="data-editor-top-row">
              {chartData.sourceImage && (
                <div className="source-image-panel">
                  <div className="source-image-header">
                    <Image size={14} />
                    <span className="source-image-label">SOURCE</span>
                  </div>
                  <div className="source-image-preview">
                    <img
                      src={`data:${chartData.sourceImage.mimeType};base64,${chartData.sourceImage.base64}`}
                      alt="Original chart source"
                      className="source-image-img"
                    />
                  </div>
                </div>
              )}
              <ImageReasoningPanel
                data={chartData}
                onDataChange={setChartData}
              />
            </div>
          )}
          {isPromptSource && chartData.sourcePrompt && (
            <div className="prompt-source-panel">
              <div className="prompt-source-header">
                <span className="prompt-source-label">RECONSTRUCTION PROMPT</span>
                <span
                  className={`prompt-source-status ${chartData.verifiedData ? 'verified' : 'unverified'}`}
                  aria-label={chartData.verifiedData ? 'Verified source-backed data' : 'Unverified AI-generated data'}
                  title={chartData.verifiedData ? 'Verified source-backed data' : 'Unverified AI-generated data'}
                >
                  {chartData.verifiedData ? 'Verified data' : 'Unverified AI estimate'}
                </span>
              </div>
              <p className="prompt-source-text">{chartData.sourcePrompt}</p>
              {!chartData.verifiedData && (
                <p className="prompt-source-note">
                  This chart was generated from your prompt and may contain synthetic or approximate values.
                  Verify against a trusted source before publishing as factual.
                </p>
              )}
            </div>
          )}
          <EditableSpreadsheet
            data={chartData}
            colorScheme={chartConfig.colorScheme}
            isDirty={isDataDirty}
            onChange={setChartData}
            onReset={handleDataReset}
          />
        </div>
      ) : isImageSource ? (
        <ReverseEngineerView
          initialData={chartData}
          config={chartConfig}
          onConfigChange={setChartConfig}
          chartRef={chartCaptureRef}
          watermark={watermarkSettings}
          logoOptions={logoOptions}
          logoSelectionValue={logoSelectionValue}
          canCustomizeBranding={isAuthenticated}
          onLogoSelectionChange={handleLogoSelectionChange}
        />
      ) : (
        <div className="chart-workspace">
          <div className="chart-column" ref={chartCaptureRef}>
            {chartData.aiSummary && (
              <details className="chart-ai-summary" open>
                <summary className="section-label chart-ai-label">AI Insight</summary>
                <p className="chart-ai-text">{chartData.aiSummary}</p>
              </details>
            )}
            <ChartPreview
              data={chartData}
              config={chartConfig}
              watermark={watermarkSettings}
            />
          </div>
          <div className="chart-sidebar">
            <ChartControls
              config={chartConfig}
              onChange={setChartConfig}
              data={chartData}
              onDataChange={setChartData}
              watermark={watermarkSettings}
              logoOptions={logoOptions}
              logoSelectionValue={logoSelectionValue}
              canCustomizeBranding={isAuthenticated}
              onLogoSelectionChange={handleLogoSelectionChange}
            />
          </div>
        </div>
      )}
    </motion.div>
  );
}
