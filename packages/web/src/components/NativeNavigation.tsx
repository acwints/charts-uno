import { nativeInputDrafts } from '../services/nativeNavigationSession';
import { confirmDiscardChart, useChartStore } from '../stores/chartStore';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import ChevronLeft from 'lucide-react/dist/esm/icons/chevron-left';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../contexts/ToastContext';
import './NativeNavigation.css';

export function NativeNavigation() {
  const { pathname, state } = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const toast = useToast();
  const root = ['/feed', '/new', '/dashboard', '/settings/account', '/settings'].includes(pathname);
  const title = pathname === '/feed' ? 'Chartsuno'
    : pathname === '/new' ? 'Create'
    : pathname.startsWith('/dashboard') || pathname.startsWith('/team') ? 'My Charts'
    : pathname.startsWith('/settings') ? 'Account'
    : pathname.endsWith('/edit') ? 'Edit Chart'
    : pathname === '/changelog' ? 'What’s New'
    : pathname === '/terms' ? 'Terms of Use'
    : pathname === '/privacy' ? 'Privacy Policy' : 'Chart';
  return <header className="native-navigation">
    <div className="native-navigation__side">
      {!root && <button type="button" aria-label="Back" onClick={() => state?.returnTo ? navigate(state.returnTo, { replace: true, state: { returnTo: state.readerReturnTo } }) : window.history.state?.idx > 0 ? navigate(-1) : navigate('/feed')}><ChevronLeft size={24} /></button>}
    </div>
    <span className="native-navigation__title">{title}</span>
    <div className="native-navigation__side native-navigation__side--end">
      {(/^\/chart(?:\/[^/]+\/edit)?$/.test(pathname)) && <button type="button" onClick={() => {
        if (!confirmDiscardChart()) return;
        useChartStore.getState().reset(); nativeInputDrafts.clear();
        navigate('/new');
      }}>New</button>}
      {pathname.startsWith('/settings') && <button type="button" onClick={async () => {
        if (!confirmDiscardChart()) return;
        try { await logout(); navigate('/', { replace: true }); }
        catch { toast.error('Could not sign out. Please try again.'); }
      }}>Sign Out</button>}
    </div>
  </header>;
}

export function NativeAccountLinks() {
  return <nav className="native-account-links" aria-label="App information">
    <Link to="/changelog">What’s New</Link>
    <Link to="/privacy">Privacy Policy</Link>
    <Link to="/terms">Terms of Use</Link>
  </nav>;
}
