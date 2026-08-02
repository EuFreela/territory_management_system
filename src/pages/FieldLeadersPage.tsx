import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  IconArrowLeft,
  IconPlus,
  IconSave,
  IconSearch,
  IconTrash,
  IconX,
} from '@/components/Map/mapIcons';
import { useConfirm } from '@/components/ui/ConfirmModal';
import { api } from '@/lib/api';
import type { FieldAssignment } from '@/lib/types';

const WEEKDAY_ORDER = ['Quarta-feira', 'Sexta-feira', 'Sábado', 'Domingo'];

function formatDateBr(iso: string | null | undefined) {
  if (!iso) return '—';
  const raw = String(iso).slice(0, 10);
  const [y, m, d] = raw.split('-');
  if (!y || !m || !d) return raw;
  return `${d}/${m}/${y}`;
}

function todayIsoLocal() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
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
    ].join(' '),
  );
  return haystack.includes(q);
}

export default function FieldLeadersPage() {
  const confirm = useConfirm();
  const [rows, setRows] = useState<FieldAssignment[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [savingId, setSavingId] = useState<number | null>(null);

  // formulário rápido de nova designação datada
  const [newDate, setNewDate] = useState('');
  const [newWeekday, setNewWeekday] = useState('Quarta-feira');
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);

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

  const datedGroups = useMemo(() => {
    const dated = filteredRows.filter((r) => !r.is_fixed);
    const map = new Map<string, FieldAssignment[]>();
    for (const row of dated) {
      const key = row.weekday_label;
      const list = map.get(key) ?? [];
      list.push(row);
      map.set(key, list);
    }
    return WEEKDAY_ORDER.map((label) => ({
      label,
      items: (map.get(label) ?? []).sort((a, b) =>
        String(a.service_date ?? '').localeCompare(String(b.service_date ?? '')),
      ),
    })).filter((g) => g.items.length > 0);
  }, [filteredRows]);

  const fixedRows = useMemo(
    () =>
      filteredRows
        .filter((r) => r.is_fixed)
        .sort((a, b) => Number(a.fixed_weekday) - Number(b.fixed_weekday)),
    [filteredRows],
  );

  const today = useMemo(() => todayIsoLocal(), []);
  const todayWeekday = useMemo(() => new Date().getDay(), []);

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

  async function removeRow(id: number) {
    const ok = await confirm({
      title: 'Remover designação',
      message: 'Esta linha da escala será apagada.',
      confirmLabel: 'Remover',
      cancelLabel: 'Cancelar',
      tone: 'danger',
    });
    if (!ok) return;
    await api(`/api/field-assignments/${id}`, { method: 'DELETE' });
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  async function addDated(event: FormEvent) {
    event.preventDefault();
    if (!newDate || !newName.trim()) {
      setError('Informe data e nome do designado.');
      return;
    }
    setAdding(true);
    setError('');
    try {
      await api('/api/field-assignments', {
        method: 'POST',
        body: JSON.stringify({
          service_date: newDate,
          weekday_label: newWeekday,
          assignee_name: newName.trim(),
          period_label: 'Julho / Agosto',
          is_fixed: false,
        }),
      });
      setNewDate('');
      setNewName('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao adicionar.');
    } finally {
      setAdding(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link
              to="/dashboard"
              title="Voltar"
              aria-label="Voltar"
              className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            >
              <IconArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-3xl font-bold text-slate-900">Dirigentes do serviço de campo</h1>
            <p className="text-sm text-slate-600">Julho / Agosto — escala por dia da semana</p>
          </div>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {loading ? <p className="text-slate-600">Carregando…</p> : null}

        {/* Busca */}
        <div>
          <label htmlFor="leaders-search" className="sr-only">
            Buscar designação
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
              <IconSearch className="h-5 w-5" />
            </span>
            <input
              id="leaders-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome, dia da semana, data ou horário…"
              className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 shadow-sm outline-none ring-sky-500 placeholder:text-slate-400 focus:border-sky-500 focus:ring-2"
              autoComplete="off"
            />
          </div>
          {!loading && rows.length > 0 ? (
            <p className="mt-2 text-xs text-slate-500">
              {query.trim()
                ? `${filteredRows.length} de ${rows.length} designação(ões)`
                : `${rows.length} designação(ões)`}
            </p>
          ) : null}
        </div>

        {/* Nova linha datada */}
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Adicionar designação (por data)
          </h2>
          <form onSubmit={addDated} className="grid gap-3 md:grid-cols-4">
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              required
            />
            <select
              value={newWeekday}
              onChange={(e) => setNewWeekday(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {WEEKDAY_ORDER.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Designado"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              required
            />
            <button
              type="submit"
              disabled={adding}
              title="Adicionar"
              aria-label="Adicionar"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-60 md:justify-self-start"
            >
              <IconPlus className="h-5 w-5" />
            </button>
          </form>
        </section>

        {!loading && rows.length > 0 && filteredRows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-600">
            Nenhuma designação encontrada para “{query.trim()}”.
          </div>
        ) : null}

        {/* Tabelas por dia */}
        {datedGroups.map((group) => (
          <section key={group.label} className="overflow-hidden rounded-2xl bg-white shadow-sm">
            <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
              <h2 className="text-lg font-bold text-slate-900">{group.label}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-3 font-medium">Dia</th>
                    <th className="px-5 py-3 font-medium">Designado</th>
                    <th className="px-5 py-3 font-medium text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {group.items.map((row) => {
                    const isToday = isTodayRow(row, today, todayWeekday);
                    const isPast = isPastDatedRow(row, today);
                    return (
                    <tr
                      key={row.id}
                      className={`border-b border-slate-50 last:border-0 transition ${
                        isToday
                          ? 'bg-sky-50 ring-2 ring-inset ring-sky-400'
                          : isPast
                            ? 'bg-slate-100/70 text-slate-400 opacity-60'
                            : ''
                      }`}
                    >
                      <td
                        className={`px-5 py-3 font-medium ${
                          isPast ? 'text-slate-400' : 'text-slate-800'
                        }`}
                      >
                        <span className="inline-flex flex-wrap items-center gap-2">
                          <span className={isPast ? 'line-through decoration-slate-300' : ''}>
                            {formatDateBr(row.service_date)}
                          </span>
                          {isToday ? (
                            <span className="rounded-full bg-sky-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                              Hoje
                            </span>
                          ) : null}
                          {isPast ? (
                            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                              Finalizado
                            </span>
                          ) : null}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        {editingId === row.id ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="min-w-[10rem] flex-1 rounded-lg border border-slate-300 px-2 py-1.5"
                              autoFocus
                            />
                            <button
                              type="button"
                              disabled={savingId === row.id}
                              onClick={() => void saveName(row.id)}
                              title="Salvar"
                              aria-label="Salvar"
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-sky-600 text-white"
                            >
                              <IconSave className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              title="Cancelar"
                              aria-label="Cancelar"
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50"
                            >
                              <IconX className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startEdit(row)}
                            className={`font-semibold hover:text-sky-700 ${
                              isToday
                                ? 'text-sky-900'
                                : isPast
                                  ? 'text-slate-400'
                                  : 'text-slate-900'
                            }`}
                            title="Clique para editar"
                          >
                            {row.assignee_name}
                          </button>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => void removeRow(row.id)}
                          title="Remover"
                          aria-label="Remover"
                          className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border hover:bg-red-50 ${
                            isPast
                              ? 'border-slate-200 text-slate-400'
                              : 'border-red-200 text-red-700'
                          }`}
                        >
                          <IconTrash className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))}

        {/* Dias fixos */}
        {fixedRows.length > 0 || (!query.trim() && !loading) ? (
        <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-emerald-50 px-5 py-3">
            <h2 className="text-lg font-bold text-slate-900">Dias fixos</h2>
            <p className="text-xs text-slate-600">Manhã — horário e dirigente fixos</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3 font-medium">Dia</th>
                  <th className="px-5 py-3 font-medium">Horário</th>
                  <th className="px-5 py-3 font-medium">Designado</th>
                  <th className="px-5 py-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {fixedRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-6 text-center text-sm text-slate-500">
                      Nenhum dia fixo neste filtro.
                    </td>
                  </tr>
                ) : null}
                {fixedRows.map((row) => {
                  const isToday = isTodayRow(row, today, todayWeekday);
                  return (
                  <tr
                    key={row.id}
                    className={`border-b border-slate-50 last:border-0 ${
                      isToday ? 'bg-emerald-50 ring-2 ring-inset ring-emerald-400' : ''
                    }`}
                  >
                    <td className="px-5 py-3 font-medium text-slate-800">
                      <span className="inline-flex flex-wrap items-center gap-2">
                        {row.weekday_label}
                        {isToday ? (
                          <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                            Hoje
                          </span>
                        ) : null}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-700">{row.fixed_time ?? '—'}</td>
                    <td className="px-5 py-3">
                      {editingId === row.id ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="min-w-[10rem] flex-1 rounded-lg border border-slate-300 px-2 py-1.5"
                            autoFocus
                          />
                          <button
                            type="button"
                            disabled={savingId === row.id}
                            onClick={() => void saveName(row.id)}
                            title="Salvar"
                            aria-label="Salvar"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-sky-600 text-white"
                          >
                            <IconSave className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            title="Cancelar"
                            aria-label="Cancelar"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50"
                          >
                            <IconX className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEdit(row)}
                          className={`font-semibold hover:text-sky-700 ${
                            isToday ? 'text-emerald-900' : 'text-slate-900'
                          }`}
                          title="Clique para editar"
                        >
                          {row.assignee_name}
                        </button>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => void removeRow(row.id)}
                        title="Remover"
                        aria-label="Remover"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 text-red-700 hover:bg-red-50"
                      >
                        <IconTrash className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
        ) : null}
      </div>
    </main>
  );
}
