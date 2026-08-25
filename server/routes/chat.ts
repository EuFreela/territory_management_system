import { Router } from 'express';
import { insertChatMessage, listChatMessages, normalizeChatBody } from '../lib/chat.js';
import { resolveWorkingCepDigits } from '../lib/map-config.js';
import { listSessionPresence } from '../lib/presence.js';
import { requireAuth, type AuthedRequest } from '../middleware/requireAuth.js';

const router = Router();

/** Snapshot: online + mensagens (poll do widget). */
router.get('/state', requireAuth, (req, res) => {
  const cep = resolveWorkingCepDigits((req as AuthedRequest).user);
  const afterRaw = typeof req.query.after === 'string' ? req.query.after : '0';
  const afterId = Math.max(0, Math.floor(Number(afterRaw) || 0));
  const messages = listChatMessages({ afterId, limit: afterId > 0 ? 100 : 80, cep });
  const online = listSessionPresence(cep).map((u) => ({
    userId: u.userId,
    name: u.name,
    updatedAt: u.updatedAt,
    sessions: u.sessions,
  }));
  res.json({ online, messages });
});

/** Histórico / novas mensagens (em memória). */
router.get('/messages', requireAuth, (req, res) => {
  const cep = resolveWorkingCepDigits((req as AuthedRequest).user);
  const afterRaw = typeof req.query.after === 'string' ? req.query.after : '0';
  const afterId = Math.max(0, Math.floor(Number(afterRaw) || 0));
  const messages = listChatMessages({ afterId, cep });
  res.json({ messages });
});

/** Envia mensagem para todos (canal geral, só em memória). */
router.post('/messages', requireAuth, (req, res) => {
  const user = (req as AuthedRequest).user;
  const body = normalizeChatBody((req.body as { body?: unknown })?.body);
  if (!body) {
    res.status(400).json({
      error: 'Mensagem inválida. Use até 500 caracteres.',
    });
    return;
  }

  const message = insertChatMessage({
    userId: user.id,
    userName: user.name,
    body,
    cep: resolveWorkingCepDigits(user),
  });

  res.status(201).json({ message });
});

export default router;
