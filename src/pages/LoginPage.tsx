import { FormEvent, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { IconMoon, IconSun } from '@/components/Map/mapIcons';
import { api } from '@/lib/api';
import { useAuth, type AuthUser } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';

export default function LoginPage() {
  const { user, loading, setUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const data = await api<{ user: AuthUser; password_is_weak?: boolean }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setUser(data.user);
      if (data.password_is_weak) {
        sessionStorage.setItem('campo_must_change_password', '1');
        navigate('/change-password', { replace: true });
      } else {
        sessionStorage.removeItem('campo_must_change_password');
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao fazer login.');
      setSubmitting(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-apple-bg px-5">
      {/* fundo sutil */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(0,113,227,0.08),_transparent_55%)] dark:bg-[radial-gradient(ellipse_at_top,_rgba(10,132,255,0.14),_transparent_55%)]"
      />

      <button
        type="button"
        onClick={toggleTheme}
        title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
        aria-label={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
        className="app-icon-btn absolute right-4 top-4 z-10 sm:right-6 sm:top-6"
      >
        {theme === 'dark' ? <IconSun className="h-4 w-4" /> : <IconMoon className="h-4 w-4" />}
      </button>

      <div className="relative w-full max-w-[400px]">
        <div className="mb-8 text-center">
          <img
            src="/logo.webp"
            alt="Campo"
            width={72}
            height={72}
            className="mx-auto mb-4 h-[72px] w-[72px] rounded-[18px] object-cover shadow-card ring-1 ring-black/[0.06] dark:ring-white/[0.08]"
          />
          <h1 className="text-[28px] font-semibold tracking-tightish text-apple-ink">Campo</h1>
          <p className="mt-1 text-[15px] text-apple-secondary">Territórios de campo</p>
        </div>

        <div className="rounded-apple-xl border border-apple-line bg-apple-surface/90 p-7 shadow-card backdrop-blur-sm sm:p-8">
          <h2 className="mb-6 text-center text-[17px] font-semibold text-apple-ink">Entrar</h2>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="app-label">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="app-input"
                required
                disabled={submitting}
                autoComplete="username"
              />
            </div>

            <div>
              <label htmlFor="password" className="app-label">
                Senha
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="app-input"
                required
                disabled={submitting}
                autoComplete="current-password"
              />
            </div>

            {error ? (
              <p className="rounded-apple bg-red-50 px-3 py-2 text-[13px] text-apple-red">{error}</p>
            ) : null}

            <button type="submit" disabled={submitting} className="app-btn-primary w-full">
              {submitting ? 'Entrando…' : 'Continuar'}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-[12px] leading-relaxed text-apple-tertiary">
          Acesso restrito. Contas são criadas pelo administrador.
        </p>
      </div>
    </main>
  );
}
