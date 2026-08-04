import { FormEvent, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export default function ChangePasswordPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!loading && !user) {
    return <Navigate to="/login" replace />;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setOk('');

    if (newPassword !== confirmPassword) {
      setError('A confirmação não confere com a nova senha.');
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
      setOk('Senha atualizada. Redirecionando…');
      sessionStorage.removeItem('campo_must_change_password');
      window.setTimeout(() => navigate('/dashboard', { replace: true }), 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao alterar senha.');
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-apple-bg px-5">
      <div className="w-full max-w-md rounded-apple-xl border border-apple-line bg-apple-surface p-8 shadow-card">
        <h1 className="mb-2 text-[22px] font-semibold tracking-tightish text-apple-ink">
          Alterar senha
        </h1>
        <p className="mb-6 text-[14px] leading-relaxed text-apple-secondary">
          Use uma senha forte: mínimo 10 caracteres, com maiúscula, minúscula, número e caractere
          especial.
        </p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="current" className="app-label">
              Senha atual
            </label>
            <input
              id="current"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="app-input"
              required
              disabled={submitting}
            />
          </div>

          <div>
            <label htmlFor="new" className="app-label">
              Nova senha
            </label>
            <input
              id="new"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="app-input"
              required
              minLength={10}
              disabled={submitting}
            />
          </div>

          <div>
            <label htmlFor="confirm" className="app-label">
              Confirmar nova senha
            </label>
            <input
              id="confirm"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="app-input"
              required
              minLength={10}
              disabled={submitting}
            />
          </div>

          {error ? (
            <p className="rounded-apple bg-red-50 px-3 py-2 text-[13px] text-apple-red">{error}</p>
          ) : null}
          {ok ? (
            <p className="rounded-apple bg-emerald-50 px-3 py-2 text-[13px] text-emerald-700">{ok}</p>
          ) : null}

          <button type="submit" disabled={submitting} className="app-btn-primary w-full">
            {submitting ? 'Salvando…' : 'Salvar nova senha'}
          </button>
        </form>

        <p className="mt-5 text-center text-[13px] text-apple-secondary">
          <Link to="/dashboard" className="app-link">
            Voltar ao início
          </Link>
        </p>
      </div>
    </main>
  );
}
