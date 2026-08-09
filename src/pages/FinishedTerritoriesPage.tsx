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
import { toast } from 'sonner';
import { confirmToast } from '@/lib/confirm-toast';
import { Spinner } from '@/components/ui/Spinner';
import { api } from '@/lib/api';
import { tooltipText } from '@/lib/tooltip';
import { useAuth } from '@/lib/auth-context';
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

const thClass =
  'px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-apple-tertiary sm:px-4';
const tdClass = 'px-3 py-3.5 text-[14px] sm:px-4';

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
    <main className="app-page">
      <div className="mb-8">
        <p className="app-section-title">Histórico</p>
        <h1 className="app-title mt-1">Finalizados</h1>
        <p className="app-subtitle">
          Histórico de finalizações — dia, horário, dirigente, pessoas e o não em casa do território
        </p>
      </div>

      <div
        className="mb-5 inline-flex w-full rounded-full border border-apple-line bg-apple-fill p-1 sm:w-auto"
        role="tablist"
        aria-label="Abas"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'metrica'}
          onClick={() => setTab('metrica')}
          className={[
            'inline-flex flex-1 items-center justify-center rounded-full px-4 py-2 text-[13px] font-semibold transition sm:flex-none sm:px-5',
            tab === 'metrica'
              ? 'bg-apple-surface text-apple-ink shadow-soft'
              : 'text-apple-secondary hover:text-apple-ink',
          ].join(' ')}
        >
          Métricas
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'historico'}
          onClick={() => setTab('historico')}
          className={[
            'inline-flex flex-1 items-center justify-center rounded-full px-4 py-2 text-[13px] font-semibold transition sm:flex-none sm:px-5',
            tab === 'historico'
              ? 'bg-apple-surface text-apple-ink shadow-soft'
              : 'text-apple-secondary hover:text-apple-ink',
          ].join(' ')}
        >
          Finalizados
        </button>
      </div>

      {tab === 'metrica' ? (
        <section className="space-y-4">
          <div>
            <p className="app-section-title">Análises</p>
            <h2 className="mt-1 text-[22px] font-semibold tracking-tightish text-apple-ink">
              Métricas
            </h2>
            <p className="mt-1 text-[14px] text-apple-secondary">
              Gráficos com base no histórico de finalizações ({rows.length} registro(s)).
            </p>
          </div>
          <div className="app-empty">
            <p className="text-[14px] text-apple-tertiary">
              Em breve: gráficos das finalizações.
            </p>
          </div>
        </section>
      ) : (
        <>
          <div className="mb-5">
        <label htmlFor="finished-search" className="sr-only">
          Buscar no histórico
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-apple-tertiary">
            <IconSearch className="h-4 w-4" />
          </span>
          <input
            id="finished-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por dia, horário, dirigente ou território…"
            className="app-input pl-10"
            autoComplete="off"
          />
        </div>
        {!loading && rows.length > 0 ? (
          <p className="mt-2 text-[12px] text-apple-tertiary">
            {query.trim()
              ? `${filtered.length} de ${rows.length} registro(s)`
              : `${rows.length} registro(s)`}
          </p>
        ) : null}
      </div>

      {!selectMode ? (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-apple-secondary">
            Gere um relatório A4 com as finalizações — escolha as linhas no checklist.
          </p>
          <button
            type="button"
            onClick={startSelection}
            disabled={filtered.length === 0}
            className="app-btn-secondary disabled:opacity-50"
          >
            <IconFileText className="h-4 w-4" />
            Gerar relatório
          </button>
        </div>
      ) : (
        <div className="mb-5 rounded-apple border border-apple-line bg-apple-surface p-3.5 shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[13px] text-apple-secondary">
              <span className="font-semibold text-apple-ink">{selectedIds.size}</span> de{' '}
              {filtered.length} selecionado(s) — marque as linhas que entram no relatório.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={toggleSelectAll}
                className="app-btn-secondary"
              >
                <IconCheck className="h-4 w-4" />
                {filtered.every((r) => selectedIds.has(Number(r.id)))
                  ? 'Limpar seleção'
                  : 'Selecionar todos'}
              </button>
              <button
                type="button"
                onClick={generateReport}
                disabled={selectedIds.size === 0}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-apple-blue px-4 text-[14px] font-semibold text-white shadow-soft transition hover:bg-apple-blue-hover disabled:opacity-50"
              >
                <IconFileText className="h-4 w-4" />
                Gerar relatório ({selectedIds.size})
              </button>
              <button
                type="button"
                onClick={cancelSelection}
                className="app-btn-secondary"
              >
                <IconX className="h-4 w-4" />
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? <Spinner label="Carregando…" className="text-apple-secondary" /> : null}
      {error ? (
        <p className="rounded-[12px] bg-apple-red/10 px-3 py-2 text-[13px] text-apple-red">{error}</p>
      ) : null}

      {!loading && !error && filtered.length === 0 ? (
        <div className="app-empty">
          <IconCheckCircle className="mx-auto mb-3 h-8 w-8 text-apple-green/70" />
          <p className="text-[15px] font-medium text-apple-ink">
            {rows.length === 0 ? 'Nenhum território finalizado ainda' : 'Nenhum resultado'}
          </p>
          <p className="mt-1 text-[13px] text-apple-tertiary">
            {rows.length === 0
              ? 'Quando todas as casas de um território forem marcadas, o registro aparece aqui.'
              : `Nada encontrado para “${query.trim()}”.`}
          </p>
        </div>
      ) : null}

      {!loading && filtered.length > 0 ? (
        /* overflow-visible: tooltips da coluna Ações precisam sobressair do card */
        <div className="rounded-[20px] border border-apple-line bg-apple-surface shadow-soft">
          <table className="w-full table-fixed text-left">
            <thead>
              <tr className="bg-apple-fill first:rounded-t-[20px]">
                <th
                  className={`${thClass} ${selectMode ? 'w-[16%]' : 'w-[9%]'} first:rounded-tl-[19px]`}
                >
                  Dia
                </th>
                <th className={`${thClass} w-[8%]`}>Horário</th>
                <th className={`${thClass} w-[11%]`}>Dirigente</th>
                <th className={`${thClass} w-[8%]`}>Presentes</th>
                <th className={`${thClass} w-[13%]`}>Restam casas</th>
                <th className={`${thClass} w-[18%]`}>Território</th>
                <th className={`${thClass} w-[12%]`}>Registro</th>
                <th className={`${thClass} w-[13%] ${isAdmin ? '' : 'rounded-tr-[19px]'}`}>
                  Fim
                </th>
                {isAdmin ? (
                  <th className={`${thClass} w-[8%] rounded-tr-[19px] text-right`}>Ações</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className="transition hover:bg-apple-fill">
                  <td className={`${tdClass} font-medium tabular-nums text-apple-ink`}>
                    <span className="flex min-w-0 items-center gap-2">
                      {selectMode ? (
                        <button
                          type="button"
                          onClick={() => toggleSelect(Number(row.id))}
                          aria-label={`Incluir no relatório: ${formatDateBr(row.field_date)} — ${row.territory_name}`}
                          className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition ${
                            selectedIds.has(Number(row.id))
                              ? 'border-transparent bg-apple-blue text-white'
                              : 'border-apple-line text-transparent hover:border-apple-blue'
                          }`}
                        >
                          <IconCheck className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                      <span>{formatDateBr(row.field_date)}</span>
                    </span>
                  </td>
                  <td className={`${tdClass} text-apple-secondary`}>
                    {row.field_time?.trim() ? (
                      <span className="inline-flex max-w-full truncate rounded-full bg-apple-fill px-2 py-0.5 text-[12px] font-semibold text-apple-ink">
                        {row.field_time}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className={`${tdClass} truncate text-apple-ink`}>
                    {row.leader_name?.trim() || (
                      <span className="text-apple-tertiary">—</span>
                    )}
                  </td>
                  <td className={`${tdClass} tabular-nums text-apple-ink`}>
                    {row.people_count != null ? (
                      <span className="font-medium">{row.people_count}</span>
                    ) : (
                      <span className="text-apple-tertiary">—</span>
                    )}
                  </td>
                  <td className={`${tdClass} tabular-nums text-apple-ink`}>
                    {row.restam_casas != null ? (
                      <span className="font-medium">{row.restam_casas}</span>
                    ) : (
                      <span className="text-apple-tertiary">—</span>
                    )}
                  </td>
                  <td className={tdClass}>
                    <div className="flex min-w-0 items-center gap-2">
                      {row.territory_id ? (
                        <Link
                          to={`/territories/${row.territory_id}`}
                          data-tooltip={tooltipText(
                            `Abrir ${row.territory_name}${row.territory_number ? ` N.º ${row.territory_number}` : ''}`,
                          )}
                          data-tooltip-side="bottom"
                          aria-label={`Abrir território ${row.territory_name}`}
                          className="relative z-10 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-apple-line bg-apple-fill text-apple-ink transition hover:border-transparent hover:bg-apple-blue hover:text-white"
                        >
                          <IconMap className="h-3.5 w-3.5" />
                        </Link>
                      ) : (
                        <span
                          data-tooltip={tooltipText(
                            `${row.territory_name}${row.territory_number ? ` N.º ${row.territory_number}` : ''}`,
                          )}
                          data-tooltip-side="bottom"
                          className="relative z-10 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-apple-line bg-apple-fill text-apple-tertiary"
                        >
                          <IconMap className="h-3.5 w-3.5" />
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-medium text-apple-ink">{row.territory_name}</p>
                        {row.territory_number ? (
                          <p className="truncate text-[12px] text-apple-tertiary">N.º {row.territory_number}</p>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className={`${tdClass} truncate text-apple-ink`}>
                    {row.finished_by_name?.trim() ? (
                      <span className="font-medium">{row.finished_by_name}</span>
                    ) : (
                      <span className="text-apple-tertiary">—</span>
                    )}
                  </td>
                  <td className={`${tdClass} truncate tabular-nums text-[13px] text-apple-secondary`}>
                    {formatTimeBr(row.finished_at)}
                  </td>
                  {isAdmin ? (
                    <td className={`${tdClass} text-right`}>
                      <button
                        type="button"
                        disabled={deletingId === row.id}
                        onClick={() => void removeHistoryRow(row)}
                        data-tooltip="Remover do histórico"
                        data-tooltip-side="left"
                        aria-label="Remover do histórico"
                        className="relative z-20 inline-flex h-8 w-8 items-center justify-center rounded-full border border-apple-red/25 bg-apple-surface text-apple-red transition hover:bg-apple-red/10 disabled:opacity-50"
                      >
                        <IconTrash className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
        </>
      )}
    </main>
  );
}
