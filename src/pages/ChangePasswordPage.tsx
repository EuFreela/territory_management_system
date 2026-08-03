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
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg">
        <h1 className="mb-2 text-2xl font-bold text-slate-900">Alterar senha</h1>
        <p className="mb-6 text-sm text-slate-600">
          Use uma senha forte: mínimo 10 caracteres, com maiúscula, minúscula, número e caractere
          especial.
        </p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="current" className="mb-1 block text-sm font-medium text-slate-700">
              Senha atual
            </label>
            <input
              id="current"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-sky-500"
              required
              disabled={submitting}
            />
          </div>

          <div>
            <label htmlFor="new" className="mb-1 block text-sm font-medium text-slate-700">
              Nova senha
            </label>
            <input
              id="new"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-sky-500"
              required
              minLength={10}
              disabled={submitting}
            />
          </div>

          <div>
            <label htmlFor="confirm" className="mb-1 block text-sm font-medium text-slate-700">
              Confirmar nova senha
            </label>
            <input
              id="confirm"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-sky-500"
              required
              minLength={10}
              disabled={submitting}
            />
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {ok ? <p className="text-sm text-emerald-700">{ok}</p> : null}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-sky-600 px-4 py-2 font-semibold text-white hover:bg-sky-700 disabled:opacity-70"
          >
            {submitting ? 'Salvando…' : 'Salvar nova senha'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-600">
          <Link to="/dashboard" className="font-medium text-sky-700">
            Voltar ao dashboard
          </Link>
        </p>
      </div>
    </main>
  );
}
