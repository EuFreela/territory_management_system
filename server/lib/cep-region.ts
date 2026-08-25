import pool from './db.js';
import { formatCep, onlyDigits } from './cep.js';
import { sqlCepDigitsEq } from './map-config.js';

export const CONGREGATION_NAME_MAX = 120;

export type SanitizeNameResult =
  | { ok: true; name: string | null }
  | { ok: false; error: string };

/** Nome da congregação vinculado ao CEP (texto visível, sem HTML). */
export function sanitizeCongregationName(raw: unknown): SanitizeNameResult {
  if (raw == null) return { ok: true, name: null };
  if (typeof raw !== 'string') {
    return { ok: false, error: 'Nome da congregação inválido.' };
  }

  const trimmed = raw.trim().replace(/\s+/g, ' ');
  if (!trimmed) return { ok: true, name: null };

  if (/[\u0000-\u001F\u007F]/.test(trimmed) || /[<>]/.test(trimmed)) {
    return { ok: false, error: 'O nome da congregação contém caracteres inválidos.' };
  }

  if (trimmed.length < 2) {
    return { ok: false, error: 'Nome da congregação deve ter pelo menos 2 caracteres.' };
  }

  if (trimmed.length > CONGREGATION_NAME_MAX) {
    return {
      ok: false,
      error: `Nome da congregação no máximo ${CONGREGATION_NAME_MAX} caracteres.`,
    };
  }

  return { ok: true, name: trimmed };
}

export async function getCongregationName(cep: string): Promise<string | null> {
  const digits = onlyDigits(cep);
  if (digits.length !== 8) return null;
  try {
    const [rows] = await pool.execute(
      `SELECT name FROM cep_regions WHERE ${sqlCepDigitsEq('cep')} LIMIT 1`,
      [digits],
    );
    const name = (rows as Array<{ name?: string }>)[0]?.name;
    return typeof name === 'string' && name.trim() ? name.trim() : null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/cep_regions|doesn't exist|Unknown table/i.test(msg)) return null;
    throw err;
  }
}

export async function listCongregationNames(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const [rows] = await pool.execute('SELECT cep, name FROM cep_regions');
    for (const row of rows as Array<{ cep: string; name: string }>) {
      const digits = onlyDigits(row.cep);
      if (digits.length !== 8) continue;
      const name = String(row.name ?? '').trim();
      if (!name) continue;
      map.set(formatCep(digits), name);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/cep_regions|doesn't exist|Unknown table/i.test(msg)) return map;
    throw err;
  }
  return map;
}

export async function upsertCongregationName(cep: string, name: string | null): Promise<void> {
  const digits = onlyDigits(cep);
  if (digits.length !== 8) return;
  const formatted = formatCep(digits);

  try {
    if (!name) {
      await pool.execute(`DELETE FROM cep_regions WHERE ${sqlCepDigitsEq('cep')}`, [digits]);
      return;
    }
    await pool.execute(
      `INSERT INTO cep_regions (cep, name) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name)`,
      [formatted, name],
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/cep_regions|doesn't exist|Unknown table/i.test(msg)) {
      throw new Error('Nome da congregação ainda não migrado. Rode: npm run migrate:cep-congregation');
    }
    throw err;
  }
}
