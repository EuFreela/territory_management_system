import pool from './db.js';
import { resolveWorkingCep } from './map-config.js';
import {
  DEFAULT_ROLE_PERMISSIONS,
  ROLE_ADMIN,
  SCOPES,
  isScope,
  normalizeThemePreference,
  type RbacUser,
  type RoleInfo,
  type Scope,
} from './rbac.js';

type UserRow = {
  id: number;
  name: string;
  email: string;
  role_id: number | null;
  role_slug: string | null;
  role_name: string | null;
  theme_preference?: string | null;
  active_cep?: string | null;
};

async function selectUserWithRbac(
  userId: number,
  opts: { theme: boolean; cep: boolean },
): Promise<UserRow | null> {
  const extra = [
    opts.theme ? 'u.theme_preference' : null,
    opts.cep ? 'u.active_cep' : null,
  ]
    .filter(Boolean)
    .join(', ');
  const extraSql = extra ? `, ${extra}` : '';
  const [rows] = await pool.execute(
    `SELECT u.id, u.name, u.email, u.role_id${extraSql},
            r.slug AS role_slug, r.name AS role_name
     FROM users u
     LEFT JOIN roles r ON r.id = u.role_id
     WHERE u.id = ?
     LIMIT 1`,
    [userId],
  );
  const list = rows as UserRow[];
  return list[0] ?? null;
}

/**
 * Carrega usuário com papel e permissões (fonte da verdade no banco).
 * Fail-closed: se as tabelas RBAC não existirem (migração ausente), NEGA o acesso
 * em vez de promover o usuário a administrador.
 */
export async function loadRbacUserById(userId: number): Promise<RbacUser | null> {
  try {
    const row = await selectUserWithRbac(userId, { theme: true, cep: true });
    if (!row) return null;
    return await buildRbacUser(row);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    const missingCep = /active_cep/i.test(msg);
    const missingTheme = /theme_preference/i.test(msg);

    if (missingCep || missingTheme) {
      try {
        const row = await selectUserWithRbac(userId, {
          theme: !missingTheme,
          cep: !missingCep,
        });
        if (!row) return null;
        return await buildRbacUser({
          ...row,
          theme_preference: row.theme_preference ?? 'light',
          active_cep: row.active_cep ?? null,
        });
      } catch (inner) {
        const innerMsg = inner instanceof Error ? inner.message : String(inner);
        if (!/roles|role_id|Unknown column/i.test(innerMsg)) throw inner;
      }
    } else if (!/roles|role_id|Unknown column/i.test(msg)) {
      throw err;
    }

    // Chegou aqui = RBAC ausente (migração não aplicada). Fail-closed.
    console.warn(
      `[load-user] tabelas RBAC ausentes para o usuário ${userId} — acesso negado (rode: npm run migrate:rbac).`,
    );
    return null;
  }
}

function normalizeStoredCep(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function workingCepFor(stored: string | null): string {
  try {
    return resolveWorkingCep({ active_cep: stored });
  } catch {
    return stored ?? '';
  }
}

async function buildRbacUser(row: UserRow): Promise<RbacUser> {
  const role: RoleInfo | null =
    row.role_id != null && row.role_slug
      ? { id: row.role_id, slug: row.role_slug, name: row.role_name || row.role_slug }
      : null;

  const isAdmin = role?.slug === ROLE_ADMIN;

  let permissions: Scope[] = [];

  if (isAdmin) {
    permissions = [...SCOPES];
  } else if (role) {
    try {
      const [permRows] = await pool.execute(
        'SELECT permission FROM role_permissions WHERE role_id = ?',
        [role.id],
      );
      permissions = (permRows as Array<{ permission: string }>)
        .map((p) => p.permission)
        .filter(isScope);
    } catch {
      permissions = DEFAULT_ROLE_PERMISSIONS[role.slug] ?? [];
    }

    if (permissions.length === 0 && DEFAULT_ROLE_PERMISSIONS[role.slug]) {
      permissions = [...DEFAULT_ROLE_PERMISSIONS[role.slug]];
    }
  }

  const active_cep = normalizeStoredCep(row.active_cep);

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role,
    permissions,
    isAdmin,
    theme_preference: normalizeThemePreference(row.theme_preference),
    active_cep,
    working_cep: workingCepFor(active_cep),
  };
}
