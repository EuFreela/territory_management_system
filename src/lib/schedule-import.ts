/**
 * Formato único da programação (.txt / colar).
 *
 * Data:  DD/MM/AAAA HH:MM Nome
 * Fixo:  FIXO Dia-da-semana HH:MM Nome
 *
 * Horário: HH:MM no relógio de 24 horas (00:00–23:59).
 * Nada é avaliado nem executado — só texto sanitizado.
 */

export const SCHEDULE_TEXT_MAX = 50_000;
export const SCHEDULE_FILE_MAX_BYTES = 50_000;
export const SCHEDULE_MAX_ITEMS = 120;
export const SCHEDULE_MAX_LINES = 400;
export const SCHEDULE_TEMPLATE_URL = '/docs/modelo-programacao-dirigentes.txt';

export const SCHEDULE_FORMAT_HINT =
  'Data: 25/08/2026 18:00 Nome   ·   Fixo: FIXO Terça-feira 08:00 Nome   ·   horário 00:00–23:59';

export type ParsedScheduleItem = {
  service_date: string | null;
  weekday_label: string;
  assignee_name: string;
  fixed_time: string;
  period_label: string;
  is_fixed: boolean;
  fixed_weekday: number | null;
};

export type SanitizeScheduleResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

export type ParseScheduleResult = {
  items: ParsedScheduleItem[];
  skipped: number;
};

const WEEKDAYS = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
] as const;

const MONTHS_PT = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
] as const;

const DANGEROUS_NAME =
  /[<>{}\\]|https?:|javascript|data:|vbscript|--|\/\*|;|\bunion\b|\bselect\b|\bdrop\b|\binsert\b|\bupdate\b|\bdelete\b/i;

const NAME_OK = /^[\p{L}\p{M}][\p{L}\p{M}0-9\s.'’-]*$/u;

const DATED_LINE =
  /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2})[:hH](\d{2})\s+(.+)$/;

const FIXED_LINE =
  /^FIXO\s+(domingo|segunda(?:-feira)?|ter[cç]a(?:-feira)?|quarta(?:-feira)?|quinta(?:-feira)?|sexta(?:-feira)?|s[aá]bado)\s+(\d{1,2})[:hH](\d{2})\s+(.+)$/i;

function fold(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function stripHtml(input: string) {
  return input
    .replace(/<\/?[a-zA-Z][^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, ' ')
    .replace(/&gt;/gi, ' ')
    .replace(/&quot;/gi, ' ')
    .replace(/&#x?[0-9a-fA-F]+;/g, ' ');
}

function weekdayIndexFromToken(token: string): number | null {
  const c = fold(token)
    .replace(/[\s-]+feira$/i, '')
    .replace(/-/g, ' ')
    .trim();
  if (c === 'domingo') return 0;
  if (c === 'segunda') return 1;
  if (c === 'terca') return 2;
  if (c === 'quarta') return 3;
  if (c === 'quinta') return 4;
  if (c === 'sexta') return 5;
  if (c === 'sabado') return 6;
  return null;
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function normalizeTime(hour: number, minute: number): string | null {
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return `${pad2(hour)}:${pad2(minute)}`;
}

function isValidYmd(year: number, month: number, day: number) {
  const nowY = new Date().getUTCFullYear();
  if (year < nowY - 1 || year > nowY + 2) return false;
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const dt = new Date(Date.UTC(year, month - 1, day, 15, 0, 0));
  return dt.getUTCFullYear() === year && dt.getUTCMonth() === month - 1 && dt.getUTCDate() === day;
}

function weekdayIndexFromIso(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 15, 0, 0)).getUTCDay();
}

function sanitizePersonName(raw: string): string | null {
  const name = raw.replace(/\s+/g, ' ').trim();
  if (name.length < 2 || name.length > 180) return null;
  if (DANGEROUS_NAME.test(name)) return null;
  if (!NAME_OK.test(name)) return null;
  const compact = fold(name);
  if (compact === 'fixo' || weekdayIndexFromToken(compact) != null) return null;
  return name;
}

export function sanitizeScheduleText(raw: unknown): SanitizeScheduleResult {
  if (typeof raw !== 'string') {
    return { ok: false, error: 'Envie a programação como texto.' };
  }
  if (raw.length > SCHEDULE_TEXT_MAX) {
    return { ok: false, error: `Texto grande demais (máx. ${SCHEDULE_TEXT_MAX} caracteres).` };
  }

  let text = raw.replace(/^\uFEFF/, '');
  if (text.includes('\u0000')) {
    return { ok: false, error: 'Arquivo inválido (conteúdo binário).' };
  }

  let control = 0;
  let cleaned = '';
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (ch === '\n' || ch === '\r' || ch === '\t') {
      cleaned += ch;
      continue;
    }
    if (code < 32 || (code >= 127 && code <= 159)) {
      control += 1;
      continue;
    }
    cleaned += ch;
  }
  if (text.length > 40 && control / text.length > 0.05) {
    return { ok: false, error: 'Arquivo inválido (não parece texto).' };
  }

  cleaned = stripHtml(cleaned)
    .replace(/javascript\s*:/gi, '')
    .replace(/vbscript\s*:/gi, '')
    .replace(/data\s*:/gi, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\u00a0\u202f\u2007\u2009]/g, ' ')
    .normalize('NFC');

  if (cleaned.split('\n').length > SCHEDULE_MAX_LINES) {
    return { ok: false, error: `Muitas linhas (máx. ${SCHEDULE_MAX_LINES}).` };
  }

  return { ok: true, text: cleaned };
}

function normalizeLine(line: string) {
  return line.replace(/\t+/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseLine(line: string): ParsedScheduleItem | null {
  const n = normalizeLine(line);
  if (!n || n.startsWith('#')) return null;

  const fixed = n.match(FIXED_LINE);
  if (fixed) {
    const day = weekdayIndexFromToken(fixed[1]);
    const time = normalizeTime(Number(fixed[2]), Number(fixed[3]));
    const name = sanitizePersonName(fixed[4]);
    if (day == null || !time || !name) return null;
    return {
      service_date: null,
      weekday_label: WEEKDAYS[day],
      assignee_name: name,
      fixed_time: time,
      period_label: '',
      is_fixed: true,
      fixed_weekday: day,
    };
  }

  const dated = n.match(DATED_LINE);
  if (!dated) return null;
  const day = Number(dated[1]);
  const month = Number(dated[2]);
  const year = Number(dated[3]);
  const time = normalizeTime(Number(dated[4]), Number(dated[5]));
  const name = sanitizePersonName(dated[6]);
  if (!time || !name || !isValidYmd(year, month, day)) return null;
  const iso = `${year}-${pad2(month)}-${pad2(day)}`;
  const weekdayIndex = weekdayIndexFromIso(iso);
  return {
    service_date: iso,
    weekday_label: WEEKDAYS[weekdayIndex],
    assignee_name: name,
    fixed_time: time,
    period_label: MONTHS_PT[month - 1] ?? '',
    is_fixed: false,
    fixed_weekday: null,
  };
}

function itemKey(item: ParsedScheduleItem) {
  if (item.is_fixed) {
    return `fixo|${item.fixed_weekday}|${item.fixed_time}|${item.assignee_name.toLowerCase()}`;
  }
  return `dia|${item.service_date}|${item.fixed_time}|${item.assignee_name.toLowerCase()}`;
}

export function isAllowedScheduleTxtName(filename: string, mime: string, size: number): string | null {
  if (size > SCHEDULE_FILE_MAX_BYTES) {
    return `Arquivo grande demais (máx. ${Math.floor(SCHEDULE_FILE_MAX_BYTES / 1000)} KB).`;
  }
  const name = filename.toLowerCase();
  if (!name.endsWith('.txt')) {
    return 'Envie somente um arquivo .txt.';
  }
  if (name.includes('/') || name.includes('\\') || name.includes('..')) {
    return 'Nome de arquivo inválido.';
  }
  const type = (mime || '').toLowerCase();
  const allowedTypes = new Set(['', 'text/plain', 'text/txt', 'application/octet-stream']);
  if (type && !allowedTypes.has(type)) {
    return 'Tipo de arquivo não permitido. Use .txt.';
  }
  return null;
}

export function isAllowedScheduleTxtFile(file: File): string | null {
  return isAllowedScheduleTxtName(file.name, file.type, file.size);
}

export function parseScheduleProgram(text: string): ParseScheduleResult {
  const items: ParsedScheduleItem[] = [];
  const seen = new Set<string>();
  let skipped = 0;

  for (const raw of text.split('\n')) {
    const line = normalizeLine(raw);
    if (!line || line.startsWith('#')) continue;
    const parsed = parseLine(line);
    if (!parsed) {
      skipped += 1;
      continue;
    }
    const key = itemKey(parsed);
    if (seen.has(key)) {
      skipped += 1;
      continue;
    }
    seen.add(key);
    items.push(parsed);
    if (items.length >= SCHEDULE_MAX_ITEMS) break;
  }

  return { items, skipped };
}
