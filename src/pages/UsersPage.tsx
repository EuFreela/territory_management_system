import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import {
  IconCheck,
  IconChevronDown,
  IconHelp,
  IconLock,
  IconLockOpen,
  IconPencil,
  IconPlus,
  IconSave,
  IconSearch,
  IconTrash,
  IconUsers,
  IconX,
} from '@/components/Map/mapIcons';
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
import FieldError from '@/components/ui/FieldError';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PasswordField from '@/components/ui/PasswordField';
import RolesModal from '@/components/ui/RolesModal';
import { Spinner } from '@/components/ui/Spinner';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { confirmToast } from '@/lib/confirm-toast';

const EMAIL_RE = /^\S+@\S+\.\S+$/;

type CreateErrors = {
  name?: string;
  email?: string;
  password?: string;
  role?: string;
};
type EditErrors = { name?: string; email?: string; role?: string; congregation?: string };

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
  active_cep?: string | null;
  congregation_name?: string | null;
  blocked?: boolean;
  created_at?: string;
};

type Congregation = {
  id: number;
  cep: string;
  name: string;
  address?: string | null;
};

const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

function CongregationPicker({
  value,
  onValueChange,
  initialCep,
  label,
  error,
  errorId,
  id,
}: {
  value: number | '' | null | undefined;
  onValueChange: (id: number | '' | null) => void;
  initialCep?: string | null;
  label: string;
  error?: string;
  errorId?: string;
  id?: string;
}) {
  const [recent, setRecent] = useState<Congregation[]>([]);
  const [options, setOptions] = useState<Congregation[]>([]);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [open, setOpen] = useState(false);
  const mounted = useRef(true);

  const loadRecent = useCallback(async () => {
    setBusy(true);
    setLoadError('');
    try {
      const r = await api<{ congregations: Congregation[] }>('/api/users/congregations');
      if (!mounted.current) return;
      setRecent(r.congregations);
      setOptions(r.congregations);
    } catch {
      if (!mounted.current) return;
      setLoadError('Não foi possível carregar as congregações.');
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void loadRecent();
    return () => {
      mounted.current = false;
    };
  }, [loadRecent]);

  useEffect(() => {
    let alive = true;
    const q = query.trim();
    if (!q) {
      setOptions(recent);
      setLoadError('');
      return;
    }
    setBusy(true);
    const t = window.setTimeout(() => {
      api<{ congregations: Congregation[] }>(
        `/api/users/congregations?q=${encodeURIComponent(q)}`,
      )
        .then((r) => {
          if (!alive) return;
          setOptions(r.congregations);
          setLoadError('');
        })
        .catch(() => {
          if (alive) setLoadError('Falha ao buscar congregações.');
        })
        .finally(() => {
          if (alive) setBusy(false);
        });
    }, 250);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [query, recent]);

  useEffect(() => {
    if (initialCep == null || !initialCep.trim()) return;
    const cep = initialCep.trim().toLowerCase();
    let alive = true;
    const inList = recent.some((c) => c.cep.toLowerCase() === cep);
    if (inList) {
      const found = recent.find((c) => c.cep.toLowerCase() === cep);
      if (found) onValueChange(found.id);
      return;
    }
    api<{ congregations: Congregation[] }>(
      `/api/users/congregations?q=${encodeURIComponent(initialCep.trim())}`,
    )
      .then((r) => {
        if (!alive) return;
        const found = r.congregations.find((c) => c.cep.toLowerCase() === cep);
        if (found) {
          onValueChange(found.id);
          setRecent((prev) => (prev.some((c) => c.id === found.id) ? prev : [found, ...prev]));
        }
      })
      .catch(() => {
        /* ignora */
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCep, recent]);

  const selected =
    options.find((c) => c.id === Number(value)) ??
    (value != null && value !== '' ? { id: Number(value), name: '', cep: '' } : null);

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <button
          id={id}
          type="button"
          onClick={() => {
            setQuery('');
            if (!recent.length && !busy) void loadRecent();
            setOptions(recent);
            setOpen((o) => !o);
            setTimeout(() => {
              const el = document.getElementById(`${id ?? ''}-search`) as HTMLInputElement | null;
              el?.focus();
            }, 30);
          }}
          className={`flex h-9 w-full items-center justify-between gap-2 rounded-lg border bg-transparent px-3 text-left text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${
            error
              ? 'border-destructive'
              : selected?.name
                ? 'border-primary/40 bg-primary/5 focus-visible:border-primary'
                : 'border-input focus-visible:border-ring'
          }`}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
        >
          {selected?.name ? (
            <span className="flex min-w-0 items-center gap-2">
              <IconCheck className="size-4 shrink-0 text-primary" aria-hidden />
              <span className="truncate">
                <span className="font-medium text-foreground">{selected.name}</span>
                {selected.cep ? (
                  <span className="ml-2 text-muted-foreground">CEP {selected.cep}</span>
                ) : null}
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">Selecionar congregação…</span>
          )}
          <IconChevronDown className="size-4 shrink-0 text-muted-foreground" />
        </button>

        {open ? (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
              aria-hidden
            />
            <div
              role="listbox"
              className="absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-lg border border-border bg-background shadow-lg"
            >
              <div className="relative border-b border-border bg-muted/30">
                <IconSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id={`${id ?? ''}-search`}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar por nome ou CEP…"
                  className="border-0 pl-9 focus-visible:ring-0"
                  autoComplete="off"
                />
              </div>
              <ul className="max-h-56 overflow-y-auto p-1.5">
                <li>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm text-muted-foreground hover:bg-muted"
                    onClick={() => {
                      onValueChange(null);
                      setOpen(false);
                      setQuery('');
                    }}
                  >
                    <span>Sem congregação</span>
                    {value == null ? <span className="text-primary">✓</span> : null}
                  </button>
                </li>
                {busy && !options.length ? (
                  <li className="px-2.5 py-2 text-sm text-muted-foreground">
                    Carregando congregações…
                  </li>
                ) : loadError && !options.length ? (
                  <li className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-2 text-sm text-muted-foreground">
                    <span>{loadError}</span>
                    <button
                      type="button"
                      onClick={() => void loadRecent()}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Tentar novamente
                    </button>
                  </li>
                ) : options.length === 0 ? (
                  <li className="px-2.5 py-2 text-sm text-muted-foreground">
                    Nenhuma congregação encontrada.
                  </li>
                ) : (
                  options.map((c) => {
                    const isSel = c.id === Number(value);
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          className={`flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-muted ${
                            isSel ? 'bg-primary/10 font-medium text-foreground' : 'text-foreground/90'
                          }`}
                          onClick={() => {
                            onValueChange(c.id);
                            setOpen(false);
                            setQuery('');
                          }}
                        >
                          <span className="truncate">
                            {c.name}
                            <span className="ml-2 text-muted-foreground">CEP {c.cep}</span>
                          </span>
                          {isSel ? (
                            <span className="flex shrink-0 items-center gap-1 text-primary">
                              <IconCheck className="size-4" aria-hidden />
                              <span className="text-xs">Selecionada</span>
                            </span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            </div>
          </>
        ) : null}
      </div>
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
    </div>
  );
}

const SELECT_CLASS =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-muted';

const ROLE_BADGE: Record<string, string> = {
  admin: 'border-primary/25 bg-primary/10 text-primary dark:border-primary/35',
  editor: 'border-violet-500/25 bg-violet-500/10 text-violet-700 dark:border-violet-500/35 dark:text-violet-300',
  field: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:border-emerald-500/35 dark:text-emerald-300',
  viewer: 'border-border bg-muted text-muted-foreground',
};

const ROLE_BADGE_FALLBACK = 'border-border bg-muted text-muted-foreground';

export default function UsersPage() {
  const { user: me, refresh: refreshAuth } = useAuth();
  const location = useLocation();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);
  const [createErrors, setCreateErrors] = useState<CreateErrors>({});

  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRoleId, setEditRoleId] = useState<number | ''>('');
  const [editCongregationId, setEditCongregationId] = useState<number | '' | null>('');
  const [editPassword, setEditPassword] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editErrors, setEditErrors] = useState<EditErrors>({});

  const [showRoles, setShowRoles] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (location.hash !== '#novo-usuario') return;
    const t = window.setTimeout(() => {
      document.getElementById('novo-usuario')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      document.getElementById('new-name')?.focus({ preventScroll: true });
    }, 80);
    return () => window.clearTimeout(t);
  }, [location.hash]);

  const filteredUsers = useMemo(() => {
    const q = search
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
    if (!q) return users;
    return users.filter((u) => {
      const haystack = `${u.name} ${u.email} ${u.role?.name ?? ''} ${u.congregation_name ?? ''} ${u.active_cep ?? ''}`
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
    const errors: CreateErrors = {};
    if (name.trim() === '') {
      errors.name = 'Preencha este campo.';
    } else if (name.trim().length < 2) {
      errors.name = 'Use pelo menos 2 caracteres.';
    }
    if (email.trim() === '') {
      errors.email = 'Preencha este campo.';
    } else if (!EMAIL_RE.test(email.trim())) {
      errors.email = 'Informe um e-mail válido.';
    }
    if (password === '') {
      errors.password = 'Preencha este campo.';
    }
    if (roleId === '') {
      errors.role = 'Selecione um papel.';
    }
    setCreateErrors(errors);
    if (errors.name || errors.email || errors.password || errors.role) return;

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        email: email.trim(),
        password,
        role_id: roleId,
      };
      await api('/api/users', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setName('');
      setEmail('');
      setPassword('');
      setCreateErrors({});
      await load();
      toast.success('Usuário criado.');
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
    setEditCongregationId('');
    setEditPassword('');
    setEditErrors({});
  }

  function closeEdit() {
    setEditing(null);
    setEditPassword('');
    setEditErrors({});
  }

  async function onSubmitEdit(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;

    const errors: EditErrors = {};
    if (editName.trim() === '') {
      errors.name = 'Preencha este campo.';
    } else if (editName.trim().length < 2) {
      errors.name = 'Use pelo menos 2 caracteres.';
    } else if (editName.trim().length > 150) {
      errors.name = 'Use no máximo 150 caracteres.';
    }
    if (editEmail.trim() === '') {
      errors.email = 'Preencha este campo.';
    } else if (!EMAIL_RE.test(editEmail.trim())) {
      errors.email = 'Informe um e-mail válido.';
    }
    if (editRoleId === '') {
      errors.role = 'Selecione um papel.';
    }
    setEditErrors(errors);
    if (errors.name || errors.email || errors.role) return;

    setEditSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: editName.trim(),
        email: editEmail.trim(),
        role_id: editRoleId,
      };
      if (editPassword.trim()) body.password = editPassword;
      if (editCongregationId === null) {
        body.congregation_id = null;
      } else if (editCongregationId !== '') {
        body.congregation_id = editCongregationId;
      }

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

  function toggleBlock(u: ManagedUser) {
    const willBlock = !u.blocked;
    confirmToast({
      title: willBlock ? 'Bloquear usuário?' : 'Desbloquear usuário?',
      description: willBlock
        ? `${u.name} não conseguirá mais entrar no sistema.`
        : `${u.name} voltará a ter acesso ao sistema.`,
      confirmLabel: willBlock ? 'Bloquear' : 'Desbloquear',
      tone: willBlock ? 'danger' : 'default',
      onConfirm: async () => {
        try {
          await api(`/api/users/${u.id}/block-status`, {
            method: 'PUT',
            body: JSON.stringify({ blocked: willBlock }),
          });
          await load();
          toast.success(willBlock ? 'Usuário bloqueado.' : 'Usuário desbloqueado.');
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Erro ao atualizar o bloqueio.');
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

      <Card id="novo-usuario" className="mb-6 scroll-mt-6">
        <CardContent className="pt-6">
          <h2 className="mb-4 text-lg font-semibold tracking-tight">Novo usuário</h2>
          <form
            onSubmit={onCreate}
            noValidate
            className="grid gap-3 sm:grid-cols-2"
          >
            <div className="grid gap-1.5">
              <Label htmlFor="new-name">Nome</Label>
              <Input
                id="new-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (createErrors.name) {
                    setCreateErrors((prev) => ({ ...prev, name: undefined }));
                  }
                }}
                aria-invalid={Boolean(createErrors.name)}
                aria-describedby={createErrors.name ? 'new-name-error' : undefined}
              />
              {createErrors.name ? <FieldError id="new-name-error">{createErrors.name}</FieldError> : null}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="new-email">Email</Label>
              <Input
                id="new-email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (createErrors.email) {
                    setCreateErrors((prev) => ({ ...prev, email: undefined }));
                  }
                }}
                aria-invalid={Boolean(createErrors.email)}
                aria-describedby={createErrors.email ? 'new-email-error' : undefined}
              />
              {createErrors.email ? <FieldError id="new-email-error">{createErrors.email}</FieldError> : null}
            </div>
            <div className="min-w-0">
              <PasswordField
                label="Senha"
                value={password}
                onChange={(v) => {
                  setPassword(v);
                  if (createErrors.password) {
                    setCreateErrors((prev) => ({ ...prev, password: undefined }));
                  }
                }}
                autoComplete="new-password"
                error={createErrors.password}
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
                onChange={(e) => {
                  setRoleId(Number(e.target.value));
                  if (createErrors.role) {
                    setCreateErrors((prev) => ({ ...prev, role: undefined }));
                  }
                }}
                className={SELECT_CLASS}
                aria-invalid={Boolean(createErrors.role)}
                aria-describedby={createErrors.role ? 'new-role-error' : undefined}
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.slug})
                  </option>
                ))}
              </select>
              {createErrors.role ? <FieldError id="new-role-error">{createErrors.role}</FieldError> : null}
            </div>
            <div className="flex justify-end sm:col-span-2">
              <Button
                type="submit"
                disabled={saving}
                data-tooltip="Criar usuário"
              >
                <IconPlus />
                {saving ? 'Criando…' : 'Criar Usuário'}
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
                      {u.active_cep || u.congregation_name ? (
                        <p className="text-xs text-muted-foreground/80">
                          {u.congregation_name ? `${u.congregation_name} · ` : ''}
                          {u.active_cep ? `CEP ${u.active_cep}` : 'CEP padrão'}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`hidden items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium sm:inline-flex ${
                          ROLE_BADGE[u.role?.slug ?? ''] ?? ROLE_BADGE_FALLBACK
                        }`}
                      >
                        <span className="size-1.5 rounded-full bg-current opacity-70" aria-hidden />
                        {u.role?.name ?? 'sem papel'}
                      </span>
                      {!u.congregation_name ? (
                        <span
                          className="inline-flex items-center rounded-full border border-red-600/30 bg-red-600/10 px-2.5 py-0.5 text-xs font-semibold text-red-600 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-400"
                          data-tooltip="Sem congregação"
                          aria-label="Sem congregação"
                        >
                          SC
                        </span>
                      ) : null}
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        data-tooltip={u.blocked ? 'Desbloquear' : 'Bloquear'}
                        aria-label={u.blocked ? 'Desbloquear' : 'Bloquear'}
                        disabled={me?.id === u.id}
                        onClick={() => toggleBlock(u)}
                        className={u.blocked ? 'text-destructive hover:text-destructive' : ''}
                      >
                        {u.blocked ? <IconLockOpen /> : <IconLock />}
                      </Button>
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
            noValidate
            className="grid gap-4"
          >
            <div className="grid gap-1.5">
              <Label htmlFor="edit-name">Nome</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => {
                  setEditName(e.target.value);
                  if (editErrors.name) {
                    setEditErrors((prev) => ({ ...prev, name: undefined }));
                  }
                }}
                aria-invalid={Boolean(editErrors.name)}
                aria-describedby={editErrors.name ? 'edit-name-error' : undefined}
              />
              {editErrors.name ? <FieldError id="edit-name-error">{editErrors.name}</FieldError> : null}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editEmail}
                onChange={(e) => {
                  setEditEmail(e.target.value);
                  if (editErrors.email) {
                    setEditErrors((prev) => ({ ...prev, email: undefined }));
                  }
                }}
                aria-invalid={Boolean(editErrors.email)}
                aria-describedby={editErrors.email ? 'edit-email-error' : undefined}
              />
              {editErrors.email ? <FieldError id="edit-email-error">{editErrors.email}</FieldError> : null}
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
                onChange={(e) => {
                  setEditRoleId(Number(e.target.value));
                  if (editErrors.role) {
                    setEditErrors((prev) => ({ ...prev, role: undefined }));
                  }
                }}
                className={SELECT_CLASS}
                disabled={me?.id === editing?.id && editing?.role?.slug === 'admin'}
                aria-invalid={Boolean(editErrors.role)}
                aria-describedby={editErrors.role ? 'edit-role-error' : undefined}
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.slug})
                  </option>
                ))}
              </select>
              {editErrors.role ? <FieldError id="edit-role-error">{editErrors.role}</FieldError> : null}
            </div>

            <div className="min-w-0">
              <CongregationPicker
                id="edit-congregation"
                label="CEP (congregação)"
                value={editCongregationId}
                onValueChange={(v) => {
                  setEditCongregationId(v);
                  if (editErrors.congregation) {
                    setEditErrors((prev) => ({ ...prev, congregation: undefined }));
                  }
                }}
                initialCep={editing?.active_cep}
                error={editErrors.congregation}
                errorId="edit-congregation-error"
              />
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
                disabled={editSaving}
                data-tooltip="Salvar alterações"
              >
                <IconSave />
                {editSaving ? 'Salvando…' : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {showRoles ? <RolesModal roles={roles} onClose={() => setShowRoles(false)} /> : null}
    </main>
  );
}
