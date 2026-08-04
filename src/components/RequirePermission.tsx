import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import type { Scope } from '@/lib/permissions';

/** Bloqueia rota no frontend se o usuário não tiver o escopo (API ainda é a fonte da verdade). */
export default function RequirePermission({
  scope,
  anyOf,
  children,
  fallback = '/dashboard',
}: {
  scope?: Scope;
  anyOf?: Scope[];
  children: React.ReactNode;
  fallback?: string;
}) {
  const { user, loading, can } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-600">Carregando…</div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const allowed = scope
    ? can(scope)
    : anyOf
      ? anyOf.some((s) => can(s))
      : true;

  if (!allowed) {
    return <Navigate to={fallback} replace />;
  }

  return <>{children}</>;
}
