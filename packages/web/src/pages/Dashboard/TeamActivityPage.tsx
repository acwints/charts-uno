import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { TeamHeader } from '../../components/Dashboard/TeamHeader';
import { ActivityFeed } from '../../components/Dashboard/ActivityFeed';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { EmptyState } from '../../components/Dashboard/EmptyState';
import { useTeam } from '../../contexts/TeamContext';
import {
  getTeams,
  getTeamMembers,
  getTeamActivity,
  type Team,
  type TeamMember,
  type ActivityItem,
} from '../../services/api';
import './Dashboard.css';

export function TeamActivityPage() {
  const { slug } = useParams<{ slug: string }>();
  const { currentTeam, switchTeam } = useTeam();

  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTeamData = useCallback(async () => {
    if (!slug) return;

    setIsLoading(true);

    try {
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

      const [membersData, activityData] = await Promise.all([
        getTeamMembers(foundTeam.id),
        getTeamActivity(foundTeam.id, 50),
      ]);

      setMembers(membersData);
      setActivities(activityData.activities);
    } catch (error) {
      console.error('Failed to fetch team activity:', error);
      setActivities([]);
    } finally {
      setIsLoading(false);
    }
  }, [slug, currentTeam?.id, switchTeam]);

  useEffect(() => {
    fetchTeamData();
  }, [fetchTeamData]);

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
        memberCount={members.length}
      />

      <div className="team-dashboard-tabs">
        <Link
          to={`/team/${slug}`}
          className="team-dashboard-tab"
        >
          All Charts
        </Link>
        <Link
          to={`/team/${slug}/activity`}
          className="team-dashboard-tab team-dashboard-tab--active"
        >
          Activity
        </Link>
      </div>

      <ActivityFeed activities={activities} />
    </motion.div>
  );
}
