import { NavLink, useNavigate } from 'react-router-dom';
import LayoutGrid from 'lucide-react/dist/esm/icons/layout-grid';
import Globe from 'lucide-react/dist/esm/icons/globe';
import FileText from 'lucide-react/dist/esm/icons/file-text';
import Heart from 'lucide-react/dist/esm/icons/heart';
import Bookmark from 'lucide-react/dist/esm/icons/bookmark';
import Users from 'lucide-react/dist/esm/icons/users';
import Plus from 'lucide-react/dist/esm/icons/plus';
import Compass from 'lucide-react/dist/esm/icons/compass';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles';
import { useTeam } from '../../contexts/TeamContext';
import { useChartStore } from '../../stores/chartStore';
import { UsageWidget } from './UsageWidget';
import './DashboardSidebar.css';

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  end?: boolean;
}

function NavItem({ to, icon, label, end }: NavItemProps) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `sidebar-nav-item ${isActive ? 'sidebar-nav-item--active' : ''}`
      }
    >
      <span className="sidebar-nav-icon">{icon}</span>
      <span className="sidebar-nav-label">{label}</span>
    </NavLink>
  );
}

export function DashboardSidebar() {
  const navigate = useNavigate();
  const { teams, currentTeam, usage } = useTeam();
  const { reset } = useChartStore();

  const nonPersonalTeams = teams.filter((t) => !t.is_personal);

  const handleCreateNew = () => {
    reset();
    navigate('/new');
  };

  const handleCreateTeam = () => {
    navigate('/settings/team');
  };

  return (
    <aside className="dashboard-sidebar">
      <nav className="sidebar-nav">
        <div className="sidebar-section">
          <button className="sidebar-create-btn" onClick={handleCreateNew}>
            <Sparkles size={16} />
            <span>Create New</span>
          </button>
        </div>

        <div className="sidebar-section">
          <NavItem to="/feed" icon={<Compass size={18} />} label="Explore" />
        </div>

        <div className="sidebar-section">
          <div className="sidebar-section-header">Personal</div>
          <NavItem to="/dashboard" icon={<LayoutGrid size={18} />} label="My Charts" end />
          <NavItem to="/dashboard/published" icon={<Globe size={18} />} label="Published" />
          <NavItem to="/dashboard/drafts" icon={<FileText size={18} />} label="Drafts" />
          <NavItem to="/dashboard/liked" icon={<Heart size={18} />} label="Liked" />
          <NavItem to="/dashboard/saved" icon={<Bookmark size={18} />} label="Saved" />
        </div>

        {nonPersonalTeams.length > 0 && (
          <div className="sidebar-section">
            <div className="sidebar-section-header">Teams</div>
            {nonPersonalTeams.map((team) => (
              <NavItem
                key={team.id}
                to={`/team/${team.slug}`}
                icon={<Users size={18} />}
                label={team.name}
              />
            ))}
            <button className="sidebar-new-team" onClick={handleCreateTeam}>
              <Plus size={16} />
              <span>New Team</span>
            </button>
          </div>
        )}

        {nonPersonalTeams.length === 0 && (
          <div className="sidebar-section">
            <div className="sidebar-section-header">Teams</div>
            <button className="sidebar-new-team" onClick={handleCreateTeam}>
              <Plus size={16} />
              <span>Create a Team</span>
            </button>
          </div>
        )}
      </nav>

      {usage && currentTeam && (
        <div className="sidebar-footer">
          <UsageWidget
            used={usage.charts_created_this_month}
            limit={usage.charts_limit}
          />
        </div>
      )}
    </aside>
  );
}
