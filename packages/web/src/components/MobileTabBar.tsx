import { NavLink } from 'react-router-dom';
import Compass from 'lucide-react/dist/esm/icons/compass';
import PlusSquare from 'lucide-react/dist/esm/icons/plus-square';
import LayoutDashboard from 'lucide-react/dist/esm/icons/layout-dashboard';
import { useAuth } from '../hooks/useAuth';
import './MobileTabBar.css';

interface MobileTabBarProps {
  onAuthOpen?: () => void;
}

// App-style bottom navigation, shown only on phone-width viewports (CSS).
// Pads for the iOS home indicator via safe-area insets so it works inside
// the Capacitor shell.
export function MobileTabBar({ onAuthOpen }: MobileTabBarProps) {
  const { isAuthenticated } = useAuth();

  return (
    <nav className="mtabbar" aria-label="Primary">
      <NavLink
        to="/feed"
        className={({ isActive }) => `mtabbar__tab ${isActive ? 'mtabbar__tab--active' : ''}`}
        aria-label="Feed"
      >
        <Compass size={24} />
        <span className="mtabbar__label">Feed</span>
      </NavLink>

      <NavLink
        to="/new"
        className={({ isActive }) => `mtabbar__tab ${isActive ? 'mtabbar__tab--active' : ''}`}
        aria-label="Create chart"
      >
        <PlusSquare size={24} />
        <span className="mtabbar__label">Create</span>
      </NavLink>

      {isAuthenticated ? (
        <NavLink
          to="/dashboard"
          className={({ isActive }) => `mtabbar__tab ${isActive ? 'mtabbar__tab--active' : ''}`}
          aria-label="My charts"
        >
          <LayoutDashboard size={24} />
          <span className="mtabbar__label">My Charts</span>
        </NavLink>
      ) : (
        <button type="button" className="mtabbar__tab" onClick={onAuthOpen} aria-label="Sign in">
          <LayoutDashboard size={24} />
          <span className="mtabbar__label">Sign In</span>
        </button>
      )}
    </nav>
  );
}
