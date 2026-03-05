import { useRef } from 'react';
import { motion, useInView } from 'motion/react';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles';
import Palette from 'lucide-react/dist/esm/icons/palette';
import Download from 'lucide-react/dist/esm/icons/download';
import Zap from 'lucide-react/dist/esm/icons/zap';
import Image from 'lucide-react/dist/esm/icons/image';
import Users from 'lucide-react/dist/esm/icons/users';
import './Features.css';

const FEATURES = [
  {
    icon: Sparkles,
    title: 'AI-Powered',
    description: 'Drop in data and AI picks the best chart type, colors, and layout automatically.',
  },
  {
    icon: Image,
    title: 'Screenshot to Chart',
    description: 'Upload a photo of any chart or table. AI extracts the data and rebuilds it beautifully.',
  },
  {
    icon: Palette,
    title: '40+ Style Controls',
    description: 'Professional, playful, editorial, or minimalist — fine-tune every detail in real time.',
  },
  {
    icon: Zap,
    title: 'Instant Export',
    description: 'Download as PNG, SVG, or PDF. Embed anywhere with a single link.',
  },
  {
    icon: Download,
    title: '6 Data Sources',
    description: 'CSV, paste, Google Sheets, stock tickers, public datasets, or just describe what you want.',
  },
  {
    icon: Users,
    title: 'Team Workspaces',
    description: 'Collaborate with your team. Shared charts, branded exports, and activity tracking.',
  },
];

export function Features() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-60px' });

  return (
    <section className="features" ref={ref} aria-label="Features">
      <motion.div
        className="features-header"
        initial={{ opacity: 0, y: 30 }}
        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="features-eyebrow">Why Chartsuno</p>
        <h2 className="features-title">
          Everything you need to make{' '}
          <em>data look incredible</em>
        </h2>
      </motion.div>

      <div className="features-grid">
        {FEATURES.map((feature, index) => {
          const Icon = feature.icon;
          return (
            <motion.div
              key={feature.title}
              className="feature-card"
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{
                duration: 0.4,
                delay: index * 0.08,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <div className="feature-icon">
                <Icon size={20} />
              </div>
              <h3 className="feature-card-title">{feature.title}</h3>
              <p className="feature-card-desc">{feature.description}</p>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
