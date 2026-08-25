import { Router } from 'express';
import {
  listGpsPresence,
  listSessionPresence,
  removeGpsPresence,
  removeSessionPresence,
  upsertGpsPresence,
  upsertSessionPresence,
} from '../lib/presence.js';
import { resolveWorkingCepDigits } from '../lib/map-config.js';
import { requireAuth, type AuthedRequest } from '../middleware/requireAuth.js';

const router = Router();

function isValidCoord(lat: unknown, lng: unknown): lat is number {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/** Lista usuários com GPS ativo (presença recente). */
router.get('/gps', requireAuth, (req, res) => {
  const cep = resolveWorkingCepDigits((req as AuthedRequest).user);
  const users = listGpsPresence(cep).map((u) => ({
    userId: u.userId,
    name: u.name,
    lat: u.lat,
    lng: u.lng,
    updatedAt: u.updatedAt,
  }));
  res.json({ users });
});

/** Publica/atualiza a própria posição GPS. */
router.put('/gps', requireAuth, (req, res) => {
  const user = (req as AuthedRequest).user;
  const lat = Number((req.body as { lat?: unknown })?.lat);
  const lng = Number((req.body as { lng?: unknown })?.lng);

  if (!isValidCoord(lat, lng)) {
    res.status(400).json({ error: 'Coordenadas inválidas.' });
    return;
  }

  const entry = upsertGpsPresence({
    userId: user.id,
    name: user.name,
    lat,
    lng,
    cep: resolveWorkingCepDigits(user),
  });

  res.json({
    ok: true,
    user: {
      userId: entry.userId,
      name: entry.name,
      lat: entry.lat,
      lng: entry.lng,
      updatedAt: entry.updatedAt,
    },
  });
});

/** Desliga a presença GPS (sai do mapa para os outros). */
router.delete('/gps', requireAuth, (req, res) => {
  const user = (req as AuthedRequest).user;
  removeGpsPresence(user.id);
  res.json({ ok: true });
});

/** Heartbeat de sessão (app aberto → online no chat). Body: { clientId } */
router.put('/session', requireAuth, (req, res) => {
  const user = (req as AuthedRequest).user;
  const clientId = (req.body as { clientId?: unknown })?.clientId;
  const entry = upsertSessionPresence({
    userId: user.id,
    name: user.name,
    clientId,
    cep: resolveWorkingCepDigits(user),
  });
  res.json({
    ok: true,
    user: {
      userId: entry.userId,
      name: entry.name,
      updatedAt: entry.updatedAt,
      sessions: entry.sessions,
    },
  });
});

/** Sai do online (fecha aba / logout). Body opcional: { clientId } */
router.delete('/session', requireAuth, (req, res) => {
  const user = (req as AuthedRequest).user;
  const clientId =
    (req.body as { clientId?: unknown } | undefined)?.clientId ??
    (typeof req.query.clientId === 'string' ? req.query.clientId : undefined);
  removeSessionPresence(user.id, clientId);
  res.json({ ok: true });
});

/** Lista quem está online (agregado por conta, com contagem de abas). */
router.get('/online', requireAuth, (req, res) => {
  const cep = resolveWorkingCepDigits((req as AuthedRequest).user);
  const users = listSessionPresence(cep).map((u) => ({
    userId: u.userId,
    name: u.name,
    updatedAt: u.updatedAt,
    sessions: u.sessions,
  }));
  res.json({ users });
});

export default router;
