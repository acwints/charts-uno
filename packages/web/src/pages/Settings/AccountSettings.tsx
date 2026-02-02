import type { User } from '../../services/api';

interface AccountSettingsProps {
  user: User;
}

export function AccountSettings({ user }: AccountSettingsProps) {
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
            <span className="settings-field__value">Google</span>
          </div>
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-card__header">
          <h3 className="settings-card__title">Privacy</h3>
        </div>
        <div className="settings-card__content">
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: 0 }}>
            Your data is stored securely and never shared with third parties without your consent.
            Charts you create are private by default unless you choose to make them public.
          </p>
        </div>
      </div>
    </div>
  );
}
