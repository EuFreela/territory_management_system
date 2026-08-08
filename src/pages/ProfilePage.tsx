import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { IconKey } from '@/components/Map/mapIcons';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { onInputClearValidity, onInvalidPtBr } from '@/lib/form-validation-pt';

export default function ProfilePage() {
  const { user, refresh } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user?.name != null) setName(user.name);
  }, [user?.name]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      toast.error('Informe um nome com pelo menos 2 caracteres.');
      return;
    }

    setSaving(true);
    try {
      await api('/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({ name: trimmed }),
      });
      await refresh();
      toast.success('Nome atualizado com sucesso.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar o nome.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="app-page max-w-2xl space-y-6">
      <div className="space-y-6">
        <div>
          <p className="app-section-title">Conta</p>
          <h1 className="app-title">Minha conta</h1>
          <p className="app-subtitle">
            Edite seu nome e troque sua senha. Email e papel são definidos pelo administrador.
          </p>
        </div>

        <section className="app-card-pad">
          <h2 className="mb-1 text-[17px] font-semibold tracking-tightish text-apple-ink">Perfil</h2>
          <p className="mb-4 text-[13px] text-apple-secondary">
            O nome aparece para os demais usuários no mapa (GPS) e nas listas do sistema.
          </p>

          <form
            onSubmit={onSubmit}
            onInvalidCapture={onInvalidPtBr}
            onInput={onInputClearValidity}
            className="space-y-4"
          >
            <div>
              <label htmlFor="profile-name" className="app-label">
                Nome
              </label>
              <input
                id="profile-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="app-input"
                required
                minLength={2}
                maxLength={150}
                autoComplete="name"
              />
            </div>

            <div>
              <label className="app-label">Email</label>
              <input
                value={user?.email ?? ''}
                className="app-input cursor-not-allowed opacity-70"
                disabled
                readOnly
                tabIndex={-1}
                aria-readonly
              />
              <p className="mt-1.5 text-[12px] text-apple-tertiary">
                Email só pode ser alterado pelo administrador.
              </p>
            </div>

            <div>
              <label className="app-label">Papel</label>
              <input
                value={user?.role?.name ?? '—'}
                className="app-input cursor-not-allowed opacity-70"
                disabled
                readOnly
                tabIndex={-1}
                aria-readonly
              />
              <p className="mt-1.5 text-[12px] text-apple-tertiary">
                Papel só pode ser alterado pelo administrador.
              </p>
            </div>

            <div className="flex justify-end pt-1">
              <button type="submit" disabled={saving} className="app-btn-primary disabled:opacity-60">
                {saving ? 'Salvando…' : 'Salvar nome'}
              </button>
            </div>
          </form>
        </section>

        <section className="app-card-pad">
          <h2 className="mb-1 text-[17px] font-semibold tracking-tightish text-apple-ink">Senha</h2>
          <p className="mb-4 text-[13px] text-apple-secondary">
            Use uma senha forte: mínimo 10 caracteres, com maiúscula, minúscula, número e caractere
            especial.
          </p>
          <Link to="/change-password" className="app-btn-primary inline-flex items-center gap-2">
            <IconKey className="h-4 w-4" />
            Alterar senha
          </Link>
        </section>
      </div>
    </main>
  );
}
