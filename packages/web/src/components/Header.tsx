import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles';
import Settings from 'lucide-react/dist/esm/icons/settings';
import CreditCard from 'lucide-react/dist/esm/icons/credit-card';
import LogOut from 'lucide-react/dist/esm/icons/log-out';
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down';
import Menu from 'lucide-react/dist/esm/icons/menu';
import { Button } from './Button';
import { ThemeToggle } from './ThemeToggle';
import { useAuth } from '../hooks/useAuth';
import { useMobileNav } from '../hooks/useMobileNav';
import './Header.css';

interface HeaderProps {
  onAuthOpen?: () => void;
}

export function Header({
  onAuthOpen,
}: HeaderProps) {
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const { isOpen: isMobileNavOpen, toggle: toggleMobileNav } = useMobileNav();

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
        <button
          className="header-hamburger"
          onClick={toggleMobileNav}
          aria-label={isMobileNavOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={isMobileNavOpen}
        >
          <Menu size={20} />
        </button>
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
            <span className="logo-text">Chartsuno</span>
          </Link>
        </motion.div>

        <nav className="header-links">
          <Link to="/new" className="header-link">Create</Link>
          <Link to="/feed" className="header-link">Explore</Link>
        </nav>

        <motion.nav
          className="header-nav"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <ThemeToggle />

          {!isAuthenticated && onAuthOpen && (
            <Button variant="primary" onClick={onAuthOpen}>
              Sign in
            </Button>
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
