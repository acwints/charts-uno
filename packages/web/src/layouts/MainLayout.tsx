import { useRef, useEffect, type ReactNode } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'motion/react';
import { Header } from '../components/Header';
import { AuthModal } from '../components/AuthModal';
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
  const { chartData, chartConfig } = useChartStore();
  const chartRef = useRef<HTMLDivElement>(null);

  const isSettingsPage = location.pathname.startsWith('/settings');
  const isFeedPage = location.pathname === '/feed';

  useEffect(() => {
    if (isAuthenticated) {
      closeAuthModal();
    }
  }, [isAuthenticated, closeAuthModal]);

  return (
    <div className="app-wrapper">
      <div className="app">
        <Header
          onAuthOpen={openAuthModal}
          hasData={!!chartData}
          data={chartData}
          config={chartConfig}
          chartRef={chartRef}
          title={chartConfig.title}
          showFeedButton={!isFeedPage && !isSettingsPage}
        />

        <main className="main">
          <AnimatePresence mode="wait">
            {children || <Outlet context={{ openAuthModal, chartRef }} />}
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

      <AuthModal isOpen={!isAuthenticated && isAuthModalOpen} onClose={closeAuthModal} />
    </div>
  );
}
