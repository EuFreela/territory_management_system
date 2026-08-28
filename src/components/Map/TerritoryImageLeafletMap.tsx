import { useEffect, useState } from 'react';
import { ImageOverlay, MapContainer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { IconCompress, IconExpand, IconFocusAreas } from '@/components/Map/mapIcons';
import { LoadingBox } from '@/components/ui/Spinner';
import type { Territory } from '@/lib/types';
import { territoryCardImageUrl } from '@/lib/territory-map-image';

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
 * Carrega só o link sanitizado — sem arquivos locais em /territories/.
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
  const imageUrl = territoryCardImageUrl(territory);
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

    if (!imageUrl) {
      setFailed(true);
      setLoading(false);
      return;
    }

    loadImage(imageUrl)
      .then((img) => {
        if (cancelled) return;
        setLoaded({ url: imageUrl, width: img.naturalWidth, height: img.naturalHeight });
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setFailed(true);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [imageUrl, territory.id]);

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
    return <LoadingBox label="Carregando imagem…" className="min-h-[20rem]" />;
  }

  if (failed || !loaded) {
    return (
      <div className="flex min-h-[20rem] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-apple-line bg-apple-fill px-4 py-10 text-center">
        <p className="text-[15px] font-medium text-apple-ink">
          {imageUrl ? 'Não foi possível carregar a imagem' : 'Nenhum link de imagem cadastrado'}
        </p>
        <p className="max-w-sm text-[13px] text-apple-secondary">
          {imageUrl
            ? 'Confira se o link aponta para um arquivo de imagem público (jpg, png, webp) e tente de novo.'
            : 'Cole o link da imagem do cartão na criação ou na edição do território.'}
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
        <div className="absolute right-3 top-3 z-[1000] flex flex-col gap-2">
          <button
            type="button"
            data-tooltip={isFullscreen ? 'Sair da tela cheia (Esc)' : 'Tela cheia'}
            data-tooltip-side="left"
            aria-label={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
            aria-pressed={isFullscreen}
            onClick={toggleFullscreen}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-apple-line bg-apple-surface text-apple-ink shadow-md transition hover:bg-apple-fill"
          >
            {isFullscreen ? <IconCompress /> : <IconExpand />}
          </button>
          <button
            type="button"
            data-tooltip="Centralizar imagem"
            data-tooltip-side="left"
            aria-label="Centralizar e enquadrar a imagem"
            onClick={fitToImage}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-apple-line bg-apple-surface text-apple-ink shadow-md transition hover:bg-apple-fill"
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
    img.referrerPolicy = 'no-referrer';
    img.decoding = 'async';
    img.onload = () => {
      if (img.naturalWidth < 1 || img.naturalHeight < 1) {
        reject(new Error('Imagem inválida.'));
        return;
      }
      resolve(img);
    };
    img.onerror = () => reject(new Error('Falha ao carregar a imagem.'));
    img.src = url;
  });
}
