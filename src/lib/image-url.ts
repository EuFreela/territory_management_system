/**
 * Sanitiza o link da imagem do cartão (espelha server/lib/image-url.ts).
 * Não busca a URL; só valida e normaliza o texto antes de usar em <img>/Leaflet.
 */

export const IMAGE_URL_MAX_LENGTH = 2048;

export type SanitizeImageUrlResult =
  | { ok: true; url: string | null }
  | { ok: false; error: string };

const PRIVATE_V4 = [
  /^0\./,
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
  /^198\.1[89]\./,
];

function isPrivateV4(host: string): boolean {
  return PRIVATE_V4.some((re) => re.test(host));
}

function hostIsBlocked(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!host) return true;
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true;
  if (host === '0.0.0.0' || host === '::' || host === '::1') return true;
  if (/^\d+$/.test(host)) return true;

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) && isPrivateV4(host)) return true;

  const v4mapped = host.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  if (v4mapped && isPrivateV4(v4mapped[1])) return true;

  if (host.includes(':')) {
    if (host.startsWith('fe80:') || host.startsWith('fc') || host.startsWith('fd')) return true;
  }

  return false;
}

function normalizeKnownImageHosts(url: URL): URL {
  const host = url.hostname.toLowerCase().replace(/^www\./, '');

  if (host === 'drive.google.com' || host === 'docs.google.com') {
    const fileMatch = url.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]{10,})/);
    const id = fileMatch?.[1] || url.searchParams.get('id') || '';
    if (/^[a-zA-Z0-9_-]{10,}$/.test(id)) {
      const next = new URL('https://drive.google.com/uc');
      next.searchParams.set('export', 'view');
      next.searchParams.set('id', id);
      return next;
    }
  }

  if (host === 'dropbox.com') {
    const next = new URL(url.href);
    next.searchParams.delete('dl');
    next.searchParams.set('raw', '1');
    return next;
  }

  return url;
}

/** Valida e normaliza um link de imagem. Vazio → null (sem imagem). */
export function sanitizeImageUrl(raw: unknown): SanitizeImageUrlResult {
  if (raw == null) return { ok: true, url: null };
  if (typeof raw !== 'string') {
    return { ok: false, error: 'Link da imagem inválido.' };
  }

  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, url: null };

  if (trimmed.length > IMAGE_URL_MAX_LENGTH) {
    return { ok: false, error: `Link da imagem no máximo ${IMAGE_URL_MAX_LENGTH} caracteres.` };
  }

  if (/[\u0000-\u001F\u007F]/.test(trimmed) || /\s/.test(trimmed)) {
    return { ok: false, error: 'O link da imagem contém caracteres inválidos.' };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: 'Informe um link válido começando com https:// ou http://.' };
  }

  const protocol = parsed.protocol.toLowerCase();
  if (protocol !== 'https:' && protocol !== 'http:') {
    return { ok: false, error: 'Use um link http ou https. Outros protocolos não são permitidos.' };
  }

  if (parsed.username || parsed.password) {
    return { ok: false, error: 'O link da imagem não pode conter usuário ou senha.' };
  }

  if (hostIsBlocked(parsed.hostname)) {
    return { ok: false, error: 'Este endereço de imagem não é permitido.' };
  }

  parsed.hash = '';

  try {
    const normalized = normalizeKnownImageHosts(parsed);
    return { ok: true, url: normalized.href };
  } catch {
    return { ok: false, error: 'Não foi possível normalizar o link da imagem.' };
  }
}
