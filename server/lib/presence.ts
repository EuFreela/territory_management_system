/**
 * Presença GPS em memória: usuários logados com localização ativa.
 * Sem DB — process único. Posições expiram se não forem atualizadas.
 */

export type GpsPresence = {
  userId: number;
  name: string;
  lat: number;
  lng: number;
  updatedAt: number;
};

/** Sem heartbeat por este tempo = offline no mapa */
const STALE_MS = 45_000;

const byUserId = new Map<number, GpsPresence>();

export function upsertGpsPresence(input: {
  userId: number;
  name: string;
  lat: number;
  lng: number;
}): GpsPresence {
  const entry: GpsPresence = {
    userId: input.userId,
    name: input.name.trim() || `Usuário ${input.userId}`,
    lat: input.lat,
    lng: input.lng,
    updatedAt: Date.now(),
  };
  byUserId.set(input.userId, entry);
  return entry;
}

export function removeGpsPresence(userId: number) {
  byUserId.delete(userId);
}

/** Lista presenças frescas (inclui o próprio usuário se ainda ativo). */
export function listGpsPresence(): GpsPresence[] {
  const now = Date.now();
  const live: GpsPresence[] = [];
  for (const [id, entry] of byUserId) {
    if (now - entry.updatedAt > STALE_MS) {
      byUserId.delete(id);
      continue;
    }
    live.push(entry);
  }
  return live;
}
