import { FormEvent, useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { FcGoogle } from 'react-icons/fc';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
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
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [startingGoogle, setStartingGoogle] = useState(false);

  useEffect(() => {
    api<{ enabled: boolean }>('/api/config/google')
      .then((data) => setGoogleEnabled(Boolean(data?.enabled)))
      .catch(() => setGoogleEnabled(false));
  }, []);

  // Erro vindo do callback do Google (?error=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');
    if (error) {
      toast.error(error);
      params.delete('error');
      const q = params.toString();
      window.history.replaceState(null, '', `${window.location.pathname}${q ? `?${q}` : ''}`);
    }
  }, []);

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
    <main className="flex min-h-svh flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-xl sm:px-6">
        <p
          className="text-[12px] font-semibold tracking-tight text-muted-foreground"
          title="Versão do sistema"
        >
          <span className="text-foreground">CAMPO</span>{' '}
          <span className="tabular-nums">{APP_VERSION}</span>
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          data-tooltip={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
          aria-label={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
        >
          {theme === 'dark' ? <IconSun /> : <IconMoon />}
        </Button>
      </header>

      <div className="flex flex-1 items-center justify-center px-5 py-10 sm:py-14">
        <div className="w-full max-w-[400px]">
          <div className="mb-8 text-center">
            <img
              src="/logo.webp"
              alt="CAMPO"
              width={72}
              height={72}
              className="mx-auto mb-5 h-[72px] w-[72px] rounded-[18px] object-cover ring-1 ring-border"
            />
            <h1 className="text-[1.75rem] font-semibold tracking-tight sm:text-[2rem]">CAMPO</h1>
            <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">
              Congregação Alpinópolis
            </p>
          </div>

          <Card>
            <CardHeader className="text-center">
              <CardTitle>Acesse sua conta</CardTitle>
              <CardDescription>Entre com seu e-mail e senha</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <form onSubmit={onSubmit} noValidate className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
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
                    placeholder="seuemail@exemplo.com"
                    autoComplete="username"
                    required
                    disabled={submitting}
                    aria-invalid={Boolean(fieldErrors.email)}
                    aria-describedby={fieldErrors.email ? 'email-error' : undefined}
                  />
                  {fieldErrors.email ? (
                    <FieldError id="email-error">{fieldErrors.email}</FieldError>
                  ) : null}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      if (fieldErrors.password) {
                        setFieldErrors((prev) => ({ ...prev, password: undefined }));
                      }
                    }}
                    autoComplete="current-password"
                    required
                    disabled={submitting}
                    aria-invalid={Boolean(fieldErrors.password)}
                    aria-describedby={fieldErrors.password ? 'password-error' : undefined}
                  />
                  {fieldErrors.password ? (
                    <FieldError id="password-error">{fieldErrors.password}</FieldError>
                  ) : null}
                </div>

                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full"
                >
                  <IconLogIn />
                  {submitting ? 'Entrando…' : 'Entrar'}
                </Button>
              </form>

              <div className="flex items-center gap-3">
                <Separator className="flex-1" />
                <span className="text-xs text-muted-foreground">ou</span>
                <Separator className="flex-1" />
              </div>

              <Button
                type="button"
                variant="outline"
                disabled={startingGoogle}
                onClick={() => {
                  if (!googleEnabled) {
                    toast.error('Login com Google não configurado no servidor.');
                    return;
                  }
                  setStartingGoogle(true);
                  window.location.href = '/api/auth/google';
                }}
                className="w-full"
              >
                <FcGoogle className="h-4 w-4" />
                {startingGoogle ? 'Entrando…' : 'Entrar com Google'}
              </Button>
            </CardContent>
          </Card>

          <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">
            Acesso restrito. Contas são criadas pelo administrador ou na primeira entrada com Google.
          </p>
        </div>
      </div>
    </main>
  );
}
