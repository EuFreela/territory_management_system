import { Router } from 'express';
import {
  listGpsPresence,
  removeGpsPresence,
  upsertGpsPresence,
} from '../lib/presence.js';
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
router.get('/gps', requireAuth, (_req, res) => {
  const users = listGpsPresence().map((u) => ({
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

export default router;
