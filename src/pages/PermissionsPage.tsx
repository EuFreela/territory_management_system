import { FormEvent, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  IconKey,
  IconLock,
  IconPencil,
  IconPlus,
  IconSave,
  IconTrash,
  IconX,
} from '@/components/Map/mapIcons';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Spinner } from '@/components/ui/Spinner';
import { api } from '@/lib/api';
import { SCOPES } from '@/lib/permissions';
import { SCOPE_LABELS } from '@/lib/scope-labels';
import { confirmToast } from '@/lib/confirm-toast';

type Role = {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  is_system: boolean;
  permissions: string[];
};

type FormErrors = { name?: string; permissions?: string };

function RolePermissionsChips({ permissions }: { permissions: string[] }) {
  return (
    <ul className="mt-2 flex flex-wrap gap-1.5">
      {permissions.map((p) => (
        <li
          key={p}
          className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-[11px] font-medium text-foreground/80"
        >
          {SCOPE_LABELS[p]?.name ?? p}
        </li>
      ))}
    </ul>
  );
}

export default function PermissionsPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  async function load() {
    setLoading(true);
    try {
      const r = await api<{ roles: Role[] }>('/api/users/roles');
      setRoles(r.roles);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar papéis.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openCreate() {
    setEditing(null);
    setName('');
    setDescription('');
    setSelected(new Set());
    setErrors({});
    setDialogOpen(true);
  }

  function openEdit(role: Role) {
    setEditing(role);
    setName(role.name);
    setDescription(role.description ?? '');
    setSelected(new Set(role.permissions));
    setErrors({});
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditing(null);
  }

  function toggle(scope: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(scope)) next.delete(scope);
      else next.add(scope);
      return next;
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const nextErrors: FormErrors = {};
    if (name.trim().length < 2) {
      nextErrors.name = 'Use pelo menos 2 caracteres.';
    } else if (name.trim().length > 100) {
      nextErrors.name = 'Use no máximo 100 caracteres.';
    }
    if (selected.size === 0) {
      nextErrors.permissions = 'Selecione ao menos uma permissão.';
    }
    setErrors(nextErrors);
    if (nextErrors.name || nextErrors.permissions) return;

    setSaving(true);
    try {
      const body = {
        name: name.trim(),
        description: description.trim() || undefined,
        permissions: [...selected],
      };
      if (editing) {
        await api(`/api/users/roles/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        });
        toast.success('Papel atualizado.');
      } else {
        await api('/api/users/roles', {
          method: 'POST',
          body: JSON.stringify(body),
        });
        toast.success('Papel criado.');
      }
      closeDialog();
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar papel.');
    } finally {
      setSaving(false);
    }
  }

  function onDelete(role: Role) {
    confirmToast({
      title: 'Excluir papel?',
      description: `Remover o papel "${role.name}"? Os usuários precisam ser reatribuídos antes.`,
      confirmLabel: 'Excluir',
      tone: 'danger',
      onConfirm: async () => {
        try {
          await api(`/api/users/roles/${role.id}`, { method: 'DELETE' });
          await load();
          toast.success('Papel excluído.');
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Erro ao excluir.');
        }
      },
    });
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8 sm:py-10">
      <div className="mb-8">
        <p className="text-sm font-medium text-muted-foreground">Administração</p>
        <div className="mt-1 flex items-center gap-2">
          <IconKey className="h-6 w-6" />
          <h1 className="text-[1.75rem] font-semibold tracking-tight sm:text-[2rem]">
            Papéis e permissões
          </h1>
        </div>
        <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">
          Crie e edite papéis (roles) definindo o nome e as permissões que compõem cada um. O
          administrador sempre tem todas as permissões.
        </p>
      </div>

      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {roles.length} papel(is) cadastrado(s)
        </p>
        <Button type="button" onClick={openCreate} data-tooltip="Criar novo papel">
          <IconPlus />
          Novo papel
        </Button>
      </div>

      {loading ? (
        <Spinner label="Carregando papéis…" className="text-muted-foreground" />
      ) : roles.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum papel cadastrado.</p>
      ) : (
        <div className="grid gap-3">
          {roles.map((role) => {
            const isAdminRole = role.slug === 'admin';
            const locked = isAdminRole;
            return (
              <Card key={role.id}>
                <CardContent className="pt-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{role.name}</p>
                        <span className="font-mono text-xs text-muted-foreground">
                          {role.slug}
                        </span>
                        {role.is_system ? (
                          <span
                            className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                            data-tooltip="Papel padrão do sistema"
                          >
                            Sistema
                          </span>
                        ) : null}
                        {isAdminRole ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                            <IconLock className="size-3" aria-hidden />
                            Somente leitura
                          </span>
                        ) : null}
                      </div>
                      {role.description ? (
                        <p className="mt-0.5 text-sm text-muted-foreground">{role.description}</p>
                      ) : null}
                      <RolePermissionsChips permissions={role.permissions} />
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        data-tooltip={locked ? 'O papel administrador não pode ser alterado' : 'Editar papel'}
                        aria-label={locked ? 'Não pode editar' : 'Editar papel'}
                        disabled={locked}
                        onClick={() => openEdit(role)}
                      >
                        <IconPencil />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        data-tooltip={
                          role.is_system
                            ? 'Papéis de sistema não podem ser excluídos'
                            : 'Excluir papel'
                        }
                        aria-label={role.is_system ? 'Não pode excluir' : 'Excluir papel'}
                        disabled={role.is_system}
                        onClick={() => onDelete(role)}
                        className="text-destructive hover:text-destructive"
                      >
                        <IconTrash />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => (open ? null : closeDialog())}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar papel' : 'Novo papel'}</DialogTitle>
            <DialogDescription>
              {editing ? (
                <>
                  Atualize os dados de{' '}
                  <span className="font-medium text-foreground">{editing.name}</span> e suas
                  permissões.
                </>
              ) : (
                'Dê um nome ao papel e marque as permissões que irão compô-lo.'
              )}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit} noValidate className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="role-name">Nome do papel</Label>
              <Input
                id="role-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
                }}
                placeholder="Ex.: Editor de territórios"
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? 'role-name-error' : undefined}
              />
              {errors.name ? <FieldError id="role-name-error">{errors.name}</FieldError> : null}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="role-description">Descrição</Label>
              <Input
                id="role-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Opcional — do que este papel é responsável"
                maxLength={255}
              />
            </div>

            <div className="grid gap-1.5">
              <Label>Permissões</Label>
              <ul className="grid max-h-[45vh] gap-1 overflow-y-auto pr-1">
                {SCOPES.map((scope) => {
                  const label = SCOPE_LABELS[scope] ?? { name: scope, description: '' };
                  const checked = selected.has(scope);
                  return (
                    <li
                      key={scope}
                      className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 ${
                        checked ? 'border-primary/30 bg-primary/5' : 'border-border'
                      }`}
                    >
                      <Checkbox
                        id={`perm-${scope}`}
                        checked={checked}
                        onCheckedChange={() => toggle(scope)}
                      />
                      <label htmlFor={`perm-${scope}`} className="min-w-0 flex-1 cursor-pointer">
                        <span
                          className={`block text-sm font-medium ${
                            checked ? 'text-foreground' : 'text-muted-foreground'
                          }`}
                        >
                          {label.name}
                        </span>
                        <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground/70">
                          {scope}
                        </span>
                        {label.description ? (
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {label.description}
                          </span>
                        ) : null}
                      </label>
                    </li>
                  );
                })}
              </ul>
              {errors.permissions ? <FieldError>{errors.permissions}</FieldError> : null}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={closeDialog}
                data-tooltip="Cancelar"
              >
                <IconX />
              </Button>
              <Button type="submit" disabled={saving} data-tooltip="Salvar papel">
                <IconSave />
                {saving ? 'Salvando…' : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}