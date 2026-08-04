import { Navigate, Outlet, useLocation } from 'react-router-dom';
import AppShell from '@/components/layout/AppShell';
import { useAuth } from '@/lib/auth-context';

export default function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-apple-bg">
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-pulse rounded-full bg-apple-ink/10" />
          <p className="text-[15px] text-apple-secondary">Carregando…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const mustChange =
    typeof sessionStorage !== 'undefined' &&
    sessionStorage.getItem('campo_must_change_password') === '1';

  if (mustChange && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  // Troca de senha forçada: tela limpa, sem shell
  if (location.pathname === '/change-password' && mustChange) {
    return <Outlet />;
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
