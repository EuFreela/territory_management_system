/**
 * Mensagens do chat em grupo — apenas em memória (processo único).
 * Não persiste no banco; some no restart do servidor e fica limitada às
 * mensagens recentes da sessão dos usuários online.
 */

export type ChatMessageKind = 'user' | 'system';

export type ChatMessage = {
  id: number;
  user_id: number;
  user_name: string;
  body: string;
  created_at: string;
  /** user = mensagem normal; system = aviso (ex.: saiu) */
  kind: ChatMessageKind;
};

const MAX_BODY = 500;
const MAX_MESSAGES = 200;
const DEFAULT_LIMIT = 80;
const MAX_LIMIT = 150;

let nextId = 1;
const messages: ChatMessage[] = [];

export function normalizeChatBody(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const body = raw.trim().replace(/\s+/g, ' ');
  if (!body || body.length > MAX_BODY) return null;
  return body;
}

export function listChatMessages(options?: {
  afterId?: number;
  limit?: number;
}): ChatMessage[] {
  const afterId = Math.max(0, Math.floor(Number(options?.afterId) || 0));
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Math.floor(Number(options?.limit) || DEFAULT_LIMIT)),
  );

  if (afterId > 0) {
    return messages.filter((m) => m.id > afterId).slice(0, limit);
  }

  if (messages.length <= limit) return [...messages];
  return messages.slice(messages.length - limit);
}

function pushMessage(message: Omit<ChatMessage, 'id' | 'created_at'>): ChatMessage {
  const full: ChatMessage = {
    ...message,
    id: nextId++,
    created_at: new Date().toISOString(),
  };
  messages.push(full);
  if (messages.length > MAX_MESSAGES) {
    messages.splice(0, messages.length - MAX_MESSAGES);
  }
  return full;
}

export function insertChatMessage(input: {
  userId: number;
  userName: string;
  body: string;
}): ChatMessage {
  return pushMessage({
    user_id: input.userId,
    user_name: input.userName.trim() || `Usuário ${input.userId}`,
    body: input.body,
    kind: 'user',
  });
}

/** Aviso de sistema no canal (ex.: alguém saiu). */
export function insertSystemMessage(body: string, relatedUser?: {
  userId: number;
  userName: string;
}): ChatMessage {
  return pushMessage({
    user_id: relatedUser?.userId ?? 0,
    user_name: relatedUser?.userName?.trim() || 'Sistema',
    body,
    kind: 'system',
  });
}

export function announceUserLeft(userId: number, userName: string): ChatMessage {
  const name = userName.trim() || `Usuário ${userId}`;
  return insertSystemMessage(`${name} saiu`, { userId, userName: name });
}

export function announceUserJoined(userId: number, userName: string): ChatMessage {
  const name = userName.trim() || `Usuário ${userId}`;
  return insertSystemMessage(`${name} entrou`, { userId, userName: name });
}
