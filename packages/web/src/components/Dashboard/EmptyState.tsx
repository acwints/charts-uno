import { Link } from 'react-router-dom';
import { BarChart3, Heart, Bookmark, Globe, FileText, Plus } from 'lucide-react';
import { Button } from '../Button';
import './EmptyState.css';

type EmptyStateType = 'all' | 'published' | 'drafts' | 'liked' | 'saved' | 'team' | 'search';

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
  drafts: {
    icon: <FileText size={48} />,
    title: 'No draft charts',
    description: 'Private charts that haven\'t been published will appear here',
    showCreateButton: true,
  },
  liked: {
    icon: <Heart size={48} />,
    title: 'No liked charts',
    description: 'Charts you like from the feed will appear here',
    showCreateButton: false,
  },
  saved: {
    icon: <Bookmark size={48} />,
    title: 'No saved charts',
    description: 'Bookmark charts from the feed to save them for later',
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

export function EmptyState({ type, searchQuery }: EmptyStateProps) {
  const state = searchQuery ? EMPTY_STATES.search : EMPTY_STATES[type];

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
    </div>
  );
}
