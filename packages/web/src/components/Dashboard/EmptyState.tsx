import { Link, useNavigate } from 'react-router-dom';
import BarChart3 from 'lucide-react/dist/esm/icons/bar-chart-3';
import Heart from 'lucide-react/dist/esm/icons/heart';
import Globe from 'lucide-react/dist/esm/icons/globe';
import Plus from 'lucide-react/dist/esm/icons/plus';
import { Button } from '../Button';
import { useChartStore } from '../../stores/chartStore';
import { DEFAULT_CHART_CONFIG, type ChartConfig, type ChartData, type ChartType } from '../../types';
import './EmptyState.css';

type EmptyStateType = 'all' | 'published' | 'liked' | 'team' | 'search';

interface EmptyStateProps {
  type: EmptyStateType;
  searchQuery?: string;
}

const EMPTY_STATES: Record<EmptyStateType, {
  icon: React.ReactNode;
  title: string;
  description: string;
  showCreateButton?: boolean;
}> = {
  all: {
    icon: <BarChart3 size={48} />,
    title: 'No charts yet',
    description: 'Create your first chart to get started',
    showCreateButton: true,
  },
  published: {
    icon: <Globe size={48} />,
    title: 'No published charts',
    description: 'Charts you publish will appear here for others to discover',
    showCreateButton: true,
  },
  liked: {
    icon: <Heart size={48} />,
    title: 'No liked charts',
    description: 'Charts you like from the feed will appear here',
    showCreateButton: false,
  },
  team: {
    icon: <BarChart3 size={48} />,
    title: 'No team charts yet',
    description: 'Charts created for this team will appear here',
    showCreateButton: true,
  },
  search: {
    icon: <BarChart3 size={48} />,
    title: 'No matching charts',
    description: 'Try adjusting your search or filters',
    showCreateButton: false,
  },
};

interface StarterTemplate {
  id: string;
  kicker: string;
  title: string;
  detail: string;
  chartTitle: string;
  type: ChartType;
  barLayout?: 'horizontal';
  labels: string[];
  series: ChartData['series'];
  yAxisFormat?: ChartData['yAxisFormat'];
  yAxisPrefix?: string;
}

const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: 'revenue',
    kicker: 'Bar chart',
    title: 'Monthly revenue',
    detail: 'Six months of revenue, ready to retitle.',
    chartTitle: 'Monthly revenue',
    type: 'bar',
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    series: [{ name: 'Revenue', data: [42000, 46500, 51000, 48800, 57200, 64000] }],
    yAxisFormat: 'currency',
    yAxisPrefix: '$',
  },
  {
    id: 'csv',
    kicker: 'CSV shape',
    title: 'Signups and churn',
    detail: 'A header row and two number columns, like a pasted CSV.',
    chartTitle: 'Signups and churn',
    type: 'bar',
    labels: ['Jan', 'Feb', 'Mar'],
    series: [
      { name: 'Signups', data: [420, 510, 690] },
      { name: 'Churned', data: [38, 41, 45] },
    ],
  },
  {
    id: 'trend',
    kicker: 'Line chart',
    title: 'Weekly visits',
    detail: 'A trend you can extend in the data editor.',
    chartTitle: 'Weekly visits',
    type: 'line',
    labels: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8'],
    series: [{ name: 'Visits', data: [820, 910, 880, 1040, 1210, 1170, 1360, 1520] }],
  },
  {
    id: 'channels',
    kicker: 'Comparison',
    title: 'Tickets by channel',
    detail: 'A few categories, largest first.',
    chartTitle: 'Tickets by channel',
    type: 'bar',
    barLayout: 'horizontal',
    labels: ['Email', 'Chat', 'Phone', 'Social'],
    series: [{ name: 'Tickets', data: [86, 64, 41, 22] }],
  },
];

function openStarter(template: StarterTemplate) {
  const data: ChartData = {
    labels: template.labels,
    series: template.series,
    sourceType: 'paste',
    suggestedTitle: template.chartTitle,
    suggestedType: template.type,
    ...(template.yAxisFormat ? { yAxisFormat: template.yAxisFormat } : {}),
    ...(template.yAxisPrefix ? { yAxisPrefix: template.yAxisPrefix } : {}),
    ...(template.barLayout ? { suggestedBarLayout: template.barLayout } : {}),
  };
  const config: ChartConfig = {
    ...DEFAULT_CHART_CONFIG,
    type: template.type,
    title: template.chartTitle,
    ...(template.barLayout ? { barLayout: template.barLayout } : {}),
  };
  useChartStore.setState({
    documentId: null,
    originalData: null,
    chartData: data,
    chartConfig: config,
    infographicSvg: null,
  });
}

export function EmptyState({ type, searchQuery }: EmptyStateProps) {
  const navigate = useNavigate();
  const state = searchQuery ? EMPTY_STATES.search : EMPTY_STATES[type];
  const showStarters = type === 'all' && !searchQuery;

  const startFromTemplate = (template: StarterTemplate) => {
    openStarter(template);
    navigate('/chart');
  };

  return (
    <div className="empty-state">
      <div className="empty-state-icon">{state.icon}</div>
      <h3 className="empty-state-title">{state.title}</h3>
      <p className="empty-state-description">
        {searchQuery
          ? `No charts found for "${searchQuery}"`
          : state.description}
      </p>
      {state.showCreateButton && !searchQuery && (
        <Link to="/new">
          <Button variant="primary" size="lg">
            <Plus size={18} />
            <span>Create New Chart</span>
          </Button>
        </Link>
      )}
      {showStarters && (
        <div className="empty-starters">
          <p className="empty-starters-label">Or open a sample in the editor</p>
          <ul className="empty-starters-list">
            {STARTER_TEMPLATES.map((template) => {
              const peak = Math.max(...template.series[0].data.map((value) => value ?? 0), 1);
              return (
                <li key={template.id}>
                  <button type="button" className="empty-starter" onClick={() => startFromTemplate(template)}>
                    <span className="empty-starter-kicker">{template.kicker}</span>
                    <span className="empty-starter-title">{template.title}</span>
                    <span className="empty-starter-detail">{template.detail}</span>
                    <span className="empty-starter-bars" aria-hidden="true">
                      {template.series[0].data.slice(0, 6).map((value, index) => (
                        <span
                          key={template.labels[index]}
                          className="empty-starter-bar"
                          style={{ height: `${Math.max(18, Math.round(((value ?? 0) / peak) * 100))}%` }}
                        />
                      ))}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
