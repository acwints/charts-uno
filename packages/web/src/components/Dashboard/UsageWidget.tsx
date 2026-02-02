import { BarChart3 } from 'lucide-react';
import './UsageWidget.css';

interface UsageWidgetProps {
  used: number;
  limit: number;
}

export function UsageWidget({ used, limit }: UsageWidgetProps) {
  const percentage = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const isNearLimit = percentage >= 80;
  const isAtLimit = percentage >= 100;

  return (
    <div className="usage-widget">
      <div className="usage-header">
        <BarChart3 size={14} />
        <span className="usage-label">Charts this month</span>
      </div>
      <div className="usage-bar">
        <div
          className={`usage-bar-fill ${isAtLimit ? 'usage-bar-fill--danger' : isNearLimit ? 'usage-bar-fill--warning' : ''}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="usage-count">
        <span className={isAtLimit ? 'usage-count--danger' : ''}>
          {used}
        </span>
        <span className="usage-count-separator">/</span>
        <span>{limit === -1 ? 'Unlimited' : limit}</span>
      </div>
    </div>
  );
}
