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
import { useEffect, useMemo, useRef, useState } from 'react';
import { IconCheck, IconLock, IconPencil, IconTag, IconTrash, IconUndo } from './mapIcons';

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

function AreaLabelMarker({ position, label }: { position: LatLng; label: string }) {
  const text = (label || '?').trim() || '?';

  const icon = useMemo(() => {
    // Largura aproximada para o Leaflet posicionar o âncora no centro
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
  }, [text]);

  return <Marker position={position} icon={icon} interactive={false} />;
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
      title={title}
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
};

export default function TerritoryMap({
  value,
  onChange,
  centerLat,
  centerLng,
  cepLabel,
  editable = true,
  heightClass = 'h-[28rem]',
}: TerritoryMapProps) {
  const [areas, setAreas] = useState<MapArea[]>(() => parseGeoJsonToAreas(value));
  const [draftPoints, setDraftPoints] = useState<LatLng[]>([]);
  /** false = mapa travado (só navegar); true = desenhar */
  const [drawMode, setDrawMode] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [seedGeoJson, setSeedGeoJson] = useState<string | null>(() => value ?? null);

  const drawingLocally = useRef(false);
  const seededFromServer = useRef(Boolean(value && parseGeoJsonToAreas(value).length > 0));

  useEffect(() => {
    if (drawingLocally.current || seededFromServer.current) return;
    const parsed = parseGeoJsonToAreas(value);
    if (parsed.length > 0) {
      setAreas(parsed);
      setSeedGeoJson(value ?? null);
      seededFromServer.current = true;
      setSelectedId(parsed[0]?.id ?? null);
    }
  }, [value]);

  const cepCenter: LatLng | null =
    centerLat != null &&
    centerLng != null &&
    Number.isFinite(Number(centerLat)) &&
    Number.isFinite(Number(centerLng))
      ? [Number(centerLat), Number(centerLng)]
      : null;

  const mapStartCenter = cepCenter ?? DEFAULT_CENTER;
  const mapStartZoom = cepCenter ? 15 : 5;

  const selected = areas.find((a) => a.id === selectedId) ?? null;
  const areaReady = areas.some((a) => a.points.length >= 3);

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
    }
  }

  function addPoint(point: LatLng) {
    if (!editable || !drawMode) return;
    setDraftPoints((prev) => [...prev, point]);
  }

  function undoPoint() {
    if (!editable) return;
    if (draftPoints.length > 0) {
      setDraftPoints((prev) => prev.slice(0, -1));
      return;
    }
    // sem rascunho: remove última área
    if (areas.length > 0) {
      const next = areas.slice(0, -1);
      emit(next);
      setSelectedId(next[next.length - 1]?.id ?? null);
    }
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
    setSelectedId(area.id);
    setDrawMode(false);
  }

  function clearAll() {
    if (!editable) return;
    setDraftPoints([]);
    setSelectedId(null);
    emit([]);
    setDrawMode(false);
  }

  function updateSelectedLabel(label: string) {
    if (!selectedId) return;
    const next = areas.map((a) => (a.id === selectedId ? { ...a, label } : a));
    emit(next);
  }

  function removeSelected() {
    if (!selectedId || !editable) return;
    const next = areas.filter((a) => a.id !== selectedId);
    emit(next);
    setSelectedId(next[0]?.id ?? null);
  }

  return (
    <div className="space-y-3">
      {/* Toolbar de ícones */}
      {editable ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
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
            title="Apagar todas as áreas"
            tone="danger"
            disabled={areas.length === 0 && draftPoints.length === 0}
            onClick={clearAll}
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
                {' — zoom livre, sem desenhar. Clique no lápis para desenhar.'}
              </>
            )}
          </p>
        </div>
      ) : null}

      <div
        className={`${heightClass} w-full overflow-hidden rounded-xl border border-slate-200 bg-white ${
          drawMode ? 'ring-2 ring-sky-400' : ''
        }`}
      >
        <MapContainer
          center={mapStartCenter}
          zoom={mapStartZoom}
          scrollWheelZoom
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <InitialMapView
            centerLat={centerLat}
            centerLng={centerLng}
            seedGeoJson={seedGeoJson}
          />

          {cepCenter && areas.length === 0 && draftPoints.length === 0 ? (
            <Marker position={cepCenter} title={cepLabel ?? 'CEP do sistema'} />
          ) : null}

          {areas.map((area, index) => {
            const palette = AREA_COLORS[index % AREA_COLORS.length];
            const isSelected = area.id === selectedId;
            return (
              <Polygon
                key={area.id}
                positions={area.points}
                pathOptions={{
                  color: isSelected ? '#0369a1' : palette.color,
                  fillColor: palette.fill,
                  fillOpacity: isSelected ? 0.5 : 0.35,
                  weight: isSelected ? 4 : 3,
                }}
                eventHandlers={{
                  click: (e) => {
                    if (drawMode) return;
                    L.DomEvent.stopPropagation(e);
                    setSelectedId(area.id);
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

      {/* Nome / texto de cada área */}
      {editable && areas.length > 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-3">
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
                  onClick={() => setSelectedId(area.id)}
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
                onClick={removeSelected}
                title="Remover área"
                aria-label="Remover área"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-white text-red-700 hover:bg-red-50"
              >
                <IconTrash className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Selecione uma área (clique no mapa ou no chip) para nomear.</p>
          )}
        </div>
      ) : null}

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
    </div>
  );
}
