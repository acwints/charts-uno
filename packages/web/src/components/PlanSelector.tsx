import { useState } from 'react';
import Check from 'lucide-react/dist/esm/icons/check';
import Zap from 'lucide-react/dist/esm/icons/zap';
import Building2 from 'lucide-react/dist/esm/icons/building-2';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles';
import { motion } from 'motion/react';
import { createCheckout } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import './PlanSelector.css';

interface Plan {
  id: 'free' | 'pro' | 'business';
  name: string;
  price: number;
  description: string;
  features: string[];
  seats: string;
  charts: string;
  highlight?: boolean;
  icon: React.ReactNode;
}

const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    description: 'Perfect for individuals getting started',
    seats: '1 seat',
    charts: '10 charts/month',
    features: [
      'Basic chart types',
      'Export as PNG/SVG',
      'Community support',
    ],
    icon: <Sparkles size={20} />,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 15,
    description: 'Best for small teams and power users',
    seats: '5 seats',
    charts: 'Unlimited charts',
    highlight: true,
    features: [
      'All chart types',
      'AI-powered features',
      'Priority support',
      'Team collaboration',
      'Advanced exports',
    ],
    icon: <Zap size={20} />,
  },
  {
    id: 'business',
    name: 'Business',
    price: 49,
    description: 'For larger teams with advanced needs',
    seats: 'Unlimited seats',
    charts: 'Unlimited charts',
    features: [
      'Everything in Pro',
      'Custom branding',
      'API access',
      'SSO (coming soon)',
      'Dedicated support',
    ],
    icon: <Building2 size={20} />,
  },
];

interface PlanSelectorProps {
  teamId: string;
  currentPlan: 'free' | 'pro' | 'business';
}

export function PlanSelector({ teamId, currentPlan }: PlanSelectorProps) {
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const toast = useToast();

  const handleSelectPlan = async (plan: Plan) => {
    if (plan.id === 'free' || plan.id === currentPlan) return;

    setIsLoading(plan.id);

    try {
      const successUrl = `${window.location.origin}/settings/billing?success=true`;
      const cancelUrl = `${window.location.origin}/settings/billing?canceled=true`;

      const result = await createCheckout(teamId, plan.id, successUrl, cancelUrl);

      // Redirect to Polar checkout
      window.location.href = result.checkout_url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to start checkout');
      setIsLoading(null);
    }
  };

  const getPlanOrder = (planId: string): number => {
    const order = { free: 0, pro: 1, business: 2 };
    return order[planId as keyof typeof order] ?? 0;
  };

  const isDowngrade = (planId: string): boolean => {
    return getPlanOrder(planId) < getPlanOrder(currentPlan);
  };

  const isCurrentPlan = (planId: string): boolean => {
    return planId === currentPlan;
  };

  return (
    <div className="plan-selector">
      <div className="plan-selector__grid">
        {PLANS.map((plan) => (
          <motion.div
            key={plan.id}
            className={`plan-card ${plan.highlight ? 'plan-card--highlight' : ''} ${
              isCurrentPlan(plan.id) ? 'plan-card--current' : ''
            }`}
            whileHover={{ y: -4 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          >
            {plan.highlight && (
              <div className="plan-card__badge">Most Popular</div>
            )}

            <div className="plan-card__icon">{plan.icon}</div>

            <h3 className="plan-card__name">{plan.name}</h3>

            <div className="plan-card__price">
              <span className="plan-card__amount">${plan.price}</span>
              {plan.price > 0 && <span className="plan-card__period">/month</span>}
            </div>

            <p className="plan-card__description">{plan.description}</p>

            <div className="plan-card__limits">
              <div className="plan-card__limit">
                <Check size={14} />
                <span>{plan.seats}</span>
              </div>
              <div className="plan-card__limit">
                <Check size={14} />
                <span>{plan.charts}</span>
              </div>
            </div>

            <ul className="plan-card__features">
              {plan.features.map((feature, idx) => (
                <li key={idx} className="plan-card__feature">
                  <Check size={14} />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <button
              className={`plan-card__button ${
                isCurrentPlan(plan.id) ? 'plan-card__button--current' : ''
              } ${isDowngrade(plan.id) ? 'plan-card__button--downgrade' : ''}`}
              onClick={() => handleSelectPlan(plan)}
              disabled={isCurrentPlan(plan.id) || plan.id === 'free' || isLoading !== null}
            >
              {isLoading === plan.id
                ? 'Loading...'
                : isCurrentPlan(plan.id)
                ? 'Current Plan'
                : isDowngrade(plan.id)
                ? 'Downgrade'
                : plan.id === 'free'
                ? 'Free'
                : 'Upgrade'}
            </button>
          </motion.div>
        ))}
      </div>

      <p className="plan-selector__note">
        All paid plans include a 14-day free trial. Cancel anytime.
      </p>
    </div>
  );
}
