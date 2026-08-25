import { FormEvent, useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { FcGoogle } from 'react-icons/fc';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { DotGridBackground } from '@/components/ui/dot-grid-background';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { IconEye, IconEyeOff, IconLogIn, IconMoon, IconSun } from '@/components/Map/mapIcons';
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
  const [showPassword, setShowPassword] = useState(false);
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
    <main className="relative flex min-h-svh flex-col overflow-hidden bg-black">
      <DotGridBackground />

      <header className="relative z-10 flex h-14 shrink-0 items-center justify-between border-b border-white/10 bg-black/40 px-4 backdrop-blur-xl sm:px-6">
        <p
          className="text-[12px] font-semibold tracking-tight text-white/60"
          title="Versão do sistema"
        >
          <span className="text-white">CAMPO</span>{' '}
          <span className="tabular-nums">{APP_VERSION}</span>
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          data-tooltip={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
          data-tooltip-side="bottom"
          aria-label={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
          className="text-white/80 hover:bg-white/10 hover:text-white"
        >
          {theme === 'dark' ? <IconSun /> : <IconMoon />}
        </Button>
      </header>

      <div className="relative z-10 flex flex-1 items-center justify-center px-5 py-10 sm:py-14">
        <Card className="w-full max-w-[400px] border-white/10 bg-card shadow-2xl shadow-black/50">
          <CardHeader className="justify-items-center text-center">
            <img
              src="/logo.webp"
              alt="CAMPO"
              width={72}
              height={72}
              className="mb-1 h-[72px] w-[72px] rounded-[18px] object-cover ring-1 ring-border"
            />
            <CardTitle className="text-[1.75rem] font-semibold tracking-tight sm:text-[2rem]">
              CAMPO
            </CardTitle>
            <CardDescription className="text-[15px] leading-relaxed">
              Unidos por Jeová
            </CardDescription>
          </CardHeader>

          <CardContent className="grid gap-4">
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">Acesse sua conta</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Entre com seu e-mail e senha
              </p>
            </div>

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
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
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
                    className="pr-11"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    data-tooltip={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    data-tooltip-side="left"
                    disabled={submitting}
                    className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground active:scale-95 disabled:opacity-40"
                  >
                    {showPassword ? (
                      <IconEyeOff className="h-[18px] w-[18px]" />
                    ) : (
                      <IconEye className="h-[18px] w-[18px]" />
                    )}
                  </button>
                </div>
                {fieldErrors.password ? (
                  <FieldError id="password-error">{fieldErrors.password}</FieldError>
                ) : null}
              </div>

              <Button type="submit" disabled={submitting} className="w-full">
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

          <CardFooter className="justify-center border-t-0 bg-transparent">
            <p className="text-center text-xs leading-relaxed text-muted-foreground">
              Acesso restrito. Contas são criadas pelo administrador ou na primeira entrada com
              Google.
            </p>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}
