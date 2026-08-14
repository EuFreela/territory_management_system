/** ID estável por aba (sessionStorage) — conta quantas abas da mesma conta estão online. */
const STORAGE_KEY = 'campo_chat_client_id';

function randomId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '');
  }
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

export function getChatClientId(): string {
  if (typeof sessionStorage === 'undefined') return randomId();
  try {
    const existing = sessionStorage.getItem(STORAGE_KEY);
    if (existing && existing.length >= 8) return existing;
    const id = randomId();
    sessionStorage.setItem(STORAGE_KEY, id);
    return id;
  } catch {
    return randomId();
  }
}
