import { lazy, Suspense, useEffect, useState } from 'react';
import { MotionConfig } from 'motion/react';
import { BrowserRouter, Routes, Route, Navigate, useOutletContext, useSearchParams } from 'react-router-dom';
import { MainLayout } from './layouts/MainLayout';
import { ChartFeedPage } from './pages/ChartFeedPage';
import { NotFound } from './pages/NotFound';
import { TermsPage } from './pages/TermsPage';
import { PrivacyPage } from './pages/PrivacyPage';

// The feed is the first screen; everything that drags in Recharts, CodeMirror,
// chart capture or the map data loads on demand so the first paint stays small.
const ChartBuilder = lazy(() => import('./pages/ChartBuilder').then((m) => ({ default: m.ChartBuilder })));
const ChartView = lazy(() => import('./pages/ChartView').then((m) => ({ default: m.ChartView })));
const EmbedView = lazy(() => import('./pages/EmbedView').then((m) => ({ default: m.EmbedView })));
const SettingsPage = lazy(() => import('./pages/Settings').then((m) => ({ default: m.SettingsPage })));
const InviteAccept = lazy(() => import('./pages/InviteAccept').then((m) => ({ default: m.InviteAccept })));
const UserDashboardPage = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.UserDashboardPage })));
const TeamDashboardPage = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.TeamDashboardPage })));
const TeamActivityPage = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.TeamActivityPage })));
const DashboardsListPage = lazy(() => import('./pages/Dashboards').then((m) => ({ default: m.DashboardsListPage })));
const DashboardViewPage = lazy(() => import('./pages/Dashboards').then((m) => ({ default: m.DashboardViewPage })));
const DashboardEditPage = lazy(() => import('./pages/Dashboards').then((m) => ({ default: m.DashboardEditPage })));
const SeoLandingPage = lazy(() => import('./pages/SeoLandingPage').then((m) => ({ default: m.SeoLandingPage })));
const ChangelogPage = lazy(() => import('./pages/ChangelogPage').then((m) => ({ default: m.ChangelogPage })));
import { ProtectedRoute } from './components/ProtectedRoute';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoadingSpinner } from './components/LoadingSpinner';
import { AssistantProvider } from './contexts/AssistantProvider';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { TeamProvider } from './contexts/TeamContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { useAuth } from './hooks/useAuth';
import './App.css';
import { isNativeApp } from './services/native';
import { getMyCharts } from './services/api';
import { prepareFirstChartEditor } from './services/firstChart';
import { saveStarterTemplateOnce, starterBySlug } from './content/starterTemplates';
import { readPendingChart } from './services/pendingChart';

function AppWithTeam() {
  const { isAuthenticated, user } = useAuth();

  return (
    <TeamProvider key={user?.id ?? "anonymous"} isAuthenticated={isAuthenticated}>
      <Suspense fallback={<RouteFallback />}>
      <Routes>
        {/* Embed route (no layout chrome) */}
        <Route path="/embed/:id" element={<EmbedView />} />

        {/* Shared app shell */}
        <Route path="/" element={<MainLayout />}>
          {/* Home route with auth-based redirect */}
          <Route index element={<HomeRoute />} />

          {/* Public routes */}
          <Route path="feed" element={<ChartFeedPage />} />
          <Route path="new" element={<ChartBuilder />} />
          <Route path="chart">
            <Route index element={<ChartView />} />
            <Route path=":id" element={<ChartView />} />
          </Route>
          <Route path="invite/:token" element={<InviteAccept />} />
          <Route path="terms" element={<TermsPage />} />
          <Route path="privacy" element={<PrivacyPage />} />
          <Route path="changelog" element={<ChangelogPage canSendFeedback={isAuthenticated} />} />
          <Route path="bar-chart-maker" element={<SeoLandingPage slug="bar-chart-maker" />} />
          <Route path="csv-to-chart" element={<SeoLandingPage slug="csv-to-chart" />} />
          <Route path="iphone-chart-maker" element={<SeoLandingPage slug="iphone-chart-maker" />} />
          <Route path="pie-chart-maker" element={<SeoLandingPage slug="pie-chart-maker" />} />
          <Route path="line-graph-maker" element={<SeoLandingPage slug="line-graph-maker" />} />
          <Route path="chart-from-google-sheets" element={<SeoLandingPage slug="chart-from-google-sheets" />} />
          <Route path="scatter-plot-maker" element={<SeoLandingPage slug="scatter-plot-maker" />} />
          <Route path="chart-from-excel" element={<SeoLandingPage slug="chart-from-excel" />} />
          <Route path="chartsuno-vs-datawrapper" element={<SeoLandingPage slug="chartsuno-vs-datawrapper" />} />
          <Route path="area-chart-maker" element={<SeoLandingPage slug="area-chart-maker" />} />
          <Route path="histogram-maker" element={<SeoLandingPage slug="histogram-maker" />} />
          <Route path="chartsuno-vs-canva-charts" element={<SeoLandingPage slug="chartsuno-vs-canva-charts" />} />
          <Route path="donut-chart-maker" element={<SeoLandingPage slug="donut-chart-maker" />} />
          <Route path="stacked-bar-chart-maker" element={<SeoLandingPage slug="stacked-bar-chart-maker" />} />
          <Route path="chart-from-json" element={<SeoLandingPage slug="chart-from-json" />} />

          {/* Auth-required dashboard routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="dashboard">
              <Route index element={<UserDashboardPage tab="all" />} />
              <Route path="published" element={<UserDashboardPage tab="published" />} />
              <Route path="liked" element={<UserDashboardPage tab="liked" />} />
              <Route path="saved" element={<ChartFeedPage initialTab="saved" />} />
            </Route>

            <Route path="dashboards">
              <Route index element={<DashboardsListPage />} />
              <Route path=":id" element={<DashboardViewPage />} />
              <Route path=":id/edit" element={<DashboardEditPage />} />
            </Route>

            <Route path="team/:slug">
              <Route index element={<TeamDashboardPage />} />
              <Route path="activity" element={<TeamActivityPage />} />
            </Route>

            <Route path="settings">
              <Route index element={<SettingsPage />} />
              <Route path=":tab" element={<SettingsPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>
    </TeamProvider>
  );
}

function RouteFallback() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
      <LoadingSpinner size="lg" />
    </div>
  );
}

// Home route: authenticated users go to dashboard, others see landing page
function HomeRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const { pendingChartFailed = false } = useOutletContext<{ pendingChartFailed?: boolean }>() ?? {};
  const waitingToSave = isAuthenticated && !pendingChartFailed && readPendingChart() !== null;
  const [params] = useSearchParams();
  const linkedTemplate = starterBySlug(params.get('template'));
  const shouldCheckLibrary = isAuthenticated && !isLoading && !waitingToSave && !isNativeApp();
  const [libraryChoice, setLibraryChoice] = useState<'pending' | 'editor' | 'library'>('pending');
  const [savedTemplateId, setSavedTemplateId] = useState<string | null>(null);
  const [checkedLibrary, setCheckedLibrary] = useState(false);
  if (checkedLibrary !== shouldCheckLibrary) {
    setCheckedLibrary(shouldCheckLibrary);
    setLibraryChoice('pending');
  }

  useEffect(() => {
    if (!shouldCheckLibrary || !linkedTemplate) return;
    let active = true;
    saveStarterTemplateOnce(linkedTemplate)
      .then((id) => {
        if (active) setSavedTemplateId(id);
      })
      .catch(() => {
        if (!active) return;
        prepareFirstChartEditor();
        setLibraryChoice('editor');
      });
    return () => {
      active = false;
    };
  }, [shouldCheckLibrary, linkedTemplate]);

  useEffect(() => {
    if (!shouldCheckLibrary || linkedTemplate) return;
    let active = true;
    getMyCharts(1, 0)
      .then((page) => {
        if (!active) return;
        if (page.total > 0) {
          setLibraryChoice('library');
          return;
        }
        prepareFirstChartEditor();
        setLibraryChoice('editor');
      })
      .catch(() => {
        if (active) setLibraryChoice('library');
      });
    return () => {
      active = false;
    };
  }, [shouldCheckLibrary, linkedTemplate]);

  if (savedTemplateId) return <Navigate to={`/chart/${savedTemplateId}`} replace />;

  if (isLoading || waitingToSave || (isAuthenticated && !isNativeApp() && libraryChoice === 'pending')) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (isNativeApp()) return <Navigate to="/feed" replace />;

  if (isAuthenticated) {
    return <Navigate to={libraryChoice === 'editor' ? '/chart' : '/dashboard'} replace />;
  }

  // Show landing page with chart builder for unauthenticated users
  return <ChartBuilder />;
}

function App() {
  return (
    <ErrorBoundary>
      <MotionConfig reducedMotion="user">
      <AuthProvider>
        <ThemeProvider>
          <ToastProvider>
            <AssistantProvider>
              <BrowserRouter>
                <AppWithTeam />
              </BrowserRouter>
            </AssistantProvider>
          </ToastProvider>
        </ThemeProvider>
      </AuthProvider>
      </MotionConfig>
    </ErrorBoundary>
  );
}

export default App;
