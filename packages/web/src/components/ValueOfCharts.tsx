import { useRef } from 'react';
import { motion, useInView } from 'motion/react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
  ResponsiveContainer,
  LabelList,
} from 'recharts';
import './ValueOfCharts.css';

const data = [
  { name: '1 Word', value: 1, label: '1' },
  { name: '1 Picture', value: 1000, label: '1,000' },
  { name: '1 Chart', value: 1000000, label: '1,000,000' },
];

const BAR_COLORS = [
  'var(--text-muted)',
  'var(--accent)',
  'url(#epicGradient)',
];

function formatTick(value: number) {
  if (value >= 1000000) return '1M';
  if (value >= 1000) return '1K';
  return String(value);
}

export function ValueOfCharts() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section className="voc" ref={ref} aria-label="Value of charts">
      <motion.div
        className="voc-inner"
        initial={{ opacity: 0, y: 40 }}
        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="voc-eyebrow">Worth a million words</p>
        <h2 className="voc-title">
          A chart isn't just a picture.{' '}
          <em>It's a million times more powerful than a single word.</em>
        </h2>

        <div className="voc-chart-container">
          <ResponsiveContainer width="100%" height={340}>
            <BarChart
              data={data}
              margin={{ top: 40, right: 20, bottom: 20, left: 20 }}
              barCategoryGap="28%"
            >
              <defs>
                <linearGradient id="epicGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" />
                  <stop offset="50%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#06b6d4" />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{
                  fill: 'var(--text-secondary)',
                  fontFamily: 'var(--font-body)',
                  fontSize: 14,
                  fontWeight: 600,
                }}
                dy={8}
              />
              <YAxis
                scale="log"
                domain={[0.5, 2000000]}
                axisLine={false}
                tickLine={false}
                tick={{
                  fill: 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                }}
                tickFormatter={formatTick}
                ticks={[1, 1000, 1000000]}
                width={36}
              />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} animationDuration={1200} animationBegin={200}>
                {data.map((_, index) => (
                  <Cell key={index} fill={BAR_COLORS[index]} />
                ))}
                <LabelList
                  dataKey="label"
                  position="top"
                  style={{
                    fill: 'var(--text-secondary)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    fontWeight: 500,
                  }}
                  offset={10}
                  formatter={(v: string) => `${v} words`}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <p className="voc-caption">
          Logarithmic scale — each bar is 1,000x the previous
        </p>
      </motion.div>
    </section>
  );
}
