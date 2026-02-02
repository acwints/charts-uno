import { ActivityItem } from './ActivityItem';
import type { ActivityItem as ActivityItemType } from '../../services/api';
import './ActivityFeed.css';

interface ActivityFeedProps {
  activities: ActivityItemType[];
}

function groupActivitiesByDate(activities: ActivityItemType[]): Map<string, ActivityItemType[]> {
  const groups = new Map<string, ActivityItemType[]>();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const lastWeek = new Date(today);
  lastWeek.setDate(lastWeek.getDate() - 7);

  for (const activity of activities) {
    const date = new Date(activity.created_at);
    const activityDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    let label: string;
    if (activityDate.getTime() === today.getTime()) {
      label = 'Today';
    } else if (activityDate.getTime() === yesterday.getTime()) {
      label = 'Yesterday';
    } else if (activityDate > lastWeek) {
      label = 'This Week';
    } else {
      label = 'Earlier';
    }

    const existing = groups.get(label) || [];
    existing.push(activity);
    groups.set(label, existing);
  }

  return groups;
}

export function ActivityFeed({ activities }: ActivityFeedProps) {
  const groupedActivities = groupActivitiesByDate(activities);
  const sortedGroups = ['Today', 'Yesterday', 'This Week', 'Earlier'].filter(
    (label) => groupedActivities.has(label)
  );

  if (activities.length === 0) {
    return (
      <div className="activity-feed-empty">
        <p>No recent activity</p>
      </div>
    );
  }

  return (
    <div className="activity-feed">
      {sortedGroups.map((label) => (
        <div key={label} className="activity-feed-group">
          <div className="activity-feed-group-label">{label}</div>
          <div className="activity-feed-group-items">
            {groupedActivities.get(label)?.map((activity) => (
              <ActivityItem key={activity.id} activity={activity} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
