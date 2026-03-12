import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import {
  getTeams,
  getUsage,
  type Team,
  type UsageSummary,
} from '../services/api';

interface TeamContextValue {
  teams: Team[];
  currentTeam: Team | null;
  usage: UsageSummary | null;
  isLoading: boolean;
  error: string | null;
  switchTeam: (teamId: string) => void;
  refetchTeams: () => Promise<void>;
  refetchUsage: () => Promise<void>;
  canCreateChart: boolean;
  canInviteMember: boolean;
  remainingCharts: number;
}

const TeamContext = createContext<TeamContextValue | null>(null);

const CURRENT_TEAM_KEY = 'chartsuno-current-team';

// eslint-disable-next-line react-refresh/only-export-components
export function useTeam() {
  const context = useContext(TeamContext);
  if (!context) {
    throw new Error('useTeam must be used within a TeamProvider');
  }
  return context;
}

interface TeamProviderProps {
  children: ReactNode;
  isAuthenticated: boolean;
}

export function TeamProvider({ children, isAuthenticated }: TeamProviderProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTeams = useCallback(async () => {
    if (!isAuthenticated) {
      setTeams([]);
      setCurrentTeam(null);
      setUsage(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await getTeams();
      setTeams(response.teams);

      // Restore last selected team or use personal team
      const savedTeamId = localStorage.getItem(CURRENT_TEAM_KEY);
      let teamToSelect = response.teams.find((t) => t.id === savedTeamId);

      if (!teamToSelect) {
        // Default to personal team
        teamToSelect = response.teams.find((t) => t.is_personal) || response.teams[0];
      }

      if (teamToSelect) {
        setCurrentTeam(teamToSelect);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load teams');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  const fetchUsage = useCallback(async () => {
    if (!currentTeam) {
      setUsage(null);
      return;
    }

    try {
      const usageData = await getUsage(currentTeam.id);
      setUsage(usageData);
    } catch (err) {
      console.error('Failed to fetch usage:', err);
    }
  }, [currentTeam]);

  const switchTeam = useCallback((teamId: string) => {
    const team = teams.find((t) => t.id === teamId);
    if (team) {
      setCurrentTeam(team);
      localStorage.setItem(CURRENT_TEAM_KEY, teamId);
    }
  }, [teams]);

  // Fetch teams when auth state changes
  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  // Fetch usage when current team changes
  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  const value = useMemo<TeamContextValue>(() => ({
    teams,
    currentTeam,
    usage,
    isLoading,
    error,
    switchTeam,
    refetchTeams: fetchTeams,
    refetchUsage: fetchUsage,
    canCreateChart: usage?.can_create_chart ?? true,
    canInviteMember: usage?.can_invite_member ?? false,
    remainingCharts: usage?.charts_remaining ?? -1,
  }), [teams, currentTeam, usage, isLoading, error, switchTeam, fetchTeams, fetchUsage]);

  return (
    <TeamContext.Provider value={value}>
      {children}
    </TeamContext.Provider>
  );
}
