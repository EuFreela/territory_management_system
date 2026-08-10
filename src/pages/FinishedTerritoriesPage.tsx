import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  IconCheck,
  IconCheckCircle,
  IconFileText,
  IconMap,
  IconSearch,
  IconTrash,
  IconX,
} from '@/components/Map/mapIcons';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { confirmToast } from '@/lib/confirm-toast';
import { Spinner } from '@/components/ui/Spinner';
import { api } from '@/lib/api';
import { tooltipText } from '@/lib/tooltip';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import type { FinishedTerritoryHistory } from '@/lib/types';

function formatDateBr(iso: string | null | undefined) {
  if (!iso) return '—';
  const raw = String(iso).slice(0, 10);
  const [y, m, d] = raw.split('-');
  if (!y || !m || !d) return raw;
  return `${d}/${m}/${y}`;
}

/** Data e hora da ação de finalizar (America/Sao_Paulo) */
function formatDateTimeBr(iso: string | null | undefined) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    // fallback: "YYYY-MM-DD HH:MM:SS" ou ISO sem Z
    const s = String(iso).replace('T', ' ').slice(0, 16);
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
    if (m) return `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}`;
    return String(iso);
  }
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

/** Só a hora da ação de finalizar (America/Sao_Paulo) */
function formatTimeBr(iso: string | null | undefined) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    const s = String(iso).replace('T', ' ').slice(0, 16);
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
    if (m) return `${m[4]}:${m[5]}`;
    return String(iso);
  }
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function normalize(text: string) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

const thClass = 'text-xs font-semibold uppercase tracking-wider text-muted-foreground';

export default function FinishedTerritoriesPage() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<FinishedTerritoryHistory[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  /** Checklist do relatório: quais linhas entram no relatório */
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [tab, setTab] = useState<'metrica' | 'historico'>('historico');

  useEffect(() => {
    setLoading(true);
    api<FinishedTerritoryHistory[]>('/api/territories/finished-history')
      .then((data) => {
        setRows(Array.isArray(data) ? data : []);
        setError('');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar.'))
      .finally(() => setLoading(false));
  }, []);

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    if (filtered.length === 0) return;
    const allSelected = filtered.every((r) => selectedIds.has(Number(r.id)));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        for (const r of filtered) next.delete(Number(r.id));
      } else {
        for (const r of filtered) next.add(Number(r.id));
      }
      return next;
    });
  }

  function startSelection() {
    setSelectedIds(new Set());
    setSelectMode(true);
  }

  function cancelSelection() {
    setSelectMode(false);
    setSelectedIds(new Set());
  }

  function generateReport() {
    if (selectedIds.size === 0) return;
    navigate(`/relatorios/finalizados?ids=${[...selectedIds].join(',')}`);
  }

  function removeHistoryRow(row: FinishedTerritoryHistory) {
    if (!isAdmin) return;
    confirmToast({
      title: 'Remover do histórico?',
      description: `Remover a finalização de “${row.territory_name}” (${formatDateBr(row.field_date)})? Esta ação não pode ser desfeita.`,
      confirmLabel: 'Remover',
      tone: 'danger',
      onConfirm: async () => {
        setDeletingId(row.id);
        setError('');
        try {
          await api(`/api/territories/finished-history/${row.id}`, { method: 'DELETE' });
          setRows((prev) => prev.filter((r) => r.id !== row.id));
          toast.success('Registro removido do histórico.');
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Erro ao remover.');
        } finally {
          setDeletingId(null);
        }
      },
    });
  }

  const filtered = useMemo(() => {
    const q = normalize(query);
    if (!q) return rows;
    return rows.filter((r) => {
      const hay = normalize(
        [
          r.territory_name,
          r.territory_number ?? '',
          formatDateBr(r.field_date),
          String(r.field_date ?? ''),
          r.field_time ?? '',
          r.leader_name ?? '',
          r.people_count != null ? String(r.people_count) : '',
          r.restam_casas != null ? String(r.restam_casas) : '',
          r.finished_by_name ?? '',
          formatDateTimeBr(r.finished_at),
          String(r.finished_at ?? ''),
        ].join(' '),
      );
      return hay.includes(q);
    });
  }, [rows, query]);

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8 sm:py-10">
      <div className="mb-8">
        <p className="text-sm font-medium text-muted-foreground">Histórico</p>
        <h1 className="mt-1 text-[1.75rem] font-semibold tracking-tight sm:text-[2rem]">
          Finalizados
        </h1>
        <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">
          Histórico de finalizações — dia, horário, dirigente, pessoas e o não em casa do território
        </p>
      </div>

      <div
        className="mb-5 inline-flex w-full rounded-full bg-muted p-1 sm:w-auto"
        role="tablist"
        aria-label="Abas"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'metrica'}
          onClick={() => setTab('metrica')}
          className={cn(
            'flex h-8 flex-1 items-center justify-center gap-1.5 rounded-full px-5 text-sm font-medium transition sm:flex-none',
            tab === 'metrica'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Métricas
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'historico'}
          onClick={() => setTab('historico')}
          className={cn(
            'flex h-8 flex-1 items-center justify-center gap-1.5 rounded-full px-5 text-sm font-medium transition sm:flex-none',
            tab === 'historico'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Finalizados
        </button>
      </div>

      {tab === 'metrica' ? (
        <section className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Análises</p>
              <h2 className="mt-1 text-[1.375rem] font-semibold tracking-tight">Métricas</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Gráficos com base no histórico de finalizações ({rows.length} registro(s)).
              </p>
            </div>
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Em breve: gráficos das finalizações.
              </CardContent>
            </Card>
          </section>
        ) : (
        <>
          <div className="mb-5">
            <label htmlFor="finished-search" className="sr-only">
              Buscar no histórico
            </label>
            <div className="relative">
              <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="finished-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por dia, horário, dirigente ou território…"
                className="pl-9"
                autoComplete="off"
              />
            </div>
            {!loading && rows.length > 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                {query.trim()
                  ? `${filtered.length} de ${rows.length} registro(s)`
                  : `${rows.length} registro(s)`}
              </p>
            ) : null}
          </div>

          {!selectMode ? (
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Gere um relatório A4 com as finalizações — escolha as linhas no checklist.
              </p>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={startSelection}
                disabled={filtered.length === 0}
                data-tooltip="Gerar relatório"
              >
                <IconFileText />
              </Button>
            </div>
          ) : (
            <Card className="mb-5">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-4">
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">{selectedIds.size}</span> de{' '}
                  {filtered.length} selecionado(s) — marque as linhas que entram no relatório.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={toggleSelectAll}
                    data-tooltip={
                      filtered.every((r) => selectedIds.has(Number(r.id)))
                        ? 'Limpar seleção'
                        : 'Selecionar todos'
                    }
                  >
                    <IconCheck />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    onClick={generateReport}
                    disabled={selectedIds.size === 0}
                    data-tooltip={`Gerar relatório (${selectedIds.size})`}
                  >
                    <IconFileText />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={cancelSelection}
                    data-tooltip="Cancelar"
                  >
                    <IconX />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {loading ? <Spinner label="Carregando…" className="text-muted-foreground" /> : null}
          {error ? (
            <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          {!loading && !error && filtered.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center py-10 text-center">
                <IconCheckCircle className="mb-3 size-8 text-emerald-500" />
                <p className="text-sm font-medium">
                  {rows.length === 0 ? 'Nenhum território finalizado ainda' : 'Nenhum resultado'}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {rows.length === 0
                    ? 'Quando todas as casas de um território forem marcadas, o registro aparece aqui.'
                    : `Nada encontrado para “${query.trim()}”.`}
                </p>
              </CardContent>
            </Card>
          ) : null}

          {!loading && filtered.length > 0 ? (
            <div className="overflow-hidden rounded-xl border bg-card">
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className={`${thClass} ${selectMode ? 'w-[16%]' : 'w-[9%]'}`}>
                      Dia
                    </TableHead>
                    <TableHead className={`${thClass} w-[8%]`}>Horário</TableHead>
                    <TableHead className={`${thClass} w-[11%]`}>Dirigente</TableHead>
                    <TableHead className={`${thClass} w-[26%]`}>Território</TableHead>
                    <TableHead className={`${thClass} w-[12%]`}>Registro</TableHead>
                    <TableHead className={`${thClass} w-[13%]`}>Fim</TableHead>
                    {isAdmin ? (
                      <TableHead className={`${thClass} w-[8%] text-right`}>Ações</TableHead>
                    ) : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="py-3 font-medium tabular-nums">
                        <span className="flex min-w-0 items-center gap-2">
                          {selectMode ? (
                            <Checkbox
                              checked={selectedIds.has(Number(row.id))}
                              onCheckedChange={() => toggleSelect(Number(row.id))}
                              aria-label={`Incluir no relatório: ${formatDateBr(row.field_date)} — ${row.territory_name}`}
                            />
                          ) : null}
                          <span>{formatDateBr(row.field_date)}</span>
                        </span>
                      </TableCell>
                      <TableCell className="py-3 text-muted-foreground">
                        {row.field_time?.trim() ? (
                          <span className="inline-flex max-w-full truncate rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-foreground">
                            {row.field_time}
                          </span>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell
                        className="relative z-10 py-3"
                        {...(row.leader_name?.trim()
                          ? { 'data-tooltip': row.leader_name.trim(), 'data-tooltip-multiline': '' }
                          : {})}
                      >
                        {row.leader_name?.trim() ? (
                          <span className="block truncate">{row.leader_name.trim()}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="flex min-w-0 items-center gap-2">
                          {row.territory_id ? (
                            <Button
                              asChild
                              variant="outline"
                              size="icon"
                              className="relative z-10"
                              data-tooltip={tooltipText(
                                `Abrir ${row.territory_name}${row.territory_number ? ` N.º ${row.territory_number}` : ''}`,
                              )}
                              data-tooltip-side="bottom"
                              aria-label={`Abrir território ${row.territory_name}`}
                            >
                              <Link to={`/territories/${row.territory_id}`}>
                                <IconMap />
                              </Link>
                            </Button>
                          ) : (
                            <span
                              className="relative z-10 inline-flex size-8 shrink-0 items-center justify-center rounded-full border bg-muted/50 text-muted-foreground"
                              data-tooltip={tooltipText(
                                `${row.territory_name}${row.territory_number ? ` N.º ${row.territory_number}` : ''}`,
                              )}
                              data-tooltip-side="bottom"
                            >
                              <IconMap className="size-3.5" />
                            </span>
                          )}
                          <div className="min-w-0">
                            <p className="truncate font-medium">{row.territory_name}</p>
                            {row.territory_number ? (
                              <p className="truncate text-xs text-muted-foreground">
                                N.º {row.territory_number}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-3 truncate">
                        {row.finished_by_name?.trim() ? (
                          <span className="font-medium">{row.finished_by_name}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="py-3 truncate text-xs tabular-nums text-muted-foreground">
                        {formatTimeBr(row.finished_at)}
                      </TableCell>
                      {isAdmin ? (
                        <TableCell className="py-3 text-right">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            disabled={deletingId === row.id}
                            onClick={() => void removeHistoryRow(row)}
                            data-tooltip="Remover do histórico"
                            data-tooltip-side="left"
                            aria-label="Remover do histórico"
                            className="relative z-20 border-destructive/30 text-destructive hover:bg-destructive/10"
                          >
                            <IconTrash />
                          </Button>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </>
      )}
    </main>
  );
}
