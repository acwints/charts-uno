import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { AnimatePresence } from 'motion/react';
import { Header } from '../components/Header';
import { DashboardSidebar } from '../components/Dashboard/DashboardSidebar';
import { AuthModal } from '../components/AuthModal';
import { useAuth } from '../hooks/useAuth';
import { useAuthModal } from '../hooks/useAuthModal';
import './DashboardLayout.css';

export function DashboardLayout() {
  const { isAuthenticated } = useAuth();
  const { isAuthModalOpen, openAuthModal, closeAuthModal } = useAuthModal();

  useEffect(() => {
    if (isAuthenticated) {
      closeAuthModal();
    }
  }, [isAuthenticated, closeAuthModal]);

  return (
    <div className="dashboard-wrapper">
      <Header
        onAuthOpen={openAuthModal}
      />

      <div className="dashboard-body">
        <DashboardSidebar />

        <main className="dashboard-main">
          <AnimatePresence mode="wait">
            <Outlet context={{ openAuthModal }} />
          </AnimatePresence>
        </main>
      </div>

      <AuthModal isOpen={!isAuthenticated && isAuthModalOpen} onClose={closeAuthModal} />
    </div>
  );
}
