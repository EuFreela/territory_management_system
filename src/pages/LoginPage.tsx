import { FormEvent, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { IconLogIn, IconMoon, IconSun } from '@/components/Map/mapIcons';
import FieldError from '@/components/ui/FieldError';
import { api } from '@/lib/api';
import { useAuth, type AuthUser } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';
import { APP_VERSION } from '@/lib/version';

const EMAIL_RE = /^\S+@\S+\.\S+$/;

export default function LoginPage() {
  const { user, loading, setUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const errors: { email?: string; password?: string } = {};
    if (email.trim() === '') {
      errors.email = 'Preencha este campo.';
    } else if (!EMAIL_RE.test(email.trim())) {
      errors.email = 'Informe um e-mail válido.';
    }
    if (password === '') {
      errors.password = 'Preencha este campo.';
    }

    if (errors.email || errors.password) {
      setFieldErrors(errors);
      setSubmitting(false);
      return;
    }
    setFieldErrors({});
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
      toast.error(err instanceof Error ? err.message : 'Erro ao fazer login.');
      setSubmitting(false);
    }
  }

  return (
    <main className="relative flex min-h-screen flex-col bg-apple-bg">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-apple-line bg-apple-surface/75 px-4 backdrop-blur-xl backdrop-saturate-150 sm:px-6">
        <p
          className="text-[12px] font-semibold tracking-tightish text-apple-tertiary"
          title="Versão do sistema"
        >
          <span className="text-apple-secondary">CAMPO</span>{' '}
          <span className="tabular-nums text-apple-ink">{APP_VERSION}</span>
        </p>
        <button
          type="button"
          onClick={toggleTheme}
          data-tooltip={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
          data-tooltip-side="bottom"
          aria-label={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
          className="app-icon-btn"
        >
          {theme === 'dark' ? <IconSun className="h-4 w-4" /> : <IconMoon className="h-4 w-4" />}
        </button>
      </header>

      <div className="flex flex-1 items-center justify-center px-5 py-10 sm:py-14">
        <div className="w-full max-w-[400px]">
          <div className="mb-8 text-center">
            <img
              src="/logo.webp"
              alt="CAMPO"
              width={72}
              height={72}
              className="mx-auto mb-5 h-[72px] w-[72px] rounded-[18px] object-cover shadow-card ring-1 ring-black/[0.06] dark:ring-white/[0.08]"
            />
            <h1 className="app-title">CAMPO</h1>
            <p className="app-subtitle">Congregação Alpinópolis</p>
          </div>

          <div className="app-card-pad sm:p-7">
            <h2 className="mb-1 text-[17px] font-semibold tracking-tightish text-apple-ink">
              Entrar
            </h2>
            <p className="mb-6 text-[14px] leading-relaxed text-apple-secondary">
              Use o email e a senha fornecidos pelo administrador.
            </p>

            <form onSubmit={onSubmit} noValidate className="space-y-4">
              <div>
                <label htmlFor="email" className="app-label">
                  Email
                </label>
                <input
                  id="email"
                  type="text"
                  inputMode="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    if (fieldErrors.email) {
                      setFieldErrors((prev) => ({ ...prev, email: undefined }));
                    }
                  }}
                  className={`app-input ${
                    fieldErrors.email
                      ? 'border-apple-red/60 ring-2 ring-inset ring-apple-red/25'
                      : ''
                  }`}
                  required
                  disabled={submitting}
                  autoComplete="username"
                  placeholder="seuemail@exemplo.com"
                  aria-invalid={Boolean(fieldErrors.email)}
                  aria-describedby={fieldErrors.email ? 'email-error' : undefined}
                />
                {fieldErrors.email ? <FieldError id="email-error">{fieldErrors.email}</FieldError> : null}
              </div>

              <div>
                <label htmlFor="password" className="app-label">
                  Senha
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    if (fieldErrors.password) {
                      setFieldErrors((prev) => ({ ...prev, password: undefined }));
                    }
                  }}
                  className={`app-input ${
                    fieldErrors.password
                      ? 'border-apple-red/60 ring-2 ring-inset ring-apple-red/25'
                      : ''
                  }`}
                  required
                  disabled={submitting}
                  autoComplete="current-password"
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby={fieldErrors.password ? 'password-error' : undefined}
                />
                {fieldErrors.password ? (
                  <FieldError id="password-error">{fieldErrors.password}</FieldError>
                ) : null}
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="app-btn-primary mt-1 h-11 w-full disabled:opacity-60"
              >
                <IconLogIn className="h-4 w-4" />
                {submitting ? 'Entrando…' : 'Continuar'}
              </button>
            </form>
          </div>

          <p className="mt-6 text-center text-[12px] leading-relaxed text-apple-tertiary">
            Acesso restrito. Contas são criadas pelo administrador.
          </p>
        </div>
      </div>
    </main>
  );
}
