import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RotateCcw, Sparkles, LayoutGrid, Settings, CreditCard, LogOut, ChevronDown } from 'lucide-react';
import { ExportMenu } from './ExportMenu/ExportMenu';
import { ThemeToggle } from './ThemeToggle';
import { TeamSwitcher } from './TeamSwitcher';
import { useAuth } from '../hooks/useAuth';
import type { ChartData } from '../types';
import './Header.css';

interface HeaderProps {
  onReset: () => void;
  hasData: boolean;
  data?: ChartData | null;
  chartRef?: React.RefObject<HTMLDivElement | null>;
  title?: string;
  onFeedClick?: () => void;
  showFeedButton?: boolean;
  onSettingsClick?: (tab?: 'account' | 'team' | 'billing') => void;
  onCreateTeam?: () => void;
}

export function Header({
  onReset,
  hasData,
  data,
  chartRef,
  title,
  onFeedClick,
  showFeedButton = true,
  onSettingsClick,
  onCreateTeam,
}: HeaderProps) {
  const { user, isAuthenticated, logout } = useAuth();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setIsUserMenuOpen(false);
    await logout();
  };

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : user?.email?.[0]?.toUpperCase() || '?';

  return (
    <header className="header">
      <div className="header-content">
        <motion.div
          className="logo-container"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="logo-icon">
            <Sparkles size={20} />
          </div>
          <span className="logo-text">Epic Charts</span>
          <span className="logo-badge">BETA</span>
        </motion.div>

        <motion.nav
          className="header-nav"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          {isAuthenticated && (
            <TeamSwitcher onCreateTeam={onCreateTeam} />
          )}

          <ThemeToggle />

          {showFeedButton && onFeedClick && (
            <button className="nav-button" onClick={onFeedClick}>
              <LayoutGrid size={16} />
              <span>Feed</span>
            </button>
          )}

          {hasData && (
            <>
              <button className="nav-button" onClick={onReset}>
                <RotateCcw size={16} />
                <span>New Chart</span>
              </button>
              {data && chartRef && (
                <ExportMenu data={data} chartRef={chartRef} title={title} />
              )}
            </>
          )}

          {isAuthenticated && user && (
            <div className="user-menu-container" ref={userMenuRef}>
              <button
                className="user-menu-trigger"
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                aria-expanded={isUserMenuOpen}
              >
                {user.picture ? (
                  <img src={user.picture} alt="" className="user-menu-avatar" />
                ) : (
                  <div className="user-menu-avatar-placeholder">{initials}</div>
                )}
                <ChevronDown
                  size={14}
                  className={`user-menu-chevron ${isUserMenuOpen ? 'user-menu-chevron--open' : ''}`}
                />
              </button>

              <AnimatePresence>
                {isUserMenuOpen && (
                  <motion.div
                    className="user-menu-dropdown"
                    initial={{ opacity: 0, y: -8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                  >
                    <div className="user-menu-header">
                      <div className="user-menu-name">{user.name || 'User'}</div>
                      <div className="user-menu-email">{user.email}</div>
                    </div>

                    <div className="user-menu-divider" />

                    <button
                      className="user-menu-item"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onSettingsClick?.('account');
                      }}
                    >
                      <Settings size={16} />
                      <span>Settings</span>
                    </button>

                    <button
                      className="user-menu-item"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onSettingsClick?.('billing');
                      }}
                    >
                      <CreditCard size={16} />
                      <span>Billing</span>
                    </button>

                    <div className="user-menu-divider" />

                    <button className="user-menu-item user-menu-item--danger" onClick={handleLogout}>
                      <LogOut size={16} />
                      <span>Sign Out</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </motion.nav>
      </div>
    </header>
  );
}
