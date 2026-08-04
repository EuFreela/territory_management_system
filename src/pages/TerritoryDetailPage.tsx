import { useEffect, useMemo, useState } from 'react';
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

  /** Agrupa ruas pela mesma quadra (name) */
  const blocksByQuadra = useMemo(() => {
    const map = new Map<string, Block[]>();
    for (const b of territory?.blocks ?? []) {
      const key = (b.name ?? '').trim() || '—';
      const list = map.get(key) ?? [];
      list.push(b);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [territory?.blocks]);

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
      <main className="app-page">
        <p className="text-[15px] text-apple-red">{error}</p>
      </main>
    );
  }

  if (!territory) {
    return (
      <main className="app-page">
        <p className="text-[15px] text-apple-secondary">Carregando…</p>
      </main>
    );
  }

  const hasArea = Boolean(territory.geojson && territory.geojson.length > 10);

  return (
    <main className="app-page space-y-6">
      <div className="space-y-6">
        <div className="app-card-pad">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-center text-xl font-bold tracking-tightish text-apple-ink md:text-left">
                Cartão de Mapa de Território
              </p>
              <div className="mt-4 grid gap-2 text-sm text-apple-secondary sm:grid-cols-2">
                <p>
                  <span className="font-medium text-apple-secondary">Localidade:</span>{' '}
                  <span className="text-lg font-semibold text-apple-ink">{territory.name}</span>
                </p>
                <p>
                  <span className="font-medium text-apple-secondary">Terr. N.º:</span>{' '}
                  <span className="text-lg font-semibold text-apple-ink">
                    {territory.number || '—'}
                  </span>
                </p>
              </div>
              {territory.is_daily ? (
                <span className="app-badge-green mt-3">Território do dia</span>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              {can('territory:set_daily') ? (
                !territory.is_daily ? (
                  <button
                    type="button"
                    onClick={() => void setDaily()}
                    data-tooltip="Marcar do dia"
                    aria-label="Marcar do dia"
                    className="app-icon-btn text-amber-600"
                  >
                    <IconStar className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void unlinkDaily()}
                    data-tooltip="Desvincular do dia"
                    aria-label="Desvincular do dia"
                    className="app-icon-btn"
                  >
                    <IconUnlink className="h-4 w-4" />
                  </button>
                )
              ) : null}
              {can('territory:update') || can('block:manage') ? (
                <Link
                  to={`/territories/${id}/edit`}
                  data-tooltip="Editar área"
                  aria-label="Editar área"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-apple-ink text-apple-bg shadow-soft transition hover:opacity-90"
                >
                  <IconPencil className="h-4 w-4" />
                </Link>
              ) : null}
              {can('territory:delete') ? (
                <button
                  type="button"
                  onClick={() => void onDelete()}
                  data-tooltip="Excluir território"
                  aria-label="Excluir território"
                  className="app-icon-btn text-apple-red"
                >
                  <IconTrash className="h-4 w-4" />
                </button>
              ) : null}
              <Link
                to="/territories"
                data-tooltip="Voltar à lista"
                aria-label="Voltar à lista"
                className="app-icon-btn"
              >
                <IconArrowLeft className="h-4 w-4" />
              </Link>
              <Link
                to="/dashboard"
                data-tooltip="Início"
                aria-label="Início"
                className="app-icon-btn"
              >
                <IconHome className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div id="territorio-mapa" className="mb-2 scroll-mt-6">
            <h2 className="app-section-title mb-2">Área no mapa</h2>
            <p className="mb-2 text-[13px] leading-relaxed text-apple-secondary">
              Clique em uma área do mapa ou em um card de não em casa para destacar a quadra
              correspondente. A página não rola sozinha — suba ou desça quando quiser. Use o botão
              ✕ no mapa para limpar o destaque.
            </p>
            {linkHint ? (
              <p className="mb-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
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
              finishedKeys={blocksByQuadra
                .filter(([, streets]) => streets.every((b) => blockProgress(b).finished))
                .map(([name]) => name)}
            />
            {!hasArea ? (
              <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
                Ainda não há polígono salvo.{' '}
                <Link to={`/territories/${id}/edit`} className="app-link">
                  Desenhar área agora
                </Link>
              </p>
            ) : null}
          </div>
        </div>

        <section id="nao-em-casa-cards" className="scroll-mt-6">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="app-section-title">Checklist</p>
              <h2 className="mt-1 text-[22px] font-semibold tracking-tightish text-apple-ink">
                Não em casa
              </h2>
              <p className="mt-1 text-[14px] text-apple-secondary">
                Toque no card para destacar no mapa · toque no número para marcar · várias ruas por
                quadra
              </p>
            </div>
            {can('block:manage') ? (
              <Link to={`/territories/${id}/edit#nao-em-casa`} className="app-btn-ghost text-[13px]">
                Gerenciar
              </Link>
            ) : null}
          </div>

          {blocksByQuadra.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {blocksByQuadra.map(([quadraName, streetBlocks]) => {
                const doneSum = streetBlocks.reduce((s, b) => s + blockProgress(b).done, 0);
                const totalSum = streetBlocks.reduce((s, b) => s + blockProgress(b).total, 0);
                const finished = streetBlocks.every((b) => blockProgress(b).finished);
                const linked = streetBlocks.some((b) => isBlockLinked(b));
                const progress = totalSum > 0 ? Math.round((doneSum / totalSum) * 100) : 0;
                const primary = streetBlocks[0];

                return (
                  <div
                    key={quadraName}
                    id={`block-card-${primary?.id ?? quadraName}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => primary && onBlockCardSelect(primary)}
                    onKeyDown={(e) => {
                      if ((e.key === 'Enter' || e.key === ' ') && primary) {
                        e.preventDefault();
                        onBlockCardSelect(primary);
                      }
                    }}
                    className={[
                      'scroll-mt-6 cursor-pointer rounded-[20px] border p-5 transition duration-200 hover:shadow-card',
                      finished
                        ? linked
                          ? 'border-transparent bg-emerald-500/10 shadow-[0_0_0_2px_rgb(52,199,89),0_8px_24px_rgba(52,199,89,0.14)] dark:bg-emerald-500/15'
                          : 'border-apple-green/30 bg-emerald-500/10 shadow-soft dark:bg-emerald-500/12'
                        : linked
                          ? 'border-transparent bg-apple-surface shadow-[0_0_0_2px_rgb(var(--apple-blue)),0_8px_24px_rgba(0,113,227,0.12)]'
                          : 'border-apple-line bg-apple-surface shadow-soft',
                    ].join(' ')}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p
                          className={`text-[11px] font-medium uppercase tracking-[0.08em] ${
                            finished
                              ? 'text-emerald-700 dark:text-emerald-300'
                              : 'text-apple-tertiary'
                          }`}
                        >
                          Quadra{finished ? ' · concluída' : ''} · {streetBlocks.length}{' '}
                          {streetBlocks.length === 1 ? 'rua' : 'ruas'}
                        </p>
                        <p
                          className={`mt-1 text-[26px] font-semibold leading-none tracking-tightish ${
                            finished
                              ? 'text-emerald-950 dark:text-emerald-100'
                              : 'text-apple-ink'
                          }`}
                        >
                          {quadraName}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        {finished ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-apple-green px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm">
                            <IconCheckCircle className="h-3.5 w-3.5" />
                            Finalizado
                          </span>
                        ) : (
                          <span className="rounded-full bg-apple-fill px-2.5 py-1 text-[11px] font-semibold tabular-nums text-apple-secondary">
                            {doneSum}/{totalSum}
                          </span>
                        )}
                        {linked ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-apple-blue/10 px-2.5 py-1 text-[11px] font-semibold text-apple-blue">
                            <span className="h-1.5 w-1.5 rounded-full bg-apple-blue" />
                            No mapa
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {!finished && totalSum > 0 ? (
                      <div className="mt-4 h-[3px] overflow-hidden rounded-full bg-apple-fill">
                        <div
                          className="h-full rounded-full bg-apple-blue transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    ) : null}

                    <div className="mt-4 space-y-4">
                      {streetBlocks.map((block) => {
                        const { finished: streetFinished } = blockProgress(block);
                        return (
                          <div
                            key={block.id}
                            className="border-t border-apple-line pt-3 first:border-t-0 first:pt-0"
                          >
                            <p
                              className={`mb-1 text-[14px] font-semibold ${
                                streetFinished
                                  ? 'text-emerald-800 dark:text-emerald-200'
                                  : 'text-apple-ink'
                              }`}
                            >
                              {block.street_name?.trim() || 'Sem rua'}
                            </p>
                            {block.description?.trim() ? (
                              <p className="mb-2 select-text text-[13px] leading-relaxed text-apple-secondary">
                                {block.description.trim()}
                              </p>
                            ) : null}
                            <div className="flex flex-wrap gap-2">
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
                                    data-tooltip={
                                      !can('block:manage')
                                        ? 'Sem permissão para alterar checklist'
                                        : doneHouse
                                          ? 'Clique para desmarcar (pede confirmação)'
                                          : 'Marcar como feito'
                                    }
                                    className={[
                                      'inline-flex min-w-[2.5rem] items-center justify-center gap-1 rounded-full px-3 py-1.5',
                                      'text-[13px] font-medium tabular-nums transition active:scale-[0.97] disabled:opacity-50',
                                      doneHouse
                                        ? 'bg-apple-green text-white shadow-sm'
                                        : streetFinished
                                          ? 'bg-apple-surface/90 text-emerald-900 ring-1 ring-apple-green/30 dark:text-emerald-100'
                                          : 'bg-apple-fill text-apple-ink hover:bg-apple-line',
                                    ].join(' ')}
                                  >
                                    {doneHouse ? (
                                      <>
                                        <IconCheck className="h-3.5 w-3.5" />
                                        {house}
                                      </>
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
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="app-empty">
              <p className="text-[15px] font-medium text-apple-ink">Nenhum registro ainda</p>
              <p className="mt-1 text-[13px] text-apple-tertiary">
                Adicione quadras e casas na edição do território.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
