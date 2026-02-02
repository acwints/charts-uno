import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Header } from './components/Header';
import { DataInput } from './components/DataInput';
import { ChartPreview } from './components/ChartPreview';
import { ChartControls } from './components/ChartControls';
import { ChatPanel } from './components/ChatPanel';
import { Hero } from './components/Hero';
import { ReverseEngineerView } from './components/ReverseEngineerView/ReverseEngineerView';
import { ChartFeed } from './components/ChartFeed';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SettingsPage } from './pages/Settings';
import { AssistantProvider, useAssistant } from './contexts/AssistantProvider';
import { ToastProvider } from './contexts/ToastContext';
import { TeamProvider } from './contexts/TeamContext';
import { useAuth } from './hooks/useAuth';
import { recommendChartType } from './services/chartTypeRecommender';
import type { ChartData, ChartConfig } from './types';
import type { ChartResponse } from './services/api';
import './App.css';

type AppView = 'input' | 'chart' | 'feed' | 'settings';

function AppContent() {
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [chartConfig, setChartConfig] = useState<ChartConfig>({
    type: 'bar',
    colorScheme: 'default',
    styleVariant: 'professional',
    showGrid: true,
    showLegend: true,
    showValues: false,
    animate: true,
    title: '',
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentView, setCurrentView] = useState<AppView>('input');
  const [settingsTab, setSettingsTab] = useState<'account' | 'team' | 'billing'>('account');
  const chartRef = useRef<HTMLDivElement>(null);
  const { isOpen: isAssistantOpen } = useAssistant();

  const handleDataSubmit = useCallback(async (data: ChartData) => {
    const updates: Partial<ChartConfig> = {};
    if (data.suggestedTitle) {
      updates.title = data.suggestedTitle;
    }

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
      setChartConfig(prev => ({
        ...prev,
        ...updates,
        type: chosenType,
      }));
      setCurrentView('chart');
    } catch (error) {
      console.error('AI recommendation failed:', error);
      const fallbackType = data.suggestedType ?? 'bar';
      setChartData(data);
      setChartConfig(prev => ({ ...prev, ...updates, type: fallbackType }));
      setCurrentView('chart');
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const handleReset = useCallback(() => {
    setChartData(null);
    setChartConfig({
      type: 'bar',
      colorScheme: 'default',
      styleVariant: 'professional',
      showGrid: true,
      showLegend: true,
      showValues: false,
      animate: true,
      title: '',
    });
    setCurrentView('input');
  }, []);

  const handleFeedClick = useCallback(() => {
    setCurrentView('feed');
  }, []);

  const handleFeedBack = useCallback(() => {
    setCurrentView(chartData ? 'chart' : 'input');
  }, [chartData]);

  const handleSettingsClick = useCallback((tab?: 'account' | 'team' | 'billing') => {
    setSettingsTab(tab || 'account');
    setCurrentView('settings');
  }, []);

  const handleSettingsClose = useCallback(() => {
    setCurrentView(chartData ? 'chart' : 'input');
  }, [chartData]);

  const handleCreateTeam = useCallback(() => {
    setSettingsTab('team');
    setCurrentView('settings');
  }, []);

  const handleChartSelect = useCallback((chart: ChartResponse) => {
    const convertedData: ChartData = {
      labels: chart.data.labels,
      series: chart.data.series,
      sourceType: (chart.source_type as ChartData['sourceType']) || 'paste',
      suggestedTitle: chart.data.suggestedTitle,
      suggestedType: chart.data.suggestedType as ChartData['suggestedType'],
    };

    setChartData(convertedData);
    setChartConfig({
      type: (chart.config.type as ChartConfig['type']) || 'bar',
      colorScheme: (chart.config.colorScheme as ChartConfig['colorScheme']) || 'default',
      styleVariant: (chart.config.styleVariant as ChartConfig['styleVariant']) || 'professional',
      showGrid: chart.config.showGrid ?? true,
      showLegend: chart.config.showLegend ?? true,
      showValues: chart.config.showValues ?? false,
      animate: chart.config.animate ?? true,
      title: chart.config.title || chart.title || '',
    });
    setCurrentView('chart');
  }, []);

  const isImageSource = chartData?.sourceType === 'image';

  const showChart = currentView === 'chart' && chartData;
  const showFeed = currentView === 'feed';
  const showSettings = currentView === 'settings';
  const showInput = currentView === 'input' || (!chartData && !showFeed && !showSettings);

  const showAssistantPanel = showChart && chartData;

  return (
    <div className="app-wrapper">
      <div className={`app ${isAssistantOpen && showAssistantPanel ? 'with-assistant-open' : ''}`}>
        <Header
          onReset={handleReset}
          hasData={!!chartData}
          data={chartData}
          chartRef={chartRef}
          title={chartConfig.title}
          onFeedClick={handleFeedClick}
          showFeedButton={!showFeed && !showSettings}
          onSettingsClick={handleSettingsClick}
          onCreateTeam={handleCreateTeam}
          showAssistantToggle={!!showChart}
        />

        <main className="main">
        <AnimatePresence mode="wait">
          {showSettings ? (
            <motion.div
              key="settings"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="settings-view"
            >
              <SettingsPage initialTab={settingsTab} onClose={handleSettingsClose} />
            </motion.div>
          ) : showFeed ? (
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
                onBack={handleFeedBack}
              />
            </motion.div>
          ) : showInput ? (
            <motion.div
              key="input"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="input-view"
            >
              <Hero />
              <DataInput onSubmit={handleDataSubmit} isProcessing={isProcessing} />
            </motion.div>
          ) : showChart && isImageSource ? (
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
                onDataChange={setChartData}
                chartRef={chartRef}
              />
            </motion.div>
          ) : showChart ? (
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
          ) : null}
        </AnimatePresence>
      </main>

      <footer className="footer">
          <div className="footer-content">
            <span className="footer-brand">Epic Charts</span>
            <span className="footer-divider">•</span>
            <span className="footer-tagline">Data visualization, elevated</span>
          </div>
        </footer>
      </div>

      {/* AI Assistant Panel - embedded right panel */}
      {showAssistantPanel && (
        <ChatPanel
          data={chartData}
          config={chartConfig}
          onDataChange={setChartData}
          onConfigChange={setChartConfig}
        />
      )}
    </div>
  );
}

function AppWithTeam() {
  const { isAuthenticated } = useAuth();

  return (
    <TeamProvider isAuthenticated={isAuthenticated}>
      <AppContent />
    </TeamProvider>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AssistantProvider>
          <AppWithTeam />
        </AssistantProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;
