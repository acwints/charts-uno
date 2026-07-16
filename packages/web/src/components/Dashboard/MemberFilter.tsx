import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down';
import Check from 'lucide-react/dist/esm/icons/check';
import User from 'lucide-react/dist/esm/icons/user';
import type { TeamMember } from '../../services/api';
import './MemberFilter.css';

interface MemberFilterProps {
  members: TeamMember[];
  selectedMemberId: string | null;
  onSelect: (memberId: string | null) => void;
}

export function MemberFilter({ members, selectedMemberId, onSelect }: MemberFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedMember = members.find((m) => m.user_id === selectedMemberId);

  return (
    <div className="member-filter" ref={dropdownRef}>
      <button
        className="member-filter-trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <User size={14} />
        <span>{selectedMember?.user?.name || 'All Members'}</span>
        <ChevronDown size={14} className={`member-filter-chevron ${isOpen ? 'member-filter-chevron--open' : ''}`} />
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            className="member-filter-menu"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            <button
              className={`member-filter-item ${selectedMemberId === null ? 'member-filter-item--selected' : ''}`}
              onClick={() => {
                onSelect(null);
                setIsOpen(false);
              }}
            >
              <span>All Members</span>
              {selectedMemberId === null && <Check size={14} />}
            </button>

            <div className="member-filter-divider" />

            {members.map((member) => (
              <button
                key={member.user_id}
                className={`member-filter-item ${member.user_id === selectedMemberId ? 'member-filter-item--selected' : ''}`}
                onClick={() => {
                  onSelect(member.user_id);
                  setIsOpen(false);
                }}
              >
                <div className="member-filter-item-info">
                  {member.user?.picture ? (
                    <img src={member.user.picture} alt="" className="member-filter-avatar" />
                  ) : (
                    <div className="member-filter-avatar-placeholder">
                      {member.user?.name?.[0]?.toUpperCase() || '?'}
                    </div>
                  )}
                  <span>{member.user?.name || 'Unknown'}</span>
                </div>
                {member.user_id === selectedMemberId && <Check size={14} />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
