import { useRef, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { AnimatePresence } from 'motion/react';
import { Header } from '../components/Header';
import { DashboardSidebar } from '../components/Dashboard/DashboardSidebar';
import { AuthModal } from '../components/AuthModal';
import { useAuth } from '../hooks/useAuth';
import { useAuthModal } from '../hooks/useAuthModal';
import { useChartStore } from '../stores/chartStore';
import './DashboardLayout.css';

export function DashboardLayout() {
  const { isAuthenticated } = useAuth();
  const { isAuthModalOpen, openAuthModal, closeAuthModal } = useAuthModal();
  const { chartData, chartConfig } = useChartStore();
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isAuthenticated) {
      closeAuthModal();
    }
  }, [isAuthenticated, closeAuthModal]);

  return (
    <div className="dashboard-wrapper">
      <Header
        onAuthOpen={openAuthModal}
        hasData={!!chartData}
        data={chartData}
        chartRef={chartRef}
        title={chartConfig.title}
        showFeedButton={true}
      />

      <div className="dashboard-body">
        <DashboardSidebar />

        <main className="dashboard-main">
          <AnimatePresence mode="wait">
            <Outlet context={{ openAuthModal, chartRef }} />
          </AnimatePresence>
        </main>
      </div>

      <AuthModal isOpen={!isAuthenticated && isAuthModalOpen} onClose={closeAuthModal} />
    </div>
  );
}
