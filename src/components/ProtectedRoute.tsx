import { Navigate, Outlet, useLocation } from 'react-router-dom';
import AppShell from '@/components/layout/AppShell';
import { useAuth } from '@/lib/auth-context';

export default function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="min-h-screen bg-apple-bg" />;
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
