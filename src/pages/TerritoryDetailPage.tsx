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
    <main className="app-page space-y-6">
      <div className="space-y-6">
        <div className="app-card-pad">
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
                    className="app-icon-btn text-amber-600"
                  >
                    <IconStar className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void unlinkDaily()}
                    title="Desvincular do dia"
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
                  title="Editar área"
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
                  title="Excluir território"
                  aria-label="Excluir território"
                  className="app-icon-btn text-apple-red"
                >
                  <IconTrash className="h-4 w-4" />
                </button>
              ) : null}
              <Link
                to="/territories"
                title="Voltar à lista"
                aria-label="Voltar à lista"
                className="app-icon-btn"
              >
                <IconArrowLeft className="h-4 w-4" />
              </Link>
              <Link
                to="/dashboard"
                title="Início"
                aria-label="Início"
                className="app-icon-btn"
              >
                <IconHome className="h-4 w-4" />
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

        <section id="nao-em-casa-cards" className="scroll-mt-6">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="app-section-title">Checklist</p>
              <h2 className="mt-1 text-[22px] font-semibold tracking-tightish text-apple-ink">
                Não em casa
              </h2>
              <p className="mt-1 text-[14px] text-apple-secondary">
                Toque no card para destacar no mapa · toque no número para marcar
              </p>
            </div>
            {can('block:manage') ? (
              <Link to={`/territories/${id}/edit#nao-em-casa`} className="app-btn-ghost text-[13px]">
                Gerenciar
              </Link>
            ) : null}
          </div>

          {territory.blocks && territory.blocks.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {territory.blocks.map((block) => {
                const { done, total, finished } = blockProgress(block);
                const linked = isBlockLinked(block);
                const progress = total > 0 ? Math.round((done / total) * 100) : 0;

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
                    className={[
                      'scroll-mt-6 cursor-pointer rounded-[20px] border p-5 transition duration-200',
                      'hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)]',
                      // Finalizado: lavagem verde Apple (System Green) — legível e elegante
                      finished
                        ? linked
                          ? 'border-transparent bg-[#f0fdf4] shadow-[0_0_0_2px_#34c759,0_8px_24px_rgba(52,199,89,0.14)]'
                          : 'border-[#34c759]/25 bg-[#f0fdf4] shadow-[0_1px_2px_rgba(52,199,89,0.06)]'
                        : linked
                          ? 'border-transparent bg-white shadow-[0_0_0_2px_#0071e3,0_8px_24px_rgba(0,113,227,0.12)]'
                          : 'border-black/[0.06] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]',
                    ].join(' ')}
                  >
                    {/* faixa superior sutil quando finalizado */}
                    {finished ? (
                      <div className="mb-3 h-[3px] w-full overflow-hidden rounded-full bg-[#34c759]/15">
                        <div className="h-full w-full rounded-full bg-[#34c759]" />
                      </div>
                    ) : null}

                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p
                          className={`text-[11px] font-medium uppercase tracking-[0.08em] ${
                            finished ? 'text-[#248a3d]' : 'text-[#86868b]'
                          }`}
                        >
                          Quadra{finished ? ' · concluída' : ''}
                        </p>
                        <p
                          className={`mt-1 text-[26px] font-semibold leading-none tracking-[-0.03em] ${
                            finished ? 'text-[#1b4332]' : 'text-[#1d1d1f]'
                          }`}
                        >
                          {block.name}
                        </p>
                        {block.street_name ? (
                          <p
                            className={`mt-2 truncate text-[14px] font-normal ${
                              finished ? 'text-[#2d6a4f]' : 'text-[#6e6e73]'
                            }`}
                          >
                            {block.street_name}
                          </p>
                        ) : null}
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        {finished ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#34c759] px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm">
                            <IconCheckCircle className="h-3.5 w-3.5" />
                            Finalizado
                          </span>
                        ) : (
                          <span className="rounded-full bg-[#f5f5f7] px-2.5 py-1 text-[11px] font-semibold tabular-nums text-[#6e6e73]">
                            {done}/{total}
                          </span>
                        )}
                        {linked ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#0071e3]/[0.1] px-2.5 py-1 text-[11px] font-semibold text-[#0071e3]">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#0071e3]" />
                            No mapa
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {!finished && total > 0 ? (
                      <div className="mt-4 h-[3px] overflow-hidden rounded-full bg-[#f5f5f7]">
                        <div
                          className="h-full rounded-full bg-[#0071e3] transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    ) : null}

                    <div className="mt-4 flex flex-wrap gap-2">
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
                            className={[
                              'inline-flex min-w-[2.5rem] items-center justify-center gap-1 rounded-full px-3 py-1.5',
                              'text-[13px] font-medium tabular-nums transition active:scale-[0.97] disabled:opacity-50',
                              doneHouse
                                ? 'bg-[#34c759] text-white shadow-sm'
                                : finished
                                  ? 'bg-white/80 text-[#1b4332] ring-1 ring-[#34c759]/25'
                                  : 'bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e8e8ed]',
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
          ) : (
            <div className="rounded-[20px] border border-dashed border-black/[0.08] bg-white px-6 py-12 text-center">
              <p className="text-[15px] font-medium text-[#1d1d1f]">Nenhum registro ainda</p>
              <p className="mt-1 text-[13px] text-[#86868b]">
                Adicione quadras e casas na edição do território.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
