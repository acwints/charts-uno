declare module 'react-simple-maps' {
  import { ReactNode, CSSProperties } from 'react';

  export interface ComposableMapProps {
    projection?: string;
    projectionConfig?: {
      scale?: number;
      center?: [number, number];
      rotate?: [number, number, number];
      parallels?: [number, number];
    };
    width?: number;
    height?: number;
    className?: string;
    style?: CSSProperties;
    children?: ReactNode;
  }

  export interface GeographiesProps {
    geography: string | object;
    children: (props: { geographies: Array<{ rsmKey: string; id?: string | number; properties: Record<string, unknown> }> }) => ReactNode;
  }

  export interface GeographyProps {
    geography: { rsmKey: string; id?: string | number; properties: Record<string, unknown> };
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    className?: string;
    style?: {
      default?: CSSProperties;
      hover?: CSSProperties;
      pressed?: CSSProperties;
    };
  }

  export interface MarkerProps {
    coordinates: [number, number];
    children?: ReactNode;
  }

  export interface ZoomableGroupProps {
    center?: [number, number];
    zoom?: number;
    minZoom?: number;
    maxZoom?: number;
    children?: ReactNode;
  }

  export function ComposableMap(props: ComposableMapProps): JSX.Element;
  export function Geographies(props: GeographiesProps): JSX.Element;
  export function Geography(props: GeographyProps): JSX.Element;
  export function Marker(props: MarkerProps): JSX.Element;
  export function ZoomableGroup(props: ZoomableGroupProps): JSX.Element;
  export function Sphere(props: { fill?: string; stroke?: string; strokeWidth?: number }): JSX.Element;
  export function Graticule(props: { stroke?: string; strokeWidth?: number }): JSX.Element;
  export function Line(props: { from: [number, number]; to: [number, number]; stroke?: string; strokeWidth?: number }): JSX.Element;
  export function Annotation(props: { subject: [number, number]; children?: ReactNode }): JSX.Element;
}
