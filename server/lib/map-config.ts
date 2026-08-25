import { formatCep, onlyDigits, resolveCepLocation, type CepLocation } from './cep.js';

const cache = new Map<string, CepLocation>();

/**
 * CEP padrão do sistema (.env TERRITORY_CEP).
 * Usado quando o usuário ainda não definiu a região de trabalho.
 */
export function getDefaultCep(): string {
  const raw = (process.env.TERRITORY_CEP || '').trim();
  if (!raw) {
    throw new Error('TERRITORY_CEP não configurado no .env');
  }
  const digits = onlyDigits(raw);
  if (digits.length !== 8) {
    throw new Error('TERRITORY_CEP inválido no .env. Use 8 dígitos (ex: 37940-000).');
  }
  return formatCep(digits);
}

export function getDefaultCepDigits(): string {
  return onlyDigits(getDefaultCep());
}

/** CEP formatado da região de trabalho do usuário (ou o padrão do .env). */
export function resolveWorkingCep(user?: { active_cep?: string | null } | null): string {
  const fromUser = onlyDigits(user?.active_cep || '');
  if (fromUser.length === 8) return formatCep(fromUser);
  return getDefaultCep();
}

export function resolveWorkingCepDigits(user?: { active_cep?: string | null } | null): string {
  return onlyDigits(resolveWorkingCep(user));
}

/** Compara CEP no MySQL ignorando hífen/espaço. Placeholder `?` = 8 dígitos. */
export function sqlCepDigitsEq(column = 'cep'): string {
  return `REPLACE(REPLACE(COALESCE(${column}, ''), '-', ''), ' ', '') = ?`;
}

/**
 * Resolve coordenadas do mapa para um CEP.
 * Sem argumento, usa o CEP padrão do .env (compatibilidade).
 */
export async function getMapConfig(cep?: string | null): Promise<CepLocation> {
  const digits = onlyDigits(cep || getDefaultCep());
  if (digits.length !== 8) {
    throw new Error('CEP inválido. Use 8 dígitos (ex: 01310-100).');
  }

  const cached = cache.get(digits);
  if (cached) return cached;

  const location = await resolveCepLocation(digits);
  cache.set(digits, location);
  return location;
}
