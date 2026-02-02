import { useState, useEffect } from 'react';
import { ExternalLink, CreditCard, TrendingUp } from 'lucide-react';
import { useTeam } from '../../contexts/TeamContext';
import { useToast } from '../../contexts/ToastContext';
import { PlanSelector } from '../../components/PlanSelector';
import { Button } from '../../components/Button';
import { getPortalUrl } from '../../services/api';

export function BillingSettings() {
  const { currentTeam, usage, refetchUsage } = useTeam();
  const toast = useToast();
  const [isLoadingPortal, setIsLoadingPortal] = useState(false);

  // Check URL params for success/canceled
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true') {
      toast.success('Subscription updated successfully!');
      refetchUsage();
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    } else if (params.get('canceled') === 'true') {
      toast.info('Checkout canceled');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const handleManageSubscription = async () => {
    if (!currentTeam) return;

    setIsLoadingPortal(true);
    try {
      const { portal_url } = await getPortalUrl(currentTeam.id);
      window.open(portal_url, '_blank');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to open billing portal');
    } finally {
      setIsLoadingPortal(false);
    }
  };

  if (!currentTeam) {
    return (
      <div className="settings-empty">
        <CreditCard size={48} className="settings-empty__icon" />
        <p className="settings-empty__text">No team selected</p>
      </div>
    );
  }

  const subscription = currentTeam.subscription;
  const plan = subscription?.plan || 'free';
  const isPaid = plan !== 'free';

  const chartsUsagePercent = usage
    ? usage.charts_limit === -1
      ? 0
      : Math.min(100, (usage.charts_created_this_month / usage.charts_limit) * 100)
    : 0;

  const seatsUsagePercent = usage
    ? usage.seats_limit === -1
      ? 0
      : Math.min(100, (usage.seats_used / usage.seats_limit) * 100)
    : 0;

  const getUsageBarClass = (percent: number) => {
    if (percent >= 90) return 'usage-bar__fill--danger';
    if (percent >= 70) return 'usage-bar__fill--warning';
    return '';
  };

  return (
    <div className="settings-section settings-section--wide">
      <div className="settings-section__header">
        <h1 className="settings-section__title">Billing & Usage</h1>
        <p className="settings-section__description">
          Manage your subscription and monitor usage
        </p>
      </div>

      {/* Current Plan Summary */}
      <div className="settings-card">
        <div className="settings-card__header">
          <h3 className="settings-card__title">Current Plan</h3>
          {isPaid && (
            <Button
              onClick={handleManageSubscription}
              disabled={isLoadingPortal}
            >
              <ExternalLink size={14} className="settings-button__icon" />
              {isLoadingPortal ? 'Loading...' : 'Manage Subscription'}
            </Button>
          )}
        </div>
        <div className="settings-card__content">
          <div className="settings-plan-row">
            <span className="settings-plan-name">{plan}</span>
            {subscription?.status === 'canceled' && (
              <span className="settings-plan-status">Canceling</span>
            )}
          </div>
          {subscription?.current_period_end && (
            <p className="settings-plan-renewal">
              {subscription.status === 'canceled'
                ? `Access until ${new Date(subscription.current_period_end).toLocaleDateString()}`
                : `Renews ${new Date(subscription.current_period_end).toLocaleDateString()}`}
            </p>
          )}
        </div>
      </div>

      {/* Usage Stats */}
      {usage && (
        <div className="settings-card">
          <div className="settings-card__header">
            <h3 className="settings-card__title">
              <TrendingUp size={18} className="settings-usage-title-icon" />
              Usage This Month
            </h3>
          </div>
          <div className="usage-stats">
            <div className="usage-stat">
              <div className="usage-stat__label">Charts Created</div>
              <div className="usage-stat__value">
                {usage.charts_created_this_month}
              </div>
              <div className="usage-stat__limit">
                {usage.charts_limit === -1
                  ? 'Unlimited'
                  : `of ${usage.charts_limit} (${usage.charts_remaining} remaining)`}
              </div>
              {usage.charts_limit !== -1 && (
                <div className="usage-bar">
                  <div
                    className={`usage-bar__fill ${getUsageBarClass(chartsUsagePercent)}`}
                    style={{ width: `${chartsUsagePercent}%` }}
                  />
                </div>
              )}
            </div>

            <div className="usage-stat">
              <div className="usage-stat__label">Team Seats</div>
              <div className="usage-stat__value">{usage.seats_used}</div>
              <div className="usage-stat__limit">
                {usage.seats_limit === -1
                  ? 'Unlimited'
                  : `of ${usage.seats_limit} (${usage.seats_remaining} available)`}
              </div>
              {usage.seats_limit !== -1 && (
                <div className="usage-bar">
                  <div
                    className={`usage-bar__fill ${getUsageBarClass(seatsUsagePercent)}`}
                    style={{ width: `${seatsUsagePercent}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Plan Selection */}
      <div className="settings-plan-selection">
        <h2 className="settings-plan-selection__title">
          {isPaid ? 'Change Plan' : 'Upgrade Your Plan'}
        </h2>
        <PlanSelector teamId={currentTeam.id} currentPlan={plan as 'free' | 'pro' | 'business'} />
      </div>

      {/* Billing FAQ */}
      <div className="settings-card settings-faq">
        <div className="settings-card__header">
          <h3 className="settings-card__title">Billing FAQ</h3>
        </div>
        <div className="settings-card__content">
          <div className="settings-faq-item">
            <strong className="settings-faq-title">When does my billing cycle reset?</strong>
            <p className="settings-faq-text">
              Chart limits reset on the first day of each billing period. Your billing date depends on when you upgraded.
            </p>
          </div>
          <div className="settings-faq-item">
            <strong className="settings-faq-title">Can I cancel anytime?</strong>
            <p className="settings-faq-text">
              Yes! You can cancel your subscription at any time. You'll retain access until the end of your current billing period.
            </p>
          </div>
          <div className="settings-faq-item">
            <strong className="settings-faq-title">What payment methods do you accept?</strong>
            <p className="settings-faq-text">
              We accept all major credit cards through our payment partner Polar. Enterprise customers can request invoicing.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
