import type { NextFunction, Request, Response } from 'express';
import { hasAllPermissions, hasAnyPermission, type Scope } from '../lib/rbac.js';
import type { AuthedRequest } from './requireAuth.js';

/**
 * Exige que o usuário autenticado tenha TODOS os escopos informados.
 * Admin (role admin) passa em qualquer checagem.
 */
export function requirePermission(...scopes: Scope[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as AuthedRequest).user;
    if (!user) {
      res.status(401).json({ error: 'Não autorizado' });
      return;
    }

    if (!hasAllPermissions(user, scopes)) {
      res.status(403).json({
        error: 'Você não tem permissão para esta ação.',
        required: scopes,
      });
      return;
    }

    next();
  };
}

/** Exige ao menos um dos escopos. */
export function requireAnyPermission(...scopes: Scope[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as AuthedRequest).user;
    if (!user) {
      res.status(401).json({ error: 'Não autorizado' });
      return;
    }

    if (!hasAnyPermission(user, scopes)) {
      res.status(403).json({
        error: 'Você não tem permissão para esta ação.',
        required_any: scopes,
      });
      return;
    }

    next();
  };
}
