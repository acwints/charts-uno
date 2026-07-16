import { useState, useEffect } from 'react';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles';
import './AIProcessingIndicator.css';

interface AIProcessingIndicatorProps {
  /** Main label, e.g. "Analyzing image" */
  label: string;
  /** Smaller hint text, e.g. "Extracting data with GPT-4o Vision" */
  hint?: string;
  /** Visual size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Rotating status messages to cycle through */
  statusMessages?: string[];
}

const DEFAULT_STATUSES = [
  'Warming up the AI...',
  'Analyzing your data...',
  'Finding the best patterns...',
  'Almost there...',
];

export function AIProcessingIndicator({
  label,
  hint,
  size = 'md',
  statusMessages = DEFAULT_STATUSES,
}: AIProcessingIndicatorProps) {
  const [progress, setProgress] = useState(0);
  const [statusIndex, setStatusIndex] = useState(0);

  // Fake progress that slows down as it approaches 90%
  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      // Fast at first, then asymptotically approach 92%
      const newProgress = Math.min(92, 100 * (1 - Math.exp(-elapsed / 8)));
      setProgress(newProgress);
    }, 50);

    return () => clearInterval(interval);
  }, []);

  // Cycle through status messages
  useEffect(() => {
    if (statusMessages.length <= 1) return;

    const interval = setInterval(() => {
      setStatusIndex((prev) => (prev + 1) % statusMessages.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [statusMessages.length]);

  return (
    <div className={`ai-processing ai-processing--${size}`}>
      {/* Orbital spinner */}
      <div className="ai-processing-orb">
        <div className="orb-ring orb-ring--outer" />
        <div className="orb-ring orb-ring--middle" />
        <div className="orb-ring orb-ring--inner" />
        <div className="orb-core">
          <Sparkles size={size === 'lg' ? 24 : size === 'sm' ? 14 : 18} />
        </div>
        {/* Orbiting dots */}
        <div className="orb-dot orb-dot--1" />
        <div className="orb-dot orb-dot--2" />
        <div className="orb-dot orb-dot--3" />
      </div>

      {/* Label */}
      <div className="ai-processing-label">{label}</div>

      {/* Progress bar */}
      <div className="ai-processing-progress">
        <div className="progress-track">
          <div
            className="progress-fill"
            style={{ transform: `scaleX(${progress / 100})` }}
          />
          <div className="progress-glow" style={{ left: `${progress}%` }} />
        </div>
      </div>

      {/* Rotating status */}
      <div className="ai-processing-status" key={statusIndex}>
        {statusMessages[statusIndex]}
      </div>

      {/* Hint */}
      {hint && (
        <div className="ai-processing-hint">{hint}</div>
      )}
    </div>
  );
}
