/** Fuso padrão do app (Brasil) */
export const APP_TIMEZONE = process.env.APP_TIMEZONE || 'America/Sao_Paulo';

const WEEKDAY_SHORT_TO_NUM: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/** Data de hoje no fuso do app: YYYY-MM-DD */
export function todayIsoInAppTz(timeZone = APP_TIMEZONE) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/**
 * Dia da semana para uma data civil YYYY-MM-DD no fuso do app.
 * Usa meio-dia local SP (UTC-3, sem horário de verão no Brasil desde 2019).
 */
export function weekdayForDateStr(dateStr: string, timeZone = APP_TIMEZONE) {
  // Meio-dia em America/Sao_Paulo ≈ 15:00 UTC
  const moment = new Date(`${dateStr}T15:00:00.000Z`);
  if (Number.isNaN(moment.getTime())) return 0;
  const short = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
  }).format(moment);
  return WEEKDAY_SHORT_TO_NUM[short] ?? 0;
}
