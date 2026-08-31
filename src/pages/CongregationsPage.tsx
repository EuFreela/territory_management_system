import { FormEvent, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  IconBuilding2,
  IconLocate,
  IconPencil,
  IconPlus,
  IconSave,
  IconSearch,
  IconTrash,
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
import { Spinner } from '@/components/ui/Spinner';
import { api } from '@/lib/api';
import { confirmToast } from '@/lib/confirm-toast';
import { useAuth } from '@/lib/auth-context';
import { maskCepInput } from '@/lib/cep';

type Congregation = {
  id: number;
  cep: string;
  name: string;
  address: string | null;
  record_count?: number;
  user_count?: number;
  created_at?: string;
  updated_at?: string;
};

type FormErrors = { cep?: string; name?: string };

const EMPTY_FORM = { cep: '', name: '', address: '' };

export default function CongregationsPage() {
  const { refresh: refreshAuth } = useAuth();
  const [congregations, setCongregations] = useState<Congregation[]>([]);
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Congregation | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
    if (!q) return congregations;
    return congregations.filter((c) => {
      const haystack = `${c.name} ${c.cep} ${c.address ?? ''}`
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [congregations, search]);

  async function load() {
    setLoading(true);
    try {
      const res = await api<{ congregations: Congregation[] }>('/api/congregations');
      setCongregations(res.congregations);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar congregações.');
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
    setForm(EMPTY_FORM);
    setErrors({});
    setOpen(true);
  }

  function openEdit(c: Congregation) {
    setEditing(c);
    setForm({ cep: maskCepInput(c.cep), name: c.name, address: c.address ?? '' });
    setErrors({});
    setOpen(true);
  }

  function closeDialog() {
    setOpen(false);
    setEditing(null);
    setErrors({});
  }

  function validateForm(): FormErrors {
    const next: FormErrors = {};
    if (maskCepInput(form.cep).length !== 9) {
      next.cep = 'Informe um CEP válido (00000-000).';
    }
    if (form.name.trim() === '') {
      next.name = 'Informe o nome da congregação.';
    } else if (form.name.trim().length < 2) {
      next.name = 'Use pelo menos 2 caracteres.';
    }
    return next;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next = validateForm();
    setErrors(next);
    if (next.cep || next.name) return;

    setSaving(true);
    try {
      const body = {
        cep: form.cep,
        name: form.name.trim(),
        address: form.address.trim() || null,
      };
      if (editing) {
        await api(`/api/congregations/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        });
        toast.success('Congregação atualizada.');
      } else {
        await api('/api/congregations', {
          method: 'POST',
          body: JSON.stringify(body),
        });
        toast.success('Congregação criada.');
      }
      closeDialog();
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar congregação.');
    } finally {
      setSaving(false);
    }
  }

  function onDelete(c: Congregation) {
    confirmToast({
      title: 'Excluir congregação?',
      description: `Remover ${c.name} (CEP ${c.cep})? Esta ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
      tone: 'danger',
      onConfirm: async () => {
        try {
          await api(`/api/congregations/${c.id}`, { method: 'DELETE' });
          await load();
          toast.success('Congregação excluída.');
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Erro ao excluir.');
        }
      },
    });
  }

  function onSetActive(c: Congregation) {
    confirmToast({
      title: 'Definir como congregação ativa?',
      description: `O CEP ${c.cep} será definido como a região de trabalho de todos os usuários e ${c.name} será o nome da congregação deste CEP.`,
      confirmLabel: 'Definir',
      onConfirm: async () => {
        try {
          await api(`/api/congregations/${c.id}/set-active`, { method: 'POST' });
          await refreshAuth();
          await load();
          toast.success('Congregação definida como ativa.');
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Erro ao definir congregação.');
        }
      },
    });
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8 sm:py-10">
      <div className="mb-8">
        <p className="text-sm font-medium text-muted-foreground">Administração</p>
        <div className="mt-1 flex items-center gap-2">
          <IconBuilding2 className="h-6 w-6" />
          <h1 className="text-[1.75rem] font-semibold tracking-tight sm:text-[2rem]">
            Congregações
          </h1>
        </div>
        <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">
          Cadastro das congregações do sistema. Um CEP pode ter mais de uma congregação; cada
          registro é identificado pelo CEP e nome.
        </p>
      </div>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-tight">Congregações cadastradas</h2>
            <Button
              type="button"
              size="icon"
              onClick={openCreate}
              data-tooltip="Nova congregação"
              aria-label="Nova congregação"
            >
              <IconPlus />
            </Button>
          </div>

          <div className="relative mt-4">
            <IconSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="congregations-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, CEP ou endereço…"
              className="pl-9"
              autoComplete="off"
            />
          </div>

          {loading ? (
            <Spinner label="Carregando…" className="mt-6 text-muted-foreground" />
          ) : congregations.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">Nenhuma congregação cadastrada.</p>
          ) : filtered.length === 0 ? (
            <p className="mt-6 py-6 text-center text-sm text-muted-foreground">
              Nenhuma congregação encontrada para “{search.trim()}”.
            </p>
          ) : (
            <>
              <p className="mt-4 mb-2 text-xs text-muted-foreground">
                {filtered.length} de {congregations.length} congregação(ões)
              </p>
              <ul className="divide-y divide-border">
                {filtered.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold">{c.name}</p>
                      <p className="text-sm text-muted-foreground">
                        CEP {c.cep}
                        {c.record_count !== undefined ? (
                          <span className="text-muted-foreground/70">
                            {' '}
                            · {c.record_count} território(s)
                            {c.user_count !== undefined ? ` · ${c.user_count} usuário(s)` : ''}
                          </span>
                        ) : null}
                      </p>
                      {c.address ? (
                        <p className="text-xs text-muted-foreground/80">{c.address}</p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        data-tooltip="Definir como congregação ativa"
                        aria-label="Definir como congregação ativa"
                        onClick={() => onSetActive(c)}
                      >
                        <IconLocate />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        data-tooltip="Editar"
                        aria-label="Editar"
                        onClick={() => openEdit(c)}
                      >
                        <IconPencil />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        data-tooltip="Excluir"
                        aria-label="Excluir"
                        onClick={() => onDelete(c)}
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

      <Dialog open={open} onOpenChange={(opened) => (opened ? null : closeDialog())}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar congregação' : 'Nova congregação'}</DialogTitle>
            <DialogDescription>
              {editing
                ? 'Atualize os dados da congregação.'
                : 'Um CEP pode ter mais de uma congregação.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit} noValidate className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="cong-cep">CEP</Label>
              <Input
                id="cong-cep"
                inputMode="numeric"
                value={form.cep}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, cep: maskCepInput(e.target.value) }));
                  if (errors.cep) setErrors((prev) => ({ ...prev, cep: undefined }));
                }}
                placeholder="00000-000"
                maxLength={9}
                aria-invalid={Boolean(errors.cep)}
                aria-describedby={errors.cep ? 'cong-cep-error' : undefined}
              />
              {errors.cep ? <FieldError id="cong-cep-error">{errors.cep}</FieldError> : null}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="cong-name">Nome</Label>
              <Input
                id="cong-name"
                value={form.name}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, name: e.target.value }));
                  if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
                }}
                maxLength={120}
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? 'cong-name-error' : undefined}
              />
              {errors.name ? <FieldError id="cong-name-error">{errors.name}</FieldError> : null}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="cong-address">Endereço (opcional)</Label>
              <Input
                id="cong-address"
                value={form.address}
                onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
                maxLength={255}
              />
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
              <Button type="submit" disabled={saving} data-tooltip="Salvar">
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
