import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  IconArrowUp,
  IconCheckCircle,
  IconEye,
  IconPencil,
  IconPlus,
  IconSearch,
  IconStar,
  IconUnlink,
} from '@/components/Map/mapIcons';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { confirmToast } from '@/lib/confirm-toast';
import { Spinner } from '@/components/ui/Spinner';
import DailyTerritoryModal from '@/components/territory/DailyTerritoryModal';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { tooltipText } from '@/lib/tooltip';
import type { Territory } from '@/lib/types';

function normalize(text: string) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

type SortDir = 'asc' | 'desc';

export default function TerritoriesPage() {
  const { can, user } = useAuth();
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  /** Ordenação por Terr. N.º — um botão alterna crescente/decrescente */
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  /** Modal: escolher o dirigente ao marcar/trocar o território do dia */
  const [dailyModalTerritoryId, setDailyModalTerritoryId] = useState<number | null>(null);

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

  /** Ordena por Terr. N.º (numérico). asc: 1→N (sem número no fim); desc: N→1 (sem número no fim). */
  function sortByTerritoryNumber(list: Territory[], dir: SortDir) {
    const sign = dir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      const na = String(a.number ?? '').trim();
      const nb = String(b.number ?? '').trim();
      const aEmpty = !na;
      const bEmpty = !nb;
      // Sem número sempre por último, em qualquer direção
      if (aEmpty !== bEmpty) return aEmpty ? 1 : -1;
      const ia = parseInt(na.replace(/\D/g, ''), 10);
      const ib = parseInt(nb.replace(/\D/g, ''), 10);
      const aNum = Number.isFinite(ia) ? ia : Number.POSITIVE_INFINITY;
      const bNum = Number.isFinite(ib) ? ib : Number.POSITIVE_INFINITY;
      if (aNum !== bNum) return (aNum - bNum) * sign;
      const byNumStr = na.localeCompare(nb, 'pt-BR') * sign;
      if (byNumStr !== 0) return byNumStr;
      return (a.name || '').localeCompare(b.name || '', 'pt-BR') * sign;
    });
  }

  const filtered = useMemo(() => {
    const q = normalize(query);
    const base = !q
      ? territories
      : territories.filter((t) => {
          const haystack = normalize(
            [t.name, t.number ?? '', t.cep ?? '', t.is_daily ? 'territorio do dia diario' : '']
              .filter(Boolean)
              .join(' '),
          );
          return haystack.includes(q);
        });
    return sortByTerritoryNumber(base, sortDir);
  }, [territories, query, sortDir]);

  function openDailyModal(territoryId: number) {
    setDailyModalTerritoryId(territoryId);
  }

  function unlinkDaily(id: number) {
    confirmToast({
      title: 'Desvincular território do dia',
      description:
        'Este território deixará de ser o destaque do dia. Você poderá marcar outro quando quiser.',
      confirmLabel: 'Desvincular',
      onConfirm: async () => {
        try {
          await api(`/api/territories/${id}/daily`, { method: 'DELETE' });
          await load();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Erro ao desvincular.');
        }
      },
    });
  }

  function toggleReviewed(territory: Territory) {
    const isReviewed = Boolean(territory.is_reviewed);
    if (isReviewed) {
      confirmToast({
        title: 'Remover revisão?',
        description:
          'Este território deixará de constar como revisado e aprovado. Você poderá marcar de novo quando quiser.',
        confirmLabel: 'Remover',
        tone: 'danger',
        onConfirm: async () => {
          try {
            await api(`/api/territories/${territory.id}/review`, { method: 'DELETE' });
            toast.success('Marcação de revisão removida.');
            await load();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Erro ao remover revisão.');
          }
        },
      });
      return;
    }

    confirmToast({
      title: 'Revisado e aprovado?',
      description:
        'Confirma que este território foi revisado e está aprovado para uso.',
      confirmLabel: 'Aprovar',
      onConfirm: async () => {
        try {
          await api(`/api/territories/${territory.id}/review`, { method: 'POST' });
          toast.success('Território marcado como revisado e aprovado.');
          await load();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Erro ao marcar revisão.');
        }
      },
    });
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8 sm:py-10">
      <div>
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Cartões</p>
            <h1 className="mt-1 text-[1.75rem] font-semibold tracking-tight sm:text-[2rem]">
              Territórios
            </h1>
            <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">
              Localidade, Terr. N.º
              {user?.working_cep ? ` · região ${user.working_cep}` : ''}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
              data-tooltip={tooltipText(
                sortDir === 'asc'
                  ? 'N.º crescente · clique: decrescente'
                  : 'N.º decrescente · clique: crescente',
              )}
              data-tooltip-side="bottom"
              aria-label={
                sortDir === 'asc'
                  ? 'Ordenar Terr. N.º decrescente'
                  : 'Ordenar Terr. N.º crescente'
              }
              aria-pressed={sortDir === 'desc'}
            >
              <IconArrowUp
                className={[
                  'size-4 transition-transform duration-200',
                  sortDir === 'desc' ? 'rotate-180' : '',
                ].join(' ')}
              />
            </Button>
            {can('territory:create') ? (
              <Button
                asChild
                size="icon"
                data-tooltip="Novo território"
                data-tooltip-side="bottom"
                aria-label="Novo território"
              >
                <Link to="/territories/new">
                  <IconPlus />
                </Link>
              </Button>
            ) : null}
          </div>
        </div>

        <div className="mb-6">
          <label htmlFor="territory-search" className="sr-only">
            Buscar território
          </label>
          <div className="relative">
            <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="territory-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por localidade, Terr. N.º…"
              className="pl-9"
              autoComplete="off"
            />
          </div>
          {!loading && territories.length > 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {query.trim()
                ? `${filtered.length} de ${territories.length} território(s)`
                : `${territories.length} território(s)`}
            </p>
          ) : null}
        </div>

        {loading ? <Spinner label="Carregando…" className="text-muted-foreground" /> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="space-y-3">
          {filtered.map((territory) => {
            const hasArea = Boolean(territory.geojson && territory.geojson.length > 10);
            const isReviewed = Boolean(territory.is_reviewed);
            return (
              <Card key={territory.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-4">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Localidade
                    </p>
                    <h2 className="mt-0.5 text-base font-semibold tracking-tight">
                      {territory.name}
                    </h2>
                    {territory.number ? (
                      <p className="text-sm text-muted-foreground">
                        Terr. N.º{' '}
                        <span className="font-medium text-foreground">{territory.number}</span>
                      </p>
                    ) : null}
                    <p
                      className={`mt-1.5 text-xs font-medium ${
                        hasArea
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-amber-700 dark:text-amber-400'
                      }`}
                    >
                      {hasArea ? 'Área definida no mapa' : 'Sem área no mapa'}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {territory.is_daily ? (
                        <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-500/35 dark:text-emerald-300">
                          <span className="size-1.5 rounded-full bg-current opacity-70" aria-hidden />
                          Território do dia
                          {territory.daily_leader_name ? ` · ${territory.daily_leader_name}` : ''}
                        </span>
                      ) : null}
                      {isReviewed ? (
                        <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-sky-500/25 bg-sky-500/10 px-2.5 py-0.5 text-xs font-medium text-sky-700 dark:border-sky-500/35 dark:text-sky-300">
                          <IconCheckCircle className="size-3.5" />
                          Revisado e aprovado
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {can('territory:update') ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => toggleReviewed(territory)}
                        data-tooltip={
                          isReviewed
                            ? 'Remover revisão'
                            : 'Marcar como revisado e aprovado'
                        }
                        aria-label={
                          isReviewed
                            ? 'Remover revisão'
                            : 'Marcar como revisado e aprovado'
                        }
                        aria-pressed={isReviewed}
                        className={
                          isReviewed
                            ? 'text-sky-600 dark:text-sky-400'
                            : 'text-muted-foreground'
                        }
                      >
                        <IconCheckCircle />
                      </Button>
                    ) : null}
                    {can('territory:set_daily') ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => openDailyModal(Number(territory.id))}
                        data-tooltip={
                          territory.is_daily ? 'Trocar dirigente do dia' : 'Marcar do dia'
                        }
                        aria-label={
                          territory.is_daily ? 'Trocar dirigente do dia' : 'Marcar do dia'
                        }
                        className="text-amber-600 dark:text-amber-400"
                      >
                        <IconStar />
                      </Button>
                    ) : null}
                    {can('territory:set_daily') && territory.is_daily ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => void unlinkDaily(territory.id)}
                        data-tooltip="Desvincular do dia"
                        aria-label="Desvincular do dia"
                      >
                        <IconUnlink />
                      </Button>
                    ) : null}
                    <Button
                      asChild
                      variant="outline"
                      size="icon"
                      data-tooltip="Ver cartão"
                      aria-label="Ver cartão"
                    >
                      <Link to={`/territories/${territory.id}`}>
                        <IconEye />
                      </Link>
                    </Button>
                    {can('territory:update') || can('block:manage') ? (
                      <Button
                        asChild
                        size="icon"
                        data-tooltip="Editar área"
                        aria-label="Editar área"
                      >
                        <Link to={`/territories/${territory.id}/edit`}>
                          <IconPencil />
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {!loading && territories.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Nenhum território cadastrado.
              </CardContent>
            </Card>
          ) : null}

          {!loading && territories.length > 0 && filtered.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Nenhum território encontrado para “{query.trim()}”.
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      {dailyModalTerritoryId != null ? (
        <DailyTerritoryModal
          territoryId={dailyModalTerritoryId}
          onClose={() => setDailyModalTerritoryId(null)}
          onDone={() => void load()}
        />
      ) : null}
    </main>
  );
}
