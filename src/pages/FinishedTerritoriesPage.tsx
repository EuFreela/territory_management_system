import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { IconCheckCircle, IconMap, IconSearch, IconTrash } from '@/components/Map/mapIcons';
import { useConfirm } from '@/components/ui/ConfirmModal';
import { api } from '@/lib/api';
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

function normalize(text: string) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export default function FinishedTerritoriesPage() {
  const confirm = useConfirm();
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<FinishedTerritoryHistory[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);

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

  async function removeHistoryRow(row: FinishedTerritoryHistory) {
    if (!isAdmin) return;
    const ok = await confirm({
      title: 'Remover do histórico?',
      message: `Remover a finalização de “${row.territory_name}” (${formatDateBr(row.field_date)})? Esta ação não pode ser desfeita.`,
      confirmLabel: 'Remover',
      cancelLabel: 'Cancelar',
      tone: 'danger',
    });
    if (!ok) return;

    setDeletingId(row.id);
    setError('');
    try {
      await api(`/api/territories/finished-history/${row.id}`, { method: 'DELETE' });
      setRows((prev) => prev.filter((r) => r.id !== row.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao remover.');
    } finally {
      setDeletingId(null);
    }
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
          Histórico de finalizações — dia do campo, horário, dirigente e data/hora do registro
        </p>
      </div>

      <div className="mb-5">
        <label htmlFor="finished-search" className="sr-only">
          Buscar no histórico
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-[#86868b]">
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
          <p className="mt-2 text-[12px] text-[#86868b]">
            {query.trim()
              ? `${filtered.length} de ${rows.length} registro(s)`
              : `${rows.length} registro(s)`}
          </p>
        ) : null}
      </div>

      {loading ? <p className="text-[15px] text-[#6e6e73]">Carregando…</p> : null}
      {error ? (
        <p className="rounded-[12px] bg-red-50 px-3 py-2 text-[13px] text-[#ff3b30]">{error}</p>
      ) : null}

      {!loading && !error && filtered.length === 0 ? (
        <div className="rounded-[20px] border border-dashed border-black/[0.08] bg-white px-6 py-14 text-center">
          <IconCheckCircle className="mx-auto mb-3 h-8 w-8 text-[#34c759]/70" />
          <p className="text-[15px] font-medium text-[#1d1d1f]">
            {rows.length === 0 ? 'Nenhum território finalizado ainda' : 'Nenhum resultado'}
          </p>
          <p className="mt-1 text-[13px] text-[#86868b]">
            {rows.length === 0
              ? 'Quando todas as casas de um território forem marcadas, o registro aparece aqui.'
              : `Nada encontrado para “${query.trim()}”.`}
          </p>
        </div>
      ) : null}

      {!loading && filtered.length > 0 ? (
        <div className="overflow-hidden rounded-[20px] border border-black/[0.06] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[14px]">
              <thead>
                <tr className="border-b border-black/[0.06] bg-[#fafafa]">
                  <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#86868b]">
                    Dia
                  </th>
                  <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#86868b]">
                    Horário
                  </th>
                  <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#86868b]">
                    Dirigente
                  </th>
                  <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#86868b]">
                    Pessoas
                  </th>
                  <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#86868b]">
                    Território
                  </th>
                  <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#86868b]">
                    Registrado por
                  </th>
                  <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#86868b]">
                    Data/hora
                  </th>
                  {isAdmin ? (
                    <th className="px-5 py-3.5 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-[#86868b]">
                      Ações
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-black/[0.04] last:border-0 transition hover:bg-[#fafafa]"
                  >
                    <td className="px-5 py-3.5 font-medium tabular-nums text-[#1d1d1f]">
                      {formatDateBr(row.field_date)}
                    </td>
                    <td className="px-5 py-3.5 text-[#6e6e73]">
                      {row.field_time?.trim() ? (
                        <span className="inline-flex rounded-full bg-[#f5f5f7] px-2.5 py-0.5 text-[12px] font-semibold text-[#1d1d1f]">
                          {row.field_time}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-[#1d1d1f]">
                      {row.leader_name?.trim() || (
                        <span className="text-[#86868b]">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 tabular-nums text-[#1d1d1f]">
                      {row.people_count != null ? (
                        <span className="font-medium">{row.people_count}</span>
                      ) : (
                        <span className="text-[#86868b]">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        {row.territory_id ? (
                          <Link
                            to={`/territories/${row.territory_id}`}
                            title={`Abrir ${row.territory_name}${row.territory_number ? ` N.º ${row.territory_number}` : ''}`}
                            aria-label={`Abrir território ${row.territory_name}`}
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/[0.06] bg-[#f5f5f7] text-[#1d1d1f] transition hover:bg-[#0071e3] hover:text-white hover:border-transparent"
                          >
                            <IconMap className="h-4 w-4" />
                          </Link>
                        ) : (
                          <span
                            title={`${row.territory_name}${row.territory_number ? ` N.º ${row.territory_number}` : ''}`}
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/[0.06] bg-[#f5f5f7] text-[#86868b]"
                          >
                            <IconMap className="h-4 w-4" />
                          </span>
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-medium text-[#1d1d1f]">{row.territory_name}</p>
                          {row.territory_number ? (
                            <p className="text-[12px] text-[#86868b]">N.º {row.territory_number}</p>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-[#1d1d1f]">
                      {row.finished_by_name?.trim() ? (
                        <span className="font-medium">{row.finished_by_name}</span>
                      ) : (
                        <span className="text-[#86868b]">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap tabular-nums text-[13px] text-[#6e6e73]">
                      {formatDateTimeBr(row.finished_at)}
                    </td>
                    {isAdmin ? (
                      <td className="px-5 py-3.5 text-right">
                        <button
                          type="button"
                          disabled={deletingId === row.id}
                          onClick={() => void removeHistoryRow(row)}
                          title="Remover do histórico"
                          aria-label="Remover do histórico"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-red-200 bg-white text-[#ff3b30] transition hover:bg-red-50 disabled:opacity-50"
                        >
                          <IconTrash className="h-4 w-4" />
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </main>
  );
}
