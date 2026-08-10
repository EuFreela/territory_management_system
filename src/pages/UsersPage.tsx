import { FormEvent, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  IconHelp,
  IconPencil,
  IconPlus,
  IconSave,
  IconSearch,
  IconTrash,
  IconUsers,
  IconX,
} from '@/components/Map/mapIcons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PasswordField from '@/components/ui/PasswordField';
import RolesModal from '@/components/ui/RolesModal';
import { Spinner } from '@/components/ui/Spinner';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { confirmToast } from '@/lib/confirm-toast';
import { onInputClearValidity, onInvalidPtBr } from '@/lib/form-validation-pt';

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

const SELECT_CLASS =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-muted';

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
    <main className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-8 sm:py-10">
      <div className="mb-8">
        <p className="text-sm font-medium text-muted-foreground">Administração</p>
        <div className="mt-1 flex items-center gap-2">
          <IconUsers className="h-6 w-6" />
          <h1 className="text-[1.75rem] font-semibold tracking-tight sm:text-[2rem]">
            Usuários e papéis
          </h1>
        </div>
        <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">
          Controle de acesso baseado em papéis (RBAC). O administrador tem todos os escopos; demais
          papéis recebem permissões delegadas.
        </p>
      </div>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <h2 className="mb-4 text-lg font-semibold tracking-tight">Novo usuário</h2>
          <form
            onSubmit={onCreate}
            onInvalidCapture={onInvalidPtBr}
            onInput={onInputClearValidity}
            className="grid gap-3 sm:grid-cols-2"
          >
            <div className="grid gap-1.5">
              <Label>Nome</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="min-w-0">
              <PasswordField
                label="Senha"
                value={password}
                onChange={setPassword}
                required
                autoComplete="new-password"
              />
            </div>
            <div className="min-w-0">
              <div className="mb-1.5 flex min-h-6 items-center justify-between gap-2">
                <Label htmlFor="new-role" className="mb-0 text-sm font-medium text-foreground">
                  Papel
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setShowRoles(true)}
                  aria-label="Ver papéis e permissões"
                  data-tooltip="Ver papéis e permissões"
                >
                  <IconHelp />
                </Button>
              </div>
              <select
                id="new-role"
                value={roleId}
                onChange={(e) => setRoleId(Number(e.target.value))}
                className={SELECT_CLASS}
                required
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.slug})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end sm:col-span-2">
              <Button
                type="submit"
                size="icon"
                disabled={saving}
                data-tooltip="Criar usuário"
              >
                <IconPlus />
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <h2 className="mb-3 text-lg font-semibold tracking-tight">Usuários</h2>

          <div className="relative mb-4">
            <IconSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="users-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, email ou papel…"
              className="pl-9"
              autoComplete="off"
            />
          </div>

          {loading ? (
            <Spinner label="Carregando…" className="text-muted-foreground" />
          ) : users.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum usuário.</p>
          ) : filteredUsers.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhum usuário encontrado para “{search.trim()}”.
            </p>
          ) : (
            <>
              <p className="mb-2 text-xs text-muted-foreground">
                {filteredUsers.length} de {users.length} usuário(s)
              </p>
              <ul className="divide-y divide-border">
                {filteredUsers.map((u) => (
                  <li
                    key={u.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div>
                      <p className="font-semibold">
                        {u.name}
                        {me?.id === u.id ? (
                          <span className="ml-2 text-xs font-medium text-primary">(você)</span>
                        ) : null}
                      </p>
                      <p className="text-sm text-muted-foreground">{u.email}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="hidden sm:inline-flex">
                        {u.role?.name ?? 'sem papel'}
                      </Badge>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        data-tooltip="Editar"
                        aria-label="Editar"
                        onClick={() => openEdit(u)}
                      >
                        <IconPencil />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        data-tooltip="Excluir"
                        aria-label="Excluir"
                        disabled={me?.id === u.id}
                        onClick={() => onDelete(u)}
                        className="text-destructive hover:text-destructive"
                      >
                        <IconTrash />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={editing != null} onOpenChange={(open) => (open ? null : closeEdit())}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar usuário</DialogTitle>
            <DialogDescription>
              Atualize os dados de <span className="font-medium text-foreground">{editing?.name}</span>
              . Deixe a senha em branco para manter a atual.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={onSubmitEdit}
            onInvalidCapture={onInvalidPtBr}
            onInput={onInputClearValidity}
            className="grid gap-4"
          >
            <div className="grid gap-1.5">
              <Label htmlFor="edit-name">Nome</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
                minLength={2}
                maxLength={150}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                required
              />
            </div>

            <div className="grid gap-1.5">
              <div className="mb-0 flex min-h-6 items-center justify-between gap-2">
                <Label htmlFor="edit-role" className="mb-0 text-sm font-medium text-foreground">
                  Papel
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setShowRoles(true)}
                  aria-label="Ver papéis e permissões"
                  data-tooltip="Ver papéis e permissões"
                >
                  <IconHelp />
                </Button>
              </div>
              <select
                id="edit-role"
                value={editRoleId}
                onChange={(e) => setEditRoleId(Number(e.target.value))}
                className={SELECT_CLASS}
                required
                disabled={me?.id === editing?.id && editing?.role?.slug === 'admin'}
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.slug})
                  </option>
                ))}
              </select>
            </div>

            <PasswordField
              label="Nova senha"
              value={editPassword}
              onChange={setEditPassword}
              optional
              autoComplete="new-password"
              placeholder="••••••••••"
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={closeEdit}
                data-tooltip="Cancelar"
              >
                <IconX />
              </Button>
              <Button
                type="submit"
                size="icon"
                disabled={editSaving}
                data-tooltip="Salvar alterações"
              >
                <IconSave />
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {showRoles ? <RolesModal roles={roles} onClose={() => setShowRoles(false)} /> : null}
    </main>
  );
}
