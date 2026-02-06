import { useState, useMemo, useCallback } from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup,
} from 'react-simple-maps';
import type { ChartData, ChartConfig, ColorTheme } from '../types';
import { getGeoId } from '../services/geoData';
import './MapChart.css';

interface MapChartProps {
  data: ChartData;
  config: ChartConfig;
  theme: ColorTheme;
  colors: string[];
}

interface GeoFeature {
  rsmKey: string;
  id?: string | number;
  properties: {
    name?: string;
  };
}

// State centroids for bubble placement (approximate lat/lng)
const US_STATE_CENTROIDS: Record<string, [number, number]> = {
  'AL': [-86.9, 32.8], 'AK': [-153.5, 64.3], 'AZ': [-111.7, 34.3],
  'AR': [-92.4, 34.9], 'CA': [-119.4, 36.8], 'CO': [-105.5, 39.0],
  'CT': [-72.7, 41.6], 'DE': [-75.5, 39.0], 'DC': [-77.0, 38.9],
  'FL': [-81.7, 28.1], 'GA': [-83.5, 32.7], 'HI': [-155.5, 19.9],
  'ID': [-114.5, 44.1], 'IL': [-89.2, 40.0], 'IN': [-86.3, 39.8],
  'IA': [-93.5, 42.0], 'KS': [-98.4, 38.5], 'KY': [-85.3, 37.8],
  'LA': [-91.9, 31.0], 'ME': [-69.2, 45.4], 'MD': [-76.6, 39.0],
  'MA': [-71.8, 42.2], 'MI': [-84.7, 44.3], 'MN': [-94.3, 46.3],
  'MS': [-89.7, 32.7], 'MO': [-92.5, 38.3], 'MT': [-110.4, 47.0],
  'NE': [-99.8, 41.5], 'NV': [-116.6, 39.3], 'NH': [-71.6, 43.7],
  'NJ': [-74.7, 40.2], 'NM': [-106.0, 34.5], 'NY': [-75.5, 43.0],
  'NC': [-79.4, 35.5], 'ND': [-100.5, 47.5], 'OH': [-82.8, 40.4],
  'OK': [-97.5, 35.5], 'OR': [-120.5, 44.0], 'PA': [-77.2, 41.2],
  'RI': [-71.5, 41.7], 'SC': [-80.9, 34.0], 'SD': [-100.2, 44.4],
  'TN': [-86.3, 35.8], 'TX': [-99.3, 31.5], 'UT': [-111.7, 39.3],
  'VT': [-72.7, 44.0], 'VA': [-78.9, 37.5], 'WA': [-120.5, 47.4],
  'WV': [-80.6, 38.9], 'WI': [-89.8, 44.6], 'WY': [-107.5, 43.0],
  'PR': [-66.5, 18.2],
};

// Country centroids for bubble placement (approximate)
const COUNTRY_CENTROIDS: Record<string, [number, number]> = {
  'USA': [-98.6, 39.8], 'CAN': [-106.3, 56.1], 'MEX': [-102.5, 23.6],
  'BRA': [-51.9, -14.2], 'ARG': [-63.6, -38.4], 'GBR': [-1.2, 52.4],
  'FRA': [2.2, 46.2], 'DEU': [10.4, 51.2], 'ITA': [12.6, 42.5],
  'ESP': [-3.7, 40.5], 'RUS': [105.3, 61.5], 'CHN': [104.2, 35.9],
  'JPN': [138.3, 36.2], 'IND': [78.9, 20.6], 'AUS': [133.8, -25.3],
  'ZAF': [22.9, -30.6], 'NGA': [8.7, 9.1], 'EGY': [30.8, 26.8],
  'KOR': [127.8, 35.9], 'IDN': [113.9, -0.8], 'TUR': [35.2, 39.0],
  'SAU': [45.1, 23.9], 'POL': [19.1, 51.9], 'NLD': [5.3, 52.1],
  'BEL': [4.5, 50.5], 'SWE': [18.6, 60.1], 'CHE': [8.2, 46.8],
  'PHL': [121.8, 12.9], 'VNM': [108.3, 14.1], 'THA': [101.0, 15.9],
  'MYS': [101.7, 4.2], 'SGP': [103.8, 1.4], 'ARE': [54.0, 23.4],
  'ISR': [34.9, 31.0], 'PAK': [69.3, 30.4], 'BGD': [90.4, 23.7],
  'NZL': [174.9, -40.9], 'CHL': [-71.5, -35.7], 'COL': [-74.3, 4.6],
  'PER': [-75.0, -9.2], 'VEN': [-66.6, 6.4], 'UKR': [31.2, 48.4],
  'IRN': [53.7, 32.4], 'IRQ': [43.7, 33.2], 'KEN': [38.0, -0.0],
};

export function MapChart({ data, config, theme, colors }: MapChartProps) {
  const [loading] = useState(false);
  const [error] = useState<string | null>(null);

  const scope = config.mapScope ?? data.mapScope ?? 'us-states';
  const variant = config.mapVariant ?? 'choropleth';
  const regions = useMemo(() => data.mapRegions ?? [], [data.mapRegions]);

  // Build a lookup map from region ID to value
  const regionValueMap = useMemo(() => {
    const map = new Map<string, { value: number; name: string }>();
    for (const region of regions) {
      const geoId = getGeoId(scope, region.id);
      if (geoId) {
        map.set(geoId, { value: region.value, name: region.name });
      }
    }
    return map;
  }, [regions, scope]);

  // Calculate value range for color scaling
  const valueRange = useMemo(() => {
    if (regions.length === 0) return { min: 0, max: 100 };
    const values = regions.map((r) => r.value);
    return { min: Math.min(...values), max: Math.max(...values) };
  }, [regions]);

  // Get color for a value (for choropleth)
  const getColorForValue = useCallback(
    (value: number): string => {
      const { min, max } = valueRange;
      const range = max - min || 1;
      const normalized = (value - min) / range;
      // Use first color at varying opacities, or blend between colors
      const baseColor = colors[0] ?? '#6366f1';
      const opacity = 0.2 + normalized * 0.8;
      return `${baseColor}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`;
    },
    [colors, valueRange]
  );

  // Get bubble size for a value
  const getBubbleRadius = useCallback(
    (value: number): number => {
      const { min, max } = valueRange;
      const range = max - min || 1;
      const normalized = (value - min) / range;
      return 4 + normalized * 20; // 4px to 24px
    },
    [valueRange]
  );

  // Get centroid for a region
  const getCentroid = useCallback(
    (regionId: string): [number, number] | undefined => {
      if (scope === 'us-states') {
        return US_STATE_CENTROIDS[regionId];
      } else {
        return COUNTRY_CENTROIDS[regionId];
      }
    },
    [scope]
  );

  // Map projection config based on scope
  const projectionConfig = useMemo(() => {
    if (scope === 'us-states') {
      return {
        scale: 1000,
        center: [-96, 38] as [number, number],
      };
    }
    return {
      scale: 147,
      center: [0, 20] as [number, number],
    };
  }, [scope]);

  // Format value for tooltip
  const formatValue = useCallback((value: number): string => {
    if (value >= 1_000_000_000) {
      return `${(value / 1_000_000_000).toFixed(1)}B`;
    }
    if (value >= 1_000_000) {
      return `${(value / 1_000_000).toFixed(1)}M`;
    }
    if (value >= 1_000) {
      return `${(value / 1_000).toFixed(1)}K`;
    }
    return value.toLocaleString();
  }, []);

  if (loading) {
    return (
      <div className="map-chart map-chart--loading">
        <div className="map-loading-spinner" />
        <span>Loading map data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="map-chart map-chart--error">
        <span>Failed to load map: {error}</span>
      </div>
    );
  }

  const geoUrl = scope === 'us-states' ? '/geo/us-states.json' : '/geo/world-countries.json';

  return (
    <div className="map-chart">
      <ComposableMap
        projection={scope === 'us-states' ? 'geoAlbersUsa' : 'geoMercator'}
        projectionConfig={projectionConfig}
        className="map-svg"
      >
        <ZoomableGroup>
          <Geographies geography={geoUrl}>
            {({ geographies }: { geographies: GeoFeature[] }) =>
              geographies.map((geo) => {
                const geoId = String(geo.id);
                const regionData = regionValueMap.get(geoId);
                const hasData = Boolean(regionData);

                // Determine fill color
                let fill = theme.border; // Default for regions without data
                if (hasData && variant === 'choropleth') {
                  fill = getColorForValue(regionData!.value);
                } else if (hasData && variant === 'bubble') {
                  fill = `${theme.textMuted}33`; // Light fill for bubble maps
                }

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={fill}
                    stroke={theme.background}
                    strokeWidth={0.5}
                    className="map-geography"
                    style={{
                      default: { outline: 'none' },
                      hover: {
                        fill: hasData ? colors[0] : theme.textMuted,
                        outline: 'none',
                        cursor: hasData ? 'pointer' : 'default',
                      },
                      pressed: { outline: 'none' },
                    }}
                  />
                );
              })
            }
          </Geographies>

          {/* Bubble markers for bubble variant */}
          {variant === 'bubble' &&
            regions.map((region) => {
              const centroid = getCentroid(region.id);
              if (!centroid) return null;

              const radius = getBubbleRadius(region.value);
              return (
                <Marker key={region.id} coordinates={centroid}>
                  <circle
                    r={radius}
                    fill={colors[0] ?? '#6366f1'}
                    fillOpacity={0.7}
                    stroke={theme.background}
                    strokeWidth={1}
                    className="map-bubble"
                  />
                  <title>{`${region.name}: ${formatValue(region.value)}`}</title>
                </Marker>
              );
            })}
        </ZoomableGroup>
      </ComposableMap>

      {/* Legend */}
      <div className="map-legend" style={{ color: theme.textMuted }}>
        <div className="map-legend-title">{data.yAxisLabel ?? 'Value'}</div>
        <div className="map-legend-range">
          <span>{formatValue(valueRange.min)}</span>
          <div
            className="map-legend-gradient"
            style={{
              background:
                variant === 'choropleth'
                  ? `linear-gradient(to right, ${colors[0]}33, ${colors[0]})`
                  : undefined,
            }}
          >
            {variant === 'bubble' && (
              <>
                <svg width="16" height="16" viewBox="0 0 16 16">
                  <circle cx="8" cy="8" r="4" fill={colors[0]} fillOpacity={0.7} />
                </svg>
                <svg width="24" height="24" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" fill={colors[0]} fillOpacity={0.7} />
                </svg>
              </>
            )}
          </div>
          <span>{formatValue(valueRange.max)}</span>
        </div>
      </div>
    </div>
  );
}
