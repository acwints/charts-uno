import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Globe from 'lucide-react/dist/esm/icons/globe';
import Lock from 'lucide-react/dist/esm/icons/lock';
import Send from 'lucide-react/dist/esm/icons/send';
import Users from 'lucide-react/dist/esm/icons/users';
import Check from 'lucide-react/dist/esm/icons/check';
import { updateChartPublishTargets } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { Button } from '../Button';
import './PublishMenu.css';

interface PublishTeamOption {
  id: string;
  name: string;
}

interface PublishMenuProps {
  chartId: string;
  isPublic: boolean;
  publishedTeamIds: string[];
  onTargetsChange?: (targets: { isPublic: boolean; teamIds: string[] }) => void;
  teamOptions: PublishTeamOption[];
  isAuthenticated?: boolean;
}

export function PublishMenu({
  chartId,
  isPublic,
  publishedTeamIds,
  onTargetsChange,
  teamOptions,
  isAuthenticated = false,
}: PublishMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draftIsPublic, setDraftIsPublic] = useState(isPublic);
  const [draftTeamIds, setDraftTeamIds] = useState<string[]>(publishedTeamIds);
  const menuRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  useEffect(() => {
    if (!isOpen) return;
    setDraftIsPublic(isPublic);
    setDraftTeamIds(publishedTeamIds);
  }, [isOpen, isPublic, publishedTeamIds]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const sortedOriginalTeamIds = useMemo(
    () => [...new Set(publishedTeamIds)].sort(),
    [publishedTeamIds],
  );
  const sortedDraftTeamIds = useMemo(
    () => [...new Set(draftTeamIds)].sort(),
    [draftTeamIds],
  );
  const isDirty = draftIsPublic !== isPublic || sortedDraftTeamIds.join('|') !== sortedOriginalTeamIds.join('|');

  const toggleTeam = (teamId: string) => {
    setDraftTeamIds((previous) => (
      previous.includes(teamId)
        ? previous.filter((id) => id !== teamId)
        : [...previous, teamId]
    ));
  };

  const handleSaveTargets = async () => {
    setIsSaving(true);
    try {
      const updated = await updateChartPublishTargets(chartId, {
        is_public: draftIsPublic,
        team_ids: sortedDraftTeamIds,
      });

      onTargetsChange?.({
        isPublic: updated.is_public,
        teamIds: updated.team_ids,
      });

      toast.success('Publish settings updated');
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to update publish targets:', error);
      toast.error('Failed to update publish settings');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="publish-menu" ref={menuRef}>
      <Button
        variant="default"
        size="sm"
        className="publish-trigger"
        onClick={() => setIsOpen(!isOpen)}
        disabled={!isAuthenticated}
      >
        <Send size={16} />
        <span>Publish</span>
      </Button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="publish-dropdown"
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
          >
            <button
              className="publish-option"
              onClick={() => setDraftIsPublic((previous) => !previous)}
              disabled={isSaving}
              aria-pressed={draftIsPublic}
            >
              {draftIsPublic ? <Globe size={16} /> : <Lock size={16} />}
              <span>{draftIsPublic ? 'Published to Feed' : 'Private from Feed'}</span>
              {draftIsPublic && <Check size={14} className="publish-check" />}
            </button>

            <div className="publish-divider" />

            <div className="publish-team-block">
              <div className="publish-team-label">
                <Users size={14} />
                <span>Team Space</span>
              </div>
              {teamOptions.length > 0 ? (
                <div className="publish-team-list" role="group" aria-label="Select team spaces">
                  {teamOptions.map((team) => (
                    <label key={team.id} className="publish-team-item">
                      <input
                        type="checkbox"
                        checked={draftTeamIds.includes(team.id)}
                        onChange={() => toggleTeam(team.id)}
                        disabled={isSaving}
                      />
                      <span>{team.name}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="publish-team-empty">
                  Join or create a team to publish to team spaces.
                </p>
              )}
              <button
                className="publish-save-button"
                onClick={handleSaveTargets}
                disabled={isSaving || !isDirty}
              >
                {isSaving ? 'Saving...' : 'Save Publish Settings'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
