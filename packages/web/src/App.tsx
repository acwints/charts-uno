import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from './layouts/MainLayout';
import { ChartFeedPage } from './pages/ChartFeedPage';
import { NotFound } from './pages/NotFound';
import { TermsPage } from './pages/TermsPage';
import { PrivacyPage } from './pages/PrivacyPage';

// The feed is the first screen; everything that drags in Recharts, CodeMirror,
// html2canvas or the map data loads on demand so the first paint stays small.
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

function AppWithTeam() {
  const { isAuthenticated } = useAuth();

  return (
    <TeamProvider isAuthenticated={isAuthenticated}>
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

          {/* Auth-required dashboard routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="dashboard">
              <Route index element={<UserDashboardPage tab="all" />} />
              <Route path="published" element={<UserDashboardPage tab="published" />} />
              <Route path="liked" element={<UserDashboardPage tab="liked" />} />
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

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (isNativeApp()) return <Navigate to="/feed" replace />;

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  // Show landing page with chart builder for unauthenticated users
  return <ChartBuilder />;
}

function App() {
  return (
    <ErrorBoundary>
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
    </ErrorBoundary>
  );
}

export default App;
