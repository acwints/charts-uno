import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import LayoutGrid from 'lucide-react/dist/esm/icons/layout-grid';
import Globe from 'lucide-react/dist/esm/icons/globe';
import Heart from 'lucide-react/dist/esm/icons/heart';
import Compass from 'lucide-react/dist/esm/icons/compass';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles';
import PanelLeftClose from 'lucide-react/dist/esm/icons/panel-left-close';
import PanelLeftOpen from 'lucide-react/dist/esm/icons/panel-left-open';
import { useTeam } from '../../contexts/TeamContext';
import { useChartStore } from '../../stores/chartStore';
import { UsageWidget } from './UsageWidget';
import './DashboardSidebar.css';

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  end?: boolean;
  collapsed?: boolean;
}

function NavItem({ to, icon, label, end, collapsed }: NavItemProps) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `sidebar-nav-item ${isActive ? 'sidebar-nav-item--active' : ''} ${collapsed ? 'sidebar-nav-item--collapsed' : ''}`
      }
      title={collapsed ? label : undefined}
    >
      <span className="sidebar-nav-icon">{icon}</span>
      {!collapsed && <span className="sidebar-nav-label">{label}</span>}
    </NavLink>
  );
}

export function DashboardSidebar() {
  const navigate = useNavigate();
  const { currentTeam, usage } = useTeam();
  const { reset } = useChartStore();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleCreateNew = () => {
    reset();
    navigate('/new');
  };

  return (
    <aside className={`dashboard-sidebar ${isCollapsed ? 'dashboard-sidebar--collapsed' : ''}`}>
      <div className="sidebar-toggle-area">
        <button
          className="sidebar-toggle-btn"
          onClick={() => setIsCollapsed(!isCollapsed)}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-section">
          <button
            className={`sidebar-create-btn ${isCollapsed ? 'sidebar-create-btn--collapsed' : ''}`}
            onClick={handleCreateNew}
            title={isCollapsed ? 'Create New' : undefined}
          >
            <Sparkles size={16} />
            {!isCollapsed && <span>Create New</span>}
          </button>
        </div>

        <div className="sidebar-section">
          <NavItem to="/feed" icon={<Compass size={18} />} label="Explore" collapsed={isCollapsed} />
        </div>

        <div className="sidebar-section">
          {!isCollapsed && <div className="sidebar-section-header">Library</div>}
          <NavItem to="/dashboard" icon={<LayoutGrid size={18} />} label="My Charts" end collapsed={isCollapsed} />
          <NavItem to="/dashboard/published" icon={<Globe size={18} />} label="Published" collapsed={isCollapsed} />
          <NavItem to="/dashboard/liked" icon={<Heart size={18} />} label="Liked" collapsed={isCollapsed} />
        </div>
      </nav>

      {!isCollapsed && usage && currentTeam && (
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
