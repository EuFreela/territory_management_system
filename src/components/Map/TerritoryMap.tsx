import {
  MapContainer,
  Polygon,
  Polyline,
  Marker,
  CircleMarker,
  Popup,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { confirmToast } from '@/lib/confirm-toast';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  fetchShortestDrivingRoute,
  findNearestArea,
  formatRouteDistance,
  formatRouteDuration,
  type LatLngTuple,
} from '@/lib/geo-route';
import { tooltipText } from '@/lib/tooltip';
import { GoogleMapsTileLayer } from './GoogleMapsTileLayer';
import {
  IconCheck,
  IconCompress,
  IconContrast,
  IconExpand,
  IconFocusAreas,
  IconLocate,
  IconLock,
  IconNote,
  IconPalette,
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

/** Comentário / balão de atenção no mapa (Point no GeoJSON) */
export type MapNote = {
  id: string;
  position: LatLng;
  text: string;
};

const DEFAULT_CENTER: LatLng = [-15.793889, -47.882778];

/**
 * Limites de câmera do mapa de territórios.
 * - minZoom: não “sai” da cidade (visão municipal)
 * - maxZoom: não chega no detalhe de nome de rua / prédio
 * - bounds: recorte ~±7 km em torno do CEP do sistema (Alpinópolis etc.)
 */
const MAP_MIN_ZOOM = 10;
const MAP_MAX_ZOOM = 20;
const MAP_DEFAULT_ZOOM = 15;
/** Meia-extensão em graus ≈ 7 km (latitude) — mantém o pan dentro da região */
const MAP_BOUNDS_DELTA = 0.065;

function mapCityBounds(lat: number, lng: number): L.LatLngBounds {
  return L.latLngBounds(
    [lat - MAP_BOUNDS_DELTA, lng - MAP_BOUNDS_DELTA],
    [lat + MAP_BOUNDS_DELTA, lng + MAP_BOUNDS_DELTA],
  );
}

function clampMapZoom(zoom: number) {
  return Math.min(MAP_MAX_ZOOM, Math.max(MAP_MIN_ZOOM, zoom));
}

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

function newNoteId() {
  return `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
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

/**
 * Compara rótulo da área com nome da quadra.
 * Só match **exato** após normalizar (Quadra 1 / Q1 / "1" → "1").
 * NÃO usa includes: "1" batia em "11", "12", "15"… e finalizava quadras erradas.
 */
export function areaMatchesBlock(areaLabel: string, blockName: string) {
  const a = normalizeAreaKey(areaLabel || '');
  const b = normalizeAreaKey(blockName || '');
  if (!a || !b) return false;
  return a === b;
}

export function findAreaForBlock(areas: MapArea[], blockName: string) {
  if (!blockName?.trim() || areas.length === 0) return null;
  return areas.find((area) => areaMatchesBlock(area.label, blockName)) ?? null;
}

/**
 * Resolve seleção externa: **id da área primeiro** (único), depois rótulo (cards de não em casa).
 * Evita pegar sempre a primeira área quando duas têm o mesmo nome (ex.: “4” e “4”).
 */
export function resolveAreaByKey(areas: MapArea[], key?: string | null): MapArea | null {
  if (key == null || key === '' || areas.length === 0) return null;
  const byId = areas.find((a) => a.id === key);
  if (byId) return byId;
  return findAreaForBlock(areas, key);
}

export function findBlockForArea<T extends { name: string }>(blocks: T[], areaLabel: string) {
  return blocks.find((block) => areaMatchesBlock(areaLabel, block.name)) ?? null;
}

/** Próximo rótulo numérico livre (1, 2, 3…) — evita duplicar após apagar uma área no meio. */
export function nextAreaLabel(areas: MapArea[]): string {
  const used = new Set(
    areas
      .map((a) => normalizeAreaKey(a.label || ''))
      .filter(Boolean),
  );
  let n = 1;
  while (used.has(String(n))) n += 1;
  return String(n);
}

/**
 * Garante rótulo único entre áreas (exceto a própria).
 * Se “4” já existir, vira “4 (2)”, “4 (3)”, …
 */
export function uniqueAreaLabel(areas: MapArea[], areaId: string, desired: string): string {
  const base = (desired || '').trim() || nextAreaLabel(areas.filter((a) => a.id !== areaId));
  const others = areas.filter((a) => a.id !== areaId);
  const taken = (candidate: string) =>
    others.some((a) => normalizeAreaKey(a.label) === normalizeAreaKey(candidate));

  if (!taken(base)) return base;
  let n = 2;
  while (taken(`${base} (${n})`)) n += 1;
  return `${base} (${n})`;
}

/** Converte GeoJSON (Feature, FeatureCollection ou Polygon) → áreas com rótulo (ignora notas Point) */
export function parseGeoJsonToAreas(value?: string | null): MapArea[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);

    if (parsed?.type === 'FeatureCollection' && Array.isArray(parsed.features)) {
      return parsed.features
        .map((feature: {
          id?: string;
          properties?: { label?: string; name?: string; kind?: string };
          geometry?: { type?: string; coordinates?: number[][][] };
        }, index: number) => {
          if (feature?.geometry?.type && feature.geometry.type !== 'Polygon') return null;
          if (feature?.properties?.kind === 'note') return null;
          const ring = feature?.geometry?.coordinates?.[0];
          if (!ring || !Array.isArray(ring) || !Array.isArray(ring[0])) return null;
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

    if (parsed?.geometry?.type === 'Point' || parsed?.type === 'Point') return [];

    const ring =
      parsed?.geometry?.coordinates?.[0] ??
      (parsed?.type === 'Polygon' ? parsed.coordinates?.[0] : null);

    if (!Array.isArray(ring) || !Array.isArray(ring[0])) return [];
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

/** Notas / balões de atenção (GeoJSON Point com properties.kind = "note") */
export function parseGeoJsonToNotes(value?: string | null): MapNote[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (parsed?.type !== 'FeatureCollection' || !Array.isArray(parsed.features)) return [];

    return parsed.features
      .map((feature: {
        id?: string;
        properties?: { kind?: string; text?: string; note?: string; label?: string };
        geometry?: { type?: string; coordinates?: number[] };
      }, index: number) => {
        const isNote =
          feature?.properties?.kind === 'note' || feature?.geometry?.type === 'Point';
        if (!isNote || feature?.geometry?.type !== 'Point') return null;
        const coords = feature.geometry.coordinates;
        if (!Array.isArray(coords) || coords.length < 2) return null;
        const lng = Number(coords[0]);
        const lat = Number(coords[1]);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        const text = String(
          feature.properties?.text ?? feature.properties?.note ?? feature.properties?.label ?? '',
        );
        return {
          id: String(feature.id ?? `note-${index}`),
          position: [lat, lng] as LatLng,
          text,
        } satisfies MapNote;
      })
      .filter(Boolean) as MapNote[];
  } catch {
    return [];
  }
}

/** Compat: primeiro polígono (páginas antigas) */
export function parseGeoJsonToPoints(value?: string | null): LatLng[] {
  return parseGeoJsonToAreas(value)[0]?.points ?? [];
}

/** Serializa áreas (Polygon) + notas (Point) no mesmo FeatureCollection */
export function mapDataToGeoJson(areas: MapArea[], notes: MapNote[] = []): string | null {
  const areaFeatures = areas
    .filter((a) => a.points.length >= 3)
    .map((area) => ({
      type: 'Feature' as const,
      id: area.id,
      properties: {
        kind: 'area',
        label: area.label || 'Área',
        name: area.label || 'Área',
      },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [pointsToRing(area.points)],
      },
    }));

  const noteFeatures = notes
    .filter((n) => Number.isFinite(n.position[0]) && Number.isFinite(n.position[1]))
    .map((note) => ({
      type: 'Feature' as const,
      id: note.id,
      properties: {
        kind: 'note',
        text: note.text || '',
        label: note.text || 'Nota',
      },
      geometry: {
        type: 'Point' as const,
        coordinates: [note.position[1], note.position[0]],
      },
    }));

  const features = [...areaFeatures, ...noteFeatures];
  if (features.length === 0) return null;

  return JSON.stringify({
    type: 'FeatureCollection',
    features,
  });
}

export function areasToGeoJson(areas: MapArea[]): string | null {
  return mapDataToGeoJson(areas, []);
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

/**
 * Ícone redondo de atenção no mapa.
 * O texto só aparece no popup ao clicar (melhor UX — não polui o mapa).
 */
function NoteAttentionMarker({
  note,
  selected = false,
  interactive = true,
  showPopup = true,
  onSelect,
}: {
  note: MapNote;
  selected?: boolean;
  interactive?: boolean;
  /** Popup de leitura ao clicar (modo cartão / quando não está editando) */
  showPopup?: boolean;
  onSelect?: () => void;
}) {
  const text = (note.text || '').trim();

  const icon = useMemo(() => {
    const size = selected ? 40 : 34;
    const bg = selected ? '#b45309' : '#ea580c';
    const ring = selected ? '0 0 0 3px rgba(255,255,255,0.95), 0 0 0 6px rgba(234,88,12,0.45)' : '0 0 0 3px rgba(255,255,255,0.9)';
    return L.divIcon({
      className: 'territorio-map-note-pin',
      html: `<div style="
        width:${size}px;height:${size}px;border-radius:9999px;
        background:${bg};color:#fff;
        display:flex;align-items:center;justify-content:center;
        font-size:${selected ? 18 : 16}px;font-weight:800;line-height:1;
        box-shadow:${ring}, 0 4px 14px rgba(180,83,9,0.45);
        border:2px solid #fff;
        font-family:system-ui,-apple-system,Segoe UI,sans-serif;
        cursor:pointer;
      " title="Atenção">!</div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -(size / 2 + 4)],
    });
  }, [selected]);

  return (
    <Marker
      position={note.position}
      icon={icon}
      interactive={interactive}
      zIndexOffset={selected ? 1400 : 900}
      eventHandlers={
        onSelect
          ? {
              click: (e) => {
                L.DomEvent.stopPropagation(e);
                onSelect();
              },
            }
          : undefined
      }
    >
      {showPopup ? (
        <Popup className="territorio-note-popup" maxWidth={280} minWidth={160} closeButton>
          <div style={{ fontFamily: 'system-ui,-apple-system,Segoe UI,sans-serif' }}>
            <p
              style={{
                margin: 0,
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: '#b45309',
              }}
            >
              Atenção
            </p>
            <p
              style={{
                margin: '6px 0 0',
                fontSize: 14,
                fontWeight: 600,
                lineHeight: 1.35,
                color: '#1c1917',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {text || 'Sem comentário ainda.'}
            </p>
          </div>
        </Popup>
      ) : null}
    </Marker>
  );
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
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: MAP_MAX_ZOOM, animate: true });
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
  notes = [],
  draftPoints,
  centerLat,
  centerLng,
}: {
  token: number;
  areas: MapArea[];
  notes?: MapNote[];
  draftPoints: LatLng[];
  centerLat?: number | null;
  centerLng?: number | null;
}) {
  const map = useMap();
  const areasRef = useRef(areas);
  const notesRef = useRef(notes);
  const draftRef = useRef(draftPoints);
  const centerRef = useRef({ centerLat, centerLng });
  areasRef.current = areas;
  notesRef.current = notes;
  draftRef.current = draftPoints;
  centerRef.current = { centerLat, centerLng };

  useEffect(() => {
    if (token <= 0) return;

    const allPoints: LatLng[] = [
      ...areasRef.current.flatMap((a) => a.points),
      ...notesRef.current.map((n) => n.position),
      ...draftRef.current,
    ];

    if (allPoints.length >= 2) {
      const bounds = L.latLngBounds(allPoints.map(([lat, lng]) => L.latLng(lat, lng)));
      map.fitBounds(bounds, { padding: [48, 48], maxZoom: MAP_MAX_ZOOM, animate: true });
      return;
    }

    if (allPoints.length === 1) {
      map.setView(allPoints[0], clampMapZoom(MAP_DEFAULT_ZOOM + 1), { animate: true });
      return;
    }

    const { centerLat: lat, centerLng: lng } = centerRef.current;
    if (
      lat != null &&
      lng != null &&
      Number.isFinite(Number(lat)) &&
      Number.isFinite(Number(lng))
    ) {
      map.setView([Number(lat), Number(lng)], MAP_DEFAULT_ZOOM, { animate: true });
      return;
    }

    map.setView(DEFAULT_CENTER, MAP_MIN_ZOOM, { animate: true });
  }, [token, map]);

  return null;
}

/**
 * Voa até o GPS só quando o token muda (ligar GPS ou “voltar ao início”).
 * NÃO reage a cada tick do watchPosition — senão o mapa “gruda” e impede pan.
 */
function FlyToUserGps({
  position,
  token,
}: {
  position: LatLng | null;
  token: number;
}) {
  const map = useMap();
  const positionRef = useRef(position);
  positionRef.current = position;

  useEffect(() => {
    if (token <= 0) return;
    const pos = positionRef.current;
    if (!pos) return;
    map.flyTo(pos, clampMapZoom(Math.max(map.getZoom(), MAP_DEFAULT_ZOOM)), {
      animate: true,
      duration: 0.8,
    });
  }, [token, map]);
  return null;
}

/** Paleta para outros usuários online (eu = azul). */
const PEER_GPS_COLORS = [
  { bg: '#059669', ring: '#047857', dot: '#34d399' }, // verde
  { bg: '#d97706', ring: '#b45309', dot: '#fbbf24' }, // laranja
  { bg: '#7c3aed', ring: '#6d28d9', dot: '#a78bfa' }, // roxo
  { bg: '#db2777', ring: '#be185d', dot: '#f472b6' }, // rosa
  { bg: '#0891b2', ring: '#0e7490', dot: '#22d3ee' }, // ciano
] as const;

function peerColorForUserId(userId: number) {
  return PEER_GPS_COLORS[Math.abs(userId) % PEER_GPS_COLORS.length];
}

/**
 * Ponto GPS no mapa — pin + nome no balão.
 * `isSelf`: azul (você). Outros: cores por userId.
 */
function UserGpsMarker({
  position,
  name,
  isSelf = true,
  userId,
  subtitle,
}: {
  position: LatLng;
  name: string;
  isSelf?: boolean;
  userId?: number;
  subtitle?: string;
}) {
  const label = (name || (isSelf ? 'Você' : 'Usuário')).trim() || (isSelf ? 'Você' : 'Usuário');
  const colors = isSelf
    ? { bg: '#0284c7', ring: '#0284c7', dot: '#0ea5e9' }
    : peerColorForUserId(userId ?? 0);

  const icon = useMemo(() => {
    const approxWidth = Math.min(220, Math.max(72, label.length * 8 + 36));
    const height = 44;
    return L.divIcon({
      className: 'territorio-user-gps-marker',
      html: `<div style="
        display:flex;flex-direction:column;align-items:center;pointer-events:none;
        font-family:system-ui,-apple-system,Segoe UI,sans-serif;
      ">
        <div style="
          max-width:200px;padding:5px 10px 6px;border-radius:9999px;
          background:${colors.bg};color:#fff;border:2px solid #fff;
          font-size:12px;font-weight:800;line-height:1.2;
          box-shadow:0 4px 14px rgba(0,0,0,0.28),0 0 0 2px ${colors.ring}55;
          white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
        ">${escapeHtml(label)}</div>
        <div style="
          width:16px;height:16px;margin-top:4px;border-radius:9999px;
          background:${colors.dot};border:3px solid #fff;
          box-shadow:0 0 0 2px ${colors.ring},0 2px 8px rgba(0,0,0,0.25);
        "></div>
      </div>`,
      iconSize: [approxWidth, height + 20],
      iconAnchor: [approxWidth / 2, height + 18],
    });
  }, [label, colors.bg, colors.dot, colors.ring]);

  return (
    <Marker
      position={position}
      icon={icon}
      interactive={false}
      zIndexOffset={isSelf ? 1600 : 1500}
    >
      <Popup>
        <strong>{label}</strong>
        <br />
        <span style={{ fontSize: 12, color: '#64748b' }}>
          {subtitle ?? (isSelf ? 'Sua localização atual' : 'Online com GPS ativo')}
        </span>
      </Popup>
    </Marker>
  );
}

export type OnlineGpsUser = {
  userId: number;
  name: string;
  lat: number;
  lng: number;
  updatedAt: number;
};

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
    map.flyTo([result.lat, result.lng], MAP_MAX_ZOOM, { animate: true, duration: 0.8 });
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
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: MAP_MAX_ZOOM, animate: false });
      cameraLocked.current = true;
      return;
    }

    if (centerLat != null && centerLng != null) {
      map.setView([Number(centerLat), Number(centerLng)], MAP_DEFAULT_ZOOM, { animate: false });
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
      : 'bg-apple-surface text-apple-secondary hover:text-apple-ink border border-apple-line',
    danger: 'bg-apple-surface text-apple-red hover:bg-apple-red/10 border border-apple-red/25',
    success: 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700',
  };

  const tip = tooltipText(title);
  return (
    <button
      type="button"
      data-tooltip={tip}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-40 ${tones[tone]} ${
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
  /** Oculta a caixa de busca por endereço (ex.: visões de comparação) */
  hideSearch?: boolean;
  /** Oculta o contador de áreas no modo leitura (ex.: cabeçalho do Mapa & Imagem) */
  hideAreaCount?: boolean;
  /** Preenche a altura disponível do pai (flex) — usado em modais de comparação */
  fillHeight?: boolean;
  /**
   * Seleção externa: preferir **id** da área (único).
   * Aceita também rótulo/nome da quadra (cards de não em casa).
   */
  selectedKey?: string | null;
  /** Incrementar para reenquadrar a área selecionada no mapa */
  focusToken?: number;
  /** Clique em um polígono (modo leitura ou edição) */
  onAreaSelect?: (area: { id: string; label: string }) => void;
  /** Limpa o destaque (seleção) — botão dentro do mapa */
  onClearSelection?: () => void;
  /** Nomes de quadras finalizadas (não em casa 100%) — cor/balão no mapa */
  finishedKeys?: string[];
  /**
   * Incrementar ao reexibir o mapa (ex.: trocar aba Imagem → Mapa) para invalidateSize
   * sem desmontar o Leaflet/Google (evita novos requests de tiles).
   */
  resizeToken?: number;
};

function areaIsFinished(areaLabel: string, finishedKeys: string[]) {
  if (!finishedKeys.length) return false;
  // Apenas igualdade normalizada (nunca substring — evita 1 ≈ 11)
  return finishedKeys.some((key) => areaMatchesBlock(areaLabel, key));
}

export default function TerritoryMap({
  value,
  onChange,
  centerLat,
  centerLng,
  cepLabel,
  editable = true,
  heightClass = 'h-[28rem]',
  hideSearch = false,
  hideAreaCount = false,
  fillHeight = false,
  selectedKey = null,
  focusToken = 0,
  onAreaSelect,
  onClearSelection,
  finishedKeys = [],
  resizeToken = 0,
}: TerritoryMapProps) {
  const { user } = useAuth();
  const [areas, setAreas] = useState<MapArea[]>(() => parseGeoJsonToAreas(value));
  const [notes, setNotes] = useState<MapNote[]>(() => parseGeoJsonToNotes(value));
  const [draftPoints, setDraftPoints] = useState<LatLng[]>([]);
  /** Pilha de refazer (ordem LIFO: ponto do rascunho ou área removida) */
  const [redoStack, setRedoStack] = useState<
    Array<{ type: 'point'; point: LatLng } | { type: 'area'; area: MapArea }>
  >([]);
  /** false = mapa travado (só navegar); true = desenhar */
  const [drawMode, setDrawMode] = useState(false);
  /** true = próximo clique no mapa cria balão de atenção */
  const [noteMode, setNoteMode] = useState(false);
  /** true = áreas desenhadas em preto e branco (sem as cores da paleta) */
  const [bwAreas, setBwAreas] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  /** Rascunho do comentário enquanto edita (só grava no mapa ao “Salvar e fechar”) */
  const [noteDraft, setNoteDraft] = useState('');
  const [seedGeoJson, setSeedGeoJson] = useState<string | null>(() => value ?? null);
  const [mapHovered, setMapHovered] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  /** true enquanto o basemap ainda não carregou — mostra o loading sobre o mapa */
  const [mapReady, setMapReady] = useState(false);
  /** Incrementa a cada toggle de tela cheia para forçar invalidateSize no Leaflet */
  const [sizeToken, setSizeToken] = useState(0);
  /** fullscreen + reexibir aba (sem desmontar) */
  const layoutToken = sizeToken + resizeToken;
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

  /** Minha localização (GPS) — toggle no mapa */
  const [gpsEnabled, setGpsEnabled] = useState(false);
  const [gpsPosition, setGpsPosition] = useState<LatLng | null>(null);
  const [gpsError, setGpsError] = useState('');
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsFlyToken, setGpsFlyToken] = useState(0);
  const gpsWatchIdRef = useRef<number | null>(null);
  /** Outros usuários logados com GPS ativo (presença no servidor) */
  const [onlineGpsUsers, setOnlineGpsUsers] = useState<OnlineGpsUser[]>([]);
  const lastPresencePublishRef = useRef<number>(0);
  const gpsPositionRef = useRef<LatLng | null>(null);
  gpsPositionRef.current = gpsPosition;

  /** Rota mais curta GPS → quadra (área) mais próxima */
  const [routePath, setRoutePath] = useState<LatLng[] | null>(null);
  const [routeDest, setRouteDest] = useState<LatLng | null>(null);
  const [routeAreaLabel, setRouteAreaLabel] = useState<string | null>(null);
  const [routeAreaId, setRouteAreaId] = useState<string | null>(null);
  const [routeDistanceM, setRouteDistanceM] = useState<number | null>(null);
  const [routeDurationS, setRouteDurationS] = useState<number | null>(null);
  const [routeFromRouter, setRouteFromRouter] = useState(false);
  const [routeLoading, setRouteLoading] = useState(false);
  const lastRouteGpsRef = useRef<LatLng | null>(null);
  const routeAbortRef = useRef<AbortController | null>(null);

  const drawingLocally = useRef(false);
  const seededFromServer = useRef(
    Boolean(
      value && (parseGeoJsonToAreas(value).length > 0 || parseGeoJsonToNotes(value).length > 0),
    ),
  );
  const addressBoxRef = useRef<HTMLDivElement>(null);

  function toggleFullscreen() {
    setIsFullscreen((prev) => !prev);
    setSizeToken((t) => t + 1);
  }

  /**
   * Mesmo botão, comportamento depende do GPS:
   * - GPS ativo → volta ao ponto da localização
   * - GPS off → enquadra as quadras/áreas do território
   */
  function fitToStart() {
    if (gpsEnabled && gpsPosition) {
      setGpsFlyToken((t) => t + 1);
      return;
    }
    setFitAreasToken((t) => t + 1);
  }

  function clearSelection() {
    setSelectedId(null);
    setSelectedNoteId(null);
    setNoteDraft('');
    onClearSelection?.();
  }

  function stopGpsWatch() {
    if (gpsWatchIdRef.current != null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(gpsWatchIdRef.current);
      gpsWatchIdRef.current = null;
    }
  }

  function clearRoute() {
    routeAbortRef.current?.abort();
    routeAbortRef.current = null;
    setRoutePath(null);
    setRouteDest(null);
    setRouteAreaLabel(null);
    setRouteAreaId(null);
    setRouteDistanceM(null);
    setRouteDurationS(null);
    setRouteFromRouter(false);
    setRouteLoading(false);
    lastRouteGpsRef.current = null;
  }

  function disableGps() {
    stopGpsWatch();
    setGpsEnabled(false);
    setGpsPosition(null);
    setGpsError('');
    setGpsLoading(false);
    clearRoute();
    // Remove presença no mapa dos outros
    void api('/api/presence/gps', { method: 'DELETE' }).catch(() => {});
  }

  function enableGps() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsError('Seu navegador não suporta geolocalização.');
      setGpsEnabled(false);
      return;
    }

    setGpsEnabled(true);
    setGpsLoading(true);
    setGpsError('');

    // Só voa na 1ª leitura ao ativar — depois o mapa fica livre para pan/zoom
    let firstFix = true;
    const onOk = (pos: GeolocationPosition) => {
      const next: LatLng = [pos.coords.latitude, pos.coords.longitude];
      setGpsPosition(next);
      setGpsLoading(false);
      setGpsError('');
      if (firstFix) {
        firstFix = false;
        setGpsFlyToken((t) => t + 1);
      }
    };

    const onErr = (err: GeolocationPositionError) => {
      setGpsLoading(false);
      setGpsPosition(null);
      setGpsEnabled(false);
      stopGpsWatch();
      if (err.code === err.PERMISSION_DENIED) {
        setGpsError(
          'Localização negada. Ative a localização do aparelho e permita o acesso neste site.',
        );
      } else if (err.code === err.POSITION_UNAVAILABLE) {
        setGpsError('Posição indisponível. Verifique se a localização do aparelho está ligada.');
      } else if (err.code === err.TIMEOUT) {
        setGpsError('Tempo esgotado ao obter a localização. Tente de novo.');
      } else {
        setGpsError('Não foi possível obter sua localização.');
      }
    };

    const opts: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 10000,
    };

    // Leitura inicial + acompanhamento enquanto o toggle estiver ativo
    navigator.geolocation.getCurrentPosition(onOk, onErr, opts);
    stopGpsWatch();
    gpsWatchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsPosition([pos.coords.latitude, pos.coords.longitude]);
        setGpsLoading(false);
        setGpsError('');
      },
      onErr,
      opts,
    );
  }

  function toggleGps() {
    if (gpsEnabled) {
      disableGps();
    } else {
      enableGps();
    }
  }

  // Limpa watch + presença ao desmontar
  useEffect(() => {
    return () => {
      stopGpsWatch();
      routeAbortRef.current?.abort();
      // keepalive: tenta avisar o servidor mesmo se a aba fechar
      try {
        void fetch('/api/presence/gps', {
          method: 'DELETE',
          credentials: 'include',
          keepalive: true,
        });
      } catch {
        /* ignore */
      }
    };
  }, []);

  /**
   * Publica a própria posição no servidor enquanto o GPS estiver ativo.
   * Intervalo fixo (~8s) + publicação imediata ao ligar (via ref da posição).
   */
  useEffect(() => {
    if (!gpsEnabled || !user?.id) return;

    const publish = (force = false) => {
      const pos = gpsPositionRef.current;
      if (!pos) return;
      const now = Date.now();
      if (!force && now - lastPresencePublishRef.current < 7500) return;
      lastPresencePublishRef.current = now;
      void api('/api/presence/gps', {
        method: 'PUT',
        body: JSON.stringify({ lat: pos[0], lng: pos[1] }),
      }).catch(() => {
        /* silencioso: mapa local continua */
      });
    };

    // Tenta logo e de novo após o 1º fix do navegador
    publish(true);
    const boot = window.setTimeout(() => publish(true), 1500);
    const id = window.setInterval(() => publish(false), 8000);
    return () => {
      window.clearTimeout(boot);
      window.clearInterval(id);
    };
  }, [gpsEnabled, user?.id]);

  // Quando a posição muda, tenta publicar (respeitando throttle)
  useEffect(() => {
    if (!gpsEnabled || !gpsPosition || !user?.id) return;
    const now = Date.now();
    if (now - lastPresencePublishRef.current < 7500) return;
    lastPresencePublishRef.current = now;
    void api('/api/presence/gps', {
      method: 'PUT',
      body: JSON.stringify({ lat: gpsPosition[0], lng: gpsPosition[1] }),
    }).catch(() => {});
  }, [gpsEnabled, gpsPosition, user?.id]);

  /**
   * Busca usuários online com GPS (todos veem no mapa, mesmo sem GPS próprio).
   */
  useEffect(() => {
    let cancelled = false;

    const pull = async () => {
      try {
        const data = await api<{ users: OnlineGpsUser[] }>('/api/presence/gps');
        if (cancelled) return;
        setOnlineGpsUsers(Array.isArray(data.users) ? data.users : []);
      } catch {
        if (!cancelled) setOnlineGpsUsers([]);
      }
    };

    void pull();
    const id = window.setInterval(() => void pull(), 6000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  /**
   * Com GPS ativo: encontra a quadra (área) mais próxima e traça a rota de carro mais curta (OSRM driving).
   * Só recalcula se o usuário se moveu ~40 m ou se as áreas mudaram.
   */
  useEffect(() => {
    if (!gpsEnabled || !gpsPosition) {
      return;
    }

    const validAreas = areas.filter((a) => a.points.length >= 3);
    if (validAreas.length === 0) {
      clearRoute();
      return;
    }

    const nearest = findNearestArea(gpsPosition as LatLngTuple, validAreas);
    if (!nearest) {
      clearRoute();
      return;
    }

    const last = lastRouteGpsRef.current;
    const movedEnough =
      !last ||
      Math.hypot(gpsPosition[0] - last[0], gpsPosition[1] - last[1]) * 111_320 > 40 ||
      routeAreaId !== nearest.area.id;

    if (!movedEnough && routePath && routePath.length >= 2) {
      return;
    }

    const ac = new AbortController();
    routeAbortRef.current?.abort();
    routeAbortRef.current = ac;
    setRouteLoading(true);

    void (async () => {
      try {
        const route = await fetchShortestDrivingRoute(
          gpsPosition as LatLngTuple,
          nearest.dest as LatLngTuple,
          ac.signal,
        );
        if (ac.signal.aborted) return;
        lastRouteGpsRef.current = gpsPosition;
        setRoutePath(route.path);
        setRouteDest(nearest.dest);
        setRouteAreaLabel(nearest.area.label || 'Quadra');
        setRouteAreaId(nearest.area.id);
        setRouteDistanceM(route.distanceM);
        setRouteDurationS(route.durationS);
        setRouteFromRouter(route.fromRouter);
      } catch {
        if (ac.signal.aborted) return;
        // mantém última rota se houver
      } finally {
        if (!ac.signal.aborted) setRouteLoading(false);
      }
    })();

    return () => {
      ac.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- movedEnough usa refs/estado de rota de propósito
  }, [gpsEnabled, gpsPosition, areas]);

  function goToAddress(hit: AddressHit) {
    setSearchPin(hit);
    setAddressQuery(hit.label);
    setAddressHits([]);
    setAddressOpen(false);
    setAddressError('');
    setSearchFlyToken((t) => t + 1);
  }

  async function searchAddress() {
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

  // Segurança: nunca deixa o loading cobrir o mapa para sempre (rede/erro silencioso)
  useEffect(() => {
    const t = window.setTimeout(() => setMapReady(true), 30000);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (drawingLocally.current || seededFromServer.current) return;
    const parsed = parseGeoJsonToAreas(value);
    const parsedNotes = parseGeoJsonToNotes(value);
    if (parsed.length > 0 || parsedNotes.length > 0) {
      setAreas(parsed);
      setNotes(parsedNotes);
      setSeedGeoJson(value ?? null);
      seededFromServer.current = true;
      // Em edição: pré-seleciona a 1ª área. Em leitura: só destaca quando o usuário escolher.
      if (editable && !selectedKey) {
        setSelectedId(parsed[0]?.id ?? null);
      }
    }
  }, [value, selectedKey, editable]);

  // Seleção externa: id único primeiro; rótulo só como fallback (cards)
  const selectedFromKey = useMemo(
    () => resolveAreaByKey(areas, selectedKey),
    [selectedKey, areas],
  );

  const selectedById = useMemo(
    () => (selectedId ? areas.find((a) => a.id === selectedId) ?? null : null),
    [areas, selectedId],
  );

  // Mantém selectedId alinhado ao card externo quando a chave ainda existe no mapa.
  // Se a área foi apagada (chave órfã), NÃO zera selectedId — senão some o campo de nome.
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
  const mapStartZoom = cepCenter ? MAP_DEFAULT_ZOOM : MAP_MIN_ZOOM;
  const boundsLat = cepCenter?.[0];
  const boundsLng = cepCenter?.[1];
  const mapBounds = useMemo(() => {
    if (boundsLat == null || boundsLng == null) return undefined;
    return mapCityBounds(boundsLat, boundsLng);
  }, [boundsLat, boundsLng]);

  /**
   * Prioriza match do card (selectedKey). Se a chave ficou órfã (área apagada/renomeada),
   * cai no selectedId local — senão o input “Nome da área” some e o chip parece “morto”.
   */
  const selected =
    selectedKey != null && selectedKey !== ''
      ? (selectedFromKey ?? selectedById)
      : selectedById;
  const selectedNote = notes.find((n) => n.id === selectedNoteId) ?? null;
  const areaReady = areas.some((a) => a.points.length >= 3);

  function syncExternalSelection(area: MapArea | null) {
    if (area) {
      onAreaSelect?.({ id: area.id, label: area.label });
    } else {
      onClearSelection?.();
    }
  }

  function selectArea(area: MapArea) {
    setSelectedId(area.id);
    setSelectedNoteId(null);
    setNoteDraft('');
    setNoteMode(false);
    syncExternalSelection(area);
  }

  function selectNote(note: MapNote) {
    setSelectedNoteId(note.id);
    setNoteDraft(note.text ?? '');
    setSelectedId(null);
    setNoteMode(false);
    setDrawMode(false);
  }

  function emit(nextAreas: MapArea[], nextNotes?: MapNote[]) {
    drawingLocally.current = true;
    setAreas(nextAreas);
    const notesToSave = nextNotes ?? notes;
    if (nextNotes) setNotes(nextNotes);
    onChange?.(mapDataToGeoJson(nextAreas, notesToSave));
  }

  function emitNotes(nextNotes: MapNote[]) {
    emit(areas, nextNotes);
  }

  function setDrawModeOn() {
    if (!editable) return;
    setDrawMode(true);
    setNoteMode(false);
    setSelectedNoteId(null);
  }

  function setDrawModeOff() {
    setDrawMode(false);
    setNoteMode(false);
    // se estava no meio de um desenho incompleto, descarta rascunho
    if (draftPoints.length > 0 && draftPoints.length < 3) {
      setDraftPoints([]);
      setRedoStack([]);
    }
  }

  function setNoteModeOn() {
    if (!editable) return;
    setNoteMode(true);
    setDrawMode(false);
    setSelectedId(null);
    if (draftPoints.length > 0 && draftPoints.length < 3) {
      setDraftPoints([]);
      setRedoStack([]);
    }
  }

  function setNoteModeOff() {
    setNoteMode(false);
  }

  function placeNote(point: LatLng) {
    if (!editable || !noteMode) return;
    const note: MapNote = {
      id: newNoteId(),
      position: point,
      text: '',
    };
    const next = [...notes, note];
    emitNotes(next);
    setSelectedNoteId(note.id);
    setNoteDraft('');
    setNoteMode(false);
  }

  function saveAndCloseNote() {
    if (!selectedNoteId) return;
    const text = noteDraft;
    emitNotes(notes.map((n) => (n.id === selectedNoteId ? { ...n, text } : n)));
    setSelectedNoteId(null);
    setNoteDraft('');
  }

  function cancelNoteEdit() {
    setSelectedNoteId(null);
    setNoteDraft('');
  }

  function removeSelectedNote() {
    if (!selectedNoteId || !editable) return;
    const note = notes.find((n) => n.id === selectedNoteId);
    const label = (noteDraft || note?.text || '').trim();
    confirmToast({
      title: 'Remover atenção',
      description: label
        ? `Remover o aviso “${label.slice(0, 60)}${label.length > 60 ? '…' : ''}”?`
        : 'Remover este ponto de atenção do mapa?',
      confirmLabel: 'Remover',
      tone: 'danger',
      onConfirm: () => {
        emitNotes(notes.filter((n) => n.id !== selectedNoteId));
        setSelectedNoteId(null);
        setNoteDraft('');
      },
    });
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
      const nextSel = next[next.length - 1] ?? null;
      setSelectedId(nextSel?.id ?? null);
      syncExternalSelection(nextSel);
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
    syncExternalSelection(entry.area);
  }

  function finishArea() {
    if (!editable || draftPoints.length < 3) return;
    // id estável + rótulo numérico livre (nunca colide com outra área)
    const id = newId();
    const label = nextAreaLabel(areas);
    const area: MapArea = {
      id,
      points: draftPoints,
      label,
    };
    const next = [...areas, area];
    emit(next);
    setDraftPoints([]);
    setRedoStack([]);
    setSelectedId(id);
    syncExternalSelection(area);
    setDrawMode(false);
  }

  function clearAll() {
    if (!editable) return;
    if (areas.length === 0 && draftPoints.length === 0 && notes.length === 0) return;

    confirmToast({
      title: 'Apagar todas as áreas e notas',
      description:
        'Todas as áreas e balões de atenção do mapa serão removidos. Essa ação não pode ser desfeita (até você salvar de novo). Deseja continuar?',
      confirmLabel: 'Apagar tudo',
      tone: 'danger',
      onConfirm: () => {
        setDraftPoints([]);
        setRedoStack([]);
        setSelectedId(null);
        setSelectedNoteId(null);
        emit([], []);
        syncExternalSelection(null);
        setDrawMode(false);
        setNoteMode(false);
      },
    });
  }

  function updateSelectedLabel(rawLabel: string) {
    if (!selectedId) return;
    // Mantém o que o usuário digita; ao sair do campo (blur) normalizamos unicidade.
    // Aqui só grava o texto e seleciona por **id** (não por nome) no pai.
    const next = areas.map((a) => (a.id === selectedId ? { ...a, label: rawLabel } : a));
    emit(next);
    onAreaSelect?.({ id: selectedId, label: rawLabel });
  }

  function commitSelectedLabel() {
    if (!selectedId) return;
    const current = areas.find((a) => a.id === selectedId);
    if (!current) return;
    const unique = uniqueAreaLabel(areas, selectedId, current.label);
    if (unique === current.label) return;
    const next = areas.map((a) => (a.id === selectedId ? { ...a, label: unique } : a));
    emit(next);
    onAreaSelect?.({ id: selectedId, label: unique });
  }

  function removeSelected() {
    if (!selectedId || !editable) return;

    const label = selected?.label?.trim() || 'esta área';

    confirmToast({
      title: 'Remover área selecionada',
      description: `A área “${label}” será removida do mapa. Deseja continuar?`,
      confirmLabel: 'Remover',
      tone: 'danger',
      onConfirm: () => {
        const next = areas.filter((a) => a.id !== selectedId);
        emit(next);
        const nextSel = next[0] ?? null;
        setSelectedId(nextSel?.id ?? null);
        syncExternalSelection(nextSel);
        setRedoStack([]);
      },
    });
  }

  return (
    <div
      className={
        isFullscreen
          ? 'fixed inset-0 z-[9000] flex flex-col gap-3 bg-slate-100 p-3 dark:bg-slate-900 sm:p-4'
          : fillHeight
            ? 'flex h-full min-h-0 flex-col gap-3'
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
            title="Mapa travado — só navegar"
            active={!drawMode && !noteMode}
            onClick={setDrawModeOff}
          >
            <IconLock />
          </ToolButton>

          <ToolButton
            title="Desenhar área no mapa"
            active={drawMode && !noteMode}
            onClick={setDrawModeOn}
          >
            <IconPencil />
          </ToolButton>

          <ToolButton
            title="Colocar aviso de atenção"
            active={noteMode}
            onClick={() => (noteMode ? setNoteModeOff() : setNoteModeOn())}
          >
            <IconNote />
          </ToolButton>

          <ToolButton
            title="Concluir área (mín. 3 pontos)"
            tone="success"
            disabled={draftPoints.length < 3}
            onClick={finishArea}
          >
            <IconCheck />
          </ToolButton>

          <ToolButton
            title="Desfazer ponto ou área"
            disabled={draftPoints.length === 0 && areas.length === 0}
            onClick={undoPoint}
          >
            <IconUndo className="h-5 w-5" />
          </ToolButton>

          <ToolButton
            title="Refazer ponto ou área"
            disabled={redoStack.length === 0}
            onClick={redoPoint}
          >
            <IconRedo className="h-5 w-5" />
          </ToolButton>

          <ToolButton
            title="Apagar áreas e notas"
            tone="danger"
            disabled={areas.length === 0 && draftPoints.length === 0 && notes.length === 0}
            onClick={() => void clearAll()}
          >
            <IconTrash />
          </ToolButton>

          <div className="ml-1 hidden h-6 w-px bg-slate-300 sm:block" />

          <p className="text-xs text-slate-600 sm:text-sm">
            {noteMode ? (
              <>
                <span className="font-semibold text-amber-700">Atenção</span>
                {' — clique no mapa para colocar o ícone de aviso.'}
              </>
            ) : drawMode ? (
              <>
                <span className="font-semibold text-sky-700">Desenhando</span>
                {draftPoints.length < 3
                  ? ` — faltam ${3 - draftPoints.length} ponto(s), depois use ✓`
                  : ' — use ✓ para fechar a área'}
              </>
            ) : (
              <>
                <span className="font-semibold text-slate-800">Mapa travado</span>
                {' — lápis = área · ! = aviso (clique no ícone para ler).'}
              </>
            )}
          </p>
        </div>
      ) : null}

      {/* Diálogo de edição da nota — só quando um ícone está selecionado */}
      {editable && selectedNote ? (
        <div
          className={`rounded-xl border border-amber-300 bg-amber-50 p-4 shadow-sm dark:border-amber-500/35 dark:bg-amber-500/10 ${
            isFullscreen ? 'shrink-0' : ''
          }`}
          role="dialog"
          aria-labelledby="note-edit-title"
        >
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-950 dark:text-amber-50">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-orange-600 text-sm font-extrabold text-white shadow">
              !
            </span>
            <span id="note-edit-title">Comentário de atenção</span>
          </div>
          <textarea
            key={selectedNote.id}
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            placeholder="Ex.: Cão no fundo, portão trancado, cuidado com a rampa…"
            rows={3}
            autoFocus
            className="mb-3 w-full resize-y rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-amber-500/40 dark:bg-apple-surface dark:text-apple-ink"
          />
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={cancelNoteEdit}
              data-tooltip="Cancelar"
              aria-label="Cancelar edição"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-apple-line bg-apple-surface text-apple-secondary transition hover:bg-apple-fill hover:text-apple-ink"
            >
              <IconX className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => void removeSelectedNote()}
              data-tooltip="Remover"
              aria-label="Remover nota"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-apple-red/25 bg-apple-surface text-apple-red transition hover:bg-apple-red/10"
            >
              <IconTrash className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={saveAndCloseNote}
              data-tooltip="Salvar e fechar"
              aria-label="Salvar e fechar"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm transition hover:bg-emerald-700"
            >
              <IconCheck className="h-5 w-5" />
            </button>
          </div>
        </div>
      ) : null}

      {/* Nome da área — acima do mapa para não precisar rolar “através” do zoom */}
      {editable && areas.length > 0 ? (
        <div
          className={`rounded-xl border border-apple-line bg-apple-surface p-3 ${
            isFullscreen ? 'max-h-40 shrink-0 overflow-y-auto shadow-sm' : ''
          }`}
        >
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-apple-ink">
            <IconTag className="h-4 w-4 text-sky-600" />
            Nome / texto da área no mapa
          </div>

          <div className="mb-3 flex flex-wrap gap-2">
            {areas.map((area, index) => {
              const palette = AREA_COLORS[index % AREA_COLORS.length];
              const isChipSelected = selected != null && area.id === selected.id;
              return (
                <button
                  key={area.id}
                  type="button"
                  onClick={() => selectArea(area)}
                  className={`rounded-full px-3 py-1 text-sm font-semibold ${
                    isChipSelected
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
                key={selected.id}
                value={selected.label}
                onChange={(e) => updateSelectedLabel(e.target.value)}
                onBlur={() => commitSelectedLabel()}
                placeholder="Ex: 1, Quadra A, Norte…"
                className="w-full rounded-lg border border-apple-line bg-apple-surface px-3 py-2 text-sm text-apple-ink placeholder:text-apple-tertiary"
                autoComplete="off"
                title="Se o nome já existir em outra área, será ajustado para ficar único (ex.: 4 → 4 (2))"
              />
              <button
                type="button"
                onClick={() => void removeSelected()}
                data-tooltip="Remover área"
                aria-label="Remover área"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-apple-red/25 bg-apple-surface text-apple-red transition hover:bg-apple-red/10"
              >
                <IconTrash className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <p className="text-sm text-apple-secondary">
              Selecione uma área (chip ou clique no mapa) para nomear.
            </p>
          )}
        </div>
      ) : null}

      {/* Busca por endereço — div (não form) p/ não quebrar em páginas com form pai (Novo/Editar) */}
      {!hideSearch ? (
      <div ref={addressBoxRef} className={`relative w-full ${isFullscreen ? 'shrink-0' : ''}`}>
        <div className="flex overflow-hidden rounded-xl border border-apple-line bg-apple-surface shadow-soft">
          <label htmlFor="map-address-search" className="sr-only">
            Buscar endereço no mapa
          </label>
          <span className="pointer-events-none flex items-center pl-3 text-apple-tertiary">
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
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                void searchAddress();
              }
            }}
            placeholder="Buscar rua, bairro, cidade ou CEP…"
            className="min-w-0 flex-1 border-0 bg-transparent px-2 py-2.5 text-sm text-apple-ink outline-none placeholder:text-apple-tertiary"
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
              className="inline-flex h-10 w-9 shrink-0 items-center justify-center text-apple-tertiary hover:bg-apple-fill hover:text-apple-ink"
            >
              <IconX className="h-4 w-4" />
            </button>
          ) : null}
          <button
            type="button"
            data-tooltip="Buscar endereço"
            aria-label="Buscar endereço"
            disabled={addressSearching}
            onClick={() => void searchAddress()}
            className="inline-flex h-10 w-11 shrink-0 items-center justify-center border-l border-apple-line bg-apple-blue text-white transition hover:bg-apple-blue-hover disabled:opacity-60"
          >
            <IconSearch className="h-4 w-4" />
          </button>
        </div>

        {addressError ? (
          <p className="mt-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-800 dark:text-amber-200">
            {addressError}
          </p>
        ) : null}

        {addressOpen && addressHits.length > 0 ? (
          <ul className="absolute left-0 right-0 z-[30] mt-1 max-h-52 overflow-y-auto rounded-xl border border-apple-line bg-apple-surface py-1 shadow-float">
            {addressHits.map((hit, index) => (
              <li key={`${hit.lat}-${hit.lng}-${index}`}>
                <button
                  type="button"
                  onClick={() => goToAddress(hit)}
                  className="flex w-full items-start gap-2 px-3 py-2 text-left text-xs text-apple-ink hover:bg-apple-blue/10 hover:text-apple-blue"
                >
                  <IconSearch className="mt-0.5 h-3.5 w-3.5 shrink-0 text-apple-tertiary" />
                  <span className="line-clamp-2">{hit.label}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {searchPin && !addressOpen ? (
          <p className="mt-1.5 truncate rounded-lg border border-apple-blue/25 bg-apple-blue/10 px-2.5 py-1.5 text-[11px] font-medium text-apple-blue">
            📍 {searchPin.label}
          </p>
        ) : null}
      </div>
      ) : null}

      <div
        className={`relative z-0 isolate w-full overflow-hidden rounded-xl border border-apple-line bg-apple-surface ${
          isFullscreen || fillHeight ? 'min-h-0 flex-1' : heightClass
        } ${
          noteMode
            ? 'ring-2 ring-amber-500/60'
            : drawMode
              ? 'ring-2 ring-apple-blue/60'
              : selected || selectedNote
                ? 'ring-2 ring-apple-blue/40'
                : ''
        }`}
        onMouseEnter={() => setMapHovered(true)}
        onMouseLeave={() => setMapHovered(false)}
      >
        {/* Chip flutuante: reforço visual fixo no canto (além do balão no centróide) */}
        {selected && !drawMode ? (
          <div className="pointer-events-none absolute left-3 top-3 z-[1000] max-w-[min(100%-1.5rem,18rem)]">
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

        {/* Controles acima do Leaflet (z~200–700), contidos por isolate no pai — não cobrem o header sticky */}
        <div className="absolute right-3 top-3 z-[1000] flex flex-col gap-2">
          <button
            type="button"
            data-tooltip={tooltipText(
              bwAreas ? 'Áreas coloridas' : 'Áreas em preto e branco',
            )}
            data-tooltip-side="left"
            aria-label={bwAreas ? 'Mostrar áreas coloridas' : 'Mostrar áreas em preto e branco'}
            aria-pressed={bwAreas}
            onClick={() => setBwAreas((v) => !v)}
            className={[
              'inline-flex h-10 w-10 items-center justify-center rounded-full border shadow-md transition',
              bwAreas
                ? 'border-apple-line bg-apple-surface text-apple-ink hover:bg-apple-fill'
                : 'border-apple-blue/30 bg-apple-blue/10 text-apple-blue hover:bg-apple-blue/15',
            ].join(' ')}
          >
            {bwAreas ? <IconContrast className="h-5 w-5" /> : <IconPalette className="h-5 w-5" />}
          </button>
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
            data-tooltip={tooltipText(
              gpsEnabled && gpsPosition ? 'Voltar à minha localização' : 'Enquadrar áreas do mapa',
            )}
            data-tooltip-side="left"
            aria-label={
              gpsEnabled && gpsPosition
                ? 'Voltar à minha localização'
                : 'Voltar ao início e enquadrar as áreas'
            }
            onClick={fitToStart}
            className={[
              'inline-flex h-10 w-10 items-center justify-center rounded-full border shadow-md transition',
              gpsEnabled && gpsPosition
                ? 'border-sky-500/40 bg-sky-50 text-sky-700 hover:bg-sky-100 dark:bg-sky-500/15 dark:text-sky-200 dark:hover:bg-sky-500/25'
                : 'border-apple-line bg-apple-surface text-apple-ink hover:bg-apple-fill',
            ].join(' ')}
          >
            <IconFocusAreas />
          </button>
          <button
            type="button"
            data-tooltip={tooltipText(
              gpsEnabled ? 'Desativar minha localização' : 'Ativar minha localização (GPS)',
            )}
            data-tooltip-side="left"
            aria-label={gpsEnabled ? 'Desativar minha localização' : 'Ativar minha localização'}
            aria-pressed={gpsEnabled}
            disabled={gpsLoading}
            onClick={toggleGps}
            className={[
              'inline-flex h-10 w-10 items-center justify-center rounded-full border shadow-md transition',
              gpsEnabled
                ? 'border-sky-500/40 bg-sky-600 text-white hover:bg-sky-700'
                : 'border-apple-line bg-apple-surface text-apple-ink hover:bg-apple-fill',
              gpsLoading ? 'opacity-60' : '',
            ].join(' ')}
          >
            {gpsLoading ? (
              <span
                className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                aria-hidden
              />
            ) : (
              <IconLocate className="h-5 w-5" />
            )}
          </button>
          {selected && !drawMode ? (
            <button
              type="button"
              data-tooltip="Limpar destaque"
              data-tooltip-side="left"
              aria-label="Limpar destaque da área"
              onClick={clearSelection}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-apple-blue/30 bg-apple-blue/10 text-apple-blue shadow-md transition hover:bg-apple-blue/15"
            >
              <IconX />
            </button>
          ) : null}
        </div>

        {gpsError ? (
          <div className="absolute bottom-3 left-3 right-14 z-[1000] rounded-lg border border-amber-500/35 bg-amber-50 px-3 py-2 text-[12px] font-medium text-amber-900 shadow-md dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-100">
            {gpsError}
          </div>
        ) : null}

        {gpsEnabled && !gpsError && (routeAreaLabel || routeLoading) ? (
          <div className="absolute bottom-3 left-3 right-14 z-[1000] rounded-lg border border-sky-500/30 bg-sky-600 px-3 py-2 text-[12px] font-semibold text-white shadow-md">
            {routeLoading && !routePath ? (
              <span>Calculando rota de carro até a quadra mais próxima…</span>
            ) : routeAreaLabel ? (
              <span>
                Rota de carro até a quadra <strong>{routeAreaLabel}</strong>
                {routeDistanceM != null ? ` · ${formatRouteDistance(routeDistanceM)}` : ''}
                {routeDurationS != null && routeDurationS > 0
                  ? ` · ${formatRouteDuration(routeDurationS)} de carro`
                  : ''}
                {!routeFromRouter && routePath ? ' · linha reta (sem rede de vias)' : ''}
                {routeLoading ? ' · atualizando…' : ''}
              </span>
            ) : null}
          </div>
        ) : null}

        <MapContainer
          center={mapStartCenter}
          zoom={mapStartZoom}
          minZoom={MAP_MIN_ZOOM}
          maxZoom={MAP_MAX_ZOOM}
          maxBounds={mapBounds}
          maxBoundsViscosity={1}
          scrollWheelZoom={false}
          className="h-full w-full"
        >
          <ScrollWheelOnHover enabled={mapHovered || isFullscreen} />
          <InvalidateSizeOn token={layoutToken} />
          <FitToAreasOn
            token={fitAreasToken}
            areas={areas}
            notes={notes}
            draftPoints={draftPoints}
            centerLat={centerLat}
            centerLng={centerLng}
          />
          <FlyToSearchResult result={searchPin} token={searchFlyToken} />
          <FlyToUserGps position={gpsEnabled ? gpsPosition : null} token={gpsFlyToken} />
          <FocusOnSelected area={selected} focusToken={focusToken} />
          <GoogleMapsTileLayer type="roadmap" onReady={() => setMapReady(true)} />

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

            if (bwAreas) {
              // Modo preto e branco: mesma gradação de cinza em todos os estados
              color = isSelected ? '#374151' : '#64748b';
              fillColor = isSelected ? '#9ca3af' : '#cbd5e1';
              fillOpacity = isSelected ? 0.55 : 0.34;
              weight = isSelected ? 5 : 2.5;
              opacity = isSelected ? 1 : 0.85;
              dashArray = dimOthers ? '5 7' : undefined;
            } else if (isFinished && (isSelected || !dimOthers)) {
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

          {notes.map((note) => (
            <NoteAttentionMarker
              key={note.id}
              note={note}
              selected={note.id === selectedNoteId}
              interactive={!drawMode && !noteMode}
              /* Em edição com painel aberto: sem popup; no cartão/leitura: popup ao clicar */
              showPopup={!editable || note.id !== selectedNoteId}
              onSelect={() => {
                if (drawMode || noteMode) return;
                if (editable) {
                  selectNote(note);
                }
                /* leitura: o Popup do Leaflet abre sozinho no clique */
              }}
            />
          ))}

          {gpsEnabled && gpsPosition ? (
            <UserGpsMarker
              position={gpsPosition}
              name={user?.name?.trim() || 'Você'}
              isSelf
              userId={user?.id}
            />
          ) : null}

          {/* Outros usuários logados com GPS ativo */}
          {onlineGpsUsers
            .filter((u) => u.userId !== user?.id)
            .map((u) => (
              <UserGpsMarker
                key={u.userId}
                position={[u.lat, u.lng]}
                name={u.name}
                isSelf={false}
                userId={u.userId}
                subtitle="Online com GPS ativo"
              />
            ))}

          {gpsEnabled && routePath && routePath.length >= 2 ? (
            <Polyline
              positions={routePath}
              pathOptions={{
                color: '#0284c7',
                weight: 5,
                opacity: 0.9,
                lineJoin: 'round',
                lineCap: 'round',
                dashArray: routeFromRouter ? undefined : '8 10',
              }}
            />
          ) : null}

          {gpsEnabled && routeDest ? (
            <CircleMarker
              center={routeDest}
              radius={8}
              pathOptions={{
                color: '#0369a1',
                fillColor: '#38bdf8',
                fillOpacity: 1,
                weight: 3,
              }}
            >
              <Popup>
                Destino · quadra {routeAreaLabel || '—'}
                {routeDistanceM != null ? (
                  <>
                    <br />
                    {formatRouteDistance(routeDistanceM)}
                    {routeDurationS != null && routeDurationS > 0
                      ? ` · ${formatRouteDuration(routeDurationS)}`
                      : ''}
                  </>
                ) : null}
              </Popup>
            </CircleMarker>
          ) : null}

          <MapClickDraw enabled={editable && drawMode && !noteMode} onAdd={addPoint} />
          <MapClickDraw enabled={editable && noteMode && !drawMode} onAdd={placeNote} />
        </MapContainer>

        {/* Loading dentro do mapa — cobre até o basemap (Google/OSM) carregar */}
        {!mapReady ? (
          <div
            className="absolute inset-0 z-[2000] flex flex-col items-center justify-center gap-3 bg-apple-surface"
            aria-live="polite"
          >
            <span
              className="h-10 w-10 animate-spin rounded-full border-4 border-apple-blue border-t-transparent"
              aria-hidden
            />
            <p className="text-sm font-medium text-apple-secondary">Carregando mapa…</p>
          </div>
        ) : null}
      </div>

      {!isFullscreen ? (
        <>
          {editable ? (
            <p
              className={`text-sm font-medium ${
                areaReady
                  ? 'text-emerald-700 dark:text-emerald-300'
                  : 'text-amber-700 dark:text-amber-300'
              }`}
            >
              {areaReady
                ? `✓ ${areas.length} área(s)${notes.length ? ` · ${notes.length} nota(s)` : ''} pronta(s) para salvar`
                : '⚠ Ative o lápis, desenhe um contorno (3+ pontos) e conclua com ✓'}
            </p>
          ) : areaReady && hideAreaCount ? null : (
            <p className="text-sm text-apple-secondary">
              {areaReady
                ? `${areas.length} área(s) no território${notes.length ? ` · ${notes.length} nota(s) de atenção` : ''}.`
                : 'Este território ainda não tem área definida.'}
            </p>
          )}

          {notes.length > 0 ? (
            <div className="rounded-xl border border-amber-200/80 bg-amber-50/70 px-3 py-2.5 dark:border-amber-500/25 dark:bg-amber-500/10">
              <p className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-amber-800 dark:text-amber-200">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-orange-600 text-[11px] font-extrabold text-white">
                  !
                </span>
                Atenções no mapa
              </p>
              <ul className="space-y-1.5">
                {notes.map((note, index) => {
                  const text = (note.text || '').trim() || 'Sem comentário';
                  const isActive = note.id === selectedNoteId;
                  return (
                    <li key={note.id}>
                      <button
                        type="button"
                        onClick={() => {
                          if (editable) {
                            selectNote(note);
                          } else {
                            setSelectedNoteId(note.id);
                          }
                          // leve “foco”: o pin já destaca via selectedNoteId
                        }}
                        className={[
                          'flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] transition',
                          isActive
                            ? 'bg-amber-200/70 text-amber-950 ring-1 ring-amber-400/60 dark:bg-amber-500/25 dark:text-amber-50'
                            : 'text-amber-950/90 hover:bg-amber-100/80 dark:text-amber-50/90 dark:hover:bg-amber-500/15',
                        ].join(' ')}
                      >
                        <span className="mt-0.5 shrink-0 tabular-nums text-[11px] font-bold text-amber-700 dark:text-amber-300">
                          {index + 1}.
                        </span>
                        <span className="min-w-0 flex-1 whitespace-pre-wrap break-words font-medium leading-snug">
                          {text}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          {cepLabel && editable ? (
            <p className="text-xs text-apple-tertiary">Base do mapa (CEP): {cepLabel}</p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
