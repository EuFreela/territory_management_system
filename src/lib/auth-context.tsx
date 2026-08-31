import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setUnauthorizedHandler } from './api';
import { can, type AuthUserWithRbac, type Scope, type ThemePreference } from './permissions';

export type AuthUser = AuthUserWithRbac;
export type { ThemePreference };

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  setUser: (user: AuthUser | null) => void;
  logout: () => Promise<void>;
  can: (scope: Scope) => boolean;
  isAdmin: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const me = await api<AuthUser>('/api/auth/me');
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Qualquer 401 (sessão caída / conta bloqueada) derruba a sessão na hora:
  // o ProtectedRoute redireciona para o login e o chat é desmontado.
  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    return () => setUnauthorizedHandler(null);
  }, []);

  const logout = useCallback(async () => {
    // Sai do online do chat só nesta aba (best-effort) antes de encerrar a sessão
    try {
      const { getChatClientId } = await import('./chat-session');
      const clientId = getChatClientId();
      await api('/api/presence/session', {
        method: 'DELETE',
        body: JSON.stringify({ clientId }),
      });
    } catch {
      /* ignore */
    }
    await api('/api/auth/logout', { method: 'POST' });
    setUser(null);
  }, []);

  const canFn = useCallback((scope: Scope) => can(user, scope), [user]);

  const value = useMemo(
    () => ({
      user,
      loading,
      refresh,
      setUser,
      logout,
      can: canFn,
      isAdmin: Boolean(user?.isAdmin || user?.role?.slug === 'admin'),
    }),
    [user, loading, refresh, logout, canFn],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
