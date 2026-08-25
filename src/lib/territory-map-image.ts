import { sanitizeImageUrl } from '@/lib/image-url';
import type { Territory } from '@/lib/types';

/**
 * Link sanitizado da imagem do cartão.
 * Só http(s) validado — nunca usa o valor cru da API em <img>/Leaflet.
 */
export function territoryCardImageUrl(
  territory: Pick<Territory, 'image_url'>,
): string | null {
  const result = sanitizeImageUrl(territory.image_url ?? null);
  return result.ok ? result.url : null;
}

export function hasTerritoryCardImage(territory: Pick<Territory, 'image_url'>): boolean {
  return Boolean(territoryCardImageUrl(territory));
}
