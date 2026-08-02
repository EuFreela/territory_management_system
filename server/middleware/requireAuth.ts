import type { NextFunction, Request, Response } from 'express';
import { getUserFromRequest, type AuthUser } from '../lib/auth.js';

export type AuthedRequest = Request & { user: AuthUser };

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = await getUserFromRequest(req);

  if (!user) {
    res.status(401).json({ error: 'Não autorizado' });
    return;
  }

  (req as AuthedRequest).user = user;
  next();
}
