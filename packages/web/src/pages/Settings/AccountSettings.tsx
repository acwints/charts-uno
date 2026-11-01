import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { User } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { isNativeApp } from '../../services/native';
import { copyReferralLink, referralShareUrl } from '../../services/referrals';
import { useToast } from '../../contexts/ToastContext';
import { Button } from '../../components/Button';

interface AccountSettingsProps {
  user: User;
}

function signInLabel(user: User): string {
  const labels: Record<string, string> = { google: 'Google', apple: 'Apple', review: 'Reviewer' };
  const providers = user.providers ?? [];
  if (providers.length === 0) return 'Google';
  return providers.map((provider) => labels[provider] ?? provider).join(' and ');
}

export function AccountSettings({ user }: AccountSettingsProps) {
  const { deleteAccount } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const inviteLink = user.referral_code ? referralShareUrl(user.referral_code) : null;
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const initials = user.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : user.email[0].toUpperCase();

  return (
    <div className="settings-section">
      <div className="settings-section__header">
        <h1 className="settings-section__title">Account Settings</h1>
        <p className="settings-section__description">
          Manage your personal account information
        </p>
      </div>

      <div className="settings-card">
        <div className="settings-card__header">
          <h3 className="settings-card__title">Profile</h3>
        </div>
        <div className="settings-card__content">
          <div className="settings-avatar">
            {user.picture ? (
              <img src={user.picture} alt={user.name || ''} className="settings-avatar__image" />
            ) : (
              <div className="settings-avatar__placeholder">{initials}</div>
            )}
            <div className="settings-avatar__info">
              <p className="settings-avatar__name">{user.name || 'No name set'}</p>
              <p className="settings-avatar__email">{user.email}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-card__header">
          <h3 className="settings-card__title">Account Details</h3>
        </div>
        <div className="settings-card__content">
          <div className="settings-field">
            <span className="settings-field__label">Email</span>
            <span className="settings-field__value">{user.email}</span>
          </div>
          <div className="settings-field">
            <span className="settings-field__label">Account Created</span>
            <span className="settings-field__value">
              {new Date(user.created_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          </div>
          <div className="settings-field">
            <span className="settings-field__label">Sign-in Method</span>
            <span className="settings-field__value">{signInLabel(user)}</span>
          </div>
        </div>
      </div>

      {inviteLink && (
        <div className="settings-card">
          <div className="settings-card__header">
            <h3 className="settings-card__title">Invite friends</h3>
          </div>
          <div className="settings-card__content">
            <p className="settings-privacy-text">
              Share your link. When a friend creates an account from it, that signup counts as your referral.
            </p>
            <label className="settings-field" htmlFor="invite-link">
              <span className="settings-field__label">Your link</span>
              <input
                id="invite-link"
                className="settings-field__input settings-invite__link"
                readOnly
                value={inviteLink}
                spellCheck={false}
              />
            </label>
            <Button
              variant="primary"
              onClick={() => {
                if (!user.referral_code) return;
                void copyReferralLink(user.referral_code).then((copied) => {
                  if (copied) toast.success('Invite link copied');
                  else toast.error('Could not copy the invite link');
                });
              }}
            >
              Invite friends
            </Button>
          </div>
        </div>
      )}

      <div className="settings-card">
        <div className="settings-card__header">
          <h3 className="settings-card__title">Privacy</h3>
        </div>
        <div className="settings-card__content">
          <p className="settings-privacy-text">
            View our privacy policy for details about how Chartsuno uses your data.
            Charts you create are private by default unless you choose to make them public.
          </p>
          <Link to="/privacy">Privacy policy</Link> · <Link to="/terms">Terms of use</Link>
        </div>
      </div>

      <div className="settings-card settings-card--danger">
        <div className="settings-card__header">
          <h3 className="settings-card__title">Delete account</h3>
        </div>
        <div className="settings-card__content">
          <p className="settings-privacy-text">
            Deletes your profile, charts, likes, and personal team from Chartsuno.
            A shared team you own is transferred to another member. This does not
            cancel a plan purchased on chartsuno.com. Payment records may be kept
            as described in the privacy policy.
          </p>
          {deleteError && <p className="settings-delete__error" role="alert">{deleteError}</p>}
          {confirming ? (
            <div className="settings-delete__confirm">
              <p className="settings-privacy-text">Delete {user.email}? This cannot be undone.</p>
              <div className="settings-delete__actions">
                <Button variant="danger" disabled={deleting} aria-busy={deleting} onClick={() => {
                  setDeleting(true);
                  setDeleteError(null);
                  void deleteAccount()
                    .then(() => navigate(isNativeApp() ? '/feed' : '/'))
                    .catch((error: unknown) => {
                      setDeleteError(error instanceof Error ? error.message : 'Could not delete your account. Please try again.');
                      setDeleting(false);
                    });
                }}>
                  {deleting ? 'Deleting…' : 'Delete account'}
                </Button>
                <Button variant="ghost" disabled={deleting} onClick={() => setConfirming(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="danger" onClick={() => { setConfirming(true); setDeleteError(null); }}>
              Delete account
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
