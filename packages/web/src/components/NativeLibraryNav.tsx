import { Link, useLocation } from 'react-router-dom';
import { useTeam } from '../contexts/TeamContext';
import { isNativeApp } from '../services/native';
import './NativeLibraryNav.css';

export function NativeLibraryNav() {
  const { pathname } = useLocation();
  const { teams } = useTeam();
  if (!isNativeApp() || !/^\/(dashboard|dashboards|team)(\/|$)/.test(pathname)) return null;
  const destinations = [
    { path: '/dashboard', label: 'My Charts' },
    { path: '/dashboard/published', label: 'Published' },
    { path: '/dashboard/saved', label: 'Saved' },
    { path: '/dashboard/liked', label: 'Liked' },
    { path: '/dashboards', label: 'Dashboards' },
    ...teams.filter((team) => !team.is_personal).map((team) => ({ path: `/team/${team.slug}`, label: team.name })),
  ];
  const selected = [...destinations].sort((a, b) => b.path.length - a.path.length)
    .find(({ path }) => pathname === path || pathname.startsWith(`${path}/`))?.path ?? '/dashboard';
  return <nav className="native-library" aria-label="Chart library">
    {destinations.map(({ path, label }) => <Link key={path} to={path} aria-current={selected === path ? 'page' : undefined}>{label}</Link>)}
  </nav>;
}
