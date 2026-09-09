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
  'block:check',
  // A escala de dirigentes é gerida à parte do não em casa (editor e admin).
  'schedule:manage',
  'user:manage',
  // Trocar a região de trabalho (CEP) redireciona o acesso a dados de outra
  // congregação — escopo restrito a papéis privilegiados (padrão: admin).
  'config:cep',
  // Gerir o cadastro de congregações do sistema (restrito a admin).
  'congregation:manage',
] as const;

export type Scope = (typeof SCOPES)[number];

export function isScope(value: string): value is Scope {
  return (SCOPES as readonly string[]).includes(value);
}

export const ROLE_ADMIN = 'admin';
export const ROLE_EDITOR = 'editor';
export const ROLE_FIELD = 'field';
export const ROLE_VIEWER = 'viewer';

/** Email do administrador de sistema — conta única, imutável e protegida. */
export const SYSTEM_ADMIN_EMAIL = 'admin@campo.local';

/** Verdadeiro para o email reservado ao administrador de sistema. */
export function isSystemAdminEmail(email: string | null | undefined): boolean {
  return email != null && email.trim().toLowerCase() === SYSTEM_ADMIN_EMAIL;
}

/** Permissões padrão por papel (seed / referência) */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, Scope[]> = {
  [ROLE_ADMIN]: [...SCOPES],
  [ROLE_EDITOR]: [
    'territory:create',
    'territory:read',
    'territory:update',
    'territory:set_daily',
    'block:manage',
    'block:check',
    'schedule:manage',
  ],
  [ROLE_FIELD]: ['territory:read', 'block:check'],
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
  /** CEP gravado no usuário (null = usa o padrão do .env) */
  active_cep: string | null;
  /** CEP efetivo da região de trabalho (gravado ou padrão) */
  working_cep: string;
  /** Nome da congregação vinculado ao CEP de trabalho */
  congregation_name: string | null;
  /** Usuário bloqueado (não pode entrar no sistema) */
  blocked: boolean;
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
