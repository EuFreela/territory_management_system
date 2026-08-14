import { FormEvent, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { IconArrowLeft, IconEye, IconEyeOff, IconKey, IconSave } from '@/components/Map/mapIcons';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import FieldError from '@/components/ui/FieldError';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PasswordField from '@/components/ui/PasswordField';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

type FieldErrors = {
  current?: string;
  new?: string;
  confirm?: string;
};

/** Mapeia a mensagem de erro para o campo relacionado (senha atual, nova ou confirmação). */
function classifyError(msg: string): keyof FieldErrors | null {
  if (/senha atual|informe a senha atual/i.test(msg)) return 'current';
  if (/confirma/i.test(msg)) return 'confirm';
  if (
    /nova senha|senha deve|senha precisa|senha muito|senha comum|senha fraca|diferente da atual|letra minúscula|letra maiúscula|número|caractere especial/i.test(
      msg,
    )
  ) {
    return 'new';
  }
  return null;
}

/** Input de senha com cadeado à esquerda e visibilidade controlada pelo olho único externo. */
function PasswordInput({
  id,
  errorId,
  autoComplete,
  value,
  onChange,
  disabled,
  hasError,
  show,
}: {
  id: string;
  errorId?: string;
  autoComplete: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  hasError?: boolean;
  show: boolean;
}) {
  return (
    <div className="relative">
      <IconKey className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
      <Input
        id={id}
        type={show ? 'text' : 'password'}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`pl-9 ${hasError ? 'border-destructive/60 ring-2 ring-destructive/25' : ''}`}
        disabled={disabled}
        aria-invalid={hasError}
        aria-describedby={hasError ? errorId : undefined}
      />
    </div>
  );
}

export default function ChangePasswordPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);

  if (!loading && !user) {
    return <Navigate to="/login" replace />;
  }

  function clearFieldError(key: keyof FieldErrors) {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFieldErrors({});

    const errors: FieldErrors = {};
    if (currentPassword === '') errors.current = 'Preencha este campo.';
    if (newPassword === '') errors.new = 'Preencha este campo.';
    if (confirmPassword === '') errors.confirm = 'Preencha este campo.';
    if (Object.values(errors).some(Boolean)) {
      setFieldErrors(errors);
      return;
    }

    if (newPassword !== confirmPassword) {
      const msg = 'A confirmação não confere com a nova senha.';
      setFieldErrors({ confirm: msg });
      return;
    }

    setSubmitting(true);
    try {
      await api('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      sessionStorage.removeItem('campo_must_change_password');
      toast.success('Senha atualizada com sucesso.');
      window.setTimeout(() => navigate('/perfil', { replace: true }), 800);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao alterar senha.';
      toast.error(msg);
      const key = classifyError(msg);
      if (key) setFieldErrors({ [key]: msg });
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-5">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
            <div className="grid gap-1">
              <CardTitle>Alterar senha</CardTitle>
              <CardDescription>
                Informe a senha atual e escolha uma nova senha forte (o medidor abaixo indica a
                força).
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setShowPasswords((s) => !s)}
              aria-label={showPasswords ? 'Ocultar senhas' : 'Mostrar senhas'}
              aria-pressed={showPasswords}
              data-tooltip={showPasswords ? 'Ocultar senhas' : 'Mostrar senhas'}
              data-tooltip-side="bottom"
            >
              {showPasswords ? <IconEyeOff /> : <IconEye />}
            </Button>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} noValidate className="grid gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="current">Senha atual</Label>
                <PasswordInput
                  id="current"
                  errorId="current-error"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(v) => {
                    setCurrentPassword(v);
                    clearFieldError('current');
                  }}
                  disabled={submitting}
                  hasError={Boolean(fieldErrors.current)}
                  show={showPasswords}
                />
                {fieldErrors.current ? (
                  <FieldError id="current-error">{fieldErrors.current}</FieldError>
                ) : null}
              </div>

              <PasswordField
                label="Nova senha"
                value={newPassword}
                onChange={(v) => {
                  setNewPassword(v);
                  clearFieldError('new');
                }}
                autoComplete="new-password"
                disabled={submitting}
                error={fieldErrors.new}
                show={showPasswords}
                showToggle={false}
              />

              <div className="grid gap-1.5">
                <Label htmlFor="confirm">Confirmar nova senha</Label>
                <PasswordInput
                  id="confirm"
                  errorId="confirm-error"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(v) => {
                    setConfirmPassword(v);
                    clearFieldError('confirm');
                  }}
                  disabled={submitting}
                  hasError={Boolean(fieldErrors.confirm)}
                  show={showPasswords}
                />
                {fieldErrors.confirm ? (
                  <FieldError id="confirm-error">{fieldErrors.confirm}</FieldError>
                ) : null}
              </div>

              <div className="flex items-center justify-end gap-2">
                <Button
                  asChild
                  variant="outline"
                  size="icon"
                  data-tooltip="Voltar à minha conta"
                  aria-label="Voltar à minha conta"
                >
                  <Link to="/perfil">
                    <IconArrowLeft />
                  </Link>
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  data-tooltip="Salvar nova senha"
                >
                  <IconSave />
                  Salvar Alterações
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
