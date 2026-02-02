import { useParams, useNavigate } from 'react-router-dom';
import { User, Users, CreditCard, ImageIcon } from 'lucide-react';
import { AccountSettings } from './AccountSettings';
import { TeamSettings } from './TeamSettings';
import { BillingSettings } from './BillingSettings';
import { BrandingSettings } from './BrandingSettings';
import { useAuth } from '../../hooks/useAuth';
import './Settings.css';

type SettingsTab = 'account' | 'team' | 'billing' | 'branding';

const TABS = [
  { id: 'account' as const, label: 'Account', icon: User },
  { id: 'team' as const, label: 'Team', icon: Users },
  { id: 'billing' as const, label: 'Billing', icon: CreditCard },
  { id: 'branding' as const, label: 'Branding', icon: ImageIcon },
];

function isValidTab(tab: string | undefined): tab is SettingsTab {
  return tab === 'account' || tab === 'team' || tab === 'billing' || tab === 'branding';
}

export function SettingsPage() {
  const { tab } = useParams<{ tab?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const activeTab: SettingsTab = isValidTab(tab) ? tab : 'account';

  const handleTabChange = (newTab: SettingsTab) => {
    navigate(`/settings/${newTab}`);
  };

  const handleClose = () => {
    navigate(-1);
  };

  if (!user) {
    return null;
  }

  return (
    <div className="settings-page">
      <div className="settings-page__sidebar">
        <h2 className="settings-page__title">Settings</h2>
        <nav className="settings-page__nav">
          {TABS.map((tabItem) => {
            const Icon = tabItem.icon;
            return (
              <button
                key={tabItem.id}
                className={`settings-page__nav-item ${
                  activeTab === tabItem.id ? 'settings-page__nav-item--active' : ''
                }`}
                onClick={() => handleTabChange(tabItem.id)}
              >
                <Icon size={18} />
                <span>{tabItem.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="settings-page__content">
        <button className="settings-page__close" onClick={handleClose}>
          &times;
        </button>

        {activeTab === 'account' && <AccountSettings user={user} />}
        {activeTab === 'team' && <TeamSettings />}
        {activeTab === 'billing' && <BillingSettings />}
        {activeTab === 'branding' && <BrandingSettings />}
      </div>
    </div>
  );
}

export { AccountSettings, TeamSettings, BillingSettings, BrandingSettings };
