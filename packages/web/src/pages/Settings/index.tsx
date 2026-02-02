import { useState } from 'react';
import { User, Users, CreditCard } from 'lucide-react';
import { AccountSettings } from './AccountSettings';
import { TeamSettings } from './TeamSettings';
import { BillingSettings } from './BillingSettings';
import { useAuth } from '../../hooks/useAuth';
import './Settings.css';

type SettingsTab = 'account' | 'team' | 'billing';

interface SettingsPageProps {
  initialTab?: SettingsTab;
  onClose: () => void;
}

const TABS = [
  { id: 'account' as const, label: 'Account', icon: User },
  { id: 'team' as const, label: 'Team', icon: Users },
  { id: 'billing' as const, label: 'Billing', icon: CreditCard },
];

export function SettingsPage({ initialTab = 'account', onClose }: SettingsPageProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  return (
    <div className="settings-page">
      <div className="settings-page__sidebar">
        <h2 className="settings-page__title">Settings</h2>
        <nav className="settings-page__nav">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                className={`settings-page__nav-item ${
                  activeTab === tab.id ? 'settings-page__nav-item--active' : ''
                }`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={18} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="settings-page__content">
        <button className="settings-page__close" onClick={onClose}>
          &times;
        </button>

        {activeTab === 'account' && <AccountSettings user={user} />}
        {activeTab === 'team' && <TeamSettings />}
        {activeTab === 'billing' && <BillingSettings />}
      </div>
    </div>
  );
}

export { AccountSettings, TeamSettings, BillingSettings };
