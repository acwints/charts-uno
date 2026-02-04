import { useState, useRef, useEffect } from 'react';
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down';
import Check from 'lucide-react/dist/esm/icons/check';
import Plus from 'lucide-react/dist/esm/icons/plus';
import Users from 'lucide-react/dist/esm/icons/users';
import { motion, AnimatePresence } from 'motion/react';
import { useTeam } from '../contexts/TeamContext';
import './TeamSwitcher.css';

interface TeamSwitcherProps {
  onCreateTeam?: () => void;
}

export function TeamSwitcher({ onCreateTeam }: TeamSwitcherProps) {
  const { teams, currentTeam, switchTeam, isLoading } = useTeam();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (isLoading || !currentTeam) {
    return (
      <div className="team-switcher team-switcher--loading">
        <div className="team-switcher__skeleton" />
      </div>
    );
  }

  const getPlanBadge = (plan: string) => {
    if (plan === 'free') return null;
    return (
      <span className={`team-switcher__plan team-switcher__plan--${plan}`}>
        {plan}
      </span>
    );
  };

  return (
    <div className="team-switcher" ref={dropdownRef}>
      <button
        className="team-switcher__trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <div className="team-switcher__icon">
          <Users size={16} />
        </div>
        <span className="team-switcher__name">{currentTeam.name}</span>
        {currentTeam.subscription && getPlanBadge(currentTeam.subscription.plan)}
        <ChevronDown
          size={16}
          className={`team-switcher__chevron ${isOpen ? 'team-switcher__chevron--open' : ''}`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="team-switcher__dropdown"
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            role="listbox"
          >
            <div className="team-switcher__header">
              <span className="team-switcher__header-text">Switch Team</span>
            </div>

            <div className="team-switcher__list">
              {teams.map((team) => (
                <button
                  key={team.id}
                  className={`team-switcher__item ${
                    team.id === currentTeam.id ? 'team-switcher__item--active' : ''
                  }`}
                  onClick={() => {
                    switchTeam(team.id);
                    setIsOpen(false);
                  }}
                  role="option"
                  aria-selected={team.id === currentTeam.id}
                >
                  <div className="team-switcher__item-icon">
                    {team.is_personal ? (
                      <div className="team-switcher__avatar team-switcher__avatar--personal">
                        {team.name.charAt(0).toUpperCase()}
                      </div>
                    ) : (
                      <div className="team-switcher__avatar">
                        <Users size={14} />
                      </div>
                    )}
                  </div>
                  <div className="team-switcher__item-content">
                    <span className="team-switcher__item-name">{team.name}</span>
                    {team.subscription && (
                      <span className="team-switcher__item-meta">
                        {team.member_count} member{team.member_count !== 1 ? 's' : ''}
                        {team.subscription.plan !== 'free' && ` · ${team.subscription.plan}`}
                      </span>
                    )}
                  </div>
                  {team.id === currentTeam.id && (
                    <Check size={16} className="team-switcher__check" />
                  )}
                </button>
              ))}
            </div>

            {onCreateTeam && (
              <>
                <div className="team-switcher__divider" />
                <button
                  className="team-switcher__create"
                  onClick={() => {
                    setIsOpen(false);
                    onCreateTeam();
                  }}
                >
                  <Plus size={16} />
                  <span>Create Team</span>
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
