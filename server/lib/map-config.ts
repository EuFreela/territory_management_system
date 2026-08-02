import { resolveCepLocation, type CepLocation } from './cep.js';

let cached: CepLocation | null = null;
let lastCep = '';

/**
 * CEP global do sistema (v2: um território / uma região).
 * Configurado em .env: TERRITORY_CEP=00000-000
 */
export function getConfiguredCep(): string {
  const raw = (process.env.TERRITORY_CEP || '').trim();
  if (!raw) {
    throw new Error('TERRITORY_CEP não configurado no .env');
  }
  return raw;
}

export async function getMapConfig(): Promise<CepLocation> {
  const cep = getConfiguredCep();

  if (cached && lastCep === cep) {
    return cached;
  }

  const location = await resolveCepLocation(cep);
  cached = location;
  lastCep = cep;
  return location;
}
