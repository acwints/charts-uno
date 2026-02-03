import { useMemo } from 'react';
import { motion } from 'motion/react';
import { ChartStyleCard } from './ChartStyleCard';
import type { ChartData, ChartConfig, ChartStyleOption, ChartType, ColorScheme } from '../../types';
import './ChartStylePicker.css';

interface ChartStylePickerProps {
  data: ChartData;
  config: ChartConfig;
  onStyleSelect: (type: ChartType, colorScheme: ColorScheme) => void;
}

export function ChartStylePicker({ data, config, onStyleSelect }: ChartStylePickerProps) {
  const styleOptions: ChartStyleOption[] = useMemo(() => {
    const recommendedType = data.suggestedType || 'bar';

    return [
      {
        id: 'recommended',
        label: 'AI Recommended',
        type: recommendedType,
        colorScheme: 'default',
        description: 'Best fit based on image analysis',
      },
      {
        id: 'bar-editorial',
        label: 'Bar Chart',
        type: 'bar',
        colorScheme: 'editorial',
        description: 'Classic editorial style',
      },
      {
        id: 'line-cool',
        label: 'Line Chart',
        type: 'line',
        colorScheme: 'cool',
        description: 'Clean trend visualization',
      },
      {
        id: 'area-default',
        label: 'Area Chart',
        type: 'area',
        colorScheme: 'default',
        description: 'Filled area visualization',
      },
    ];
  }, [data.suggestedType]);

  const currentStyleId = useMemo(() => {
    const match = styleOptions.find(
      opt => opt.type === config.type && opt.colorScheme === config.colorScheme
    );
    return match?.id || styleOptions[0].id;
  }, [config.type, config.colorScheme, styleOptions]);

  return (
    <motion.div
      className="chart-style-picker"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="style-picker-header">
        <span className="section-label">Chart Style</span>
      </div>
      <div className="style-cards">
        {styleOptions.map((option, index) => (
          <motion.div
            key={option.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
          >
            <ChartStyleCard
              option={option}
              data={data}
              isSelected={currentStyleId === option.id}
              isRecommended={option.id === 'recommended'}
              onClick={() => onStyleSelect(option.type, option.colorScheme)}
            />
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
