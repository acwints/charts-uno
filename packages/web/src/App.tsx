import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from './layouts/MainLayout';
import { ChartBuilder } from './pages/ChartBuilder';
import { ChartView } from './pages/ChartView';
import { EmbedView } from './pages/EmbedView';
import { ChartFeedPage } from './pages/ChartFeedPage';
import { SettingsPage } from './pages/Settings';
import { InviteAccept } from './pages/InviteAccept';
import { NotFound } from './pages/NotFound';
import { UserDashboardPage, TeamDashboardPage, TeamActivityPage } from './pages/Dashboard';
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

function AppWithTeam() {
  const { isAuthenticated } = useAuth();

  return (
    <TeamProvider isAuthenticated={isAuthenticated}>
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

          {/* Auth-required dashboard routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="dashboard">
              <Route index element={<UserDashboardPage tab="all" />} />
              <Route path="published" element={<UserDashboardPage tab="published" />} />
              <Route path="liked" element={<UserDashboardPage tab="liked" />} />
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
    </TeamProvider>
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
