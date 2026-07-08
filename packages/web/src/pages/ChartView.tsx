import { useRef, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import type { ChartLogoOption } from '../components/ChartPreview';
import { ChartWorkbench, type ChartEditorView } from '../components/ChartWorkbench';
import { LoadingSpinner } from '../components/LoadingSpinner';
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
  const [editorView, setEditorView] = useState<ChartEditorView>('chart');
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
        ...(chartData.sourceType === 'sql' && chartData.sqlConnectionId ? {
          sql_connection_id: chartData.sqlConnectionId,
          refresh_query: {
            sql: chartData.sqlQuery,
            label_column: chartData.sqlLabelColumn,
            series_columns: chartData.sqlSeriesColumns,
          },
        } : {}),
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
      <ChartWorkbench
        data={chartData}
        config={chartConfig}
        chartId={id}
        chartRef={chartCaptureRef}
        editorView={editorView}
        isAuthenticated={isAuthenticated}
        isSaving={isSaving}
        isDataDirty={isDataDirty}
        isPublishedToFeed={isPublishedToFeed}
        publishedTeamIds={publishedTeamIds}
        publishTeamOptions={publishTeamOptions}
        watermark={watermarkSettings}
        logoOptions={logoOptions}
        logoSelectionValue={logoSelectionValue}
        canCustomizeBranding={isAuthenticated}
        onCreateNew={handleCreateNew}
        onSave={handleSaveChart}
        onEditorViewChange={setEditorView}
        onPublishTargetsChange={(targets) => {
          setIsPublishedToFeed(targets.isPublic);
          setPublishedTeamIds(targets.teamIds);
        }}
        onDataChange={setChartData}
        onDataReset={handleDataReset}
        onConfigChange={setChartConfig}
        onLogoSelectionChange={handleLogoSelectionChange}
      />
    </motion.div>
  );
}
