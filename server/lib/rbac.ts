/**
 * RBAC — Role-Based Access Control
 * Escopos (permissions) do sistema Campo.
 */

export const SCOPES = [
  'territory:create',
  'territory:read',
  'territory:update',
  'territory:delete',
  'territory:set_daily',
  'block:manage',
  'user:manage',
] as const;

export type Scope = (typeof SCOPES)[number];

export function isScope(value: string): value is Scope {
  return (SCOPES as readonly string[]).includes(value);
}

export const ROLE_ADMIN = 'admin';
export const ROLE_EDITOR = 'editor';
export const ROLE_FIELD = 'field';
export const ROLE_VIEWER = 'viewer';

/** Permissões padrão por papel (seed / referência) */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, Scope[]> = {
  [ROLE_ADMIN]: [...SCOPES],
  [ROLE_EDITOR]: [
    'territory:create',
    'territory:read',
    'territory:update',
    'territory:set_daily',
    'block:manage',
  ],
  [ROLE_FIELD]: ['territory:read', 'territory:set_daily', 'block:manage'],
  [ROLE_VIEWER]: ['territory:read'],
};

export type RoleInfo = {
  id: number;
  slug: string;
  name: string;
};

export type ThemePreference = 'light' | 'dark';

export type RbacUser = {
  id: number;
  email: string;
  name: string;
  role: RoleInfo | null;
  permissions: Scope[];
  isAdmin: boolean;
  /** Preferência de aparência salva no usuário */
  theme_preference: ThemePreference;
};

export function normalizeThemePreference(value: unknown): ThemePreference {
  return value === 'dark' ? 'dark' : 'light';
}

export function hasPermission(user: Pick<RbacUser, 'isAdmin' | 'permissions'>, scope: Scope): boolean {
  if (user.isAdmin) return true;
  return user.permissions.includes(scope);
}

export function hasAnyPermission(
  user: Pick<RbacUser, 'isAdmin' | 'permissions'>,
  scopes: Scope[],
): boolean {
  if (user.isAdmin) return true;
  return scopes.some((s) => user.permissions.includes(s));
}

export function hasAllPermissions(
  user: Pick<RbacUser, 'isAdmin' | 'permissions'>,
  scopes: Scope[],
): boolean {
  if (user.isAdmin) return true;
  return scopes.every((s) => user.permissions.includes(s));
}
