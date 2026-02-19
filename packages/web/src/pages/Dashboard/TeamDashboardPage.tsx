import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { TeamHeader } from '../../components/Dashboard/TeamHeader';
import { MemberFilter } from '../../components/Dashboard/MemberFilter';
import { ChartGrid } from '../../components/Dashboard/ChartGrid';
import { ChartListView } from '../../components/Dashboard/ChartListView';
import { DashboardToolbar } from '../../components/Dashboard/DashboardToolbar';
import { EmptyState } from '../../components/Dashboard/EmptyState';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { useDashboardStore } from '../../stores/dashboardStore';
import { useTeam } from '../../contexts/TeamContext';
import {
  getTeams,
  getTeamCharts,
  getTeamMembers,
  type Team,
  type TeamMember,
  type ChartResponse,
} from '../../services/api';
import './Dashboard.css';

export function TeamDashboardPage() {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  const { view, sort, order, search, clearSelection } = useDashboardStore();
  const { currentTeam, switchTeam } = useTeam();

  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [charts, setCharts] = useState<ChartResponse[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const isActivityTab = location.pathname.endsWith('/activity');

  const fetchTeamData = useCallback(async () => {
    if (!slug) return;

    setIsLoading(true);
    clearSelection();

    try {
      // In a real app, we'd fetch by slug. For now, assume slug is the team ID
      // or implement a lookup endpoint
      const teamsResponse = await getTeams();
      const foundTeam = teamsResponse.teams.find(t => t.slug === slug);

      if (!foundTeam) {
        setTeam(null);
        return;
      }

      setTeam(foundTeam);
      if (currentTeam?.id !== foundTeam.id) {
        switchTeam(foundTeam.id);
      }

      const [membersData, chartsData] = await Promise.all([
        getTeamMembers(foundTeam.id),
        getTeamCharts(foundTeam.id, {
          limit: 50,
          offset: 0,
          sort,
          order,
          search: search || undefined,
          memberId: selectedMemberId || undefined,
        }),
      ]);

      setMembers(membersData);
      setCharts(chartsData.charts);
      setTotal(chartsData.total);
    } catch (error) {
      console.error('Failed to fetch team data:', error);
      setCharts([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  }, [slug, sort, order, search, selectedMemberId, clearSelection, currentTeam?.id, switchTeam]);

  useEffect(() => {
    fetchTeamData();
  }, [fetchTeamData]);

  const handleChartUpdate = (updatedChart: ChartResponse) => {
    setCharts((prev) =>
      prev.map((c) => (c.id === updatedChart.id ? updatedChart : c))
    );
  };

  const handleChartDelete = (chartId: string) => {
    setCharts((prev) => prev.filter((c) => c.id !== chartId));
    setTotal((prev) => prev - 1);
  };

  const handleBatchAction = () => {
    fetchTeamData();
  };

  if (isLoading) {
    return (
      <div className="dashboard-page">
        <div className="dashboard-loading">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="dashboard-page">
        <EmptyState type="team" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="dashboard-page"
    >
      <TeamHeader
        team={team}
        chartCount={total}
        memberCount={members.length}
      />

      <div className="team-dashboard-tabs">
        <Link
          to={`/team/${slug}`}
          className={`team-dashboard-tab ${!isActivityTab ? 'team-dashboard-tab--active' : ''}`}
        >
          All Charts
        </Link>
        <Link
          to={`/team/${slug}/activity`}
          className={`team-dashboard-tab ${isActivityTab ? 'team-dashboard-tab--active' : ''}`}
        >
          Activity
        </Link>

        <div className="team-dashboard-tabs-actions">
          <MemberFilter
            members={members}
            selectedMemberId={selectedMemberId}
            onSelect={setSelectedMemberId}
          />
        </div>
      </div>

      {charts.length === 0 ? (
        <EmptyState type="team" searchQuery={search} />
      ) : view === 'grid' ? (
        <ChartGrid
          charts={charts}
          onUpdate={handleChartUpdate}
          onDelete={handleChartDelete}
          showAuthor={true}
        />
      ) : (
        <ChartListView
          charts={charts}
          onUpdate={handleChartUpdate}
          onDelete={handleChartDelete}
          showAuthor={true}
        />
      )}

      <DashboardToolbar onBatchAction={handleBatchAction} />
    </motion.div>
  );
}
