import { SignJWT, jwtVerify } from 'jose';
import type { Request } from 'express';

export type AuthUser = {
  id: number;
  email: string;
  name: string;
};

export type TokenPayload = {
  userId: number;
  email: string;
  name: string;
};

export const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

function getSecretKey() {
  return new TextEncoder().encode(JWT_SECRET);
}

export async function signToken(user: AuthUser) {
  return new SignJWT({
    userId: user.id,
    email: user.email,
    name: user.name,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecretKey());
}

export async function verifyToken(token: string) {
  const { payload } = await jwtVerify(token, getSecretKey());

  return {
    userId: Number(payload.userId),
    email: String(payload.email ?? ''),
    name: String(payload.name ?? ''),
  } satisfies TokenPayload;
}

export async function getUserFromRequest(req: Request): Promise<AuthUser | null> {
  const token = req.cookies?.auth_token as string | undefined;
  if (!token) return null;

  try {
    const payload = await verifyToken(token);
    return {
      id: payload.userId,
      email: payload.email,
      name: payload.name,
    };
  } catch {
    return null;
  }
}

export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 7 * 1000,
};
