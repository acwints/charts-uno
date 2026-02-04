import { Link, useNavigate } from 'react-router-dom';
import ArrowLeft from 'lucide-react/dist/esm/icons/arrow-left';
import Settings from 'lucide-react/dist/esm/icons/settings';
import UserPlus from 'lucide-react/dist/esm/icons/user-plus';
import { Button } from '../Button';
import type { Team } from '../../services/api';
import './TeamHeader.css';

interface TeamHeaderProps {
  team: Team;
  chartCount?: number;
  memberCount?: number;
}

export function TeamHeader({ team, chartCount, memberCount }: TeamHeaderProps) {
  const navigate = useNavigate();

  const handleInvite = () => {
    navigate(`/settings/team?invite=true`);
  };

  const handleSettings = () => {
    navigate(`/settings/team`);
  };

  return (
    <div className="team-header">
      <div className="team-header-top">
        <Link to="/dashboard" className="team-header-back">
          <ArrowLeft size={18} />
        </Link>

        <div className="team-header-info">
          <div className="team-header-title-row">
            <h1 className="team-header-title">{team.name}</h1>
            {team.subscription?.plan === 'pro' && (
              <span className="team-header-badge team-header-badge--pro">Pro</span>
            )}
            {team.subscription?.plan === 'business' && (
              <span className="team-header-badge team-header-badge--business">Business</span>
            )}
          </div>

          <div className="team-header-stats">
            {chartCount !== undefined && (
              <span className="team-header-stat">{chartCount} charts</span>
            )}
            {memberCount !== undefined && (
              <span className="team-header-stat">{memberCount} members</span>
            )}
          </div>
        </div>

        <div className="team-header-actions">
          <Button size="sm" onClick={handleInvite}>
            <UserPlus size={14} />
            <span>Invite</span>
          </Button>
          <Button size="sm" variant="ghost" onClick={handleSettings}>
            <Settings size={14} />
          </Button>
        </div>
      </div>
    </div>
  );
}
