import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { Button } from './Button';
import './Hero.css';

interface HeroProps {
  showAuthCta?: boolean;
  onAuthOpen?: () => void;
  children?: ReactNode;
}

export function Hero({ showAuthCta = false, onAuthOpen, children }: HeroProps) {
  const editorFirst = Boolean(children);
  return (
    <div className={editorFirst ? 'hero hero--editor' : 'hero'}>
      <motion.div
        className={editorFirst ? 'hero-content hero-content--maker' : 'hero-content'}
        initial={editorFirst ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: editorFirst ? 0 : 0.5 }}
      >
        {editorFirst ? (
          <h1 className="hero-title hero-title--maker">Paste your data. <em>Get a chart.</em></h1>
        ) : (
          <>
            <p className="hero-eyebrow">Data visualization, refined</p>

            <h1 className="hero-title">
              Transform your data into <em>stunning visualizations</em>
            </h1>

            <p className="hero-subtitle">
              Drop in your data — CSV, spreadsheet, or a screenshot of an existing chart.
              AI generates beautiful charts instantly.
            </p>
          </>
        )}

        {children}

        {showAuthCta && onAuthOpen && !children && (
          <div className="hero-actions">
            <Button variant="primary" size="lg" onClick={onAuthOpen}>
              Get Started Free
            </Button>
            <p className="hero-note">No credit card required. Start creating charts instantly.</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
