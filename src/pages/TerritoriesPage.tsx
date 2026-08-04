import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  IconArrowLeft,
  IconEye,
  IconPencil,
  IconSearch,
  IconStar,
  IconUnlink,
} from '@/components/Map/mapIcons';
import { useConfirm } from '@/components/ui/ConfirmModal';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import type { Territory } from '@/lib/types';

function normalize(text: string) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export default function TerritoriesPage() {
  const confirm = useConfirm();
  const { can } = useAuth();
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const rows = await api<Territory[]>('/api/territories');
      setTerritories(rows);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao listar territórios.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = normalize(query);
    if (!q) return territories;

    return territories.filter((t) => {
      const haystack = normalize(
        [t.name, t.number ?? '', t.cep ?? '', t.is_daily ? 'territorio do dia diario' : '']
          .filter(Boolean)
          .join(' '),
      );
      return haystack.includes(q);
    });
  }, [territories, query]);

  async function setDaily(id: number) {
    await api(`/api/territories/${id}/daily`, { method: 'POST' });
    await load();
  }

  async function unlinkDaily(id: number) {
    const ok = await confirm({
      title: 'Desvincular território do dia',
      message: 'Este território deixará de ser o destaque do dia. Você poderá marcar outro quando quiser.',
      confirmLabel: 'Desvincular',
      cancelLabel: 'Cancelar',
      tone: 'warning',
    });
    if (!ok) return;
    await api(`/api/territories/${id}/daily`, { method: 'DELETE' });
    await load();
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link
              to="/dashboard"
              title="Voltar ao dashboard"
              aria-label="Voltar ao dashboard"
              className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            >
              <IconArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="mt-1 text-3xl font-bold text-slate-900">Cartões de território</h1>
            <p className="text-sm text-slate-600">Localidade + Terr. N.º + área desenhada no mapa</p>
          </div>

          {can('territory:create') ? (
            <Link
              to="/territories/new"
              className="rounded-lg bg-sky-600 px-4 py-2 font-semibold text-white hover:bg-sky-700"
            >
              Novo território
            </Link>
          ) : null}
        </div>

        <div className="mb-4">
          <label htmlFor="territory-search" className="sr-only">
            Buscar território
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
              <IconSearch className="h-5 w-5" />
            </span>
            <input
              id="territory-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por localidade, Terr. N.º ou CEP…"
              className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 shadow-sm outline-none ring-sky-500 placeholder:text-slate-400 focus:border-sky-500 focus:ring-2"
              autoComplete="off"
            />
          </div>
          {!loading && territories.length > 0 ? (
            <p className="mt-2 text-xs text-slate-500">
              {query.trim()
                ? `${filtered.length} de ${territories.length} território(s)`
                : `${territories.length} território(s)`}
            </p>
          ) : null}
        </div>

        {loading ? <p className="text-slate-600">Carregando…</p> : null}
        {error ? <p className="text-red-600">{error}</p> : null}

        <div className="space-y-4">
          {filtered.map((territory) => {
            const hasArea = Boolean(territory.geojson && territory.geojson.length > 10);
            return (
              <div
                key={territory.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-5 shadow-sm"
              >
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Localidade</p>
                  <h2 className="text-xl font-semibold text-slate-900">{territory.name}</h2>
                  {territory.number ? (
                    <p className="text-sm text-slate-600">
                      Terr. N.º <span className="font-semibold">{territory.number}</span>
                    </p>
                  ) : null}
                  <p className={`mt-1 text-xs font-medium ${hasArea ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {hasArea ? '✓ Área definida no mapa' : '⚠ Sem área no mapa'}
                  </p>
                  {territory.is_daily ? (
                    <span className="mt-2 inline-block rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
                      Território do dia
                    </span>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  {can('territory:set_daily') ? (
                    !territory.is_daily ? (
                      <button
                        type="button"
                        onClick={() => void setDaily(territory.id)}
                        title="Marcar do dia"
                        aria-label="Marcar do dia"
                        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50"
                      >
                        <IconStar className="h-5 w-5" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void unlinkDaily(territory.id)}
                        title="Desvincular do dia"
                        aria-label="Desvincular do dia"
                        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                      >
                        <IconUnlink className="h-5 w-5" />
                      </button>
                    )
                  ) : null}
                  <Link
                    to={`/territories/${territory.id}`}
                    title="Ver cartão"
                    aria-label="Ver cartão"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  >
                    <IconEye className="h-5 w-5" />
                  </Link>
                  {can('territory:update') || can('block:manage') ? (
                    <Link
                      to={`/territories/${territory.id}/edit`}
                      title="Editar área"
                      aria-label="Editar área"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white hover:bg-slate-800"
                    >
                      <IconPencil className="h-5 w-5" />
                    </Link>
                  ) : null}
                </div>
              </div>
            );
          })}

          {!loading && territories.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-600">
              Nenhum território cadastrado.
            </div>
          ) : null}

          {!loading && territories.length > 0 && filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-600">
              Nenhum território encontrado para “{query.trim()}”.
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
