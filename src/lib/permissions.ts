/** Escopos RBAC espelhados do backend (server/lib/rbac.ts) */
export const SCOPES = [
  'territory:create',
  'territory:read',
  'territory:update',
  'territory:delete',
  'territory:set_daily',
  'block:manage',
  'block:check',
  'schedule:manage',
  'user:manage',
  'config:cep',
  'congregation:manage',
] as const;

export type Scope = (typeof SCOPES)[number];

export type RoleInfo = {
  id: number;
  slug: string;
  name: string;
};

export type ThemePreference = 'light' | 'dark';

export type AuthUserWithRbac = {
  id: number;
  email: string;
  name: string;
  role?: RoleInfo | null;
  permissions?: Scope[] | string[];
  isAdmin?: boolean;
  /** Preferência salva no usuário (banco) */
  theme_preference?: ThemePreference | null;
  /** CEP gravado na conta (null = usa o padrão do .env) */
  active_cep?: string | null;
  /** CEP efetivo da região de trabalho */
  working_cep?: string;
  /** Nome da congregação vinculado ao CEP */
  congregation_name?: string | null;
  /** Conta bloqueada (não pode entrar) */
  blocked?: boolean;
};

export function can(user: AuthUserWithRbac | null | undefined, scope: Scope): boolean {
  if (!user) return false;
  if (user.isAdmin || user.role?.slug === 'admin') return true;
  const perms = user.permissions ?? [];
  return perms.includes(scope);
}

export function canAny(user: AuthUserWithRbac | null | undefined, scopes: Scope[]): boolean {
  return scopes.some((s) => can(user, s));
}

export function canAll(user: AuthUserWithRbac | null | undefined, scopes: Scope[]): boolean {
  return scopes.every((s) => can(user, s));
}
