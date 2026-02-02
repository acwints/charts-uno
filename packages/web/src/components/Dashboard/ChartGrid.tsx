import { DashboardChartCard } from './DashboardChartCard';
import type { ChartResponse } from '../../services/api';
import './ChartGrid.css';

interface ChartGridProps {
  charts: ChartResponse[];
  onUpdate?: (chart: ChartResponse) => void;
  onDelete?: (chartId: string) => void;
  showAuthor?: boolean;
}

export function ChartGrid({ charts, onUpdate, onDelete, showAuthor = false }: ChartGridProps) {
  return (
    <div className="chart-grid">
      {charts.map((chart) => (
        <DashboardChartCard
          key={chart.id}
          chart={chart}
          onUpdate={onUpdate}
          onDelete={onDelete}
          showAuthor={showAuthor}
        />
      ))}
    </div>
  );
}
