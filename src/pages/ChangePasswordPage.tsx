import { FormEvent, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { IconEye, IconEyeOff, IconKey } from '@/components/Map/mapIcons';
import PasswordField from '@/components/ui/PasswordField';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { onInputClearValidity, onInvalidPtBr } from '@/lib/form-validation-pt';

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

function inputClass(hasError: boolean) {
  return `app-input ${hasError ? 'border-apple-red/60 ring-2 ring-inset ring-apple-red/25' : ''}`;
}

/** Input de senha com cadeado à esquerda e visibilidade controlada pelo olho único externo. */
function PasswordInput({
  id,
  autoComplete,
  value,
  onChange,
  required,
  disabled,
  hasError,
  show,
}: {
  id: string;
  autoComplete: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  hasError?: boolean;
  show: boolean;
}) {
  return (
    <div className="relative">
      <IconKey className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-apple-tertiary" />
      <input
        id={id}
        type={show ? 'text' : 'password'}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass(Boolean(hasError))} pl-10`}
        required={required}
        disabled={disabled}
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

    if (newPassword !== confirmPassword) {
      const msg = 'A confirmação não confere com a nova senha.';
      toast.error(msg);
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
    <main className="flex min-h-screen items-center justify-center bg-apple-bg px-5">
      <div className="w-full max-w-md rounded-apple-xl border border-apple-line bg-apple-surface p-8 shadow-card">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h1 className="text-[22px] font-semibold tracking-tightish text-apple-ink">
            Alterar senha
          </h1>
          <button
            type="button"
            onClick={() => setShowPasswords((s) => !s)}
            aria-label={showPasswords ? 'Ocultar senhas' : 'Mostrar senhas'}
            aria-pressed={showPasswords}
            data-tooltip={showPasswords ? 'Ocultar senhas' : 'Mostrar senhas'}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-apple-line bg-apple-fill text-apple-ink transition hover:bg-apple-line active:scale-95"
          >
            {showPasswords ? <IconEyeOff className="h-[18px] w-[18px]" /> : <IconEye className="h-[18px] w-[18px]" />}
          </button>
        </div>
        <p className="mb-6 text-[14px] leading-relaxed text-apple-secondary">
          Informe a senha atual e escolha uma nova senha forte (o medidor abaixo indica a força).
        </p>

        <form
          onSubmit={onSubmit}
          onInvalidCapture={onInvalidPtBr}
          onInput={onInputClearValidity}
          className="space-y-4"
        >
          <div>
            <label htmlFor="current" className="app-label">
              Senha atual
            </label>
            <PasswordInput
              id="current"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(v) => {
                setCurrentPassword(v);
                clearFieldError('current');
              }}
              required
              disabled={submitting}
              hasError={Boolean(fieldErrors.current)}
              show={showPasswords}
            />
            {fieldErrors.current ? (
              <p className="mt-1.5 text-[12px] font-medium text-apple-red">{fieldErrors.current}</p>
            ) : null}
          </div>

          <div>
            <PasswordField
              label="Nova senha"
              value={newPassword}
              onChange={(v) => {
                setNewPassword(v);
                clearFieldError('new');
              }}
              required
              autoComplete="new-password"
              disabled={submitting}
              error={fieldErrors.new}
              show={showPasswords}
              showToggle={false}
            />
          </div>

          <div>
            <label htmlFor="confirm" className="app-label">
              Confirmar nova senha
            </label>
            <PasswordInput
              id="confirm"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(v) => {
                setConfirmPassword(v);
                clearFieldError('confirm');
              }}
              required
              disabled={submitting}
              hasError={Boolean(fieldErrors.confirm)}
              show={showPasswords}
            />
            {fieldErrors.confirm ? (
              <p className="mt-1.5 text-[12px] font-medium text-apple-red">
                {fieldErrors.confirm}
              </p>
            ) : null}
          </div>

          <button type="submit" disabled={submitting} className="app-btn-primary w-full">
            {submitting ? 'Salvando…' : 'Salvar nova senha'}
          </button>
        </form>

        <p className="mt-5 text-center text-[13px] text-apple-secondary">
          <Link to="/perfil" className="app-link">
            Voltar à minha conta
          </Link>
        </p>
      </div>
    </main>
  );
}
