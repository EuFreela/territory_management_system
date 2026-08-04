import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
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
    <main className="app-page">
      <div>
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="app-section-title">Cartões</p>
            <h1 className="app-title mt-1">Territórios</h1>
            <p className="app-subtitle">Localidade, Terr. N.º</p>
          </div>

          {can('territory:create') ? (
            <Link to="/territories/new" className="app-btn-primary">
              Novo território
            </Link>
          ) : null}
        </div>

        <div className="mb-6">
          <label htmlFor="territory-search" className="sr-only">
            Buscar território
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-apple-tertiary">
              <IconSearch className="h-4 w-4" />
            </span>
            <input
              id="territory-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por localidade, Terr. N.º…"
              className="app-input pl-10"
              autoComplete="off"
            />
          </div>
          {!loading && territories.length > 0 ? (
            <p className="mt-2 text-xs text-apple-tertiary">
              {query.trim()
                ? `${filtered.length} de ${territories.length} território(s)`
                : `${territories.length} território(s)`}
            </p>
          ) : null}
        </div>

        {loading ? <p className="text-[15px] text-apple-secondary">Carregando…</p> : null}
        {error ? <p className="text-[15px] text-apple-red">{error}</p> : null}

        <div className="space-y-3">
          {filtered.map((territory) => {
            const hasArea = Boolean(territory.geojson && territory.geojson.length > 10);
            return (
              <div
                key={territory.id}
                className="app-card flex flex-wrap items-center justify-between gap-4 p-5 transition hover:shadow-card"
              >
                <div>
                  <p className="text-[12px] font-medium uppercase tracking-[0.04em] text-apple-tertiary">
                    Localidade
                  </p>
                  <h2 className="text-[18px] font-semibold tracking-tightish text-apple-ink">
                    {territory.name}
                  </h2>
                  {territory.number ? (
                    <p className="text-[14px] text-apple-secondary">
                      Terr. N.º <span className="font-medium text-apple-ink">{territory.number}</span>
                    </p>
                  ) : null}
                  <p
                    className={`mt-1.5 text-[12px] font-medium ${
                      hasArea
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-amber-700 dark:text-amber-400'
                    }`}
                  >
                    {hasArea ? 'Área definida no mapa' : 'Sem área no mapa'}
                  </p>
                  {territory.is_daily ? (
                    <span className="app-badge-green mt-2">Território do dia</span>
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
                        className="app-icon-btn text-amber-600"
                      >
                        <IconStar className="h-4 w-4" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void unlinkDaily(territory.id)}
                        title="Desvincular do dia"
                        aria-label="Desvincular do dia"
                        className="app-icon-btn"
                      >
                        <IconUnlink className="h-4 w-4" />
                      </button>
                    )
                  ) : null}
                  <Link
                    to={`/territories/${territory.id}`}
                    title="Ver cartão"
                    aria-label="Ver cartão"
                    className="app-icon-btn"
                  >
                    <IconEye className="h-4 w-4" />
                  </Link>
                  {can('territory:update') || can('block:manage') ? (
                    <Link
                      to={`/territories/${territory.id}/edit`}
                      title="Editar área"
                      aria-label="Editar área"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-apple-ink text-apple-bg shadow-soft transition hover:opacity-90 active:scale-[0.97]"
                    >
                      <IconPencil className="h-4 w-4" />
                    </Link>
                  ) : null}
                </div>
              </div>
            );
          })}

          {!loading && territories.length === 0 ? (
            <div className="app-empty text-apple-secondary">Nenhum território cadastrado.</div>
          ) : null}

          {!loading && territories.length > 0 && filtered.length === 0 ? (
            <div className="app-empty text-apple-secondary">
              Nenhum território encontrado para “{query.trim()}”.
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
