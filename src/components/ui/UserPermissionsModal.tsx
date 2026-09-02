import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Button,
} from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Spinner } from '@/components/ui/Spinner';
import { api } from '@/lib/api';
import { SCOPE_LABELS } from '@/lib/scope-labels';
import { IconSave, IconX } from '@/components/Map/mapIcons';

type PermissionsData = {
  scopes: string[];
  role_permissions: string[];
  extra_permissions: string[];
};

export default function UserPermissionsModal({
  userId,
  userName,
  onClose,
}: {
  userId: number;
  userName: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<PermissionsData | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    api<PermissionsData>(`/api/users/permissions/${userId}`)
      .then((d) => {
        if (!alive) return;
        setData(d);
        setSelected(new Set(d.extra_permissions));
      })
      .catch((err) => {
        if (!alive) return;
        toast.error(err instanceof Error ? err.message : 'Erro ao carregar permissões.');
        onClose();
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function toggle(scope: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(scope)) next.delete(scope);
      else next.add(scope);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    try {
      const extra = [...selected];
      await api(`/api/users/permissions/${userId}`, {
        method: 'PUT',
        body: JSON.stringify({ permissions: extra }),
      });
      toast.success('Permissões exclusivas atualizadas.');
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar permissões.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Permissões exclusivas</DialogTitle>
          <DialogDescription>
            Permissões adicionais para <span className="font-medium text-foreground">{userName}</span>,
            somadas às do papel. As permissões do papel não podem ser removidas aqui.
          </DialogDescription>
        </DialogHeader>

        {!data ? (
          <Spinner label="Carregando permissões…" className="justify-start text-muted-foreground" />
        ) : (
          <ul className="grid max-h-[55vh] gap-1 overflow-y-auto pr-1">
            {data.scopes.map((scope) => {
              const label = SCOPE_LABELS[scope] ?? {
                name: scope,
                description: '',
              };
              const fromRole = data.role_permissions.includes(scope);
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
                    <span className="flex flex-wrap items-center gap-2">
                      <span className={`text-sm font-medium ${checked ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {label.name}
                      </span>
                      {fromRole ? (
                        <span
                          className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                          data-tooltip="Esta permissão já vem do papel do usuário"
                        >
                          Do papel
                        </span>
                      ) : null}
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
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onClose}
            data-tooltip="Cancelar"
          >
            <IconX />
          </Button>
          <Button type="button" onClick={save} disabled={saving || !data} data-tooltip="Salvar permissões">
            <IconSave />
            {saving ? 'Salvando…' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
