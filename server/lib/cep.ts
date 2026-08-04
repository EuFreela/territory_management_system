export type CepLocation = {
  cep: string;
  street?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  lat: number;
  lng: number;
  label: string;
};

function onlyDigits(cep: string) {
  return cep.replace(/\D/g, '');
}

export function formatCep(cep: string) {
  const digits = onlyDigits(cep);
  if (digits.length !== 8) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function isValidCep(cep: string) {
  return onlyDigits(cep).length === 8;
}

export type GeocodeResult = {
  lat: number;
  lng: number;
  label: string;
};

async function geocodeWithNominatim(query: string): Promise<{ lat: number; lng: number } | null> {
  const results = await searchAddressNominatim(query, 1);
  if (!results[0]) return null;
  return { lat: results[0].lat, lng: results[0].lng };
}

/**
 * Busca endereço no OpenStreetMap (Nominatim) — Brasil.
 * Uso: localizar ponto no mapa a partir de texto livre / rua / CEP.
 */
export async function searchAddressNominatim(
  query: string,
  limit = 5,
): Promise<GeocodeResult[]> {
  const q = query.trim();
  if (q.length < 3) {
    throw new Error('Digite ao menos 3 caracteres para buscar.');
  }

  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', q);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', String(Math.min(10, Math.max(1, limit))));
  url.searchParams.set('countrycodes', 'br');
  url.searchParams.set('addressdetails', '0');

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'CampoTerritorios/2.0 (local-dev)',
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Não foi possível buscar o endereço agora. Tente de novo em instantes.');
  }

  const data = (await response.json()) as Array<{
    lat: string;
    lon: string;
    display_name?: string;
  }>;

  return data
    .map((item) => {
      const lat = Number(item.lat);
      const lng = Number(item.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return {
        lat,
        lng,
        label: String(item.display_name ?? q).trim(),
      } satisfies GeocodeResult;
    })
    .filter(Boolean) as GeocodeResult[];
}

/**
 * Resolve CEP brasileiro para coordenadas do mapa.
 * 1) BrasilAPI (quando tem location)
 * 2) Fallback Nominatim com endereço
 */
export async function resolveCepLocation(rawCep: string): Promise<CepLocation> {
  const digits = onlyDigits(rawCep);

  if (digits.length !== 8) {
    throw new Error('CEP inválido. Use 8 dígitos (ex: 01310-100).');
  }

  const brasilApi = await fetch(`https://brasilapi.com.br/api/cep/v2/${digits}`);

  if (!brasilApi.ok) {
    if (brasilApi.status === 404) {
      throw new Error('CEP não encontrado.');
    }
    throw new Error('Não foi possível consultar o CEP agora.');
  }

  const data = (await brasilApi.json()) as {
    cep?: string;
    street?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    location?: {
      coordinates?: {
        latitude?: string | number;
        longitude?: string | number;
      };
    };
  };

  let lat = Number(data.location?.coordinates?.latitude);
  let lng = Number(data.location?.coordinates?.longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    const parts = [data.street, data.neighborhood, data.city, data.state, 'Brasil'].filter(Boolean);
    const fallback = await geocodeWithNominatim(parts.join(', '));
    if (!fallback) {
      throw new Error('CEP encontrado, mas sem coordenadas no mapa. Tente outro CEP próximo.');
    }
    lat = fallback.lat;
    lng = fallback.lng;
  }

  const label = [data.street, data.neighborhood, data.city, data.state].filter(Boolean).join(' — ');

  return {
    cep: formatCep(digits),
    street: data.street,
    neighborhood: data.neighborhood,
    city: data.city,
    state: data.state,
    lat,
    lng,
    label: label || formatCep(digits),
  };
}
