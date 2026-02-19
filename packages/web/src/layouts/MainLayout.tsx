import { useEffect, type ReactNode } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'motion/react';
import { Header } from '../components/Header';
import { DashboardSidebar } from '../components/Dashboard/DashboardSidebar';
import { AuthModal } from '../components/AuthModal';
import { ChatPanel } from '../components/ChatPanel';
import { useAuth } from '../hooks/useAuth';
import { useAuthModal } from '../hooks/useAuthModal';
import { useChartStore } from '../stores/chartStore';

interface MainLayoutProps {
  children?: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const { isAuthModalOpen, openAuthModal, closeAuthModal } = useAuthModal();
  const { chartData, chartConfig, setChartData, setChartConfig } = useChartStore();

  const isChartPage = location.pathname === '/chart' || location.pathname.startsWith('/chart/');
  const isCreationFlow = isChartPage || location.pathname === '/new';

  useEffect(() => {
    if (isAuthenticated) {
      closeAuthModal();
    }
  }, [isAuthenticated, closeAuthModal]);

  return (
    <div className="app">
      <Header onAuthOpen={openAuthModal} />

      <div className="app-body">
        {isAuthenticated && !isCreationFlow && <DashboardSidebar />}

        <main className="main">
          <AnimatePresence mode="wait">
            {children || <Outlet context={{ openAuthModal }} />}
          </AnimatePresence>
        </main>

        {/* ChatPanel as sidebar - only show on chart pages with data */}
        {isChartPage && chartData && (
          <ChatPanel
            data={chartData}
            config={chartConfig}
            onDataChange={setChartData}
            onConfigChange={setChartConfig}
          />
        )}
      </div>

      <footer className="footer">
        <div className="footer-content">
          <span className="footer-brand">Chartsuno</span>
          <span className="footer-divider">•</span>
          <span className="footer-tagline">Data visualization, elevated</span>
        </div>
      </footer>

      <AuthModal isOpen={!isAuthenticated && isAuthModalOpen} onClose={closeAuthModal} />
    </div>
  );
}
