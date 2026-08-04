import {
  MapContainer,
  TileLayer,
  Polygon,
  Marker,
  CircleMarker,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useConfirm } from '@/components/ui/ConfirmModal';
import { api } from '@/lib/api';
import {
  IconCheck,
  IconCompress,
  IconExpand,
  IconFocusAreas,
  IconLock,
  IconPencil,
  IconRedo,
  IconSearch,
  IconTag,
  IconTrash,
  IconUndo,
  IconX,
} from './mapIcons';

export type LatLng = [number, number];

export type MapArea = {
  id: string;
  points: LatLng[];
  label: string;
};

const DEFAULT_CENTER: LatLng = [-15.793889, -47.882778];

const AREA_COLORS = [
  { color: '#0ea5e9', fill: '#7dd3fc' },
  { color: '#f59e0b', fill: '#fde68a' },
  { color: '#10b981', fill: '#6ee7b7' },
  { color: '#8b5cf6', fill: '#c4b5fd' },
  { color: '#ef4444', fill: '#fca5a5' },
  { color: '#ec4899', fill: '#f9a8d4' },
];

function newId() {
  return `area-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function ringToPoints(coords: number[][]): LatLng[] {
  const points = coords
    .map((pair) => {
      if (!Array.isArray(pair) || pair.length < 2) return null;
      return [pair[1], pair[0]] as LatLng;
    })
    .filter(Boolean) as LatLng[];

  if (points.length > 1) {
    const first = points[0];
    const last = points[points.length - 1];
    if (first[0] === last[0] && first[1] === last[1]) {
      return points.slice(0, -1);
    }
  }
  return points;
}

function pointsToRing(points: LatLng[]): number[][] {
  const ring = points.map(([lat, lng]) => [lng, lat]);
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first && last && (first[0] !== last[0] || first[1] !== last[1])) {
    ring.push([...first]);
  }
  return ring;
}

function centroid(points: LatLng[]): LatLng {
  const sum = points.reduce(
    (acc, [lat, lng]) => [acc[0] + lat, acc[1] + lng] as LatLng,
    [0, 0] as LatLng,
  );
  return [sum[0] / points.length, sum[1] / points.length];
}

/** Normaliza rótulos: "Quadra 1", "quadra1", "Q1", "1" → comparáveis */
export function normalizeAreaKey(text: string) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/quadra\s*/gi, '')
    .replace(/^q(?=\d)/, '') // Q1 → 1
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

export function areaMatchesBlock(areaLabel: string, blockName: string) {
  const a = normalizeAreaKey(areaLabel || '');
  const b = normalizeAreaKey(blockName || '');
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

export function findAreaForBlock(areas: MapArea[], blockName: string) {
  if (!blockName?.trim() || areas.length === 0) return null;
  // 1) match exato normalizado
  const exact = areas.find((area) => {
    const a = normalizeAreaKey(area.label);
    const b = normalizeAreaKey(blockName);
    return a && b && a === b;
  });
  if (exact) return exact;
  // 2) match parcial (Quadra 1 ↔ 1, etc.)
  return areas.find((area) => areaMatchesBlock(area.label, blockName)) ?? null;
}

export function findBlockForArea<T extends { name: string }>(blocks: T[], areaLabel: string) {
  return blocks.find((block) => areaMatchesBlock(areaLabel, block.name)) ?? null;
}

/** Converte GeoJSON (Feature, FeatureCollection ou Polygon) → áreas com rótulo */
export function parseGeoJsonToAreas(value?: string | null): MapArea[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);

    if (parsed?.type === 'FeatureCollection' && Array.isArray(parsed.features)) {
      return parsed.features
        .map((feature: {
          id?: string;
          properties?: { label?: string; name?: string };
          geometry?: { type?: string; coordinates?: number[][][] };
        }, index: number) => {
          const ring = feature?.geometry?.coordinates?.[0];
          if (!ring) return null;
          const points = ringToPoints(ring);
          if (points.length < 3) return null;
          return {
            id: String(feature.id ?? `f-${index}`),
            points,
            label: String(feature.properties?.label ?? feature.properties?.name ?? `${index + 1}`),
          } satisfies MapArea;
        })
        .filter(Boolean) as MapArea[];
    }

    const ring =
      parsed?.geometry?.coordinates?.[0] ??
      (parsed?.type === 'Polygon' ? parsed.coordinates?.[0] : null);

    if (!Array.isArray(ring)) return [];
    const points = ringToPoints(ring);
    if (points.length < 3) return [];

    return [
      {
        id: 'area-1',
        points,
        label: String(parsed?.properties?.label ?? parsed?.properties?.name ?? '1'),
      },
    ];
  } catch {
    return [];
  }
}

/** Compat: primeiro polígono (páginas antigas) */
export function parseGeoJsonToPoints(value?: string | null): LatLng[] {
  return parseGeoJsonToAreas(value)[0]?.points ?? [];
}

export function areasToGeoJson(areas: MapArea[]): string | null {
  const valid = areas.filter((a) => a.points.length >= 3);
  if (valid.length === 0) return null;

  return JSON.stringify({
    type: 'FeatureCollection',
    features: valid.map((area) => ({
      type: 'Feature',
      id: area.id,
      properties: {
        label: area.label || 'Área',
        name: area.label || 'Área',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [pointsToRing(area.points)],
      },
    })),
  });
}

export function pointsToGeoJson(points: LatLng[], label = '1'): string | null {
  if (points.length < 3) return null;
  return areasToGeoJson([{ id: 'area-1', points, label }]);
}

export function hasValidMapArea(value?: string | null): boolean {
  return parseGeoJsonToAreas(value).length > 0;
}

function MapClickDraw({
  enabled,
  onAdd,
}: {
  enabled: boolean;
  onAdd: (point: LatLng) => void;
}) {
  useMapEvents({
    click(event) {
      if (!enabled) return;
      onAdd([event.latlng.lat, event.latlng.lng]);
    },
  });
  return null;
}

/** Zoom com scroll só com o mouse em cima do mapa (evita “roubar” o scroll da página) */
function ScrollWheelOnHover({ enabled }: { enabled: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (enabled) {
      map.scrollWheelZoom.enable();
    } else {
      map.scrollWheelZoom.disable();
    }
  }, [enabled, map]);
  return null;
}

/** Leaflet precisa recalcular o tamanho ao entrar/sair da tela cheia */
function InvalidateSizeOn({ token }: { token: number }) {
  const map = useMap();
  useEffect(() => {
    if (token <= 0) return;
    const t = window.setTimeout(() => {
      map.invalidateSize({ animate: false });
    }, 80);
    return () => window.clearTimeout(t);
  }, [token, map]);
  return null;
}

/** Enquadra a área selecionada (quando vem do card ou clique) */
function FocusOnSelected({
  area,
  focusToken,
}: {
  area: MapArea | null;
  focusToken: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (!area || area.points.length < 2 || focusToken <= 0) return;
    const bounds = L.latLngBounds(area.points.map(([lat, lng]) => L.latLng(lat, lng)));
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 18, animate: true });
  }, [area, focusToken, map]);

  return null;
}

/**
 * Reenquadra o mapa nas áreas (retângulos) — botão “voltar ao início”
 * quando o usuário se perde movendo o mapa. Só reage ao clique (token).
 */
function FitToAreasOn({
  token,
  areas,
  draftPoints,
  centerLat,
  centerLng,
}: {
  token: number;
  areas: MapArea[];
  draftPoints: LatLng[];
  centerLat?: number | null;
  centerLng?: number | null;
}) {
  const map = useMap();
  const areasRef = useRef(areas);
  const draftRef = useRef(draftPoints);
  const centerRef = useRef({ centerLat, centerLng });
  areasRef.current = areas;
  draftRef.current = draftPoints;
  centerRef.current = { centerLat, centerLng };

  useEffect(() => {
    if (token <= 0) return;

    const allPoints: LatLng[] = [
      ...areasRef.current.flatMap((a) => a.points),
      ...draftRef.current,
    ];

    if (allPoints.length >= 2) {
      const bounds = L.latLngBounds(allPoints.map(([lat, lng]) => L.latLng(lat, lng)));
      map.fitBounds(bounds, { padding: [48, 48], maxZoom: 17, animate: true });
      return;
    }

    if (allPoints.length === 1) {
      map.setView(allPoints[0], 16, { animate: true });
      return;
    }

    const { centerLat: lat, centerLng: lng } = centerRef.current;
    if (
      lat != null &&
      lng != null &&
      Number.isFinite(Number(lat)) &&
      Number.isFinite(Number(lng))
    ) {
      map.setView([Number(lat), Number(lng)], 15, { animate: true });
      return;
    }

    map.setView(DEFAULT_CENTER, 5, { animate: true });
  }, [token, map]);

  return null;
}

/** Voa até o endereço encontrado na busca */
function FlyToSearchResult({
  result,
  token,
}: {
  result: { lat: number; lng: number; label: string } | null;
  token: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (token <= 0 || !result) return;
    map.flyTo([result.lat, result.lng], 17, { animate: true, duration: 0.8 });
  }, [token, result, map]);

  return null;
}

type AddressHit = { lat: number; lng: number; label: string };

function InitialMapView({
  centerLat,
  centerLng,
  seedGeoJson,
}: {
  centerLat?: number | null;
  centerLng?: number | null;
  seedGeoJson?: string | null;
}) {
  const map = useMap();
  const cameraLocked = useRef(false);

  useEffect(() => {
    if (cameraLocked.current) return;

    const areas = parseGeoJsonToAreas(seedGeoJson);
    const allPoints = areas.flatMap((a) => a.points);

    if (allPoints.length >= 2) {
      const bounds = L.latLngBounds(allPoints.map(([lat, lng]) => L.latLng(lat, lng)));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 17, animate: false });
      cameraLocked.current = true;
      return;
    }

    if (centerLat != null && centerLng != null) {
      map.setView([Number(centerLat), Number(centerLng)], 15, { animate: false });
      cameraLocked.current = true;
    }
  }, [centerLat, centerLng, seedGeoJson, map]);

  return null;
}

function AreaLabelMarker({
  position,
  label,
  selected = false,
  finished = false,
}: {
  position: LatLng;
  label: string;
  selected?: boolean;
  finished?: boolean;
}) {
  const text = (label || '?').trim() || '?';

  const icon = useMemo(() => {
    if (selected) {
      // Selecionada: balão sólido. Finalizada usa cinza (como o card), sem trocar para ciano.
      const title = finished ? 'Finalizada · selecionada' : 'Área destacada';
      const bg = finished ? '#64748b' : '#0284c7';
      const glow = finished
        ? '0 6px 16px rgba(51,65,85,0.4), 0 0 0 3px rgba(148,163,184,0.45)'
        : '0 6px 20px rgba(3,105,161,0.55), 0 0 0 3px rgba(14,165,233,0.35)';
      const dot = finished ? '#cbd5e1' : '#7dd3fc';
      const approxWidth = Math.min(300, Math.max(150, text.length * 10 + (finished ? 72 : 56)));
      const height = finished ? 66 : 58;
      return L.divIcon({
        className: 'territorio-area-label territorio-area-selected-balloon',
        html: `<div class="territorio-selected-balloon-root" style="
          display:flex;
          flex-direction:column;
          align-items:center;
          pointer-events:none;
          font-family:system-ui,-apple-system,Segoe UI,sans-serif;
        ">
          <div style="
            max-width:280px;
            padding:9px 16px 10px;
            border-radius:16px;
            background:${bg};
            color:#fff;
            border:3px solid #fff;
            text-align:center;
            line-height:1.15;
            box-shadow:${glow};
          ">
            <div style="
              font-size:10px;
              font-weight:800;
              letter-spacing:0.06em;
              text-transform:uppercase;
              opacity:0.95;
              display:flex;
              align-items:center;
              justify-content:center;
              gap:4px;
            ">
              <span style="display:inline-block;width:7px;height:7px;border-radius:9999px;background:${dot};"></span>
              ${escapeHtml(title)}
            </div>
            <div style="
              margin-top:3px;
              font-size:16px;
              font-weight:800;
              white-space:nowrap;
              overflow:hidden;
              text-overflow:ellipsis;
              max-width:250px;
            ">${escapeHtml(text)}</div>
            ${
              finished
                ? `<div style="margin-top:4px;font-size:10px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;opacity:0.9;">✓ Quadra concluída</div>`
                : ''
            }
          </div>
          <div style="
            width:0;height:0;
            border-left:11px solid transparent;
            border-right:11px solid transparent;
            border-top:13px solid ${bg};
            margin-top:-1px;
          "></div>
        </div>`,
        iconSize: [approxWidth, height + 14],
        iconAnchor: [approxWidth / 2, height + 14],
      });
    }

    if (finished) {
      // Finalizada sem seleção: pill cinza (como o card)
      const approxWidth = Math.min(240, Math.max(48, text.length * 8.5 + 40));
      const height = 28;
      return L.divIcon({
        className: 'territorio-area-label',
        html: `<div style="
          display:inline-flex;
          align-items:center;
          justify-content:center;
          gap:4px;
          max-width:240px;
          padding:5px 12px;
          border-radius:9999px;
          background:#f1f5f9;
          color:#64748b;
          border:2px solid #94a3b8;
          font-weight:800;
          font-size:13px;
          line-height:1.2;
          box-shadow:0 2px 8px rgba(15,23,42,0.18);
          white-space:nowrap;
          overflow:hidden;
          text-overflow:ellipsis;
          pointer-events:none;
          font-family:system-ui,-apple-system,Segoe UI,sans-serif;
          text-decoration:line-through;
          text-decoration-color:#94a3b8;
        "><span style="font-size:12px;text-decoration:none;">✓</span>${escapeHtml(text)}</div>`,
        iconSize: [approxWidth, height],
        iconAnchor: [approxWidth / 2, height / 2],
      });
    }

    const approxWidth = Math.min(220, Math.max(36, text.length * 8.5 + 28));
    const height = 28;

    return L.divIcon({
      className: 'territorio-area-label',
      html: `<div style="
        display:inline-flex;
        align-items:center;
        justify-content:center;
        max-width:220px;
        padding:5px 12px;
        border-radius:9999px;
        background:#fffbeb;
        color:#78350f;
        border:2px solid #b45309;
        font-weight:800;
        font-size:13px;
        line-height:1.2;
        letter-spacing:0.01em;
        box-shadow:0 2px 8px rgba(15,23,42,0.25);
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
        pointer-events:none;
        font-family:system-ui,-apple-system,Segoe UI,sans-serif;
      ">${escapeHtml(text)}</div>`,
      iconSize: [approxWidth, height],
      iconAnchor: [approxWidth / 2, height / 2],
    });
  }, [text, selected, finished]);

  return (
    <Marker
      position={position}
      icon={icon}
      interactive={false}
      zIndexOffset={selected ? 1200 : finished ? 200 : 0}
    />
  );
}

function escapeHtml(text: string) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function ToolButton({
  active,
  disabled,
  title,
  onClick,
  tone = 'default',
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  title: string;
  onClick: () => void;
  tone?: 'default' | 'danger' | 'success';
  children: React.ReactNode;
}) {
  const tones = {
    default: active
      ? 'bg-sky-600 text-white shadow-sm'
      : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-300',
    danger: 'bg-white text-red-600 hover:bg-red-50 border border-red-200',
    success: 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700',
  };

  return (
    <button
      type="button"
      data-tooltip={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-40 ${tones[tone]} ${
        active && tone === 'default' ? '' : ''
      }`}
    >
      {children}
    </button>
  );
}

type TerritoryMapProps = {
  value?: string | null;
  onChange?: (geojson: string | null) => void;
  centerLat?: number | null;
  centerLng?: number | null;
  cepLabel?: string | null;
  editable?: boolean;
  heightClass?: string;
  /** Seleção externa (ex.: nome da quadra / rótulo da área) */
  selectedKey?: string | null;
  /** Incrementar para reenquadrar a área selecionada no mapa */
  focusToken?: number;
  /** Clique em um polígono (modo leitura ou edição) */
  onAreaSelect?: (area: { id: string; label: string }) => void;
  /** Limpa o destaque (seleção) — botão dentro do mapa */
  onClearSelection?: () => void;
  /** Nomes de quadras finalizadas (não em casa 100%) — cor/balão no mapa */
  finishedKeys?: string[];
};

function areaIsFinished(areaLabel: string, finishedKeys: string[]) {
  if (!finishedKeys.length) return false;
  return finishedKeys.some((key) => areaMatchesBlock(areaLabel, key) || areaLabel === key);
}

export default function TerritoryMap({
  value,
  onChange,
  centerLat,
  centerLng,
  cepLabel,
  editable = true,
  heightClass = 'h-[28rem]',
  selectedKey = null,
  focusToken = 0,
  onAreaSelect,
  onClearSelection,
  finishedKeys = [],
}: TerritoryMapProps) {
  const confirm = useConfirm();
  const [areas, setAreas] = useState<MapArea[]>(() => parseGeoJsonToAreas(value));
  const [draftPoints, setDraftPoints] = useState<LatLng[]>([]);
  /** Pilha de refazer (ordem LIFO: ponto do rascunho ou área removida) */
  const [redoStack, setRedoStack] = useState<
    Array<{ type: 'point'; point: LatLng } | { type: 'area'; area: MapArea }>
  >([]);
  /** false = mapa travado (só navegar); true = desenhar */
  const [drawMode, setDrawMode] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [seedGeoJson, setSeedGeoJson] = useState<string | null>(() => value ?? null);
  const [mapHovered, setMapHovered] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  /** Incrementa a cada toggle de tela cheia para forçar invalidateSize no Leaflet */
  const [sizeToken, setSizeToken] = useState(0);
  /** Incrementa ao clicar em “voltar às áreas” */
  const [fitAreasToken, setFitAreasToken] = useState(0);

  /** Busca por endereço no mapa */
  const [addressQuery, setAddressQuery] = useState('');
  const [addressHits, setAddressHits] = useState<AddressHit[]>([]);
  const [addressOpen, setAddressOpen] = useState(false);
  const [addressSearching, setAddressSearching] = useState(false);
  const [addressError, setAddressError] = useState('');
  const [searchPin, setSearchPin] = useState<AddressHit | null>(null);
  const [searchFlyToken, setSearchFlyToken] = useState(0);

  const drawingLocally = useRef(false);
  const seededFromServer = useRef(Boolean(value && parseGeoJsonToAreas(value).length > 0));
  const addressBoxRef = useRef<HTMLDivElement>(null);

  function toggleFullscreen() {
    setIsFullscreen((prev) => !prev);
    setSizeToken((t) => t + 1);
  }

  function fitToAreas() {
    setFitAreasToken((t) => t + 1);
  }

  function clearSelection() {
    setSelectedId(null);
    onClearSelection?.();
  }

  function goToAddress(hit: AddressHit) {
    setSearchPin(hit);
    setAddressQuery(hit.label);
    setAddressHits([]);
    setAddressOpen(false);
    setAddressError('');
    setSearchFlyToken((t) => t + 1);
  }

  async function searchAddress(event?: FormEvent) {
    event?.preventDefault();
    const q = addressQuery.trim();
    if (q.length < 3) {
      setAddressError('Digite ao menos 3 caracteres (rua, bairro, cidade ou CEP).');
      setAddressHits([]);
      setAddressOpen(false);
      return;
    }

    setAddressSearching(true);
    setAddressError('');
    try {
      const data = await api<{ results: AddressHit[] }>(
        `/api/config/geocode?q=${encodeURIComponent(q)}`,
      );
      const results = data.results ?? [];
      if (results.length === 0) {
        setAddressHits([]);
        setAddressOpen(false);
        setAddressError('Nenhum endereço encontrado. Tente outra busca.');
        return;
      }
      if (results.length === 1) {
        goToAddress(results[0]);
        return;
      }
      setAddressHits(results);
      setAddressOpen(true);
    } catch (err) {
      setAddressHits([]);
      setAddressOpen(false);
      setAddressError(err instanceof Error ? err.message : 'Erro ao buscar endereço.');
    } finally {
      setAddressSearching(false);
    }
  }

  // Fecha lista de sugestões ao clicar fora
  useEffect(() => {
    if (!addressOpen) return;
    function onDoc(e: MouseEvent) {
      if (!addressBoxRef.current?.contains(e.target as Node)) {
        setAddressOpen(false);
      }
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [addressOpen]);

  // Esc sai da tela cheia; trava scroll do body enquanto fullscreen
  useEffect(() => {
    if (!isFullscreen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Deixa o modal de confirmação (ou outro dialog) tratar o Esc primeiro
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

  useEffect(() => {
    if (drawingLocally.current || seededFromServer.current) return;
    const parsed = parseGeoJsonToAreas(value);
    if (parsed.length > 0) {
      setAreas(parsed);
      setSeedGeoJson(value ?? null);
      seededFromServer.current = true;
      // Em edição: pré-seleciona a 1ª área. Em leitura: só destaca quando o usuário escolher.
      if (editable && !selectedKey) {
        setSelectedId(parsed[0]?.id ?? null);
      }
    }
  }, [value, selectedKey, editable]);

  // Seleção controlada pelo card (selectedKey) — resolvida no mesmo render (sem atraso de useEffect)
  const selectedFromKey = useMemo(() => {
    if (selectedKey == null || selectedKey === '') return null;
    return (
      findAreaForBlock(areas, selectedKey) ??
      areas.find((a) => a.id === selectedKey) ??
      null
    );
  }, [selectedKey, areas]);

  // Mantém selectedId alinhado (edição de rótulo / toolbar)
  useEffect(() => {
    if (selectedKey == null || selectedKey === '') {
      if (!editable) setSelectedId(null);
      return;
    }
    if (selectedFromKey) {
      setSelectedId(selectedFromKey.id);
    } else if (!editable) {
      setSelectedId(null);
    }
  }, [selectedKey, selectedFromKey, editable]);

  const cepCenter: LatLng | null =
    centerLat != null &&
    centerLng != null &&
    Number.isFinite(Number(centerLat)) &&
    Number.isFinite(Number(centerLng))
      ? [Number(centerLat), Number(centerLng)]
      : null;

  const mapStartCenter = cepCenter ?? DEFAULT_CENTER;
  const mapStartZoom = cepCenter ? 15 : 5;

  // Com chave externa (card NÃO EM CASA): prioriza o match do card no mesmo frame
  const selected =
    selectedKey != null && selectedKey !== ''
      ? selectedFromKey
      : (areas.find((a) => a.id === selectedId) ?? null);
  const areaReady = areas.some((a) => a.points.length >= 3);

  function selectArea(area: MapArea) {
    setSelectedId(area.id);
    onAreaSelect?.({ id: area.id, label: area.label });
  }

  function emit(nextAreas: MapArea[]) {
    drawingLocally.current = true;
    setAreas(nextAreas);
    onChange?.(areasToGeoJson(nextAreas));
  }

  function setDrawModeOn() {
    if (!editable) return;
    setDrawMode(true);
  }

  function setDrawModeOff() {
    setDrawMode(false);
    // se estava no meio de um desenho incompleto, descarta rascunho
    if (draftPoints.length > 0 && draftPoints.length < 3) {
      setDraftPoints([]);
      setRedoStack([]);
    }
  }

  function addPoint(point: LatLng) {
    if (!editable || !drawMode) return;
    setDraftPoints((prev) => [...prev, point]);
    // nova ação invalida o refazer
    setRedoStack([]);
  }

  function undoPoint() {
    if (!editable) return;
    if (draftPoints.length > 0) {
      const removed = draftPoints[draftPoints.length - 1];
      setDraftPoints((prev) => prev.slice(0, -1));
      setRedoStack((prev) => [...prev, { type: 'point', point: removed }]);
      return;
    }
    // sem rascunho: remove última área (pode refazer)
    if (areas.length > 0) {
      const removed = areas[areas.length - 1];
      const next = areas.slice(0, -1);
      emit(next);
      setSelectedId(next[next.length - 1]?.id ?? null);
      setRedoStack((prev) => [...prev, { type: 'area', area: removed }]);
    }
  }

  function redoPoint() {
    if (!editable || redoStack.length === 0) return;
    const entry = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));

    if (entry.type === 'point') {
      setDraftPoints((prev) => [...prev, entry.point]);
      if (!drawMode) setDrawMode(true);
      return;
    }

    const next = [...areas, entry.area];
    emit(next);
    setSelectedId(entry.area.id);
  }

  function finishArea() {
    if (!editable || draftPoints.length < 3) return;
    const label = String(areas.length + 1);
    const area: MapArea = {
      id: newId(),
      points: draftPoints,
      label,
    };
    const next = [...areas, area];
    emit(next);
    setDraftPoints([]);
    setRedoStack([]);
    setSelectedId(area.id);
    setDrawMode(false);
  }

  async function clearAll() {
    if (!editable) return;
    if (areas.length === 0 && draftPoints.length === 0) return;

    const ok = await confirm({
      title: 'Apagar todas as áreas',
      message:
        'Todas as áreas desenhadas no mapa serão removidas. Essa ação não pode ser desfeita (até você salvar de novo com novas áreas). Deseja continuar?',
      confirmLabel: 'Apagar tudo',
      cancelLabel: 'Cancelar',
      tone: 'danger',
    });
    if (!ok) return;

    setDraftPoints([]);
    setRedoStack([]);
    setSelectedId(null);
    emit([]);
    setDrawMode(false);
  }

  function updateSelectedLabel(label: string) {
    if (!selectedId) return;
    const next = areas.map((a) => (a.id === selectedId ? { ...a, label } : a));
    emit(next);
  }

  async function removeSelected() {
    if (!selectedId || !editable) return;

    const label = selected?.label?.trim() || 'esta área';

    const ok = await confirm({
      title: 'Remover área selecionada',
      message: `A área “${label}” será removida do mapa. Deseja continuar?`,
      confirmLabel: 'Remover',
      cancelLabel: 'Cancelar',
      tone: 'danger',
    });
    if (!ok) return;

    const next = areas.filter((a) => a.id !== selectedId);
    emit(next);
    setSelectedId(next[0]?.id ?? null);
    setRedoStack([]);
  }

  return (
    <div
      className={
        isFullscreen
          ? 'fixed inset-0 z-[9000] flex flex-col gap-3 bg-slate-100 p-3 sm:p-4'
          : 'space-y-3'
      }
    >
      {/* Toolbar de ícones */}
      {editable ? (
        <div
          className={`flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 ${
            isFullscreen ? 'shrink-0 shadow-sm' : ''
          }`}
        >
          <ToolButton
            title="Mapa travado — só navegar / zoom (não desenha)"
            active={!drawMode}
            onClick={setDrawModeOff}
          >
            <IconLock />
          </ToolButton>

          <ToolButton
            title="Desenhar área — clique no mapa para marcar vértices"
            active={drawMode}
            onClick={setDrawModeOn}
          >
            <IconPencil />
          </ToolButton>

          <ToolButton
            title="Concluir área atual (mín. 3 pontos)"
            tone="success"
            disabled={draftPoints.length < 3}
            onClick={finishArea}
          >
            <IconCheck />
          </ToolButton>

          <ToolButton
            title="Desfazer último ponto (ou última área, se não houver rascunho)"
            disabled={draftPoints.length === 0 && areas.length === 0}
            onClick={undoPoint}
          >
            <IconUndo className="h-5 w-5" />
          </ToolButton>

          <ToolButton
            title="Refazer último ponto (ou última área desfeita)"
            disabled={redoStack.length === 0}
            onClick={redoPoint}
          >
            <IconRedo className="h-5 w-5" />
          </ToolButton>

          <ToolButton
            title="Apagar todas as áreas"
            tone="danger"
            disabled={areas.length === 0 && draftPoints.length === 0}
            onClick={() => void clearAll()}
          >
            <IconTrash />
          </ToolButton>

          <div className="ml-1 hidden h-6 w-px bg-slate-300 sm:block" />

          <p className="text-xs text-slate-600 sm:text-sm">
            {drawMode ? (
              <>
                <span className="font-semibold text-sky-700">Desenhando</span>
                {draftPoints.length < 3
                  ? ` — faltam ${3 - draftPoints.length} ponto(s), depois use ✓`
                  : ' — use ✓ para fechar a área'}
              </>
            ) : (
              <>
                <span className="font-semibold text-slate-800">Mapa travado</span>
                {' — zoom só com o mouse em cima do mapa. Clique no lápis para desenhar.'}
              </>
            )}
          </p>
        </div>
      ) : null}

      {/* Nome da área — acima do mapa para não precisar rolar “através” do zoom */}
      {editable && areas.length > 0 ? (
        <div
          className={`rounded-xl border border-slate-200 bg-white p-3 ${
            isFullscreen ? 'max-h-40 shrink-0 overflow-y-auto shadow-sm' : ''
          }`}
        >
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-800">
            <IconTag className="h-4 w-4 text-sky-600" />
            Nome / texto da área no mapa
          </div>

          <div className="mb-3 flex flex-wrap gap-2">
            {areas.map((area, index) => {
              const palette = AREA_COLORS[index % AREA_COLORS.length];
              return (
                <button
                  key={area.id}
                  type="button"
                  onClick={() => selectArea(area)}
                  className={`rounded-full px-3 py-1 text-sm font-semibold ${
                    area.id === selectedId
                      ? 'ring-2 ring-sky-500 ring-offset-1'
                      : 'opacity-80 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: palette.fill, color: '#0f172a' }}
                >
                  {area.label || `Área ${index + 1}`}
                </button>
              );
            })}
          </div>

          {selected ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                value={selected.label}
                onChange={(e) => updateSelectedLabel(e.target.value)}
                placeholder="Ex: 1, Quadra A, Norte…"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => void removeSelected()}
                data-tooltip="Remover área"
                aria-label="Remover área"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-white text-red-700 hover:bg-red-50"
              >
                <IconTrash className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              Selecione uma área (chip ou clique no mapa) para nomear.
            </p>
          )}
        </div>
      ) : null}

      {/* Busca por endereço — acima do mapa */}
      <div ref={addressBoxRef} className={`relative w-full ${isFullscreen ? 'shrink-0' : ''}`}>
        <form
          onSubmit={(e) => void searchAddress(e)}
          className="flex overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm"
        >
          <label htmlFor="map-address-search" className="sr-only">
            Buscar endereço no mapa
          </label>
          <span className="pointer-events-none flex items-center pl-3 text-slate-400">
            <IconSearch className="h-5 w-5" />
          </span>
          <input
            id="map-address-search"
            type="search"
            value={addressQuery}
            onChange={(e) => {
              setAddressQuery(e.target.value);
              setAddressError('');
            }}
            onFocus={() => {
              if (addressHits.length > 1) setAddressOpen(true);
            }}
            placeholder="Buscar rua, bairro, cidade ou CEP…"
            className="min-w-0 flex-1 border-0 bg-transparent px-2 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400"
            autoComplete="off"
            disabled={addressSearching}
          />
          {searchPin || addressQuery ? (
            <button
              type="button"
              data-tooltip="Limpar busca"
              aria-label="Limpar busca"
              onClick={() => {
                setAddressQuery('');
                setAddressHits([]);
                setAddressOpen(false);
                setAddressError('');
                setSearchPin(null);
              }}
              className="inline-flex h-10 w-9 shrink-0 items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-slate-800"
            >
              <IconX className="h-4 w-4" />
            </button>
          ) : null}
          <button
            type="submit"
            data-tooltip="Buscar endereço"
            aria-label="Buscar endereço"
            disabled={addressSearching}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 border-l border-slate-200 bg-sky-600 px-3 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
          >
            <IconSearch className="h-4 w-4" />
            <span className="hidden sm:inline">{addressSearching ? 'Buscando…' : 'Buscar'}</span>
          </button>
        </form>

        {addressError ? (
          <p className="mt-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900">
            {addressError}
          </p>
        ) : null}

        {addressOpen && addressHits.length > 0 ? (
          <ul className="absolute left-0 right-0 z-[30] mt-1 max-h-52 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
            {addressHits.map((hit, index) => (
              <li key={`${hit.lat}-${hit.lng}-${index}`}>
                <button
                  type="button"
                  onClick={() => goToAddress(hit)}
                  className="flex w-full items-start gap-2 px-3 py-2 text-left text-xs text-slate-700 hover:bg-sky-50 hover:text-sky-900"
                >
                  <IconSearch className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span className="line-clamp-2">{hit.label}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {searchPin && !addressOpen ? (
          <p className="mt-1.5 truncate rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-[11px] font-medium text-sky-900">
            📍 {searchPin.label}
          </p>
        ) : null}
      </div>

      <div
        className={`relative w-full overflow-hidden rounded-xl border border-slate-200 bg-white ${
          isFullscreen ? 'min-h-0 flex-1' : heightClass
        } ${drawMode ? 'ring-2 ring-sky-400' : selected ? 'ring-2 ring-sky-300' : ''}`}
        onMouseEnter={() => setMapHovered(true)}
        onMouseLeave={() => setMapHovered(false)}
      >
        {/* Chip flutuante: reforço visual fixo no canto (além do balão no centróide) */}
        {selected && !drawMode ? (
          <div className="pointer-events-none absolute left-3 top-3 z-[500] max-w-[min(100%-1.5rem,18rem)]">
            {(() => {
              const selectedFinished = areaIsFinished(selected.label, finishedKeys);
              return (
                <div
                  className={`territorio-map-selected-chip rounded-xl border-2 border-white px-3 py-2 text-white shadow-lg ${
                    selectedFinished
                      ? 'bg-slate-500 shadow-slate-800/30'
                      : 'bg-sky-600 shadow-sky-900/35'
                  }`}
                >
                  <p
                    className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${
                      selectedFinished ? 'text-slate-100' : 'text-sky-100'
                    }`}
                  >
                    <span
                      className={`territorio-map-selected-dot inline-block h-2 w-2 rounded-full ${
                        selectedFinished ? 'bg-slate-200' : 'bg-sky-200'
                      }`}
                    />
                    {selectedFinished ? 'Finalizada · selecionada' : 'Área destacada'}
                  </p>
                  <p className="truncate text-sm font-extrabold leading-tight">{selected.label || '—'}</p>
                  {selectedFinished ? (
                    <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-100/95">
                      ✓ Quadra concluída
                    </p>
                  ) : null}
                </div>
              );
            })()}
          </div>
        ) : null}

        {/* Controles do mapa (canto superior direito) */}
        <div className="absolute right-3 top-3 z-[500] flex flex-col gap-2">
          <button
            type="button"
            data-tooltip={isFullscreen ? 'Sair da tela cheia (Esc)' : 'Tela cheia'}
            data-tooltip-side="left"
            aria-label={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
            aria-pressed={isFullscreen}
            onClick={toggleFullscreen}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 shadow-md transition hover:bg-slate-50"
          >
            {isFullscreen ? <IconCompress /> : <IconExpand />}
          </button>
          <button
            type="button"
            data-tooltip="Voltar ao início — enquadrar as áreas do mapa"
            data-tooltip-side="left"
            aria-label="Voltar ao início e enquadrar as áreas"
            onClick={fitToAreas}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 shadow-md transition hover:bg-slate-50"
          >
            <IconFocusAreas />
          </button>
          {selected && !drawMode ? (
            <button
              type="button"
              data-tooltip="Limpar destaque"
              data-tooltip-side="left"
              aria-label="Limpar destaque da área"
              onClick={clearSelection}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-sky-300 bg-sky-50 text-sky-800 shadow-md transition hover:bg-sky-100"
            >
              <IconX />
            </button>
          ) : null}
        </div>

        <MapContainer
          center={mapStartCenter}
          zoom={mapStartZoom}
          scrollWheelZoom={false}
          className="h-full w-full"
        >
          <ScrollWheelOnHover enabled={mapHovered || isFullscreen} />
          <InvalidateSizeOn token={sizeToken} />
          <FitToAreasOn
            token={fitAreasToken}
            areas={areas}
            draftPoints={draftPoints}
            centerLat={centerLat}
            centerLng={centerLng}
          />
          <FlyToSearchResult result={searchPin} token={searchFlyToken} />
          <FocusOnSelected area={selected} focusToken={focusToken} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <InitialMapView
            centerLat={centerLat}
            centerLng={centerLng}
            seedGeoJson={seedGeoJson}
          />

          {cepCenter && areas.length === 0 && draftPoints.length === 0 && !searchPin ? (
            <Marker position={cepCenter} title={cepLabel ?? 'CEP do sistema'} />
          ) : null}

          {searchPin ? (
            <Marker position={[searchPin.lat, searchPin.lng]} title={searchPin.label} />
          ) : null}

          {areas.map((area, index) => {
            const palette = AREA_COLORS[index % AREA_COLORS.length];
            const isSelected = selected != null && area.id === selected.id;
            const isFinished = areaIsFinished(area.label, finishedKeys);
            // Com seleção ativa: área escolhida em destaque forte; demais “somem” (cinza tracejado)
            const dimOthers = Boolean(selected) && !isSelected;

            // Finalizada = cinza do card (mesmo quando selecionada — não troca para ciano).
            // Selecionada (em andamento) = ciano. Info de seleção da finalizada fica no balão/chip.
            let color = palette.color;
            let fillColor = palette.fill;
            let fillOpacity = 0.35;
            let weight = 3;
            let opacity = 0.9;
            let dashArray: string | undefined;
            let className: string | undefined;

            if (isFinished && (isSelected || !dimOthers)) {
              // Mesmo cinza do card finalizado, com ou sem seleção
              color = '#64748b';
              fillColor = '#cbd5e1';
              fillOpacity = isSelected ? 0.45 : 0.38;
              weight = isSelected ? 5 : 2.5;
              opacity = isSelected ? 1 : 0.85;
              className = isSelected
                ? 'territorio-polygon-finished-selected'
                : 'territorio-polygon-finished';
            } else if (isSelected) {
              color = '#0369a1';
              fillColor = '#0ea5e9';
              fillOpacity = 0.62;
              weight = 6;
              opacity = 1;
              className = 'territorio-polygon-selected';
            } else if (dimOthers) {
              color = '#94a3b8';
              fillColor = '#cbd5e1';
              fillOpacity = 0.12;
              weight = 1.5;
              opacity = 0.45;
              dashArray = '5 7';
              className = 'territorio-polygon-dim';
            }

            return (
              <Polygon
                key={area.id}
                positions={area.points}
                pathOptions={{
                  color,
                  fillColor,
                  fillOpacity,
                  weight,
                  opacity,
                  dashArray,
                  className,
                }}
                eventHandlers={{
                  click: (e) => {
                    if (drawMode) return;
                    L.DomEvent.stopPropagation(e);
                    selectArea(area);
                  },
                }}
              />
            );
          })}

          {areas.map((area) =>
            area.points.length >= 3 ? (
              <AreaLabelMarker
                key={`label-${area.id}`}
                position={centroid(area.points)}
                label={area.label || '?'}
                selected={selected != null && area.id === selected.id}
                finished={areaIsFinished(area.label, finishedKeys)}
              />
            ) : null,
          )}

          {/* rascunho em andamento */}
          {draftPoints.length >= 2 ? (
            <Polygon
              positions={draftPoints}
              pathOptions={{
                color: '#0369a1',
                fillColor: '#bae6fd',
                fillOpacity: 0.25,
                weight: 2,
                dashArray: '6 4',
              }}
            />
          ) : null}

          {draftPoints.map((point, index) => (
            <CircleMarker
              key={`draft-${index}-${point[0]}-${point[1]}`}
              center={point}
              radius={6}
              pathOptions={{
                color: '#0369a1',
                fillColor: '#38bdf8',
                fillOpacity: 1,
                weight: 2,
              }}
            />
          ))}

          <MapClickDraw enabled={editable && drawMode} onAdd={addPoint} />
        </MapContainer>
      </div>

      {!isFullscreen ? (
        <>
          {editable ? (
            <p className={`text-sm font-medium ${areaReady ? 'text-emerald-700' : 'text-amber-700'}`}>
              {areaReady
                ? `✓ ${areas.length} área(s) pronta(s) para salvar`
                : '⚠ Ative o lápis, desenhe um contorno (3+ pontos) e conclua com ✓'}
            </p>
          ) : (
            <p className="text-sm text-slate-600">
              {areaReady
                ? `${areas.length} área(s) no território.`
                : 'Este território ainda não tem área definida.'}
            </p>
          )}

          {cepLabel && editable ? (
            <p className="text-xs text-slate-500">Base do mapa (CEP): {cepLabel}</p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
