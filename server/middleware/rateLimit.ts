import type { NextFunction, Request, Response } from 'express';

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

/** Limpa entradas expiradas de tempos em tempos (evita map crescer sem freio) */
function gc(now: number) {
  if (buckets.size < 500) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/**
 * IP real do cliente.
 * Só confia em cabeçalhos de proxy (cf-connecting-ip / x-forwarded-for) quando
 * express está atrás de um proxy de confiança (app.set('trust proxy', ...)).
 * Caso contrário (acesso direto), esses cabeçalhos são spoofáveis e podem
 * zerar/espalhar o bucket de rate limit — por isso usa-se o socket como base.
 */
function clientIp(req: Request) {
  const trustProxy = (req.app.get('trust proxy') as unknown) ?? false;
  if (trustProxy) {
    const cf = req.headers['cf-connecting-ip'];
    if (typeof cf === 'string' && cf.trim()) return cf.trim();
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string' && xff.length > 0) return xff.split(',')[0]!.trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

export type RateLimitOptions = {
  /** Janela em ms */
  windowMs: number;
  /** Máximo de pedidos na janela */
  max: number;
  /** Prefixo da chave (ex.: login) */
  name: string;
  /** Extra na chave (ex.: email do body) */
  keyExtra?: (req: Request) => string;
};

/**
 * Rate limit em memória (por processo).
 * Adequado a 1 instância Node (processo único).
 */
export function rateLimit(options: RateLimitOptions) {
  const { windowMs, max, name, keyExtra } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    gc(now);

    const extra = keyExtra?.(req) ?? '';
    const key = `${name}:${clientIp(req)}:${extra}`;

    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;

    const remaining = Math.max(0, max - bucket.count);
    const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));

    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > max) {
      res.setHeader('Retry-After', String(retryAfterSec));
      res.status(429).json({
        error: `Muitas tentativas. Aguarde ${retryAfterSec}s e tente de novo.`,
      });
      return;
    }

    next();
  };
}
