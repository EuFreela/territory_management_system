import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
// Import ESM do MapLibre antes do bridge CJS (leaflet-maplibre-gl)
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import '@maplibre/maplibre-gl-leaflet';

// Garante que o UMD/CJS do bridge enxergue maplibre-gl no global quando o bundler isola módulos
if (typeof window !== 'undefined' && !(window as unknown as { maplibregl?: typeof maplibregl }).maplibregl) {
  (window as unknown as { maplibregl: typeof maplibregl }).maplibregl = maplibregl;
}

/** Tiles oficiais OSM Foundation no schema Shortbread (vector). */
const OSM_SHORTBREAD_TILES = 'https://vector.openstreetmap.org/shortbread_v1/{z}/{x}/{y}.mvt';

/**
 * Estilo MapLibre baseado no VersaTiles Colorful (schema Shortbread),
 * com a fonte de tiles apontando para o Shortbread da OSMF.
 * @see https://shortbread-tiles.org/
 * @see https://operations.osmfoundation.org/policies/vector/
 */
const STYLE_TEMPLATE_URL = 'https://tiles.versatiles.org/assets/styles/colorful/style.json';

type MapLibreStyle = {
  sources?: Record<
    string,
    {
      type?: string;
      tiles?: string[];
      attribution?: string;
      maxzoom?: number;
      minzoom?: number;
      [key: string]: unknown;
    }
  >;
  [key: string]: unknown;
};

let stylePromise: Promise<MapLibreStyle> | null = null;

function loadShortbreadStyle(): Promise<MapLibreStyle> {
  if (!stylePromise) {
    stylePromise = fetch(STYLE_TEMPLATE_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`Falha ao carregar estilo Shortbread (${res.status})`);
        return res.json() as Promise<MapLibreStyle>;
      })
      .then((style) => {
        const sources = style.sources ?? {};
        for (const key of Object.keys(sources)) {
          const src = sources[key];
          if (src?.type === 'vector') {
            src.tiles = [OSM_SHORTBREAD_TILES];
            src.maxzoom = 14;
            src.attribution =
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · Shortbread';
          }
        }
        style.name = 'OpenStreetMap Shortbread';
        return style;
      })
      .catch((err) => {
        stylePromise = null;
        throw err;
      });
  }
  return stylePromise;
}

/**
 * Camada base OpenStreetMap Shortbread (vector tiles) no Leaflet via MapLibre GL.
 * Substitui o raster clássico tile.openstreetmap.org.
 */
export function OsmShortbreadTileLayer() {
  const map = useMap();
  const layerRef = useRef<L.Layer | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const style = await loadShortbreadStyle();
        if (cancelled) return;

        const layer = L.maplibreGL({
          style: style as never,
          interactive: false,
          attributionControl: false,
          // pane padrão tilePane — fica sob áreas/markers do Leaflet
        });

        layer.addTo(map);
        if (cancelled) {
          map.removeLayer(layer);
          return;
        }

        layerRef.current = layer;
        console.info('[Campo] Basemap OpenStreetMap Shortbread (vector) ativo.');
      } catch (err) {
        console.error('[Campo] Falha ao carregar OSM Shortbread:', err);
        // Fallback raster se o vector falhar (rede/CORS/etc.)
        if (cancelled) return;
        const fallback = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        });
        fallback.addTo(map);
        layerRef.current = fallback;
      }
    })();

    return () => {
      cancelled = true;
      if (layerRef.current) {
        try {
          map.removeLayer(layerRef.current);
        } catch {
          /* mapa já desmontado */
        }
        layerRef.current = null;
      }
    };
  }, [map]);

  return null;
}
