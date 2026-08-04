import { FormEvent, useEffect, useState } from 'react';
import { IconPlus, IconTrash, IconUsers } from '@/components/Map/mapIcons';
import { useConfirm } from '@/components/ui/ConfirmModal';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

type Role = {
  id: number;
  slug: string;
  name: string;
  description?: string | null;
  permissions: string[];
};

type ManagedUser = {
  id: number;
  name: string;
  email: string;
  role_id: number | null;
  role: { id: number; slug: string; name: string } | null;
  created_at?: string;
};

export default function UsersPage() {
  const confirm = useConfirm();
  const { user: me } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [list, rolesRes] = await Promise.all([
        api<ManagedUser[]>('/api/users'),
        api<{ roles: Role[] }>('/api/users/roles'),
      ]);
      setUsers(list);
      setRoles(rolesRes.roles);
      if (roleId === '' && rolesRes.roles.length) {
        const field = rolesRes.roles.find((r) => r.slug === 'field');
        setRoleId(field?.id ?? rolesRes.roles[0].id);
      }
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar usuários.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (roleId === '') {
      setError('Selecione um papel.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api('/api/users', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          role_id: roleId,
        }),
      });
      setName('');
      setEmail('');
      setPassword('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar usuário.');
    } finally {
      setSaving(false);
    }
  }

  async function onChangeRole(userId: number, nextRoleId: number) {
    try {
      await api(`/api/users/${userId}`, {
        method: 'PUT',
        body: JSON.stringify({ role_id: nextRoleId }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao alterar papel.');
    }
  }

  async function onDelete(u: ManagedUser) {
    const ok = await confirm({
      title: 'Excluir usuário',
      message: `Remover ${u.name} (${u.email})? Esta ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
      cancelLabel: 'Cancelar',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await api(`/api/users/${u.id}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir.');
    }
  }

  return (
    <main className="app-page max-w-4xl space-y-6">
      <div className="space-y-6">
        <div>
          <p className="app-section-title">Administração</p>
          <div className="mt-1 flex items-center gap-2">
            <IconUsers className="h-6 w-6 text-apple-ink" />
            <h1 className="app-title">Usuários e papéis</h1>
          </div>
          <p className="app-subtitle">
            Controle de acesso baseado em papéis (RBAC). O administrador tem todos os escopos; demais
            papéis recebem permissões delegadas.
          </p>
        </div>

        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <section className="app-card-pad">
          <h2 className="mb-4 text-[17px] font-semibold tracking-tightish text-apple-ink">
            Novo usuário
          </h2>
          <form onSubmit={onCreate} className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="app-label">Nome</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="app-input"
                required
                minLength={2}
              />
            </div>
            <div>
              <label className="app-label">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="app-input"
                required
              />
            </div>
            <div>
              <label className="app-label">Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="app-input"
                required
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="app-label">Papel</label>
              <select
                value={roleId}
                onChange={(e) => setRoleId(Number(e.target.value))}
                className="app-input"
                required
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.slug})
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={saving}
                className="app-btn-primary disabled:opacity-60"
              >
                <IconPlus className="h-4 w-4" />
                {saving ? 'Criando…' : 'Criar usuário'}
              </button>
            </div>
          </form>
        </section>

        <section className="app-card-pad">
          <h2 className="mb-3 text-[17px] font-semibold tracking-tightish text-apple-ink">Papéis</h2>
          <ul className="space-y-2 text-sm">
            {roles.map((r) => (
              <li key={r.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                <p className="font-semibold text-slate-900">
                  {r.name}{' '}
                  <span className="font-mono text-xs font-normal text-slate-500">{r.slug}</span>
                </p>
                {r.description ? <p className="text-slate-600">{r.description}</p> : null}
                <p className="mt-1 font-mono text-xs text-slate-500">
                  {r.permissions?.join(', ') || '—'}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section className="app-card-pad">
          <h2 className="mb-3 text-[17px] font-semibold tracking-tightish text-apple-ink">Usuários</h2>
          {loading ? (
            <p className="text-slate-600">Carregando…</p>
          ) : users.length === 0 ? (
            <p className="text-slate-600">Nenhum usuário.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {users.map((u) => (
                <li
                  key={u.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div>
                    <p className="font-semibold text-slate-900">
                      {u.name}
                      {me?.id === u.id ? (
                        <span className="ml-2 text-xs font-medium text-sky-700">(você)</span>
                      ) : null}
                    </p>
                    <p className="text-sm text-slate-600">{u.email}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={u.role_id ?? ''}
                      onChange={(e) => void onChangeRole(u.id, Number(e.target.value))}
                      className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
                      disabled={me?.id === u.id && u.role?.slug === 'admin'}
                      title="Alterar papel"
                    >
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      title="Excluir"
                      aria-label="Excluir"
                      disabled={me?.id === u.id}
                      onClick={() => void onDelete(u)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-white text-red-700 hover:bg-red-50 disabled:opacity-40"
                    >
                      <IconTrash className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
