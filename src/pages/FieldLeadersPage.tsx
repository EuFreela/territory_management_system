import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  IconPlus,
  IconSave,
  IconSearch,
  IconTrash,
  IconX,
} from '@/components/Map/mapIcons';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import FieldError from '@/components/ui/FieldError';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { confirmToast } from '@/lib/confirm-toast';
import { Spinner } from '@/components/ui/Spinner';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import type { FieldAssignment } from '@/lib/types';

/** Todos os dias da semana (ordem de exibição e opções do formulário) */
const WEEKDAYS_ALL = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
] as const;

/**
 * Horários da escala (select fixo):
 * - Sábado: 08:00 · Domingo: 09:00
 * - Seg/Ter/Qua/Sex: 18:00
 * - Quinta: 09:00
 */
const TIME_OPTIONS = [
  { value: '08:00', label: '08:00 — manhã' },
  { value: '09:00', label: '09:00 — manhã' },
  { value: '18:00', label: '18:00 — noite' },
] as const;

const EVENING_WEEKDAYS = new Set([
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Sexta-feira',
]);

function defaultTimeForWeekday(weekdayLabel: string): string {
  if (weekdayLabel === 'Sábado') return '08:00';
  if (weekdayLabel === 'Domingo') return '09:00';
  if (EVENING_WEEKDAYS.has(weekdayLabel)) return '18:00';
  return '09:00';
}

function isEveningWeekday(weekdayLabel: string) {
  return EVENING_WEEKDAYS.has(weekdayLabel);
}

function formatScheduleTime(value?: string | null) {
  const t = (value ?? '').trim();
  return t || '—';
}

/** Rótulo curto do período a partir do horário */
function periodHintForTime(time: string) {
  if (time === '09:00' || time === '08:00' || time === 'Manhã') return 'Manhã';
  if (time === '18:00' || time === 'Noite') return 'Noite';
  return '';
}

function ScheduleTimeBadge({
  value,
  muted = false,
}: {
  value?: string | null;
  muted?: boolean;
}) {
  const label = formatScheduleTime(value);
  if (muted) {
    return <span className="text-sm font-medium text-muted-foreground">{label}</span>;
  }
  const period = periodHintForTime(label);
  const tone =
    period === 'Noite' || label === 'Noite' || label === '18:00'
      ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-300'
      : period === 'Manhã' || label === 'Manhã' || label === '09:00' || label === '08:00'
        ? 'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-300'
        : 'bg-muted text-foreground';
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone}`}>
      {label}
    </span>
  );
}

/** Mesmas larguras em todas as tabelas (uma debaixo da outra) */
function AssignmentTableColgroup({ canManage }: { canManage: boolean }) {
  return (
    <colgroup>
      <col style={{ width: canManage ? '28%' : '30%' }} />
      <col style={{ width: canManage ? '16%' : '18%' }} />
      <col style={{ width: canManage ? '44%' : '52%' }} />
      {canManage ? <col style={{ width: '12%' }} /> : null}
    </colgroup>
  );
}

const TD_CLASS = 'px-4 py-3 align-middle';
const SELECT_CLASS =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-muted';

function formatDateBr(iso: string | null | undefined) {
  if (!iso) return '—';
  const raw = String(iso).slice(0, 10);
  const [y, m, d] = raw.split('-');
  if (!y || !m || !d) return raw;
  return `${d}/${m}/${y}`;
}

/** Dia da semana em PT a partir de YYYY-MM-DD (calendário local, sem UTC) */
function weekdayLabelFromIsoDate(iso: string): string {
  const raw = String(iso).slice(0, 10);
  const [y, m, d] = raw.split('-').map(Number);
  if (!y || !m || !d) return WEEKDAYS_ALL[0];
  const date = new Date(y, m - 1, d);
  return WEEKDAYS_ALL[date.getDay()] ?? WEEKDAYS_ALL[0];
}

/** Hoje no fuso de São Paulo/Brasília (independente do fuso do servidor) */
function todayIsoLocal() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function weekdaySaoPaulo() {
  const short = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short',
  }).format(new Date());
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[short] ?? 0;
}

function isTodayRow(row: FieldAssignment, today: string, weekday: number) {
  if (row.is_fixed) {
    return Number(row.fixed_weekday) === weekday;
  }
  const date = String(row.service_date ?? '').slice(0, 10);
  return date === today;
}

/** Designação datada já passada (antes de hoje) */
function isPastDatedRow(row: FieldAssignment, today: string) {
  if (row.is_fixed) return false;
  const date = String(row.service_date ?? '').slice(0, 10);
  return Boolean(date && date < today);
}

function normalize(text: string) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function matchesQuery(row: FieldAssignment, q: string) {
  if (!q) return true;
  const dateBr = formatDateBr(row.service_date);
  const haystack = normalize(
    [
      row.assignee_name,
      row.weekday_label,
      row.period_label ?? '',
      row.fixed_time ?? '',
      dateBr,
      String(row.service_date ?? ''),
      row.is_fixed ? 'fixo manha' : '',
      'horario',
    ].join(' '),
  );
  return haystack.includes(q);
}

export default function FieldLeadersPage() {
  const { can } = useAuth();
  const canManage = can('block:manage');
  const [rows, setRows] = useState<FieldAssignment[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [savingId, setSavingId] = useState<number | null>(null);

  // formulário rápido de nova designação datada
  const [newDate, setNewDate] = useState('');
  const [newWeekday, setNewWeekday] = useState<string>(WEEKDAYS_ALL[0]);
  const [newTime, setNewTime] = useState<string>(defaultTimeForWeekday(WEEKDAYS_ALL[0]));
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [addErrors, setAddErrors] = useState<{ date?: string; name?: string }>({});

  async function load() {
    setLoading(true);
    try {
      const data = await api<FieldAssignment[]>('/api/field-assignments');
      setRows(data);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar designações.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filteredRows = useMemo(() => {
    const q = normalize(query);
    if (!q) return rows;
    return rows.filter((r) => matchesQuery(r, q));
  }, [rows, query]);

  const today = useMemo(() => todayIsoLocal(), []);
  const todayWeekday = useMemo(() => weekdaySaoPaulo(), []);

  const datedGroups = useMemo(() => {
    const dated = filteredRows.filter((r) => !r.is_fixed);
    const map = new Map<string, FieldAssignment[]>();
    for (const row of dated) {
      const key = row.weekday_label;
      const list = map.get(key) ?? [];
      list.push(row);
      map.set(key, list);
    }

    function sortItems(items: FieldAssignment[]) {
      return [...items].sort((a, b) => {
        // Linha de hoje sempre no topo do card
        const aToday = isTodayRow(a, today, todayWeekday) ? 0 : 1;
        const bToday = isTodayRow(b, today, todayWeekday) ? 0 : 1;
        if (aToday !== bToday) return aToday - bToday;
        return String(a.service_date ?? '').localeCompare(String(b.service_date ?? ''));
      });
    }

    // Ordem fixa Dom→Sáb; dias fora da lista (rótulos antigos) ficam no final
    const known = new Set<string>(WEEKDAYS_ALL);
    const ordered = WEEKDAYS_ALL.map((label) => ({
      label,
      items: sortItems(map.get(label) ?? []),
    })).filter((g) => g.items.length > 0);

    const extras = [...map.keys()]
      .filter((label) => !known.has(label))
      .sort((a, b) => a.localeCompare(b, 'pt-BR'))
      .map((label) => ({
        label,
        items: sortItems(map.get(label) ?? []),
      }));

    const groups = [...ordered, ...extras];

    // Card com designação de hoje sempre primeiro
    return groups
      .map((g, index) => ({
        ...g,
        hasToday: g.items.some((r) => isTodayRow(r, today, todayWeekday)),
        index,
      }))
      .sort((a, b) => {
        if (a.hasToday !== b.hasToday) return a.hasToday ? -1 : 1;
        return a.index - b.index;
      });
  }, [filteredRows, today, todayWeekday]);

  const fixedRows = useMemo(() => {
    return filteredRows
      .filter((r) => r.is_fixed)
      .sort((a, b) => {
        const aToday = isTodayRow(a, today, todayWeekday) ? 0 : 1;
        const bToday = isTodayRow(b, today, todayWeekday) ? 0 : 1;
        if (aToday !== bToday) return aToday - bToday;
        return Number(a.fixed_weekday) - Number(b.fixed_weekday);
      });
  }, [filteredRows, today, todayWeekday]);

  /** Cards na tela: o que tem “Hoje” sobe para o topo */
  const displayCards = useMemo(() => {
    type Card =
      | { kind: 'dated'; key: string; group: (typeof datedGroups)[number]; hasToday: boolean; order: number }
      | { kind: 'fixed'; key: string; hasToday: boolean; order: number };

    const cards: Card[] = datedGroups.map((group, order) => ({
      kind: 'dated' as const,
      key: `dated-${group.label}`,
      group,
      hasToday: group.hasToday,
      order,
    }));

    const showFixed = fixedRows.length > 0 || (!query.trim() && !loading);
    if (showFixed) {
      cards.push({
        kind: 'fixed',
        key: 'fixed',
        hasToday: fixedRows.some((r) => isTodayRow(r, today, todayWeekday)),
        order: cards.length,
      });
    }

    return cards.sort((a, b) => {
      if (a.hasToday !== b.hasToday) return a.hasToday ? -1 : 1;
      return a.order - b.order;
    });
  }, [datedGroups, fixedRows, query, loading, today, todayWeekday]);

  function startEdit(row: FieldAssignment) {
    setEditingId(row.id);
    setEditName(row.assignee_name);
  }

  async function saveName(id: number) {
    if (!editName.trim()) return;
    setSavingId(id);
    try {
      const updated = await api<FieldAssignment>(`/api/field-assignments/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ assignee_name: editName.trim() }),
      });
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...updated } : r)));
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar.');
    } finally {
      setSavingId(null);
    }
  }

  function removeRow(id: number) {
    confirmToast({
      title: 'Remover designação',
      description: 'Esta linha da escala será apagada.',
      confirmLabel: 'Remover',
      tone: 'danger',
      onConfirm: async () => {
        try {
          await api(`/api/field-assignments/${id}`, { method: 'DELETE' });
          setRows((prev) => prev.filter((r) => r.id !== id));
          toast.success('Designação removida.');
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Erro ao remover designação.');
        }
      },
    });
  }

  async function addDated(event: FormEvent) {
    event.preventDefault();
    const errors: { date?: string; name?: string } = {};
    if (!newDate) errors.date = 'Preencha este campo.';
    if (!newName.trim()) errors.name = 'Preencha este campo.';
    setAddErrors(errors);
    if (errors.date || errors.name) return;

    setAdding(true);
    setError('');
    try {
      await api('/api/field-assignments', {
        method: 'POST',
        body: JSON.stringify({
          service_date: newDate,
          weekday_label: newWeekday,
          assignee_name: newName.trim(),
          period_label: 'Agosto',
          fixed_time: newTime.trim(),
          is_fixed: false,
        }),
      });
      setNewDate('');
      setNewName('');
      setNewWeekday(WEEKDAYS_ALL[0]);
      setNewTime(defaultTimeForWeekday(WEEKDAYS_ALL[0]));
      setAddErrors({});
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao adicionar.');
    } finally {
      setAdding(false);
    }
  }

  function onDateChange(value: string) {
    setNewDate(value);
    if (addErrors.date) setAddErrors((prev) => ({ ...prev, date: undefined }));
    if (!value) return;
    const weekday = weekdayLabelFromIsoDate(value);
    setNewWeekday(weekday);
    setNewTime(defaultTimeForWeekday(weekday));
  }

  function onWeekdayChange(value: string) {
    setNewWeekday(value);
    setNewTime(defaultTimeForWeekday(value));
  }

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-5 py-8 sm:px-8 sm:py-10">
      <div>
        <p className="text-sm font-medium text-muted-foreground">Escala</p>
        <h1 className="mt-1 text-[1.75rem] font-semibold tracking-tight sm:text-[2rem]">
          Dirigentes do serviço de campo
        </h1>
        <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">
          Designações por data e dias fixos
        </p>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {loading ? <Spinner label="Carregando…" className="text-muted-foreground" /> : null}

      {/* Busca */}
      <div>
        <label htmlFor="leaders-search" className="sr-only">
          Buscar designação
        </label>
        <div className="relative">
          <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="leaders-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome, dia da semana, data ou horário…"
            className="pl-9"
            autoComplete="off"
          />
        </div>
        {!loading && rows.length > 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            {query.trim()
              ? `${filteredRows.length} de ${rows.length} designação(ões)`
              : `${rows.length} designação(ões)`}
          </p>
        ) : null}
      </div>

      {/* Nova linha datada */}
      {canManage ? (
        <Card className="p-5 sm:p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Adicionar designação (por data)
          </h2>
          <form onSubmit={addDated} noValidate className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="grid gap-1.5">
              <Label htmlFor="new-assignment-date">Data</Label>
              <Input
                id="new-assignment-date"
                type="date"
                value={newDate}
                onChange={(e) => onDateChange(e.target.value)}
                aria-invalid={Boolean(addErrors.date)}
                aria-describedby={addErrors.date ? 'new-assignment-date-error' : undefined}
              />
              {addErrors.date ? (
                <FieldError id="new-assignment-date-error">{addErrors.date}</FieldError>
              ) : null}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="new-assignment-weekday">Dia da semana</Label>
              <select
                id="new-assignment-weekday"
                value={newWeekday}
                onChange={(e) => onWeekdayChange(e.target.value)}
                className={SELECT_CLASS}
              >
                {WEEKDAYS_ALL.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="new-assignment-time">Horário</Label>
              <select
                id="new-assignment-time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                className={SELECT_CLASS}
              >
                {TIME_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="new-assignment-name">Designado</Label>
              <Input
                id="new-assignment-name"
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value);
                  if (addErrors.name) setAddErrors((prev) => ({ ...prev, name: undefined }));
                }}
                placeholder="Nome do dirigente"
                aria-invalid={Boolean(addErrors.name)}
                aria-describedby={addErrors.name ? 'new-assignment-name-error' : undefined}
              />
              {addErrors.name ? (
                <FieldError id="new-assignment-name-error">{addErrors.name}</FieldError>
              ) : null}
            </div>
            <div className="flex items-end">
              <Button
                type="submit"
                disabled={adding}
                aria-label="Adicionar"
                data-tooltip="Adicionar"
              >
                <IconPlus />
                Adicionar
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      {!loading && rows.length > 0 && filteredRows.length === 0 ? (
        <Card>
          <div className="py-10 text-center text-sm text-muted-foreground">
            Nenhuma designação encontrada para “{query.trim()}”.
          </div>
        </Card>
      ) : null}

      {/* Cards: o que tem “Hoje” sempre em primeiro */}
      {displayCards.map((card) => {
        if (card.kind === 'dated') {
          const group = card.group;
          return (
            <Card key={card.key} className="gap-0 overflow-hidden p-0">
              <div
                className={cn(
                  'border-b px-5 py-3.5',
                  card.hasToday
                    ? 'border-blue-200/60 bg-blue-50 dark:border-blue-500/30 dark:bg-blue-500/10'
                    : 'border-border bg-muted/40',
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold">{group.label}</h2>
                  {card.hasToday ? (
                    <span className="rounded-full bg-sky-600 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                      Hoje
                    </span>
                  ) : null}
                </div>
                {group.label === 'Sábado' ? (
                  <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                    Manhã · início 08:00
                  </p>
                ) : group.label === 'Domingo' ? (
                  <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                    Manhã · início 09:00
                  </p>
                ) : isEveningWeekday(group.label) ? (
                  <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300">
                    Campo à noite · início 18:00
                  </p>
                ) : null}
              </div>
              <div className="w-full">
                <Table className="table-fixed">
                  <AssignmentTableColgroup canManage={canManage} />
                  <TableBody>
                    {group.items.map((row) => {
                      const isToday = isTodayRow(row, today, todayWeekday);
                      const isPast = isPastDatedRow(row, today);
                      return (
                        <TableRow
                          key={row.id}
                          className={cn(
                            isToday
                              ? 'bg-blue-50 inset-ring-2 inset-ring-sky-400 dark:bg-sky-500/15 dark:inset-ring-sky-500'
                              : isPast
                                ? 'bg-muted/40 opacity-60'
                                : '',
                          )}
                        >
                          <TableCell className={cn(TD_CLASS, 'font-medium')}>
                            <span className="inline-flex flex-wrap items-center gap-2">
                              <span className={isPast ? 'line-through text-muted-foreground' : ''}>
                                {formatDateBr(row.service_date)}
                              </span>
                              {isToday ? (
                                <span className="rounded-full bg-sky-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                                  Hoje
                                </span>
                              ) : null}
                              {isPast ? (
                                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                  Finalizado
                                </span>
                              ) : null}
                            </span>
                          </TableCell>
                          <TableCell className={TD_CLASS}>
                            <ScheduleTimeBadge value={row.fixed_time} muted={isPast} />
                          </TableCell>
                          <TableCell className={TD_CLASS}>
                            {canManage && editingId === row.id ? (
                              <div className="flex flex-wrap items-center gap-2">
                                <Input
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                  className="h-8 min-w-0 flex-1"
                                  autoFocus
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  disabled={savingId === row.id}
                                  onClick={() => void saveName(row.id)}
                                  data-tooltip="Salvar dirigencia"
                                  aria-label="Salvar dirigencia"
                                >
                                  <IconSave />
                                  Salvar dirigencia
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setEditingId(null)}
                                  data-tooltip="Cancelar"
                                  aria-label="Cancelar"
                                >
                                  <IconX />
                                </Button>
                              </div>
                            ) : canManage ? (
                              <button
                                type="button"
                                onClick={() => startEdit(row)}
                                className={cn(
                                  'block max-w-full truncate font-semibold',
                                  isToday
                                    ? 'text-sky-900 hover:underline dark:text-sky-300'
                                    : isPast
                                      ? 'text-muted-foreground'
                                      : 'text-foreground hover:underline',
                                )}
                                data-tooltip="Clique para editar"
                              >
                                {row.assignee_name}
                              </button>
                            ) : (
                              <span
                                className={cn(
                                  'block max-w-full truncate font-semibold',
                                  isToday
                                    ? 'text-sky-900 dark:text-sky-300'
                                    : isPast
                                      ? 'text-muted-foreground'
                                      : 'text-foreground',
                                )}
                              >
                                {row.assignee_name}
                              </span>
                            )}
                          </TableCell>
                          {canManage ? (
                            <TableCell className={cn(TD_CLASS, 'text-right')}>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() => void removeRow(row.id)}
                                data-tooltip="Remover"
                                aria-label="Remover"
                                className={cn(
                                  isPast
                                    ? 'text-muted-foreground'
                                    : 'border-destructive/30 text-destructive hover:bg-destructive/10',
                                )}
                              >
                                <IconTrash />
                              </Button>
                            </TableCell>
                          ) : null}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </Card>
          );
        }

        // card.kind === 'fixed'
        return (
          <Card key={card.key} className="gap-0 overflow-hidden p-0">
            <div
              className={cn(
                'border-b px-5 py-3.5',
                card.hasToday
                  ? 'border-emerald-300/60 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10'
                  : 'border-border bg-emerald-50/60 dark:bg-emerald-500/5',
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold">Dias fixos</h2>
                {card.hasToday ? (
                  <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    Hoje
                  </span>
                ) : null}
              </div>
              <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                Manhã — horário e dirigente fixos
              </p>
            </div>
            <div className="w-full">
                <Table className="table-fixed">
                  <AssignmentTableColgroup canManage={canManage} />
                  <TableBody>
                  {fixedRows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={canManage ? 4 : 3}
                        className="py-6 text-center text-sm text-muted-foreground"
                      >
                        Nenhum dia fixo neste filtro.
                      </TableCell>
                    </TableRow>
                  ) : null}
                  {fixedRows.map((row) => {
                    const isToday = isTodayRow(row, today, todayWeekday);
                    return (
                      <TableRow
                        key={row.id}
                        className={
                          isToday
                            ? 'bg-emerald-50 inset-ring-2 inset-ring-emerald-400 dark:bg-emerald-500/15 dark:inset-ring-emerald-500'
                            : ''
                        }
                      >
                        <TableCell className={cn(TD_CLASS, 'font-medium')}>
                          <span className="inline-flex flex-wrap items-center gap-2">
                            {row.weekday_label}
                            {isToday ? (
                              <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                                Hoje
                              </span>
                            ) : null}
                          </span>
                        </TableCell>
                        <TableCell className={TD_CLASS}>
                          <ScheduleTimeBadge value={row.fixed_time} />
                        </TableCell>
                        <TableCell className={TD_CLASS}>
                          {canManage && editingId === row.id ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <Input
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="h-8 min-w-0 flex-1"
                                autoFocus
                              />
                              <Button
                                type="button"
                                variant="outline"
                                disabled={savingId === row.id}
                                onClick={() => void saveName(row.id)}
                                data-tooltip="Salvar dirigencia"
                                aria-label="Salvar dirigencia"
                              >
                                <IconSave />
                                Salvar dirigencia
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => setEditingId(null)}
                                data-tooltip="Cancelar"
                                aria-label="Cancelar"
                              >
                                <IconX />
                              </Button>
                            </div>
                          ) : canManage ? (
                            <button
                              type="button"
                              onClick={() => startEdit(row)}
                              className={cn(
                                'block max-w-full truncate font-semibold',
                                isToday
                                  ? 'text-emerald-900 hover:underline dark:text-emerald-300'
                                  : 'text-foreground hover:underline',
                              )}
                              data-tooltip="Clique para editar"
                            >
                              {row.assignee_name}
                            </button>
                          ) : (
                            <span
                              className={cn(
                                'block max-w-full truncate font-semibold',
                                isToday
                                  ? 'text-emerald-900 dark:text-emerald-300'
                                  : 'text-foreground',
                              )}
                            >
                              {row.assignee_name}
                            </span>
                          )}
                        </TableCell>
                        {canManage ? (
                          <TableCell className={cn(TD_CLASS, 'text-right')}>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => void removeRow(row.id)}
                              data-tooltip="Remover"
                              aria-label="Remover"
                              className="border-destructive/30 text-destructive hover:bg-destructive/10"
                            >
                              <IconTrash />
                            </Button>
                          </TableCell>
                        ) : null}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
        );
      })}
    </main>
  );
}
