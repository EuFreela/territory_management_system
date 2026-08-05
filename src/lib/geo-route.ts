/** Utilitários de distância e rota (GPS → quadra mais próxima) */

export type LatLngTuple = [number, number];

const EARTH_RADIUS_M = 6_371_000;

/** Distância em metros (Haversine) entre dois pontos [lat, lng]. */
export function haversineMeters(a: LatLngTuple, b: LatLngTuple): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Ponto da área mais próximo do GPS: vértice do polígono com menor distância.
 * (Simples e estável para quadras desenhadas no mapa.)
 */
export function nearestPointOnArea(
  from: LatLngTuple,
  areaPoints: LatLngTuple[],
): { point: LatLngTuple; distanceM: number } | null {
  if (!areaPoints.length) return null;
  let best = areaPoints[0];
  let bestD = haversineMeters(from, best);
  for (let i = 1; i < areaPoints.length; i++) {
    const d = haversineMeters(from, areaPoints[i]);
    if (d < bestD) {
      bestD = d;
      best = areaPoints[i];
    }
  }
  return { point: best, distanceM: bestD };
}

export type NearestAreaResult<T extends { id: string; points: LatLngTuple[]; label: string }> = {
  area: T;
  dest: LatLngTuple;
  airDistanceM: number;
};

/** Escolhe a área (quadra) mais próxima do ponto GPS. */
export function findNearestArea<T extends { id: string; points: LatLngTuple[]; label: string }>(
  from: LatLngTuple,
  areas: T[],
): NearestAreaResult<T> | null {
  const valid = areas.filter((a) => a.points.length >= 1);
  if (!valid.length) return null;

  let best: NearestAreaResult<T> | null = null;
  for (const area of valid) {
    const near = nearestPointOnArea(from, area.points);
    if (!near) continue;
    if (!best || near.distanceM < best.airDistanceM) {
      best = { area, dest: near.point, airDistanceM: near.distanceM };
    }
  }
  return best;
}

export type RouteResult = {
  path: LatLngTuple[];
  distanceM: number;
  durationS: number;
  /** true se veio do OSRM; false = linha reta de fallback */
  fromRouter: boolean;
};

/**
 * Velocidade média em área urbana para estimar tempo quando só há linha reta.
 * Com OSRM driving usamos o duration do motor (mais realista com semáforos/vias).
 */
export const DRIVING_SPEED_KM_H = 40;
const DRIVING_SPEED_M_PER_S = (DRIVING_SPEED_KM_H * 1000) / 3600;

/** Tempo de carro estimado só pela distância (fallback sem router). */
export function estimateDrivingDurationSeconds(distanceM: number): number {
  if (!distanceM || distanceM <= 0) return 0;
  return distanceM / DRIVING_SPEED_M_PER_S;
}

/**
 * Rota de **carro** mais curta (OSRM público — vias do OpenStreetMap, perfil driving).
 * Distância = comprimento no asfalto; duração = tempo do OSRM (carro).
 * Em falha, linha reta + tempo estimado a ~40 km/h.
 */
export async function fetchShortestDrivingRoute(
  from: LatLngTuple,
  to: LatLngTuple,
  signal?: AbortSignal,
): Promise<RouteResult> {
  const coords = `${from[1]},${from[0]};${to[1]},${to[0]}`;
  const url =
    `https://router.project-osrm.org/route/v1/driving/${coords}` +
    `?overview=full&geometries=geojson&alternatives=true`;

  try {
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
    const data = (await res.json()) as {
      code?: string;
      routes?: Array<{
        distance: number;
        duration: number;
        geometry?: { coordinates?: number[][] };
      }>;
    };
    if (data.code !== 'Ok' || !data.routes?.length) throw new Error('OSRM sem rota');

    // Entre alternativas, escolhe a de menor distância (rota mais curta de carro)
    const best = data.routes.reduce((a, b) => (b.distance < a.distance ? b : a));
    const line = best.geometry?.coordinates ?? [];
    if (line.length < 2) throw new Error('Geometria vazia');

    const path: LatLngTuple[] = line.map((c) => [c[1], c[0]] as LatLngTuple);
    return {
      path,
      distanceM: best.distance,
      durationS: best.duration > 0 ? best.duration : estimateDrivingDurationSeconds(best.distance),
      fromRouter: true,
    };
  } catch {
    const distanceM = haversineMeters(from, to);
    return {
      path: [from, to],
      distanceM,
      durationS: estimateDrivingDurationSeconds(distanceM),
      fromRouter: false,
    };
  }
}

/** @deprecated use fetchShortestDrivingRoute — mantido por compatibilidade de imports */
export async function fetchShortestWalkingRoute(
  from: LatLngTuple,
  to: LatLngTuple,
  signal?: AbortSignal,
): Promise<RouteResult> {
  return fetchShortestDrivingRoute(from, to, signal);
}

export function formatRouteDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
}

export function formatRouteDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '';
  const min = Math.max(1, Math.round(seconds / 60));
  if (min < 60) return `~${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `~${h} h ${m} min` : `~${h} h`;
}
