import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Sparkles, LayoutGrid, Home, Settings, CreditCard, LogOut, ChevronDown } from 'lucide-react';
import { ExportMenu } from './ExportMenu/ExportMenu';
import { Button } from './Button';
import { ThemeToggle } from './ThemeToggle';
import { TeamSwitcher } from './TeamSwitcher';
import { useAuth } from '../hooks/useAuth';
import { useChartStore } from '../stores/chartStore';
import { getTeamBranding, type TeamBranding } from '../services/api';
import { useTeam } from '../contexts/TeamContext';
import type { ChartData } from '../types';
import type { WatermarkSettings } from '../services/exportService';
import './Header.css';

interface HeaderProps {
  hasData?: boolean;
  data?: ChartData | null;
  chartRef?: React.RefObject<HTMLDivElement | null>;
  title?: string;
  showFeedButton?: boolean;
  onAuthOpen?: () => void;
}

export function Header({
  hasData,
  data,
  chartRef,
  title,
  showFeedButton = true,
  onAuthOpen,
}: HeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, logout } = useAuth();
  const { reset } = useChartStore();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [branding, setBranding] = useState<TeamBranding | null>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Get current team for branding
  let currentTeam: { id: string; subscription?: { plan: string } | null } | null = null;
  try {
    const teamContext = useTeam();
    currentTeam = teamContext.currentTeam;
  } catch {
    // Team context not available (not wrapped in provider)
  }

  const isDashboard = location.pathname.startsWith('/dashboard') || location.pathname.startsWith('/team/');
  const isNewChartPage = location.pathname === '/new';

  // Fetch branding settings when team changes
  useEffect(() => {
    if (currentTeam?.id) {
      getTeamBranding(currentTeam.id)
        .then(setBranding)
        .catch(() => setBranding(null));
    } else {
      setBranding(null);
    }
  }, [currentTeam?.id]);

  // Determine watermark settings based on branding and subscription
  const watermarkSettings: WatermarkSettings = (() => {
    const isPaidPlan = currentTeam?.subscription?.plan && currentTeam.subscription.plan !== 'free';

    if (!isPaidPlan) {
      // Free users always get watermark
      return { enabled: true, customLogoUrl: null };
    }

    if (branding) {
      // Paid users can customize
      return {
        enabled: branding.watermark_enabled,
        customLogoUrl: branding.custom_logo_url,
      };
    }

    // Default for paid users with no branding configured
    return { enabled: true, customLogoUrl: null };
  })();

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
    navigate('/');
  };

  const handleCreateNew = () => {
    reset();
    navigate('/new');
  };

  const handleCreateTeam = () => {
    navigate('/settings/team');
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
          <Link to="/" className="logo-link">
            <div className="logo-icon">
              <Sparkles size={20} />
            </div>
            <span className="logo-text">Epic Charts</span>
            <span className="logo-badge">BETA</span>
          </Link>
        </motion.div>

        <motion.nav
          className="header-nav"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          {isAuthenticated && (
            <TeamSwitcher onCreateTeam={handleCreateTeam} />
          )}

          <ThemeToggle />

          {!isAuthenticated && onAuthOpen && (
            <Button variant="primary" onClick={onAuthOpen}>
              Sign in
            </Button>
          )}

          {/* Dashboard link for authenticated users when not on dashboard */}
          {isAuthenticated && !isDashboard && (
            <Link to="/dashboard">
              <Button>
                <Home size={16} />
                <span>Dashboard</span>
              </Button>
            </Link>
          )}

          {showFeedButton && (
            <Link to="/feed">
              <Button>
                <LayoutGrid size={16} />
                <span>Feed</span>
              </Button>
            </Link>
          )}

          {/* Create New button for authenticated users (always visible when authenticated) */}
          {isAuthenticated && !isNewChartPage && (
            <Button variant="primary" onClick={handleCreateNew}>
              <Plus size={16} />
              <span>Create New</span>
            </Button>
          )}

          {/* Export menu when viewing a chart */}
          {hasData && data && chartRef && (
            <ExportMenu data={data} chartRef={chartRef} title={title} watermark={watermarkSettings} />
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

                    <Link
                      to="/settings/account"
                      className="user-menu-item"
                      onClick={() => setIsUserMenuOpen(false)}
                    >
                      <Settings size={16} />
                      <span>Settings</span>
                    </Link>

                    <Link
                      to="/settings/billing"
                      className="user-menu-item"
                      onClick={() => setIsUserMenuOpen(false)}
                    >
                      <CreditCard size={16} />
                      <span>Billing</span>
                    </Link>

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
