declare module 'leaflet.gridlayer.googlemutant' {
  import { GridLayer, GridLayerOptions } from 'leaflet';

  export type GoogleMutantMapType = 'roadmap' | 'satellite' | 'terrain' | 'hybrid';

  export interface GoogleMutantOptions extends GridLayerOptions {
    type?: GoogleMutantMapType;
    styles?: object[];
  }

  export default class GoogleMutant extends GridLayer {
    constructor(options?: GoogleMutantOptions);
    whenReady(callback: (event: { target: GoogleMutant }) => void, context?: unknown): this;
  }
}
