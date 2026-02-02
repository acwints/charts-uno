import { motion } from 'motion/react';
import { Button } from './Button';
import './Hero.css';

interface HeroProps {
  showAuthCta?: boolean;
  onAuthOpen?: () => void;
}

export function Hero({ showAuthCta = false, onAuthOpen }: HeroProps) {
  return (
    <div className="hero">
      <motion.div
        className="hero-content"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <p className="hero-eyebrow">Data visualization, refined</p>

        <h1 className="hero-title">
          Transform your data into <em>stunning visualizations</em>
        </h1>

        <p className="hero-subtitle">
          Drop in your data — CSV, spreadsheet, or a screenshot of an existing chart.
          AI generates beautiful charts instantly.
        </p>

        {showAuthCta && onAuthOpen && (
          <div className="hero-actions">
            <Button variant="primary" size="lg" onClick={onAuthOpen}>
              Sign in to save charts
            </Button>
            <p className="hero-note">Billing and account setup happen after you sign in.</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
