import { useRef } from 'react';
import { motion, useInView } from 'motion/react';
import { Link } from 'react-router-dom';
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right';
import './BottomCTA.css';

interface BottomCTAProps {
  onAuthOpen?: () => void;
  isAuthenticated: boolean;
}

export function BottomCTA({ onAuthOpen, isAuthenticated }: BottomCTAProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-60px' });

  return (
    <section className="bottom-cta" ref={ref} aria-label="Get started">
      <motion.div
        className="bottom-cta-inner"
        initial={{ opacity: 0, y: 30 }}
        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <h2 className="bottom-cta-title">
          Ready to make your data <em>stand out?</em>
        </h2>
        <p className="bottom-cta-subtitle">
          Start creating beautiful charts in seconds. No design skills needed.
        </p>
        <div className="bottom-cta-actions">
          {isAuthenticated ? (
            <Link to="/new" className="epic-button epic-button--gradient bottom-cta-btn">
              Create a Chart <ArrowRight size={16} />
            </Link>
          ) : (
            <button
              className="epic-button epic-button--gradient bottom-cta-btn"
              onClick={onAuthOpen}
            >
              Get Started Free <ArrowRight size={16} />
            </button>
          )}
        </div>
      </motion.div>
    </section>
  );
}
