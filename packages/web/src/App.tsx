import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from './layouts/MainLayout';
import { ChartBuilder } from './pages/ChartBuilder';
import { ChartView } from './pages/ChartView';
import { ChartFeedPage } from './pages/ChartFeedPage';
import { SettingsPage } from './pages/Settings';
import { InviteAccept } from './pages/InviteAccept';
import { NotFound } from './pages/NotFound';
import { UserDashboardPage, TeamDashboardPage, TeamActivityPage } from './pages/Dashboard';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AssistantProvider } from './contexts/AssistantProvider';
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
        {/* Home route with auth-based redirect */}
        <Route path="/" element={<HomeRoute />} />

        {/* Public routes */}
        <Route path="/feed" element={<MainLayout />}>
          <Route index element={<ChartFeedPage />} />
        </Route>

        <Route path="/chart" element={<MainLayout />}>
          <Route index element={<ChartView />} />
        </Route>

        <Route path="/chart/:id" element={<MainLayout />}>
          <Route index element={<ChartView />} />
        </Route>

        <Route path="/invite/:token" element={<MainLayout />}>
          <Route index element={<InviteAccept />} />
        </Route>

        {/* Auth-required dashboard routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<MainLayout />}>
            <Route index element={<UserDashboardPage tab="all" />} />
            <Route path="published" element={<UserDashboardPage tab="published" />} />
            <Route path="liked" element={<UserDashboardPage tab="liked" />} />
          </Route>

          <Route path="/team/:slug" element={<MainLayout />}>
            <Route index element={<TeamDashboardPage />} />
            <Route path="activity" element={<TeamActivityPage />} />
          </Route>

          <Route path="/new" element={<MainLayout />}>
            <Route index element={<ChartBuilder />} />
          </Route>

          <Route path="/settings" element={<MainLayout />}>
            <Route index element={<SettingsPage />} />
            <Route path=":tab" element={<SettingsPage />} />
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
    return null; // Or a loading spinner
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  // Show landing page with chart builder for unauthenticated users
  return (
    <MainLayout>
      <ChartBuilder />
    </MainLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <AssistantProvider>
            <BrowserRouter>
              <AppWithTeam />
            </BrowserRouter>
          </AssistantProvider>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
