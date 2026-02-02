import { useState, useEffect } from 'react';
import { Users, UserPlus, Trash2, Shield } from 'lucide-react';
import { useTeam } from '../../contexts/TeamContext';
import { useToast } from '../../contexts/ToastContext';
import { InviteModal } from '../../components/InviteModal';
import {
  getTeamMembers,
  getInvitations,
  updateTeam,
  removeTeamMember,
  cancelInvitation,
  type TeamMember,
  type TeamInvitation,
} from '../../services/api';
import { useAuth } from '../../hooks/useAuth';

export function TeamSettings() {
  const { currentTeam, refetchTeams, canInviteMember } = useTeam();
  const { user } = useAuth();
  const toast = useToast();

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (currentTeam) {
      setTeamName(currentTeam.name);
      loadTeamData();
    }
  }, [currentTeam]);

  const loadTeamData = async () => {
    if (!currentTeam) return;

    setIsLoading(true);
    try {
      const [membersData, invitationsData] = await Promise.all([
        getTeamMembers(currentTeam.id),
        getInvitations(currentTeam.id).catch(() => ({ invitations: [], total: 0 })),
      ]);

      setMembers(membersData);
      setInvitations(invitationsData.invitations);
    } catch (err) {
      toast.error('Failed to load team data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateTeamName = async () => {
    if (!currentTeam || teamName === currentTeam.name) return;

    setIsSaving(true);
    try {
      await updateTeam(currentTeam.id, { name: teamName });
      toast.success('Team name updated');
      refetchTeams();
    } catch (err) {
      toast.error('Failed to update team name');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveMember = async (memberId: string, memberUserId: string) => {
    if (!currentTeam) return;

    if (!confirm('Are you sure you want to remove this member?')) return;

    try {
      await removeTeamMember(currentTeam.id, memberUserId);
      toast.success('Member removed');
      setMembers(members.filter((m) => m.id !== memberId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove member');
    }
  };

  const handleCancelInvitation = async (token: string) => {
    if (!confirm('Are you sure you want to cancel this invitation?')) return;

    try {
      await cancelInvitation(token);
      toast.success('Invitation cancelled');
      setInvitations(invitations.filter((i) => i.id !== token));
      loadTeamData();
    } catch (err) {
      toast.error('Failed to cancel invitation');
    }
  };

  if (!currentTeam) {
    return (
      <div className="settings-empty">
        <Users size={48} className="settings-empty__icon" />
        <p className="settings-empty__text">No team selected</p>
      </div>
    );
  }

  const currentMember = members.find((m) => m.user_id === user?.id);
  const isAdmin = currentMember?.role === 'owner' || currentMember?.role === 'admin';

  return (
    <div className="settings-section">
      <div className="settings-section__header">
        <h1 className="settings-section__title">Team Settings</h1>
        <p className="settings-section__description">
          Manage your team members and settings
        </p>
      </div>

      <div className="settings-card">
        <div className="settings-card__header">
          <h3 className="settings-card__title">Team Details</h3>
        </div>
        <div className="settings-card__content">
          <div className="settings-field">
            <label className="settings-field__label" htmlFor="team-name">
              Team Name
            </label>
            <input
              id="team-name"
              type="text"
              className="settings-field__input"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              disabled={!isAdmin || currentTeam.is_personal}
            />
          </div>
          {isAdmin && !currentTeam.is_personal && teamName !== currentTeam.name && (
            <button
              className="settings-button settings-button--primary"
              onClick={handleUpdateTeamName}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          )}
          {currentTeam.is_personal && (
            <p style={{ fontSize: '13px', color: 'var(--color-text-tertiary)', margin: 0 }}>
              This is your personal team and cannot be renamed.
            </p>
          )}
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-card__header">
          <h3 className="settings-card__title">Members ({members.length})</h3>
          {isAdmin && (
            <button
              className="settings-button"
              onClick={() => setIsInviteOpen(true)}
              disabled={!canInviteMember}
            >
              <UserPlus size={16} style={{ marginRight: 6 }} />
              Invite
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="settings-empty">Loading...</div>
        ) : (
          <div className="members-list">
            {members.map((member) => (
              <div key={member.id} className="member-item">
                {member.user?.picture ? (
                  <img
                    src={member.user.picture}
                    alt=""
                    className="member-item__avatar"
                  />
                ) : (
                  <div className="member-item__avatar-placeholder">
                    {member.user?.name?.[0] || member.user?.email?.[0] || '?'}
                  </div>
                )}
                <div className="member-item__info">
                  <div className="member-item__name">
                    {member.user?.name || member.user?.email || 'Unknown'}
                    {member.user_id === user?.id && ' (You)'}
                  </div>
                  <div className="member-item__email">
                    {member.user?.email}
                  </div>
                </div>
                <span
                  className={`member-item__role ${
                    member.role === 'owner' ? 'member-item__role--owner' : ''
                  }`}
                >
                  {member.role === 'owner' && <Shield size={12} style={{ marginRight: 4 }} />}
                  {member.role}
                </span>
                {isAdmin && member.role !== 'owner' && member.user_id !== user?.id && (
                  <div className="member-item__actions">
                    <button
                      className="settings-button settings-button--danger"
                      onClick={() => handleRemoveMember(member.id, member.user_id)}
                      title="Remove member"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {invitations.length > 0 && (
        <div className="settings-card">
          <div className="settings-card__header">
            <h3 className="settings-card__title">Pending Invitations ({invitations.length})</h3>
          </div>
          <div className="members-list">
            {invitations.map((invitation) => (
              <div key={invitation.id} className="member-item">
                <div className="member-item__avatar-placeholder">
                  {invitation.email[0].toUpperCase()}
                </div>
                <div className="member-item__info">
                  <div className="member-item__name">{invitation.email}</div>
                  <div className="member-item__email">
                    Expires {new Date(invitation.expires_at).toLocaleDateString()}
                  </div>
                </div>
                <span className="member-item__role">{invitation.role}</span>
                {isAdmin && (
                  <div className="member-item__actions">
                    <button
                      className="settings-button settings-button--danger"
                      onClick={() => handleCancelInvitation(invitation.id)}
                      title="Cancel invitation"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!canInviteMember && isAdmin && (
        <div className="settings-card" style={{ borderColor: '#f59e0b' }}>
          <div className="settings-card__content">
            <p style={{ margin: 0, fontSize: '14px', color: '#f59e0b' }}>
              You've reached your seat limit. Upgrade your plan to invite more members.
            </p>
            <a href="/settings/billing" className="settings-button settings-button--primary" style={{ marginTop: 12, display: 'inline-block', textDecoration: 'none' }}>
              Upgrade Plan
            </a>
          </div>
        </div>
      )}

      <InviteModal
        teamId={currentTeam.id}
        teamName={currentTeam.name}
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        onInviteSent={() => loadTeamData()}
        canInvite={canInviteMember}
      />
    </div>
  );
}
