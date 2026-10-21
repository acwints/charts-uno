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
  const { chartData, chartConfig, documentId, originalData, loadDocument, markSaved, setChartData, setChartConfig } = useChartStore();
  const { isAuthenticated, user } = useAuth();
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
  const justSavedIdRef = useRef<string | null>(null);
  const activeScope = `${user?.id ?? "anonymous"}:${id ?? "new"}`;
  const activeScopeRef = useRef(activeScope);
  activeScopeRef.current = activeScope;
  const [ownership, setOwnership] = useState<{ scope: string; ownerId: string } | null>(null);
  const canEditSavedChart = !id || (ownership?.scope === activeScope && ownership.ownerId === user?.id);
  const mountedRef = useRef(true);
  const savingRef = useRef(false);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

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
    if (!chartData || documentId !== (id ?? null) || savingRef.current) return null;
    const scope = activeScope;
    const isCurrent = () => mountedRef.current && activeScopeRef.current === scope;
    if (!isAuthenticated || !user) {
      toast.error('Please sign in to save and share charts');
      return null;
    }

    savingRef.current = true;
    setIsSaving(true);
    try {
      const { sourceType: _sourceType, ...storedChartData } = chartData;
      void _sourceType;
      if (id && canEditSavedChart) {
        await updateChart(id, {
          title: chartConfig.title || 'Untitled Chart',
          data: storedChartData,
          config: chartConfig,
        });
        if (!isCurrent()) return id;
        markSaved(id, chartData);
        toast.success('Chart updated');
        return id;
      }

      const result = await createChart({
        title: chartConfig.title || 'Untitled Chart',
        data: storedChartData,
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
      if (!isCurrent()) return result.id;
      // Bind the new server identity to the exact draft that was saved.
      useChartStore.setState({ documentId: result.id, originalData: chartData });
      setOwnership({ scope: `${user.id}:${result.id}`, ownerId: user.id });
      setIsPublishedToFeed(result.is_public);
      setPublishedTeamIds([]);
      toast.success('Chart saved to your profile');
      justSavedIdRef.current = result.id;
      navigate(`/chart/${result.id}`, { replace: true });
      return result.id;
    } catch (err) {
      console.error('Failed to save chart:', err);
      if (isCurrent()) toast.error(err instanceof Error ? err.message : 'Failed to save chart');
      return null;
    } finally {
      savingRef.current = false;
      if (mountedRef.current) setIsSaving(false);
    }
  };

  const handleSaveChart = async () => {
    await saveChart();
  };

  const handleCreateNew = () => {
    navigate('/new');
  };

  // Loads and publish settings may commit only to their own route/account scope.
  useEffect(() => {
    let cancelled = false;
    const isCurrent = () => !cancelled && activeScopeRef.current === activeScope;
    setError(null);
    setIsPublishedToFeed(false);
    setPublishedTeamIds([]);
    if (!id) {
      setIsLoading(false);
      const draft = useChartStore.getState();
      if (draft.chartData && !draft.originalData && draft.documentId === null) {
        markSaved(null, draft.chartData);
      }
      return () => { cancelled = true; };
    }
    if (justSavedIdRef.current === id) {
      justSavedIdRef.current = null;
      setIsLoading(false);
      return () => { cancelled = true; };
    }
    setIsLoading(true);
    getChart(id).then(async (chart) => {
      if (!isCurrent()) return;
      setOwnership({ scope: activeScope, ownerId: chart.user_id });
      const data: ChartData = {
        ...chart.data,
        sourceType: (chart.source_type as ChartData['sourceType']) || 'paste',
        suggestedTitle: chart.title || chart.config.title || chart.data.suggestedTitle,
      };
      const rawConfig = chart.config as Record<string, unknown>;
      loadDocument(id, data, {
        ...chart.config as ChartConfig,
        themeMode: rawConfig.themeMode as ChartConfig['themeMode'] || 'dark',
        showBorder: rawConfig.showBorder as boolean ?? true,
        showPoints: rawConfig.showPoints as boolean ?? true,
      });
      setIsLoading(false);
      if (chart.user_id !== user?.id) {
        setIsPublishedToFeed(chart.is_public);
        return;
      }
      try {
        const targets = await getChartPublishTargets(chart.id);
        if (!isCurrent()) return;
        setIsPublishedToFeed(targets.is_public);
        setPublishedTeamIds(targets.team_ids);
      } catch {
        if (isCurrent()) setIsPublishedToFeed(chart.is_public);
      }
    }).catch((err) => {
      if (!isCurrent()) return;
      console.error('Failed to load chart:', err);
      setError('Chart not found');
      setIsLoading(false);
    });
    return () => { cancelled = true; };
  }, [id, activeScope, user?.id, loadDocument, markSaved]);

  // If no ID and no chart data, redirect to home
  useEffect(() => {
    if (!id && !chartData) {
      navigate('/');
    }
  }, [id, chartData, navigate]);

  const isImageSource = chartData?.sourceType === 'image';

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

  if (isLoading || (id && documentId !== id && !error)) {
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
        key={activeScope}
        data={chartData}
        config={chartConfig}
        chartId={id}
        chartRef={chartCaptureRef}
        editorView={editorView}
        isAuthenticated={isAuthenticated}
        canEditSavedChart={canEditSavedChart}
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
          if (activeScopeRef.current !== activeScope) return;
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
