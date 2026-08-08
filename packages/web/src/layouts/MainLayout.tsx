import { useEffect, useState, type ReactNode } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Header } from '../components/Header';
import { MobileTabBar } from '../components/MobileTabBar';
import { MobileOnboarding } from '../components/MobileOnboarding';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { DashboardSidebar } from '../components/Dashboard/DashboardSidebar';
import { AuthModal } from '../components/AuthModal';
import { ChatPanel } from '../components/ChatPanel';
import { useAuth } from '../hooks/useAuth';
import { useAuthModal } from '../hooks/useAuthModal';
import { useChartStore } from '../stores/chartStore';

interface MainLayoutProps {
  children?: ReactNode;
}

const ONBOARDED_STORAGE_KEY = 'chartsuno_onboarded_v1';

export function MainLayout({ children }: MainLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();
  const isPhoneViewport = useMediaQuery('(max-width: 768px)');
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const { isAuthModalOpen, openAuthModal, closeAuthModal } = useAuthModal();
  const [hasOnboarded, setHasOnboarded] = useState(
    () => localStorage.getItem(ONBOARDED_STORAGE_KEY) === 'true'
  );
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

  // Persist the flag for signed-in users so onboarding never reappears on
  // this device (e.g. after a later sign-out and remount).
  useEffect(() => {
    if (isAuthenticated) {
      localStorage.setItem(ONBOARDED_STORAGE_KEY, 'true');
    }
  }, [isAuthenticated]);

  const completeOnboarding = (thenSignIn: boolean) => {
    localStorage.setItem(ONBOARDED_STORAGE_KEY, 'true');
    setHasOnboarded(true);
    navigate('/feed');
    if (thenSignIn) {
      openAuthModal();
    }
  };

  const showOnboarding =
    isPhoneViewport && !isAuthLoading && !isAuthenticated && !hasOnboarded;

  if (showOnboarding) {
    return (
      <MobileOnboarding
        onSignIn={() => completeOnboarding(true)}
        onExplore={() => completeOnboarding(false)}
      />
    );
  }

  return (
    <div className="app app--has-tabbar">
      <Header onAuthOpen={openAuthModal} />

      <div className="app-body">
        {isAuthenticated && !hideSidebar && <DashboardSidebar />}

        <main className="main">
          {!shouldAnimateRoute ? (
            <div className="app-route-shell">{routeContent}</div>
          ) : (
            <AnimatePresence mode="wait" initial={false}>
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
          <div className="footer-left">
            <span className="footer-brand">Chartsuno</span>
            <span className="footer-divider">•</span>
            <span className="footer-tagline">Data visualization, elevated</span>
          </div>
          <nav className="footer-links">
            <Link to="/new" className="footer-link">Create</Link>
            <Link to="/feed" className="footer-link">Explore</Link>
            <Link to="/terms" className="footer-link">Terms</Link>
            <Link to="/privacy" className="footer-link">Privacy</Link>
          </nav>
        </div>
      </footer>

      <MobileTabBar onAuthOpen={openAuthModal} />

      <AuthModal isOpen={!isAuthenticated && isAuthModalOpen} onClose={closeAuthModal} />
    </div>
  );
}
