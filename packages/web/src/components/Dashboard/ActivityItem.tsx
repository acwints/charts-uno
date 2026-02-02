import { Link } from 'react-router-dom';
import {
  PlusCircle,
  Edit,
  Globe,
  Trash2,
  UserPlus,
  UserMinus,
} from 'lucide-react';
import type { ActivityItem as ActivityItemType } from '../../services/api';
import './ActivityItem.css';

interface ActivityItemProps {
  activity: ActivityItemType;
}

const ACTIVITY_ICONS: Record<ActivityItemType['type'], React.ReactNode> = {
  chart_created: <PlusCircle size={16} />,
  chart_updated: <Edit size={16} />,
  chart_published: <Globe size={16} />,
  chart_deleted: <Trash2 size={16} />,
  member_joined: <UserPlus size={16} />,
  member_left: <UserMinus size={16} />,
};

const ACTIVITY_COLORS: Record<ActivityItemType['type'], string> = {
  chart_created: 'activity-item-icon--success',
  chart_updated: 'activity-item-icon--default',
  chart_published: 'activity-item-icon--accent',
  chart_deleted: 'activity-item-icon--danger',
  member_joined: 'activity-item-icon--success',
  member_left: 'activity-item-icon--warning',
};

function getActivityText(activity: ActivityItemType): { action: string; target?: string } {
  switch (activity.type) {
    case 'chart_created':
      return { action: 'created', target: activity.target?.name };
    case 'chart_updated':
      return { action: 'updated', target: activity.target?.name };
    case 'chart_published':
      return { action: 'published', target: activity.target?.name };
    case 'chart_deleted':
      return { action: 'deleted', target: activity.target?.name };
    case 'member_joined':
      return { action: 'joined the team' };
    case 'member_left':
      return { action: 'left the team' };
    default:
      return { action: 'performed an action' };
  }
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function ActivityItem({ activity }: ActivityItemProps) {
  const { action, target } = getActivityText(activity);
  const icon = ACTIVITY_ICONS[activity.type];
  const colorClass = ACTIVITY_COLORS[activity.type];

  return (
    <div className="activity-item">
      <div className={`activity-item-icon ${colorClass}`}>{icon}</div>

      <div className="activity-item-content">
        <span className="activity-item-actor">{activity.actor.name || 'Someone'}</span>
        <span className="activity-item-action">{action}</span>
        {target && activity.target && (
          <>
            {' '}
            {activity.target.type === 'chart' ? (
              <Link to={`/chart/${activity.target.id}`} className="activity-item-target">
                "{target}"
              </Link>
            ) : (
              <span className="activity-item-target">"{target}"</span>
            )}
          </>
        )}
      </div>

      <span className="activity-item-time">{formatTimeAgo(activity.created_at)}</span>
    </div>
  );
}
