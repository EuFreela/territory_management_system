/**
 * Formata a data em DD/MM/AAAA. O driver MySQL entrega a coluna DATE como
 * "YYYY-MM-DDTHH:MM:SS.sssZ" (ISO UTC à meia-noite); extraímos só a parte do
 * calendário (YYYY-MM-DD) sem converter para Date/UTC, para nunca deslocar o dia.
 */
export function formatDateBr(value: string | null | undefined): string {
  if (!value) return '—';
  const raw = String(value).slice(0, 10);
  const [y, m, d] = raw.split('-');
  if (!y || !m || !d) return raw;
  return `${d}/${m}/${y}`;
}

/** Data e hora em DD/MM/AAAA HH:mm (fuso America/Sao_Paulo) */
export function formatDateTimeBr(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    // fallback: "YYYY-MM-DD HH:MM:SS" ou ISO sem Z
    const s = String(value).replace('T', ' ').slice(0, 16);
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
    if (m) return `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}`;
    return String(value);
  }
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

/** Só a hora em HH:mm (fuso America/Sao_Paulo) */
export function formatTimeBr(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const s = String(value).replace('T', ' ').slice(0, 16);
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
    if (m) return `${m[4]}:${m[5]}`;
    return String(value);
  }
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}