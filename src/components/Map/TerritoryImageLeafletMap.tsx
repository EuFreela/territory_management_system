import { useEffect, useMemo, useState } from 'react';
import { ImageOverlay, MapContainer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { IconCompress, IconExpand, IconFocusAreas } from '@/components/Map/mapIcons';
import type { Territory } from '@/lib/types';
import { territoryStaticMapCandidates } from '@/lib/territory-map-image';

type LoadedImage = {
  url: string;
  width: number;
  height: number;
};

/** Encaixa a imagem no viewport e invalida o tamanho (tela cheia / reenquadrar). */
function FitImageBounds({
  bounds,
  fitToken,
  sizeToken,
}: {
  bounds: L.LatLngBoundsExpression;
  fitToken: number;
  sizeToken: number;
}) {
  const map = useMap();

  useEffect(() => {
    map.invalidateSize();
    map.fitBounds(bounds, { animate: fitToken > 0, padding: [12, 12] });
  }, [map, bounds, fitToken, sizeToken]);

  useEffect(() => {
    const onResize = () => {
      map.invalidateSize();
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [map]);

  return null;
}

/**
 * Imagem do cartão no Leaflet (CRS.Simple + ImageOverlay).
 * Controles iguais ao mapa: tela cheia e centralizar/enquadrar.
 */
export default function TerritoryImageLeafletMap({
  territory,
  /** Incrementar ao reexibir a aba (sem desmontar) */
  resizeToken = 0,
  /** Altura do contêiner quando fora de tela cheia */
  heightClass = 'h-[min(70vh,40rem)]',
  /** Preenche a altura disponível do pai (flex) — usado em modais de comparação */
  fillHeight = false,
}: {
  territory: Territory;
  resizeToken?: number;
  heightClass?: string;
  fillHeight?: boolean;
}) {
  const candidates = useMemo(() => territoryStaticMapCandidates(territory), [territory]);
  const [loaded, setLoaded] = useState<LoadedImage | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sizeToken, setSizeToken] = useState(0);
  const [fitToken, setFitToken] = useState(0);
  const layoutToken = sizeToken + resizeToken;

  useEffect(() => {
    let cancelled = false;
    setLoaded(null);
    setFailed(false);
    setLoading(true);

    if (candidates.length === 0) {
      setFailed(true);
      setLoading(false);
      return;
    }

    (async () => {
      for (const url of candidates) {
        try {
          const img = await loadImage(url);
          if (cancelled) return;
          setLoaded({ url, width: img.naturalWidth, height: img.naturalHeight });
          setLoading(false);
          return;
        } catch {
          /* tenta próxima extensão */
        }
      }
      if (!cancelled) {
        setFailed(true);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [candidates, territory.id, territory.number]);

  // Esc sai da tela cheia; trava scroll do body
  useEffect(() => {
    if (!isFullscreen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (document.querySelector('[role="alertdialog"], [aria-modal="true"]')) return;
      e.preventDefault();
      setIsFullscreen(false);
      setSizeToken((t) => t + 1);
    };

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isFullscreen]);

  function toggleFullscreen() {
    setIsFullscreen((prev) => !prev);
    setSizeToken((t) => t + 1);
  }

  function fitToImage() {
    setFitToken((t) => t + 1);
  }

  if (loading) {
    return (
      <div className="flex min-h-[20rem] items-center justify-center rounded-2xl border border-apple-line bg-apple-fill text-[14px] text-apple-secondary">
        Carregando imagem…
      </div>
    );
  }

  if (failed || !loaded) {
    return (
      <div className="flex min-h-[20rem] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-apple-line bg-apple-fill px-4 py-10 text-center">
        <p className="text-[15px] font-medium text-apple-ink">Imagem do mapa não encontrada</p>
        <p className="max-w-sm text-[13px] text-apple-secondary">
          Coloque o arquivo em{' '}
          <code className="rounded bg-apple-surface px-1.5 py-0.5 text-[12px]">
            public/territories/t{String(territory.number ?? '').replace(/\D/g, '') || 'N'}.webp
          </code>{' '}
          (ou .jpg / .png). Terr. N.º atual: {territory.number || '—'}.
        </p>
      </div>
    );
  }

  // CRS.Simple: [y, x] — origem canto superior-esquerdo da imagem
  const bounds = L.latLngBounds([
    [0, 0],
    [loaded.height, loaded.width],
  ]);
  const center: L.LatLngExpression = [loaded.height / 2, loaded.width / 2];

  return (
    <div
      className={
        isFullscreen
          ? 'fixed inset-0 z-[9000] flex flex-col bg-slate-100 p-3 dark:bg-black sm:p-4'
          : fillHeight
            ? 'flex h-full min-h-0 flex-col gap-3'
            : ''
      }
    >
      <div
        className={`relative z-0 isolate w-full overflow-hidden rounded-2xl border border-apple-line bg-apple-surface shadow-soft ${
          isFullscreen || fillHeight ? 'min-h-0 flex-1' : heightClass
        }`}
      >
        {/* Controles — mesmo padrão do TerritoryMap */}
        <div className="absolute right-3 top-3 z-[1000] flex flex-col gap-2">
          <button
            type="button"
            data-tooltip={isFullscreen ? 'Sair da tela cheia (Esc)' : 'Tela cheia'}
            data-tooltip-side="left"
            aria-label={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
            aria-pressed={isFullscreen}
            onClick={toggleFullscreen}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-apple-line bg-apple-surface text-apple-ink shadow-md transition hover:bg-apple-fill"
          >
            {isFullscreen ? <IconCompress /> : <IconExpand />}
          </button>
          <button
            type="button"
            data-tooltip="Centralizar imagem"
            data-tooltip-side="left"
            aria-label="Centralizar e enquadrar a imagem"
            onClick={fitToImage}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-apple-line bg-apple-surface text-apple-ink shadow-md transition hover:bg-apple-fill"
          >
            <IconFocusAreas />
          </button>
        </div>

        <div className="h-full w-full [&_.leaflet-container]:h-full [&_.leaflet-container]:w-full [&_.leaflet-container]:bg-apple-fill">
          <MapContainer
            key={loaded.url}
            crs={L.CRS.Simple}
            center={center}
            zoom={0}
            minZoom={-3}
            maxZoom={4}
            scrollWheelZoom
            className="h-full w-full"
            style={{ height: '100%', width: '100%', background: 'transparent' }}
            attributionControl={false}
          >
            <ImageOverlay url={loaded.url} bounds={bounds} opacity={1} zIndex={1} />
            <FitImageBounds bounds={bounds} fitToken={fitToken} sizeToken={layoutToken} />
          </MapContainer>
        </div>
      </div>
    </div>
  );
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Falha ao carregar ${url}`));
    img.src = url;
  });
}
