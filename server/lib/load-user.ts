import pool from './db.js';
import {
  DEFAULT_ROLE_PERMISSIONS,
  ROLE_ADMIN,
  SCOPES,
  isScope,
  normalizeThemePreference,
  type RbacUser,
  type RoleInfo,
  type Scope,
  type ThemePreference,
} from './rbac.js';

type UserRow = {
  id: number;
  name: string;
  email: string;
  role_id: number | null;
  role_slug: string | null;
  role_name: string | null;
  theme_preference?: string | null;
};

async function selectUserWithRbac(userId: number, withTheme: boolean): Promise<UserRow | null> {
  const themeCol = withTheme ? ', u.theme_preference' : '';
  const [rows] = await pool.execute(
    `SELECT u.id, u.name, u.email, u.role_id${themeCol},
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
 * Se a tabela de roles ainda não existir, devolve permissões de admin (compat).
 */
export async function loadRbacUserById(userId: number): Promise<RbacUser | null> {
  try {
    const row = await selectUserWithRbac(userId, true);
    if (!row) return null;
    return await buildRbacUser(row);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    // Coluna theme ainda não migrada: carrega RBAC sem ela
    if (/theme_preference/i.test(msg)) {
      try {
        const row = await selectUserWithRbac(userId, false);
        if (!row) return null;
        return await buildRbacUser({ ...row, theme_preference: 'light' });
      } catch (inner) {
        const innerMsg = inner instanceof Error ? inner.message : String(inner);
        if (!/roles|role_id|Unknown column/i.test(innerMsg)) throw inner;
      }
    } else if (!/roles|role_id|Unknown column/i.test(msg)) {
      throw err;
    }

    // Banco sem migração RBAC
    try {
      const [rows] = await pool.execute(
        'SELECT id, name, email, theme_preference FROM users WHERE id = ? LIMIT 1',
        [userId],
      );
      const list = rows as Array<{
        id: number;
        name: string;
        email: string;
        theme_preference?: string | null;
      }>;
      const row = list[0];
      if (!row) return null;

      return {
        id: row.id,
        name: row.name,
        email: row.email,
        role: { id: 0, slug: ROLE_ADMIN, name: 'Administrador' },
        permissions: [...SCOPES],
        isAdmin: true,
        theme_preference: normalizeThemePreference(row.theme_preference),
      };
    } catch {
      const [rows] = await pool.execute(
        'SELECT id, name, email FROM users WHERE id = ? LIMIT 1',
        [userId],
      );
      const list = rows as Array<{ id: number; name: string; email: string }>;
      const row = list[0];
      if (!row) return null;

      return {
        id: row.id,
        name: row.name,
        email: row.email,
        role: { id: 0, slug: ROLE_ADMIN, name: 'Administrador' },
        permissions: [...SCOPES],
        isAdmin: true,
        theme_preference: 'light' as ThemePreference,
      };
    }
  }
}

export async function loadRbacUserByEmail(email: string): Promise<RbacUser | null> {
  try {
    const [rows] = await pool.execute(
      `SELECT u.id, u.name, u.email, u.role_id, u.theme_preference,
              r.slug AS role_slug, r.name AS role_name
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.email = ?
       LIMIT 1`,
      [email.toLowerCase()],
    );
    const list = rows as UserRow[];
    const row = list[0];
    if (!row) return null;
    return await buildRbacUser(row);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/theme_preference/i.test(msg)) {
      try {
        const [rows] = await pool.execute(
          `SELECT u.id, u.name, u.email, u.role_id,
                  r.slug AS role_slug, r.name AS role_name
           FROM users u
           LEFT JOIN roles r ON r.id = u.role_id
           WHERE u.email = ?
           LIMIT 1`,
          [email.toLowerCase()],
        );
        const list = rows as UserRow[];
        const row = list[0];
        if (!row) return null;
        return await buildRbacUser({ ...row, theme_preference: 'light' });
      } catch {
        return null;
      }
    }
    return null;
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

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role,
    permissions,
    isAdmin,
    theme_preference: normalizeThemePreference(row.theme_preference),
  };
}
