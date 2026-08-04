import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { api } from './api';
import { useAuth } from './auth-context';
import type { AuthUser, ThemePreference } from './auth-context';

export type Theme = ThemePreference;

const GUEST_STORAGE_KEY = 'campo-theme-guest';

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readGuestTheme(): Theme | null {
  try {
    const stored = localStorage.getItem(GUEST_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
    // compat com chave antiga
    const legacy = localStorage.getItem('campo-theme');
    if (legacy === 'light' || legacy === 'dark') return legacy;
  } catch {
    /* ignore */
  }
  return null;
}

function systemTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function getInitialTheme(): Theme {
  return readGuestTheme() ?? systemTheme();
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', theme === 'dark' ? '#000000' : '#f5f5f7');
  }
}

function normalizeTheme(value: unknown): Theme | null {
  if (value === 'light' || value === 'dark') return value;
  return null;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading, setUser } = useAuth();
  const [theme, setThemeState] = useState<Theme>(() => getInitialTheme());
  const lastUserId = useRef<number | null>(null);
  const saveSeq = useRef(0);

  // Aplica tema do usuário quando a sessão carrega / troca de conta
  useEffect(() => {
    if (authLoading) return;

    if (user) {
      const pref = normalizeTheme(user.theme_preference);
      if (pref) {
        setThemeState(pref);
      } else if (lastUserId.current !== user.id) {
        // usuário sem preferência no banco: mantém o tema atual da UI e tenta gravar
        setThemeState((current) => current);
      }
      lastUserId.current = user.id;
      return;
    }

    // logout: volta ao tema de convidado / sistema
    if (lastUserId.current != null) {
      lastUserId.current = null;
      setThemeState(readGuestTheme() ?? systemTheme());
    }
  }, [user, authLoading]);

  useEffect(() => {
    applyTheme(theme);
    // cache local só quando não autenticado (login)
    if (!user) {
      try {
        localStorage.setItem(GUEST_STORAGE_KEY, theme);
        localStorage.setItem('campo-theme', theme);
      } catch {
        /* ignore */
      }
    }
  }, [theme, user]);

  const persistUserTheme = useCallback(
    async (next: Theme, currentUser: AuthUser) => {
      const seq = ++saveSeq.current;
      try {
        const data = await api<{ theme: Theme; user?: AuthUser }>('/api/auth/theme', {
          method: 'PUT',
          body: JSON.stringify({ theme: next }),
        });
        if (seq !== saveSeq.current) return;
        if (data.user) {
          setUser(data.user);
        } else {
          setUser({ ...currentUser, theme_preference: data.theme ?? next });
        }
      } catch (err) {
        console.error('[theme] falha ao salvar preferência', err);
      }
    },
    [setUser],
  );

  const setTheme = useCallback(
    (next: Theme) => {
      setThemeState(next);
      if (user) {
        setUser({ ...user, theme_preference: next });
        void persistUserTheme(next, user);
      } else {
        try {
          localStorage.setItem(GUEST_STORAGE_KEY, next);
          localStorage.setItem('campo-theme', next);
        } catch {
          /* ignore */
        }
      }
    },
    [user, setUser, persistUserTheme],
  );

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}
