import { SearchInput } from './SearchInput';
import { SortDropdown } from './SortDropdown';
import { ViewToggle } from './ViewToggle';
import { useDashboardStore } from '../../stores/dashboardStore';
import './DashboardHeader.css';

interface DashboardHeaderProps {
  title: string;
  subtitle?: string;
  chartCount?: number;
}

export function DashboardHeader({ title, subtitle, chartCount }: DashboardHeaderProps) {
  const { view, setView, sort, order, setSort, search, setSearch } = useDashboardStore();

  return (
    <div className="dashboard-header">
      <div className="dashboard-header-top">
        <div className="dashboard-header-title-section">
          <h1 className="dashboard-header-title">{title}</h1>
          {subtitle && <p className="dashboard-header-subtitle">{subtitle}</p>}
          {chartCount !== undefined && (
            <span className="dashboard-header-count">{chartCount} charts</span>
          )}
        </div>
      </div>

      <div className="dashboard-header-controls">
        <SearchInput value={search} onChange={setSearch} />
        <div className="dashboard-header-actions">
          <SortDropdown sort={sort} order={order} onSort={setSort} />
          <ViewToggle view={view} onViewChange={setView} />
        </div>
      </div>
    </div>
  );
}
