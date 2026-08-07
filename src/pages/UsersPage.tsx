import { FormEvent, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { IconHelp, IconPencil, IconPlus, IconSearch, IconTrash, IconUsers } from '@/components/Map/mapIcons';
import PasswordField from '@/components/ui/PasswordField';
import RolesModal from '@/components/ui/RolesModal';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { confirmToast } from '@/lib/confirm-toast';

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
  const { user: me, refresh: refreshAuth } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);

  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRoleId, setEditRoleId] = useState<number | ''>('');
  const [editPassword, setEditPassword] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const [showRoles, setShowRoles] = useState(false);
  const [search, setSearch] = useState('');

  const filteredUsers = useMemo(() => {
    const q = search
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
    if (!q) return users;
    return users.filter((u) => {
      const haystack = `${u.name} ${u.email} ${u.role?.name ?? ''}`
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [users, search]);

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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar usuários.');
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
      toast.error('Selecione um papel.');
      return;
    }
    setSaving(true);
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
      toast.success('Usuário criado com sucesso.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar usuário.');
    } finally {
      setSaving(false);
    }
  }

  function openEdit(u: ManagedUser) {
    setEditing(u);
    setEditName(u.name);
    setEditEmail(u.email);
    setEditRoleId(u.role_id ?? '');
    setEditPassword('');
  }

  function closeEdit() {
    setEditing(null);
    setEditPassword('');
  }

  useEffect(() => {
    if (!editing) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeEdit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  async function onSubmitEdit(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    if (editRoleId === '') {
      toast.error('Selecione um papel.');
      return;
    }

    setEditSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: editName.trim(),
        email: editEmail.trim(),
        role_id: editRoleId,
      };
      if (editPassword.trim()) body.password = editPassword;

      await api(`/api/users/${editing.id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });

      const editedSelf = me?.id === editing.id;
      closeEdit();
      await load();
      toast.success('Alterações salvas com sucesso.');
      if (editedSelf) await refreshAuth();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar alterações.');
    } finally {
      setEditSaving(false);
    }
  }

  function onDelete(u: ManagedUser) {
    confirmToast({
      title: 'Excluir usuário?',
      description: `Remover ${u.name} (${u.email})? Esta ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
      tone: 'danger',
      onConfirm: async () => {
        try {
          await api(`/api/users/${u.id}`, { method: 'DELETE' });
          await load();
          toast.success('Usuário excluído.');
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Erro ao excluir.');
        }
      },
    });
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
            <div className="mb-2">
              <PasswordField
                label="Senha"
                value={password}
                onChange={setPassword}
                required
                autoComplete="new-password"
              />
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="new-role" className="app-label mb-0">
                  Papel
                </label>
                <button
                  type="button"
                  onClick={() => setShowRoles(true)}
                  aria-label="Ver papéis e permissões"
                  data-tooltip="Ver papéis e permissões"
                  className="flex h-6 w-6 items-center justify-center rounded-full text-apple-tertiary transition hover:bg-apple-fill hover:text-apple-blue active:scale-95"
                >
                  <IconHelp className="h-[18px] w-[18px]" />
                </button>
              </div>
              <select
                id="new-role"
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
            <div className="sm:col-span-2 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                data-tooltip="Criar usuário"
                data-tooltip-side="bottom"
                aria-label="Criar usuário"
                className="app-icon-btn-ink disabled:opacity-60"
              >
                <IconPlus className="h-4 w-4" />
              </button>
            </div>
          </form>
        </section>

        <section className="app-card-pad">
          <h2 className="mb-3 text-[17px] font-semibold tracking-tightish text-apple-ink">Usuários</h2>

          <div className="relative mb-4">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-apple-tertiary">
              <IconSearch className="h-[18px] w-[18px]" />
            </span>
            <input
              id="users-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, email ou papel…"
              className="app-input pl-10"
              autoComplete="off"
            />
          </div>

          {loading ? (
            <p className="text-apple-secondary">Carregando…</p>
          ) : users.length === 0 ? (
            <p className="text-apple-secondary">Nenhum usuário.</p>
          ) : filteredUsers.length === 0 ? (
            <div className="app-empty text-apple-secondary">
              Nenhum usuário encontrado para “{search.trim()}”.
            </div>
          ) : (
            <>
              <p className="mb-2 text-xs text-apple-tertiary">
                {filteredUsers.length} de {users.length} usuário(s)
              </p>
              <ul className="divide-y divide-apple-line">
                {filteredUsers.map((u) => (
                  <li
                    key={u.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div>
                      <p className="font-semibold text-apple-ink">
                        {u.name}
                        {me?.id === u.id ? (
                          <span className="ml-2 text-xs font-medium text-apple-blue">(você)</span>
                        ) : null}
                      </p>
                      <p className="text-sm text-apple-secondary">{u.email}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        data-tooltip="Editar"
                        aria-label="Editar"
                        onClick={() => openEdit(u)}
                        className="app-icon-btn-ink"
                      >
                        <IconPencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        data-tooltip="Excluir"
                        aria-label="Excluir"
                        disabled={me?.id === u.id}
                        onClick={() => onDelete(u)}
                        className="app-icon-btn text-apple-red disabled:opacity-40"
                      >
                        <IconTrash className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

      {editing
        ? createPortal(
            <div
              className="fixed inset-0 z-[10050] flex items-center justify-center p-4"
              role="presentation"
            >
              <button
                type="button"
                aria-label="Fechar"
                className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px] transition"
                onClick={closeEdit}
              />

              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="edit-user-modal-title"
                className="relative z-10 w-full max-w-md overflow-hidden rounded-apple-xl border border-apple-line bg-apple-surface shadow-float"
              >
                <div className="h-1 w-full bg-apple-blue" />

                <div className="px-6 pb-6 pt-5">
                  <h2
                    id="edit-user-modal-title"
                    className="text-[17px] font-semibold tracking-tightish text-apple-ink"
                  >
                    Editar usuário
                  </h2>
                  <p className="mb-5 mt-1 text-[13px] text-apple-secondary">
                    Atualize os dados de <span className="font-medium text-apple-ink">{editing.name}</span>.
                    Deixe a senha em branco para manter a atual.
                  </p>

                  <form onSubmit={onSubmitEdit} className="space-y-4">
                    <div>
                      <label htmlFor="edit-name" className="app-label">
                        Nome
                      </label>
                      <input
                        id="edit-name"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="app-input"
                        required
                        minLength={2}
                        maxLength={150}
                      />
                    </div>

                    <div>
                      <label htmlFor="edit-email" className="app-label">
                        Email
                      </label>
                      <input
                        id="edit-email"
                        type="email"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        className="app-input"
                        required
                      />
                    </div>

                    <div>
                      <div className="mb-1.5 flex items-center justify-between">
                        <label htmlFor="edit-role" className="app-label mb-0">
                          Papel
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowRoles(true)}
                          aria-label="Ver papéis e permissões"
                          data-tooltip="Ver papéis e permissões"
                          className="flex h-6 w-6 items-center justify-center rounded-full text-apple-tertiary transition hover:bg-apple-fill hover:text-apple-blue active:scale-95"
                        >
                          <IconHelp className="h-[18px] w-[18px]" />
                        </button>
                      </div>
                      <select
                        id="edit-role"
                        value={editRoleId}
                        onChange={(e) => setEditRoleId(Number(e.target.value))}
                        className="app-input"
                        required
                        disabled={me?.id === editing.id && editing.role?.slug === 'admin'}
                      >
                        {roles.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name} ({r.slug})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <PasswordField
                        label="Nova senha"
                        value={editPassword}
                        onChange={setEditPassword}
                        optional
                        autoComplete="new-password"
                        placeholder="••••••••••"
                      />
                    </div>

                    <div className="flex flex-wrap justify-end gap-2 pt-1">
                      <button type="button" onClick={closeEdit} className="app-btn-secondary">
                        Cancelar
                      </button>
                      <button type="submit" disabled={editSaving} className="app-btn-primary disabled:opacity-60">
                        {editSaving ? 'Salvando…' : 'Salvar alterações'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {showRoles ? <RolesModal roles={roles} onClose={() => setShowRoles(false)} /> : null}
    </main>
  );
}
