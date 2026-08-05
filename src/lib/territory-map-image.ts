import type { Territory } from '@/lib/types';

/**
 * Imagens estáticas do mapa (papel/scan) em `public/territories/`.
 *
 * Convenção de arquivo (por Terr. N.º):
 *   public/territories/t{N}.webp  (preferido)
 *   public/territories/t{N}.jpg
 *   public/territories/t{N}.png
 *
 * Ex.: Terr. N.º 28 → /territories/t28.jpg  (cartão /territories/10 em produção)
 */

/** Normaliza o número do território para o nome do arquivo (só dígitos quando possível). */
export function territoryNumberKey(territory: Pick<Territory, 'number' | 'id'>): string | null {
  const raw = String(territory.number ?? '').trim();
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  return digits || raw.replace(/[^\w-]/g, '');
}

/** Caminhos candidatos (webp → jpg → png), relativos à raiz do site. */
export function territoryStaticMapCandidates(
  territory: Pick<Territory, 'number' | 'id'>,
): string[] {
  const key = territoryNumberKey(territory);
  if (!key) return [];
  const base = `/territories/t${key}`;
  return [`${base}.webp`, `${base}.jpg`, `${base}.jpeg`, `${base}.png`];
}

/** Primeiro caminho a tentar (ex.: no <img src>). */
export function territoryStaticMapPrimaryUrl(
  territory: Pick<Territory, 'number' | 'id'>,
): string | null {
  return territoryStaticMapCandidates(territory)[0] ?? null;
}

/** Há candidata de imagem? (não garante que o arquivo exista no disco) */
export function hasTerritoryStaticMapCandidate(
  territory: Pick<Territory, 'number' | 'id'>,
): boolean {
  return territoryStaticMapCandidates(territory).length > 0;
}
