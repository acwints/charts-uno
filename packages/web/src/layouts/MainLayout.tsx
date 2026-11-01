import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, Outlet, useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { NativeAppStatus } from '../components/NativeAppStatus';
import { NativeLibraryNav } from '../components/NativeLibraryNav';
import { isNativeApp } from '../services/native';
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
import { rememberReferral } from '../services/referrals';

interface MainLayoutProps {
  children?: ReactNode;
}

const ONBOARDED_STORAGE_KEY = 'chartsuno_onboarded_v1';

export function MainLayout({ children }: MainLayoutProps) {
  const location = useLocation();
  const navigationType = useNavigationType();
  const mainRef = useRef<HTMLElement>(null);
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
  const showSidebar = isAuthenticated && !hideSidebar && !isNativeApp();
  const shouldAnimateRoute = !isNativeApp() && !prefersReducedMotion && !isNewRoute;

  // New route = start at the top. Back/forward keeps the browser's own
  // restored position. Needed because the SPA never reloads the document.
  useEffect(() => {
    if (navigationType !== 'POP') {
      window.scrollTo(0, 0);
      // The native shell scrolls this element rather than the document.
      mainRef.current?.scrollTo(0, 0);
    }
  }, [location.pathname, navigationType]);

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

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const ref = params.get('ref');
    const wantsAuth = params.get('auth') === '1';
    if (ref) rememberReferral(location.search);
    if (!ref && !wantsAuth) return;

    // Keep ?auth=1 until we know whether to open the modal. Drop ?ref= as soon
    // as it is stored so the address bar is not someone else's invite link.
    if (isNativeApp() || (wantsAuth && isAuthLoading)) {
      if (!ref) return;
      params.delete('ref');
    } else {
      if (ref) params.delete('ref');
      if (wantsAuth) {
        if (!isAuthenticated) openAuthModal();
        params.delete('auth');
      }
    }

    const next = params.toString();
    navigate(
      { pathname: location.pathname, search: next ? `?${next}` : '', hash: location.hash },
      { replace: true },
    );
  }, [location.hash, location.pathname, location.search, isAuthLoading, isAuthenticated, navigate, openAuthModal]);

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
      <Header onAuthOpen={openAuthModal} showMenuButton={showSidebar} />
      <NativeAppStatus />
      {isAuthenticated && <NativeLibraryNav />}

      <div className="app-body">
        {showSidebar && <DashboardSidebar />}

        <main className="main" ref={mainRef}>
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
            <Link to="/bar-chart-maker" className="footer-link">Bar charts</Link>
            <Link to="/pie-chart-maker" className="footer-link">Pie charts</Link>
            <Link to="/line-graph-maker" className="footer-link">Line graphs</Link>
            <Link to="/csv-to-chart" className="footer-link">CSV to chart</Link>
            <Link to="/chart-from-google-sheets" className="footer-link">Google Sheets</Link>
            <Link to="/iphone-chart-maker" className="footer-link">iPhone</Link>
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
