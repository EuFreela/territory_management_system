import { useEffect, useRef, useState } from 'react';
import { useMap } from 'react-leaflet';
import type { Layer } from 'leaflet';
import GoogleMutant from 'leaflet.gridlayer.googlemutant';
import { OsmShortbreadTileLayer } from './OsmShortbreadTileLayer';

const API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim();

export type GoogleMapType = 'roadmap' | 'satellite' | 'terrain' | 'hybrid';

type Props = {
  /** Tipo de mapa do Google. Padrão: roadmap (ruas, atualizado). */
  type?: GoogleMapType;
  /** Chamado quando o basemap estiver pronto (Google ou fallback OSM). */
  onReady?: () => void;
};

declare global {
  interface Window {
    google?: typeof google;
  }
}

/**
 * Carrega o script clássico da Maps JavaScript API.
 * O GoogleMutant exige `window.google.maps.Map` — o loader modular
 * (@googlemaps/js-api-loader) nem sempre expõe isso a tempo.
 */
function loadGoogleMapsScript(apiKey: string): Promise<void> {
  if (window.google?.maps?.Map) {
    return Promise.resolve();
  }

  const existing = document.querySelector<HTMLScriptElement>('script[data-campo-gmaps]');
  if (existing) {
    return new Promise((resolve, reject) => {
      if (window.google?.maps?.Map) {
        resolve();
        return;
      }
      const onLoad = () => {
        if (window.google?.maps?.Map) resolve();
        else reject(new Error('Google Maps script loaded but google.maps.Map is missing'));
      };
      existing.addEventListener('load', onLoad, { once: true });
      existing.addEventListener(
        'error',
        () => reject(new Error('Falha ao carregar script do Google Maps')),
        { once: true },
      );
      // Script já pode ter terminado entre o query e o listener
      if (window.google?.maps?.Map) resolve();
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&language=pt-BR&region=BR`;
    script.async = true;
    script.defer = true;
    script.dataset.campoGmaps = '1';
    script.onload = () => {
      if (window.google?.maps?.Map) resolve();
      else reject(new Error('Google Maps script loaded but google.maps.Map is missing'));
    };
    script.onerror = () => reject(new Error('Falha ao baixar Google Maps JS (rede ou chave inválida)'));
    document.head.appendChild(script);
  });
}

/**
 * Base map do Google Maps dentro do Leaflet (ToS-compliant via GoogleMutant).
 * Até o Google ficar pronto (ou se falhar), usa OpenStreetMap Shortbread (vector).
 */
export function GoogleMapsTileLayer({ type = 'roadmap', onReady }: Props) {
  const map = useMap();
  /** true = ainda sem Google (mostra OSM Shortbread). false = Google ativo. */
  const [showOsm, setShowOsm] = useState(true);
  const layerRef = useRef<Layer | null>(null);
  /** Sempre chama o callback mais recente sem recriar o efeito (identidade muda a cada render). */
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    if (!API_KEY) {
      console.warn(
        '[Campo] VITE_GOOGLE_MAPS_API_KEY não definida — usando OpenStreetMap Shortbread.\n' +
          'Adicione a chave no .env e reinicie o Vite (npm run dev).',
      );
      setShowOsm(true);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        await loadGoogleMapsScript(API_KEY);
        if (cancelled) return;

        if (!window.google?.maps?.Map) {
          throw new Error('window.google.maps.Map indisponível após o load');
        }

        const layer = new GoogleMutant({
          type,
          // Alinhado ao maxZoom do TerritoryMap (sem detalhe de nome de rua)
          maxZoom: 16,
          maxNativeZoom: 16,
        });

        await new Promise<void>((resolve, reject) => {
          const timeout = window.setTimeout(() => {
            reject(new Error('Timeout: GoogleMutant não inicializou em 15s'));
          }, 15_000);

          layer.whenReady(() => {
            window.clearTimeout(timeout);
            resolve();
          });

          layer.addTo(map);
        });

        if (cancelled) {
          map.removeLayer(layer);
          return;
        }

        layerRef.current = layer;
        setShowOsm(false);
        console.info('[Campo] Google Maps basemap ativo (Leaflet + GoogleMutant).');
        onReadyRef.current?.();
      } catch (err) {
        console.error('[Campo] Falha ao carregar Google Maps no Leaflet:', err);
        if (!cancelled) setShowOsm(true);
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
  }, [map, type]);

  if (!showOsm) return null;

  return <OsmShortbreadTileLayer onReady={onReady} />;
}
