import { useEffect, type ReactNode } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
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
  const prefersReducedMotion = useReducedMotion();
  const { isAuthenticated } = useAuth();
  const { isAuthModalOpen, openAuthModal, closeAuthModal } = useAuthModal();
  const { chartData, chartConfig, setChartData, setChartConfig } = useChartStore();
  const routeContent = children || <Outlet context={{ openAuthModal }} />;

  const isChartPage = location.pathname === '/chart' || location.pathname.startsWith('/chart/');
  const isNewRoute = location.pathname === '/new';
  const hideSidebar = isChartPage || (!isAuthenticated && isNewRoute);
  const shouldAnimateRoute = !prefersReducedMotion && !isNewRoute;

  useEffect(() => {
    if (isAuthenticated) {
      closeAuthModal();
    }
  }, [isAuthenticated, closeAuthModal]);

  return (
    <div className="app">
      <Header onAuthOpen={openAuthModal} />

      <div className="app-body">
        {isAuthenticated && !hideSidebar && <DashboardSidebar />}

        <main className="main">
          {!shouldAnimateRoute ? (
            <div className="app-route-shell">{routeContent}</div>
          ) : (
            <AnimatePresence mode="sync" initial={false}>
              <motion.div
                key={location.pathname}
                className="app-route-shell"
                initial={false}
                animate={{ y: 0 }}
                exit={{ y: -4 }}
                transition={{
                  duration: 0.18,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                {routeContent}
              </motion.div>
            </AnimatePresence>
          )}
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
