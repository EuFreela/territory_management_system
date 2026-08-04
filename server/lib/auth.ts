import { randomBytes } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import type { Request } from 'express';
import { loadRbacUserById } from './load-user.js';
import type { RbacUser } from './rbac.js';

export type AuthUser = RbacUser;

export type TokenPayload = {
  userId: number;
  email: string;
  name: string;
};

const DEV_FALLBACK = 'dev-secret-change-me';

function resolveJwtSecret() {
  const fromEnv = (process.env.JWT_SECRET || '').trim();
  const isProd = process.env.NODE_ENV === 'production';

  if (isProd && (!fromEnv || fromEnv === DEV_FALLBACK || fromEnv.length < 32)) {
    throw new Error(
      '[auth] JWT_SECRET ausente ou fraco em produção (mín. 32 caracteres, não use o valor de dev).',
    );
  }

  if (!fromEnv || fromEnv === DEV_FALLBACK) {
    console.warn(
      '[auth] JWT_SECRET não definido ou inseguro — usando fallback só para desenvolvimento.',
    );
    return DEV_FALLBACK;
  }

  return fromEnv;
}

export const JWT_SECRET = resolveJwtSecret();

/** Duração da sessão (cookie + JWT). Padrão 12h; override com JWT_EXPIRES (ex.: 7d, 1h). */
export const JWT_EXPIRES = process.env.JWT_EXPIRES?.trim() || '12h';

function getSecretKey() {
  return new TextEncoder().encode(JWT_SECRET);
}

function sessionMaxAgeMs() {
  const raw = JWT_EXPIRES.toLowerCase();
  const m = raw.match(/^(\d+)([smhd])$/);
  if (!m) return 12 * 60 * 60 * 1000;
  const n = Number(m[1]);
  const unit = m[2];
  const mult =
    unit === 's' ? 1000 : unit === 'm' ? 60_000 : unit === 'h' ? 3_600_000 : 86_400_000;
  return n * mult;
}

export async function signToken(user: Pick<AuthUser, 'id' | 'email' | 'name'>) {
  return new SignJWT({
    userId: user.id,
    email: user.email,
    name: user.name,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setJti(randomBytes(16).toString('hex'))
    .setExpirationTime(JWT_EXPIRES)
    .sign(getSecretKey());
}

export async function verifyToken(token: string) {
  const { payload } = await jwtVerify(token, getSecretKey(), {
    algorithms: ['HS256'],
  });

  return {
    userId: Number(payload.userId),
    email: String(payload.email ?? ''),
    name: String(payload.name ?? ''),
  } satisfies TokenPayload;
}

/**
 * Resolve o usuário a partir do cookie JWT e carrega papel/permissões no banco.
 */
export async function getUserFromRequest(req: Request): Promise<AuthUser | null> {
  const token = req.cookies?.auth_token as string | undefined;
  if (!token) return null;

  try {
    const payload = await verifyToken(token);
    if (!payload.userId) return null;
    return await loadRbacUserById(payload.userId);
  } catch {
    return null;
  }
}

/** Secure cookie só em HTTPS. Em HTTP (LAN) o browser ignora Secure. */
function cookieSecure() {
  if (process.env.COOKIE_SECURE === 'true') return true;
  if (process.env.COOKIE_SECURE === 'false') return false;
  const appUrl = process.env.VITE_APP_URL || '';
  return appUrl.startsWith('https://');
}

export const cookieOptions = {
  httpOnly: true,
  secure: cookieSecure(),
  sameSite: 'lax' as const,
  path: '/',
  maxAge: sessionMaxAgeMs(),
};
