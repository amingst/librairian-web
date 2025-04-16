declare module 'react-simple-maps' {
  import React from 'react';

  export interface Geography {
    rsmKey: string;
    type: string;
    properties: any;
    geometry: any;
  }

  export interface GeographyProps {
    geography: Geography;
    [key: string]: any;
  }

  export const ComposableMap: React.FC<{
    projection?: string;
    projectionConfig?: any;
    width?: number;
    height?: number;
    [key: string]: any;
  }>;

  export const Geographies: React.FC<{
    geography: string | any;
    children: (props: { geographies: Geography[] }) => React.ReactNode;
    [key: string]: any;
  }>;

  export const Geography: React.FC<GeographyProps>;

  export const Marker: React.FC<{
    coordinates: [number, number];
    [key: string]: any;
  }>;

  export const ZoomableGroup: React.FC<{
    center?: [number, number];
    zoom?: number;
    [key: string]: any;
  }>;
} 