import { useState, useEffect, useRef } from 'react';
import Users from 'lucide-react/dist/esm/icons/users';
import UserPlus from 'lucide-react/dist/esm/icons/user-plus';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2';
import Shield from 'lucide-react/dist/esm/icons/shield';
import Palette from 'lucide-react/dist/esm/icons/palette';
import Globe from 'lucide-react/dist/esm/icons/globe';
import Wand2 from 'lucide-react/dist/esm/icons/wand-2';
import Upload from 'lucide-react/dist/esm/icons/upload';
import ImageIcon from 'lucide-react/dist/esm/icons/image';
import Lock from 'lucide-react/dist/esm/icons/lock';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles';
import { Link } from 'react-router-dom';
import { useTeam } from '../../contexts/TeamContext';
import { useToast } from '../../contexts/ToastContext';
import { InviteModal } from '../../components/InviteModal';
import { Button } from '../../components/Button';
import {
  getTeamMembers,
  getInvitations,
  updateTeam,
  removeTeamMember,
  cancelInvitation,
  getTeamBranding,
  updateTeamBranding,
  deleteTeamLogo,
  inferTeamBrand,
  type TeamMember,
  type TeamInvitation,
  type TeamBranding,
} from '../../services/api';
import { useAuth } from '../../hooks/useAuth';

// Color role definitions for brand palette
const COLOR_ROLES = [
  { index: 0, label: 'Primary Data', description: 'Main chart color (bars, lines)' },
  { index: 1, label: 'Secondary Data', description: 'Second series color' },
  { index: 2, label: 'Tertiary Data', description: 'Third series color' },
  { index: 3, label: 'Background', description: 'Chart background color' },
  { index: 4, label: 'Text', description: 'Labels and titles' },
];

export function TeamSettings() {
  const { currentTeam, refetchTeams, canInviteMember } = useTeam();
  const { user } = useAuth();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Branding state
  const [branding, setBranding] = useState<TeamBranding | null>(null);
  const [domainInput, setDomainInput] = useState('');
  const [isInferring, setIsInferring] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [editingColorIndex, setEditingColorIndex] = useState<number | null>(null);

  const isPaidPlan = currentTeam?.subscription?.plan && currentTeam.subscription.plan !== 'free';

  useEffect(() => {
    if (currentTeam) {
      setTeamName(currentTeam.name);
      loadTeamData();
      loadBranding();
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
    } catch {
      toast.error('Failed to load team data');
    } finally {
      setIsLoading(false);
    }
  };

  const loadBranding = async () => {
    if (!currentTeam?.id) return;
    try {
      const data = await getTeamBranding(currentTeam.id);
      setBranding(data);
      if (data.brand_domain) {
        setDomainInput(data.brand_domain);
      }
    } catch {
      // Silently fail - branding is optional
    }
  };

  const handleInferBrand = async () => {
    if (!currentTeam?.id || !domainInput.trim()) return;

    setIsInferring(true);
    try {
      await inferTeamBrand(currentTeam.id, domainInput.trim());
      const updated = await getTeamBranding(currentTeam.id);
      setBranding(updated);
      toast.success(`Brand colors extracted from ${domainInput}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to analyze website');
    } finally {
      setIsInferring(false);
    }
  };

  const handleColorChange = async (index: number, color: string) => {
    if (!currentTeam?.id || !branding) return;

    const newColors = [...(branding.brand_colors || ['#6366f1', '#22c55e', '#f59e0b', '#0a0a0f', '#f0f0f5'])];
    newColors[index] = color;

    try {
      const updated = await updateTeamBranding(currentTeam.id, { brand_colors: newColors });
      setBranding(updated);
    } catch {
      toast.error('Failed to update color');
    }
    setEditingColorIndex(null);
  };

  const handleToggleWatermark = async () => {
    if (!currentTeam?.id || !branding) return;

    setIsSaving(true);
    try {
      const updated = await updateTeamBranding(currentTeam.id, {
        watermark_enabled: !branding.watermark_enabled,
      });
      setBranding(updated);
      toast.success(updated.watermark_enabled ? 'Watermark enabled' : 'Watermark disabled');
    } catch {
      toast.error('Failed to update watermark setting');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentTeam?.id) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 500 * 1024) {
      toast.error('Image must be smaller than 500KB');
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = reader.result as string;
        const updated = await updateTeamBranding(currentTeam.id, { custom_logo_url: base64 });
        setBranding(updated);
        toast.success('Logo uploaded');
      } catch {
        toast.error('Failed to upload logo');
      } finally {
        setIsUploading(false);
      }
    };
    reader.onerror = () => {
      toast.error('Failed to read file');
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleDeleteLogo = async () => {
    if (!currentTeam?.id) return;
    try {
      await deleteTeamLogo(currentTeam.id);
      setBranding((prev) => prev ? { ...prev, custom_logo_url: null } : null);
      toast.success('Logo removed');
    } catch {
      toast.error('Failed to remove logo');
    }
  };

  const handleUpdateTeamName = async () => {
    if (!currentTeam || teamName === currentTeam.name) return;

    setIsSaving(true);
    try {
      await updateTeam(currentTeam.id, { name: teamName });
      toast.success('Team name updated');
      refetchTeams();
    } catch {
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
    } catch {
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
            <Button
              variant="primary"
              onClick={handleUpdateTeamName}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          )}
          {currentTeam.is_personal && (
            <p className="settings-muted-text">
              This is your personal team and cannot be renamed.
            </p>
          )}
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-card__header">
          <h3 className="settings-card__title">Members ({members.length})</h3>
          {isAdmin && (
            <Button
              onClick={() => setIsInviteOpen(true)}
              disabled={!canInviteMember}
            >
              <UserPlus size={16} className="settings-button__icon" />
              Invite
            </Button>
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
                  {member.role === 'owner' && <Shield size={12} className="settings-inline-icon" />}
                  {member.role}
                </span>
                {isAdmin && member.role !== 'owner' && member.user_id !== user?.id && (
                  <div className="member-item__actions">
                    <Button
                      variant="danger"
                      size="sm"
                      className="settings-icon-button"
                      onClick={() => handleRemoveMember(member.id, member.user_id)}
                      title="Remove member"
                      aria-label="Remove member"
                    >
                      <Trash2 size={14} />
                    </Button>
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
                    <Button
                      variant="danger"
                      size="sm"
                      className="settings-icon-button"
                      onClick={() => handleCancelInvitation(invitation.id)}
                      title="Cancel invitation"
                      aria-label="Cancel invitation"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!canInviteMember && isAdmin && (
        <div className="settings-card settings-card--warning">
          <div className="settings-card__content">
            <p className="settings-warning-text">
              You've reached your seat limit. Upgrade your plan to invite more members.
            </p>
            <a
              href="/settings/billing"
              className="button button--primary button--md settings-warning-link"
            >
              Upgrade Plan
            </a>
          </div>
        </div>
      )}

      {/* Branding Section */}
      <div className="settings-card">
        <div className="settings-card__header">
          <h3 className="settings-card__title">
            <Palette size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
            Branding
          </h3>
        </div>

        {!isPaidPlan ? (
          <div className="settings-card__content">
            <div className="branding-upgrade">
              <div className="branding-upgrade__icon">
                <Lock size={24} />
              </div>
              <div className="branding-upgrade__content">
                <h4 className="branding-upgrade__title">Upgrade to customize branding</h4>
                <p className="branding-upgrade__text">
                  Free accounts include an "Epic Charts" watermark on exports.
                  Upgrade to remove it or add your own logo and brand colors.
                </p>
                <Link to="/settings/billing">
                  <Button variant="primary">
                    <Sparkles size={16} />
                    Upgrade Now
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="settings-card__content">
            {/* Brand Colors */}
            <div className="branding-section">
              <h4 className="branding-section__title">Brand Palette</h4>
              <p className="settings-muted-text" style={{ marginBottom: '12px' }}>
                These colors are used when you select "Brand" style in the chart editor.
              </p>

              <div className="branding-domain-input" style={{ marginBottom: '16px' }}>
                <div className="branding-domain-field">
                  <Globe size={16} className="branding-domain-icon" />
                  <input
                    type="text"
                    className="branding-domain-text"
                    placeholder="yourcompany.com"
                    value={domainInput}
                    onChange={(e) => setDomainInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleInferBrand()}
                    spellCheck={false}
                  />
                </div>
                <Button onClick={handleInferBrand} disabled={isInferring || !domainInput.trim()}>
                  <Wand2 size={16} />
                  {isInferring ? 'Analyzing...' : 'Extract from Website'}
                </Button>
              </div>

              <div className="brand-colors-editor">
                {COLOR_ROLES.map((role) => {
                  const colors = branding?.brand_colors || ['#6366f1', '#22c55e', '#f59e0b', '#0a0a0f', '#f0f0f5'];
                  const color = colors[role.index] || '#888888';
                  const isEditing = editingColorIndex === role.index;

                  return (
                    <div key={role.index} className="brand-color-row">
                      <div className="brand-color-info">
                        <span className="brand-color-label">{role.label}</span>
                        <span className="brand-color-description">{role.description}</span>
                      </div>
                      <div className="brand-color-input-wrapper">
                        <button
                          className="brand-color-swatch-btn"
                          style={{ backgroundColor: color }}
                          onClick={() => setEditingColorIndex(isEditing ? null : role.index)}
                          title="Click to edit"
                          aria-label={`Edit ${role.label} color`}
                        />
                        {isEditing && (
                          <input
                            type="color"
                            className="brand-color-picker"
                            value={color}
                            onChange={(e) => handleColorChange(role.index, e.target.value)}
                            onBlur={() => setEditingColorIndex(null)}
                            autoFocus
                          />
                        )}
                        <input
                          type="text"
                          className="brand-color-hex-input"
                          value={color.toUpperCase()}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
                              handleColorChange(role.index, val);
                            }
                          }}
                          spellCheck={false}
                          maxLength={7}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {branding?.brand_theme && (
                <div className="branding-theme-badge" style={{ marginTop: '12px' }}>
                  Theme: {branding.brand_theme}
                </div>
              )}
            </div>

            {/* Watermark Settings */}
            <div className="branding-section" style={{ marginTop: '24px' }}>
              <h4 className="branding-section__title">Export Watermark</h4>
              <div className="branding-toggle">
                <div className="branding-toggle__info">
                  <span className="branding-toggle__label">Show watermark on exports</span>
                  <span className="branding-toggle__description">
                    When disabled, exported images will have no watermark
                  </span>
                </div>
                <button
                  className={`branding-toggle__switch ${branding?.watermark_enabled !== false ? 'branding-toggle__switch--on' : ''}`}
                  onClick={handleToggleWatermark}
                  disabled={isSaving}
                  aria-pressed={branding?.watermark_enabled !== false}
                >
                  <span className="branding-toggle__switch-thumb" />
                </button>
              </div>
            </div>

            {/* Custom Logo */}
            <div className="branding-section" style={{ marginTop: '24px' }}>
              <h4 className="branding-section__title">Custom Logo</h4>
              <p className="settings-muted-text" style={{ marginBottom: '12px' }}>
                Replace the default watermark text with your logo. PNG with transparency recommended.
              </p>

              <div className="branding-logo-upload">
                {branding?.custom_logo_url ? (
                  <div className="branding-logo-current">
                    <img src={branding.custom_logo_url} alt="Logo" className="branding-logo-current__image" />
                    <div className="branding-logo-current__actions">
                      <Button onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                        <Upload size={16} />
                        Replace
                      </Button>
                      <Button variant="ghost" onClick={handleDeleteLogo}>
                        <Trash2 size={16} />
                        Remove
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    className="branding-logo-dropzone"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                  >
                    <ImageIcon size={24} />
                    <span>{isUploading ? 'Uploading...' : 'Click to upload logo'}</span>
                    <span className="branding-logo-dropzone__hint">PNG, JPG up to 500KB</span>
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  style={{ display: 'none' }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

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
