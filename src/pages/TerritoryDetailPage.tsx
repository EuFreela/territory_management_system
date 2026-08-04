import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  IconArrowLeft,
  IconCheck,
  IconCheckCircle,
  IconHome,
  IconPencil,
  IconStar,
  IconTrash,
  IconUnlink,
} from '@/components/Map/mapIcons';
import TerritoryMap, {
  areaMatchesBlock,
  findAreaForBlock,
  parseGeoJsonToAreas,
} from '@/components/Map/TerritoryMap';
import { useConfirm } from '@/components/ui/ConfirmModal';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import type { Block, CepLocation, Territory } from '@/lib/types';

export default function TerritoryDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { can } = useAuth();
  const [territory, setTerritory] = useState<Territory | null>(null);
  const [mapConfig, setMapConfig] = useState<CepLocation | null>(null);
  const [error, setError] = useState('');
  const [togglingKey, setTogglingKey] = useState<string | null>(null);
  /** chave compartilhada mapa ↔ card (nome da quadra / rótulo da área) */
  const [linkedKey, setLinkedKey] = useState<string | null>(null);
  const [mapFocusToken, setMapFocusToken] = useState(0);
  const [linkHint, setLinkHint] = useState('');

  useEffect(() => {
    if (!id) return;
    Promise.all([api<Territory>(`/api/territories/${id}`), api<CepLocation>('/api/config/map')])
      .then(([t, config]) => {
        setTerritory(t);
        setMapConfig(config);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar.'));
  }, [id]);

  async function onDelete() {
    if (!id) return;
    const ok = await confirm({
      title: 'Excluir território',
      message:
        'O cartão, as áreas no mapa e os registros de não em casa serão apagados permanentemente.',
      confirmLabel: 'Excluir',
      cancelLabel: 'Cancelar',
      tone: 'danger',
    });
    if (!ok) return;
    await api(`/api/territories/${id}`, { method: 'DELETE' });
    navigate('/territories', { replace: true });
  }

  async function setDaily() {
    if (!id) return;
    await api(`/api/territories/${id}/daily`, { method: 'POST' });
    const refreshed = await api<Territory>(`/api/territories/${id}`);
    setTerritory(refreshed);
  }

  async function unlinkDaily() {
    if (!id) return;
    const ok = await confirm({
      title: 'Desvincular território do dia',
      message: 'Este território deixará de ser o destaque do dia. Você poderá marcar outro quando quiser.',
      confirmLabel: 'Desvincular',
      cancelLabel: 'Cancelar',
      tone: 'warning',
    });
    if (!ok) return;
    await api(`/api/territories/${id}/daily`, { method: 'DELETE' });
    const refreshed = await api<Territory>(`/api/territories/${id}`);
    setTerritory(refreshed);
  }

  function isHouseDone(block: Block, house: string) {
    return (block.completed_houses ?? []).includes(house);
  }

  function blockProgress(block: Block) {
    const total = block.house_numbers.length;
    const done = (block.completed_houses ?? []).filter((h) => block.house_numbers.includes(h)).length;
    const finished = total > 0 && done >= total;
    return { total, done, finished };
  }

  function isBlockLinked(block: Block) {
    if (!linkedKey) return false;
    return areaMatchesBlock(linkedKey, block.name) || linkedKey === String(block.id);
  }

  /** Clique no polígono do mapa → destaca card (sem rolar a página) */
  function onMapAreaSelect(area: { id: string; label: string }) {
    setLinkedKey(area.label);
    setMapFocusToken((n) => n + 1);
    const blocks = territory?.blocks ?? [];
    const match = blocks.find((b) => areaMatchesBlock(area.label, b.name));
    if (match) {
      setLinkHint('');
    } else {
      setLinkHint(
        `Área “${area.label}” destacada no mapa — nenhum card de não em casa com esse nome.`,
      );
    }
  }

  /** Clique no card → destaca a área no mapa (sem rolar a página) */
  function onBlockCardSelect(block: Block) {
    const name = (block.name ?? '').trim();
    setLinkedKey(name);
    setMapFocusToken((n) => n + 1);

    const areas = parseGeoJsonToAreas(territory?.geojson);
    const mapArea = findAreaForBlock(areas, name);
    if (mapArea) {
      setLinkHint('');
    } else {
      setLinkHint(
        `Nenhuma área no mapa com o nome “${name}”. Confira se a quadra no mapa tem o mesmo rótulo (ex.: ${name}).`,
      );
    }
  }

  async function toggleHouse(block: Block, house: string) {
    if (!id) return;
    if (!can('block:manage')) return;
    const currentlyDone = isHouseDone(block, house);
    const done = !currentlyDone;

    // Desmarcar (voltar ao normal) exige confirmação — marcar como feito é imediato
    if (currentlyDone) {
      const street = block.street_name?.trim();
      const ok = await confirm({
        title: 'Desmarcar casa como pendente?',
        message: street
          ? `A casa nº ${house} (${street}) voltará ao estado normal (ainda não feita). Deseja continuar?`
          : `A casa nº ${house} voltará ao estado normal (ainda não feita). Deseja continuar?`,
        confirmLabel: 'Sim, desmarcar',
        cancelLabel: 'Cancelar',
        tone: 'warning',
      });
      if (!ok) return;
    }

    const key = `${block.id}:${house}`;
    setTogglingKey(key);

    // otimista
    setTerritory((prev) => {
      if (!prev?.blocks) return prev;
      return {
        ...prev,
        blocks: prev.blocks.map((b) => {
          if (b.id !== block.id) return b;
          const current = b.completed_houses ?? [];
          const nextCompleted = done
            ? current.includes(house)
              ? current
              : [...current, house]
            : current.filter((h) => h !== house);
          const doneCount = nextCompleted.filter((h) => b.house_numbers.includes(h)).length;
          return {
            ...b,
            completed_houses: nextCompleted,
            done_count: doneCount,
            total: b.house_numbers.length,
            is_finished: b.house_numbers.length > 0 && doneCount >= b.house_numbers.length,
          };
        }),
      };
    });

    try {
      const updated = await api<Block>(`/api/territories/${id}/blocks/${block.id}/houses`, {
        method: 'PATCH',
        body: JSON.stringify({ house_number: house, done }),
      });
      setTerritory((prev) => {
        if (!prev?.blocks) return prev;
        return {
          ...prev,
          blocks: prev.blocks.map((b) => (b.id === block.id ? { ...b, ...updated } : b)),
        };
      });
    } catch (err) {
      // reverte recarregando
      const refreshed = await api<Territory>(`/api/territories/${id}`);
      setTerritory(refreshed);
      setError(err instanceof Error ? err.message : 'Erro ao atualizar checklist.');
    } finally {
      setTogglingKey(null);
    }
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <p className="text-red-600">{error}</p>
      </main>
    );
  }

  if (!territory) {
    return <main className="flex min-h-screen items-center justify-center text-slate-600">Carregando…</main>;
  }

  const hasArea = Boolean(territory.geojson && territory.geojson.length > 10);

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-center text-xl font-bold tracking-wide text-slate-900 md:text-left">
                Cartão de Mapa de Território
              </p>
              <div className="mt-4 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                <p>
                  <span className="font-medium">Localidade:</span>{' '}
                  <span className="text-lg font-semibold text-slate-900">{territory.name}</span>
                </p>
                <p>
                  <span className="font-medium">Terr. N.º:</span>{' '}
                  <span className="text-lg font-semibold text-slate-900">{territory.number || '—'}</span>
                </p>
              </div>
              {territory.is_daily ? (
                <span className="mt-3 inline-block rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
                  Território do dia
                </span>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              {can('territory:set_daily') ? (
                !territory.is_daily ? (
                  <button
                    type="button"
                    onClick={() => void setDaily()}
                    title="Marcar do dia"
                    aria-label="Marcar do dia"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50"
                  >
                    <IconStar className="h-5 w-5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void unlinkDaily()}
                    title="Desvincular do dia"
                    aria-label="Desvincular do dia"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  >
                    <IconUnlink className="h-5 w-5" />
                  </button>
                )
              ) : null}
              {can('territory:update') || can('block:manage') ? (
                <Link
                  to={`/territories/${id}/edit`}
                  title="Editar área"
                  aria-label="Editar área"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white hover:bg-slate-800"
                >
                  <IconPencil className="h-5 w-5" />
                </Link>
              ) : null}
              {can('territory:delete') ? (
                <button
                  type="button"
                  onClick={() => void onDelete()}
                  title="Excluir território"
                  aria-label="Excluir território"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-red-300 bg-white text-red-700 hover:bg-red-50"
                >
                  <IconTrash className="h-5 w-5" />
                </button>
              ) : null}
              <Link
                to="/territories"
                title="Voltar à lista"
                aria-label="Voltar à lista"
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              >
                <IconArrowLeft className="h-5 w-5" />
              </Link>
              <Link
                to="/dashboard"
                title="Dashboard"
                aria-label="Dashboard"
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-sky-300 bg-white text-sky-700 hover:bg-sky-50"
              >
                <IconHome className="h-5 w-5" />
              </Link>
            </div>
          </div>

          <div id="territorio-mapa" className="mb-2 scroll-mt-6">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Área no mapa
            </h2>
            <p className="mb-2 text-xs text-slate-500">
              Clique em uma área do mapa ou em um card de não em casa para destacar a quadra
              correspondente. A página não rola sozinha — suba ou desça quando quiser. Use o botão
              ✕ no mapa para limpar o destaque.
            </p>
            {linkHint ? (
              <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                {linkHint}
              </p>
            ) : null}
            <TerritoryMap
              value={territory.geojson}
              centerLat={
                territory.map_lat != null
                  ? Number(territory.map_lat)
                  : mapConfig?.lat ?? null
              }
              centerLng={
                territory.map_lng != null
                  ? Number(territory.map_lng)
                  : mapConfig?.lng ?? null
              }
              cepLabel={mapConfig ? `${mapConfig.cep} — ${mapConfig.label}` : null}
              editable={false}
              selectedKey={linkedKey}
              focusToken={mapFocusToken}
              onAreaSelect={onMapAreaSelect}
              onClearSelection={() => {
                setLinkedKey(null);
                setMapFocusToken(0);
                setLinkHint('');
              }}
              finishedKeys={(territory.blocks ?? [])
                .filter((b) => blockProgress(b).finished)
                .map((b) => b.name)}
            />
            {!hasArea ? (
              <p className="mt-2 text-sm text-amber-700">
                Ainda não há polígono salvo.{' '}
                <Link to={`/territories/${id}/edit`} className="font-medium underline">
                  Desenhar área agora
                </Link>
              </p>
            ) : null}
          </div>
        </div>

        <div id="nao-em-casa-cards" className="scroll-mt-6 rounded-2xl border-2 border-amber-200 bg-white p-6 shadow-sm">
          <h2 className="mb-1 text-lg font-bold tracking-wide text-amber-900">NÃO EM CASA</h2>
          <p className="mb-4 text-sm text-slate-600">
            Clique no card da quadra para destacar a área no mapa (cor + balão), sem mover a página. Toque
            nos números para marcar as casas já trabalhadas.
          </p>
          {territory.blocks && territory.blocks.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {territory.blocks.map((block) => {
                const { done, total, finished } = blockProgress(block);
                const linked = isBlockLinked(block);
                // Finalizado + selecionado: mantém visual de concluído e anel de seleção
                const cardTone = linked
                  ? finished
                    ? 'border-sky-500 bg-slate-100 ring-2 ring-sky-400 shadow-md shadow-sky-200/50 opacity-100'
                    : 'border-sky-500 bg-sky-50 ring-2 ring-sky-400 shadow-md shadow-sky-200/60'
                  : finished
                    ? 'border-slate-200 bg-slate-100/80 opacity-70 hover:opacity-100'
                    : 'border-amber-200 bg-amber-50 hover:border-amber-300 hover:shadow-md';
                return (
                  <div
                    key={block.id}
                    id={`block-card-${block.id}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => onBlockCardSelect(block)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onBlockCardSelect(block);
                      }
                    }}
                    className={`cursor-pointer rounded-xl border p-4 shadow-sm transition scroll-mt-6 ${cardTone}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p
                          className={`text-xs font-medium uppercase tracking-wide ${
                            finished ? 'text-slate-500' : linked ? 'text-sky-700' : 'text-amber-800'
                          }`}
                        >
                          Quadra
                          {finished ? ' · finalizada' : ''}
                        </p>
                        <p
                          className={`text-3xl font-bold ${
                            finished
                              ? 'text-slate-500 line-through decoration-slate-400'
                              : 'text-slate-900'
                          }`}
                        >
                          {block.name}
                        </p>
                        {linked ? (
                          <p
                            className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white ${
                              finished ? 'bg-sky-700' : 'bg-sky-600'
                            }`}
                          >
                            <span className="territorio-map-selected-dot inline-block h-1.5 w-1.5 rounded-full bg-sky-200" />
                            Destacada no mapa
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {finished ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">
                            <IconCheckCircle className="h-4 w-4" />
                            Finalizado
                          </span>
                        ) : (
                          <span className="rounded-full bg-white px-2 py-1 text-xs font-medium text-amber-900 ring-1 ring-amber-200">
                            {done}/{total}
                          </span>
                        )}
                        {linked && finished ? (
                          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-800 ring-1 ring-sky-300">
                            Selecionada
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {block.street_name ? (
                      <p
                        className={`mt-1 text-sm font-medium ${
                          finished ? 'text-slate-500' : 'text-slate-800'
                        }`}
                      >
                        {block.street_name}
                      </p>
                    ) : null}

                    <div className="mt-3 flex flex-wrap gap-2">
                      {block.house_numbers.map((item) => {
                        const house = String(item);
                        const doneHouse = isHouseDone(block, house);
                        const busy = togglingKey === `${block.id}:${house}`;
                        return (
                          <button
                            key={house}
                            type="button"
                            disabled={busy || !can('block:manage')}
                            onClick={(e) => {
                              e.stopPropagation();
                              void toggleHouse(block, house);
                            }}
                            title={
                              !can('block:manage')
                                ? 'Sem permissão para alterar checklist'
                                : doneHouse
                                  ? 'Clique para desmarcar (pede confirmação)'
                                  : 'Marcar como feito'
                            }
                            className={`inline-flex min-w-[2.5rem] items-center justify-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold transition disabled:opacity-60 ${
                              doneHouse
                                ? 'bg-emerald-600 text-white line-through decoration-white/70 shadow-sm'
                                : finished
                                  ? 'bg-white text-slate-500 ring-1 ring-slate-200'
                                  : 'bg-white text-slate-800 ring-1 ring-amber-300 hover:bg-amber-100'
                            }`}
                          >
                            {doneHouse ? (
                              <span className="inline-flex items-center gap-0.5">
                                <IconCheck className="h-3.5 w-3.5" />
                                {house}
                              </span>
                            ) : (
                              house
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-slate-600">Nenhum registro de não em casa.</p>
          )}
          {can('block:manage') ? (
            <Link
              to={`/territories/${id}/edit#nao-em-casa`}
              className="mt-4 inline-block text-sm font-medium text-amber-800 underline"
            >
              Gerenciar não em casa
            </Link>
          ) : null}
        </div>
      </div>
    </main>
  );
}
