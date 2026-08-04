import pool from './db.js';
import {
  DEFAULT_ROLE_PERMISSIONS,
  ROLE_ADMIN,
  SCOPES,
  isScope,
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
};

/**
 * Carrega usuário com papel e permissões (fonte da verdade no banco).
 * Se a tabela de roles ainda não existir, devolve permissões de admin (compat).
 */
export async function loadRbacUserById(userId: number): Promise<RbacUser | null> {
  try {
    const [rows] = await pool.execute(
      `SELECT u.id, u.name, u.email, u.role_id,
              r.slug AS role_slug, r.name AS role_name
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.id = ?
       LIMIT 1`,
      [userId],
    );
    const list = rows as UserRow[];
    const row = list[0];
    if (!row) return null;

    return await buildRbacUser(row);
  } catch (err) {
    // Banco sem migração RBAC: tenta só users
    const msg = err instanceof Error ? err.message : String(err);
    if (!/roles|role_id|Unknown column/i.test(msg)) throw err;

    const [rows] = await pool.execute(
      'SELECT id, name, email FROM users WHERE id = ? LIMIT 1',
      [userId],
    );
    const list = rows as Array<{ id: number; name: string; email: string }>;
    const row = list[0];
    if (!row) return null;

    // Sem RBAC: mantém acesso total (comportamento antigo) até migrar
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role: { id: 0, slug: ROLE_ADMIN, name: 'Administrador' },
      permissions: [...SCOPES],
      isAdmin: true,
    };
  }
}

export async function loadRbacUserByEmail(email: string): Promise<RbacUser | null> {
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
    return await buildRbacUser(row);
  } catch {
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
      // fallback: mapa estático do slug
      permissions = DEFAULT_ROLE_PERMISSIONS[role.slug] ?? [];
    }

    // se admin sem linhas na tabela, usa tudo
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
  };
}
