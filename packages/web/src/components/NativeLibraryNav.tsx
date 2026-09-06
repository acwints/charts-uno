import { useLocation, useNavigate } from 'react-router-dom';
import { useTeam } from '../contexts/TeamContext';
import { isNativeApp } from '../services/native';
import './NativeLibraryNav.css';

export function NativeLibraryNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { teams } = useTeam();
  if (!isNativeApp() || !/^\/(dashboard|dashboards|team)(\/|$)/.test(pathname)) return null;
  const destinations = [
    { path: '/dashboard', label: 'My Charts' },
    { path: '/dashboard/published', label: 'Published' },
    { path: '/dashboard/liked', label: 'Liked' },
    { path: '/dashboards', label: 'Dashboards' },
    ...teams.filter((team) => !team.is_personal).map((team) => ({ path: `/team/${team.slug}`, label: team.name })),
  ];
  const selected = [...destinations].sort((a, b) => b.path.length - a.path.length)
    .find(({ path }) => pathname === path || pathname.startsWith(`${path}/`))?.path ?? '/dashboard';
  return <nav className="native-library" aria-label="Chart library">
    <label htmlFor="native-library-destination">Library</label>
    <select id="native-library-destination" value={selected} onChange={(event) => navigate(event.target.value)}>
      {destinations.map(({ path, label }) => <option key={path} value={path}>{label}</option>)}
    </select>
  </nav>;
}
