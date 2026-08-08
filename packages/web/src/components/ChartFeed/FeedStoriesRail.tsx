import { useMemo } from 'react';
import type { ChartResponse } from '../../services/api';
import { MiniChartPreview } from '../MiniChartPreview';
import './FeedStoriesRail.css';

interface FeedStoriesRailProps {
  charts: ChartResponse[];
  onChartSelect?: (chart: ChartResponse) => void;
}

const RAIL_LIMIT = 12;

// Horizontal "stories" rail of the most-liked charts in the current feed.
// Each entry is a ringed circular chart thumbnail, tapping opens the chart.
export function FeedStoriesRail({ charts, onChartSelect }: FeedStoriesRailProps) {
  const trending = useMemo(
    () =>
      [...charts]
        .sort((a, b) => b.like_count - a.like_count || b.view_count - a.view_count)
        .slice(0, RAIL_LIMIT),
    [charts],
  );

  if (trending.length === 0) return null;

  return (
    <div className="stories-rail" role="list" aria-label="Trending charts">
      {trending.map((chart) => {
        const label = chart.title || chart.config.title || 'Untitled Chart';
        return (
          <button
            key={chart.id}
            type="button"
            role="listitem"
            className="stories-rail__item"
            onClick={() => onChartSelect?.(chart)}
            aria-label={`Open trending chart: ${label}`}
          >
            <span className="stories-rail__ring">
              <span className="stories-rail__thumb">
                <MiniChartPreview
                  className="stories-rail__preview"
                  data={chart.data}
                  config={chart.config}
                  minHeight={56}
                />
              </span>
            </span>
            <span className="stories-rail__label">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
