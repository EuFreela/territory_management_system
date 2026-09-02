import { Navigate } from 'react-router-dom';
import { LoadingScreen } from '@/components/ui/Spinner';
import { useAuth } from '@/lib/auth-context';

/** Bloqueia rota no frontend para não-administradores (a API ainda é a fonte da verdade). */
export default function RequireAdmin({
  children,
  fallback = '/dashboard',
}: {
  children: React.ReactNode;
  fallback?: string;
}) {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen label="Carregando sessão…" />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!user.isAdmin && user.role?.slug !== 'admin') {
    return <Navigate to={fallback} replace />;
  }

  return <>{children}</>;
}