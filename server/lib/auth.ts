import { randomBytes } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import type { Request } from 'express';
import { loadRbacUserById } from './load-user.js';
import { isSystemAdminEmail, type RbacUser } from './rbac.js';

export type AuthUser = RbacUser;

export type TokenPayload = {
  userId: number;
  email: string;
  name: string;
};

const DEV_FALLBACK = 'dev-secret-change-me';

function resolveJwtSecret() {
  const fromEnv = (process.env.JWT_SECRET || '').trim();
  const appUrl = (process.env.VITE_APP_URL || '').trim();
  // "Produção" = NODE_ENV=production OU app exposto por URL https (ex.: https://analp.tec.br)
  const looksPublic = process.env.NODE_ENV === 'production' || /^https:\/\//i.test(appUrl);

  if (looksPublic && (!fromEnv || fromEnv === DEV_FALLBACK || fromEnv.length < 32)) {
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

/**
 * Denylist de sessões revogadas (por jti do JWT), em memória, por processo.
 * Somada ao TTL do token, permite invalidar um token roubado sem esperar a
 * expiração natural — por exemplo no logout. O apagamento expira junto com o token.
 */
const revokedJtis = new Map<string, number>();

/** Revoga um token pelo seu jti. Opcional: ttlMs para expirar antes do token. */
export function revokeTokenJti(jti: string) {
  revokedJtis.set(jti, Date.now() + sessionMaxAgeMs());
}

/** Expulsa os jtis já revogados (evita o map crescer sem limite). */
export function isTokenRevoked(jti: string) {
  const until = revokedJtis.get(jti);
  if (until === undefined) return false;
  if (Date.now() > until) {
    revokedJtis.delete(jti);
    return false;
  }
  return true;
}

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
    jti: typeof payload.jti === 'string' ? payload.jti : '',
  } satisfies TokenPayload & { jti: string };
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
    if (payload.jti && isTokenRevoked(payload.jti)) return null;
    const user = await loadRbacUserById(payload.userId);
    // Usuário bloqueado: encerra a sessão ativa de imediato (não consegue mais acessar).
    // A conta de sistema fica isenta do bloqueio — nunca pode ser bloqueada de logar.
    if (!user || (user.blocked && !isSystemAdminEmail(user.email))) return null;
    return user;
  } catch {
    return null;
  }
}

/** Secure cookie só em HTTPS. Em HTTP (LAN) o browser ignora Secure. */
export function cookieSecure() {
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
