/**
 * Presença em memória (processo único):
 * - GPS: usuários com localização ativa no mapa
 * - Sessão: abas/clientes com o app aberto (chat / online)
 *
 * Várias abas da mesma conta contam como sessões distintas.
 * Entrada/saída no chat só anunciam quando a 1ª sessão entra
 * ou a última sessão sai (com período de graça).
 */
import { announceUserJoined, announceUserLeft } from './chat.js';

export type GpsPresence = {
  userId: number;
  name: string;
  lat: number;
  lng: number;
  updatedAt: number;
};

/** Uma aba/cliente ativa */
export type ClientSession = {
  clientId: string;
  userId: number;
  name: string;
  updatedAt: number;
};

/** Usuário agregado (pode ter N sessões/abas) */
export type SessionPresence = {
  userId: number;
  name: string;
  updatedAt: number;
  /** Quantas abas/clientes desta conta estão online */
  sessions: number;
};

/** Sem heartbeat por este tempo = offline no mapa */
const GPS_STALE_MS = 45_000;
/** Sem heartbeat de sessão = offline no chat */
const SESSION_STALE_MS = 45_000;
/**
 * Após a última sessão sumir, espera este tempo antes de anunciar "saiu".
 * Se voltar nesse intervalo, cancela o aviso e não anuncia "entrou" de novo.
 */
const LEAVE_GRACE_MS = 20_000;

const gpsByUserId = new Map<number, GpsPresence>();
/** clientId → sessão (permite várias abas da mesma conta) */
const sessionsByClientId = new Map<string, ClientSession>();
const pendingLeave = new Map<
  number,
  { name: string; timer: ReturnType<typeof setTimeout> }
>();

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
  gpsByUserId.set(input.userId, entry);
  return entry;
}

export function removeGpsPresence(userId: number) {
  gpsByUserId.delete(userId);
}

/** Lista presenças GPS frescas (inclui o próprio usuário se ainda ativo). */
export function listGpsPresence(): GpsPresence[] {
  const now = Date.now();
  const live: GpsPresence[] = [];
  for (const [id, entry] of gpsByUserId) {
    if (now - entry.updatedAt > GPS_STALE_MS) {
      gpsByUserId.delete(id);
      continue;
    }
    live.push(entry);
  }
  return live;
}

function countSessionsForUser(userId: number): number {
  let n = 0;
  for (const s of sessionsByClientId.values()) {
    if (s.userId === userId) n += 1;
  }
  return n;
}

function cancelPendingLeave(userId: number): boolean {
  const pending = pendingLeave.get(userId);
  if (!pending) return false;
  clearTimeout(pending.timer);
  pendingLeave.delete(userId);
  return true;
}

function scheduleLeaveAnnounce(userId: number, name: string) {
  cancelPendingLeave(userId);
  const timer = setTimeout(() => {
    pendingLeave.delete(userId);
    // Só anuncia se não restou nenhuma sessão desta conta
    if (countSessionsForUser(userId) === 0) {
      announceUserLeft(userId, name);
    }
  }, LEAVE_GRACE_MS);
  pendingLeave.set(userId, { name, timer });
}

function normalizeClientId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const id = raw.trim().slice(0, 80);
  if (!id || id.length < 8) return null;
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) return null;
  return id;
}

/**
 * Heartbeat de uma aba/cliente.
 * `clientId` identifica a aba; várias abas da mesma conta coexistem.
 */
export function upsertSessionPresence(input: {
  userId: number;
  name: string;
  clientId?: unknown;
}): SessionPresence {
  const name = input.name.trim() || `Usuário ${input.userId}`;
  const clientId =
    normalizeClientId(input.clientId) ?? `u${input.userId}-fallback`;

  const sessionsBefore = countSessionsForUser(input.userId);
  const cancelledLeave = cancelPendingLeave(input.userId);

  const entry: ClientSession = {
    clientId,
    userId: input.userId,
    name,
    updatedAt: Date.now(),
  };
  sessionsByClientId.set(clientId, entry);

  const sessionsAfter = countSessionsForUser(input.userId);

  // Anuncia "entrou" só quando a conta passa de 0 → 1 sessão (não em cada aba extra)
  if (sessionsBefore === 0 && sessionsAfter >= 1 && !cancelledLeave) {
    announceUserJoined(input.userId, name);
  }

  return {
    userId: input.userId,
    name,
    updatedAt: entry.updatedAt,
    sessions: sessionsAfter,
  };
}

/**
 * Remove uma aba/cliente.
 * Se `clientId` for omitido, remove todas as sessões da conta (logout global).
 */
export function removeSessionPresence(
  userId: number,
  clientIdRaw?: unknown,
): SessionPresence | null {
  const clientId = normalizeClientId(clientIdRaw);

  if (clientId) {
    const entry = sessionsByClientId.get(clientId);
    if (!entry || entry.userId !== userId) return null;
    sessionsByClientId.delete(clientId);
    const remaining = countSessionsForUser(userId);
    // Só agenda "saiu" quando a última aba desta conta fecha
    if (remaining === 0) {
      scheduleLeaveAnnounce(userId, entry.name);
    }
    return {
      userId,
      name: entry.name,
      updatedAt: entry.updatedAt,
      sessions: remaining,
    };
  }

  // Sem clientId: remove todas as sessões do usuário
  let name = `Usuário ${userId}`;
  let removed = 0;
  for (const [id, s] of sessionsByClientId) {
    if (s.userId === userId) {
      name = s.name;
      sessionsByClientId.delete(id);
      removed += 1;
    }
  }
  if (removed === 0) return null;
  scheduleLeaveAnnounce(userId, name);
  return { userId, name, updatedAt: Date.now(), sessions: 0 };
}

/** Agrega sessões por usuário (com contagem de abas). Expira sessões velhas. */
export function listSessionPresence(): SessionPresence[] {
  const now = Date.now();
  const affectedUsers = new Map<number, string>();

  for (const [clientId, entry] of sessionsByClientId) {
    if (now - entry.updatedAt > SESSION_STALE_MS) {
      sessionsByClientId.delete(clientId);
      affectedUsers.set(entry.userId, entry.name);
    }
  }

  // Usuários que ficaram com 0 sessões após expirar → agenda "saiu"
  for (const [userId, name] of affectedUsers) {
    if (countSessionsForUser(userId) === 0) {
      scheduleLeaveAnnounce(userId, name);
    }
  }

  const byUser = new Map<number, SessionPresence>();
  for (const s of sessionsByClientId.values()) {
    const cur = byUser.get(s.userId);
    if (!cur) {
      byUser.set(s.userId, {
        userId: s.userId,
        name: s.name,
        updatedAt: s.updatedAt,
        sessions: 1,
      });
    } else {
      cur.sessions += 1;
      if (s.updatedAt > cur.updatedAt) {
        cur.updatedAt = s.updatedAt;
        cur.name = s.name;
      }
    }
  }

  return [...byUser.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}
