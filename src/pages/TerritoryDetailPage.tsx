import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  IconArrowLeft,
  IconCheck,
  IconCheckCircle,
  IconColumns,
  IconHome,
  IconImage,
  IconMap,
  IconPencil,
  IconRows,
  IconStar,
  IconTrash,
  IconUnlink,
  IconX,
} from '@/components/Map/mapIcons';
import TerritoryImageLeafletMap from '@/components/Map/TerritoryImageLeafletMap';
import TerritoryMap, {
  areaMatchesBlock,
  findAreaForBlock,
  parseGeoJsonToAreas,
  parseGeoJsonToNotes,
  resolveAreaByKey,
} from '@/components/Map/TerritoryMap';
import { toast } from 'sonner';
import { confirmToast } from '@/lib/confirm-toast';
import { LoadingBox } from '@/components/ui/Spinner';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { hasTerritoryStaticMapCandidate } from '@/lib/territory-map-image';
import { tooltipText } from '@/lib/tooltip';
import type { Block, CepLocation, Territory } from '@/lib/types';

type MapViewTab = 'mapa' | 'imagem' | 'mapa-imagem';

export default function TerritoryDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const [territory, setTerritory] = useState<Territory | null>(null);
  const [mapConfig, setMapConfig] = useState<CepLocation | null>(null);
  const [error, setError] = useState('');
  const [togglingKey, setTogglingKey] = useState<string | null>(null);
  /** chave compartilhada mapa ↔ card (nome da quadra / rótulo da área) */
  const [linkedKey, setLinkedKey] = useState<string | null>(null);
  const [mapFocusToken, setMapFocusToken] = useState(0);
  const [linkHint, setLinkHint] = useState('');
  /** Aba: mapa interativo (Leaflet) ou imagem estática do cartão */
  const [mapViewTab, setMapViewTab] = useState<MapViewTab>('mapa');
  /** Modal de comparação Mapa & Imagem aberta? */
  const [splitOpen, setSplitOpen] = useState(false);
  /** Orientação dos quadros: horizontal = lado a lado; vertical = um sobre o outro */
  const [splitOrientation, setSplitOrientation] = useState<'horizontal' | 'vertical'>(
    'horizontal',
  );
  /** Incrementa ao girar a orientação p/ invalidateSize nos dois Leaflet */
  const [splitResizeToken, setSplitResizeToken] = useState(0);
  /** Mantém painéis montados; só redimensiona o Leaflet ao trocar (sem novo load do Google) */
  const [mapResizeToken, setMapResizeToken] = useState(0);
  const [imageResizeToken, setImageResizeToken] = useState(0);
  /** Imagem só monta na 1ª visita à aba — depois permanece no DOM */
  const [imagePanelReady, setImagePanelReady] = useState(false);

  const splitAreas = useMemo(() => parseGeoJsonToAreas(territory?.geojson), [territory?.geojson]);
  const splitNotes = useMemo(() => parseGeoJsonToNotes(territory?.geojson), [territory?.geojson]);
  const splitAreaCount =
    splitAreas.length > 0
      ? `${splitAreas.length} área(s) no território${splitNotes.length ? ` · ${splitNotes.length} nota(s) de atenção` : ''}.`
      : 'Sem áreas definidas.';

  function selectMapView(tab: MapViewTab) {
    setMapViewTab(tab);
    if (tab === 'mapa') {
      setMapResizeToken((n) => n + 1);
    } else if (tab === 'imagem') {
      setImagePanelReady(true);
      setImageResizeToken((n) => n + 1);
    } else {
      setImagePanelReady(true);
      setSplitOpen(true);
      setSplitResizeToken((n) => n + 1);
    }
  }

  /** Fecha a modal e volta para a aba anterior (Mapa) */
  function closeSplit() {
    setSplitOpen(false);
    setMapViewTab('mapa');
    setMapResizeToken((n) => n + 1);
  }

  /** Alterna a orientação dos quadros: horizontal ↔ vertical */
  function rotateSplit() {
    setSplitOrientation((prev) => (prev === 'horizontal' ? 'vertical' : 'horizontal'));
    setSplitResizeToken((n) => n + 1);
  }

  // Esc fecha a modal de comparação e trava o scroll do body
  useEffect(() => {
    if (!splitOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      closeSplit();
    };

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [splitOpen]);

  useEffect(() => {
    if (!id) return;
    Promise.all([api<Territory>(`/api/territories/${id}`), api<CepLocation>('/api/config/map')])
      .then(([t, config]) => {
        setTerritory(t);
        setMapConfig(config);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar.'));
  }, [id]);

  function onDelete() {
    if (!id) return;
    confirmToast({
      title: 'Excluir território',
      description:
        'O cartão, as áreas no mapa e os registros de não em casa serão apagados permanentemente.',
      confirmLabel: 'Excluir',
      tone: 'danger',
      onConfirm: async () => {
        try {
          await api(`/api/territories/${id}`, { method: 'DELETE' });
          navigate('/territories', { replace: true });
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Erro ao excluir território.');
        }
      },
    });
  }

  async function setDaily() {
    if (!id) return;
    try {
      await api(`/api/territories/${id}/daily`, { method: 'POST' });
      const refreshed = await api<Territory>(`/api/territories/${id}`);
      setTerritory(refreshed);
      toast.success('Território vinculado ao dia.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao vincular.');
    }
  }

  function unlinkDaily() {
    if (!id) return;
    confirmToast({
      title: 'Desvincular território do dia',
      description:
        'Este território deixará de ser o destaque do dia. Você poderá marcar outro quando quiser.',
      confirmLabel: 'Desvincular',
      onConfirm: async () => {
        try {
          await api(`/api/territories/${id}/daily`, { method: 'DELETE' });
          const refreshed = await api<Territory>(`/api/territories/${id}`);
          setTerritory(refreshed);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Erro ao desvincular.');
        }
      },
    });
  }

  /** Igualdade estrita de número de casa (nunca substring: "1" ≠ "11") */
  function houseEquals(a: string, b: string) {
    return String(a).trim() === String(b).trim();
  }

  function isHouseDone(block: Block, house: string) {
    return (block.completed_houses ?? []).some((h) => houseEquals(h, house));
  }

  function blockProgress(block: Block) {
    const houses = new Set((block.house_numbers ?? []).map((n) => String(n).trim()));
    const completed = new Set((block.completed_houses ?? []).map((n) => String(n).trim()));
    const total = houses.size;
    const done = [...completed].filter((h) => houses.has(h)).length;
    const finished = total > 0 && done >= total;
    return { total, done, finished };
  }

  function isBlockLinked(block: Block) {
    if (!linkedKey) return false;
    if (linkedKey === String(block.id)) return true;
    if (areaMatchesBlock(linkedKey, block.name) || linkedKey === (block.name ?? '').trim()) {
      return true;
    }
    // linkedKey pode ser o id estável da área no mapa
    const area = resolveAreaByKey(parseGeoJsonToAreas(territory?.geojson), linkedKey);
    return area
      ? areaMatchesBlock(area.label, block.name) || area.label === (block.name ?? '').trim()
      : false;
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

  /** Clique no polígono do mapa → destaca por **id** da área (nomes iguais não colidem) */
  function onMapAreaSelect(area: { id: string; label: string }) {
    setLinkedKey(area.id);
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
      confirmToast({
        title: 'Desmarcar casa como pendente?',
        description: street
          ? `A casa nº ${house} (${street}) voltará ao estado normal (ainda não feita). Deseja continuar?`
          : `A casa nº ${house} voltará ao estado normal (ainda não feita). Deseja continuar?`,
        confirmLabel: 'Sim, desmarcar',
        onConfirm: () => applyToggleHouse(block, house, done),
      });
      return;
    }

    await applyToggleHouse(block, house, done);
  }

  async function applyToggleHouse(block: Block, house: string, done: boolean) {
    if (!id) return;
    const key = `${block.id}:${house}`;
    setTogglingKey(key);

    // otimista
    setTerritory((prev) => {
      if (!prev?.blocks) return prev;
      return {
        ...prev,
        blocks: prev.blocks.map((b) => {
          // Sempre por id da rua/quadra no banco — nunca por nome parcial
          if (b.id !== block.id) return b;
          const current = b.completed_houses ?? [];
          const nextCompleted = done
            ? current.some((h) => houseEquals(h, house))
              ? current
              : [...current, house]
            : current.filter((h) => !houseEquals(h, house));
          const doneCount = nextCompleted.filter((h) =>
            b.house_numbers.some((n) => houseEquals(h, n)),
          ).length;
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
        <LoadingBox label="Carregando…" className="min-h-[16rem]" />
      </main>
    );
  }

  const hasArea = Boolean(territory.geojson && territory.geojson.length > 10);

  return (
    <>
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

            {/* Abas: mapa interativo × imagem do cartão */}
            <div
              className="mb-3 inline-flex w-full rounded-full border border-apple-line bg-apple-fill p-1 sm:w-auto"
              role="tablist"
              aria-label="Visualização do mapa"
            >
              <button
                type="button"
                role="tab"
                id="tab-mapa-interativo"
                aria-selected={mapViewTab === 'mapa'}
                onClick={() => selectMapView('mapa')}
                className={[
                  'inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold transition sm:flex-none sm:px-5',
                  mapViewTab === 'mapa'
                    ? 'bg-apple-surface text-apple-ink shadow-soft'
                    : 'text-apple-secondary hover:text-apple-ink',
                ].join(' ')}
              >
                <IconMap className="h-3.5 w-3.5 shrink-0" />
                Mapa
              </button>
              <button
                type="button"
                role="tab"
                id="tab-mapa-imagem"
                aria-selected={mapViewTab === 'imagem'}
                onClick={() => selectMapView('imagem')}
                className={[
                  'inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold transition sm:flex-none sm:px-5',
                  mapViewTab === 'imagem'
                    ? 'bg-apple-surface text-apple-ink shadow-soft'
                    : 'text-apple-secondary hover:text-apple-ink',
                ].join(' ')}
              >
                <IconImage className="h-3.5 w-3.5 shrink-0" />
                Imagem
              </button>
              <button
                type="button"
                role="tab"
                id="tab-mapa-imagem-juntas"
                aria-selected={mapViewTab === 'mapa-imagem'}
                onClick={() => selectMapView('mapa-imagem')}
                className={[
                  'inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold transition sm:flex-none sm:px-5',
                  mapViewTab === 'mapa-imagem'
                    ? 'bg-apple-surface text-apple-ink shadow-soft'
                    : 'text-apple-secondary hover:text-apple-ink',
                ].join(' ')}
              >
                <span className="flex shrink-0 items-center">
                  <IconMap className="h-3.5 w-3.5" />
                  <IconImage className="-ml-1 h-3.5 w-3.5" />
                </span>
              </button>
            </div>

            {/* Painéis sempre no DOM após montar — evita reload do Google Maps a cada troca de aba */}
            <div
              role="tabpanel"
              aria-labelledby="tab-mapa-interativo"
              hidden={mapViewTab !== 'mapa'}
              className={mapViewTab === 'mapa' ? 'mb-4' : 'hidden'}
            >
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
                  territory.map_lat != null ? Number(territory.map_lat) : mapConfig?.lat ?? null
                }
                centerLng={
                  territory.map_lng != null ? Number(territory.map_lng) : mapConfig?.lng ?? null
                }
                cepLabel={mapConfig ? `${mapConfig.cep} — ${mapConfig.label}` : null}
                editable={false}
                selectedKey={linkedKey}
                focusToken={mapFocusToken}
                resizeToken={mapResizeToken}
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

            {imagePanelReady || mapViewTab === 'imagem' || mapViewTab === 'mapa-imagem' ? (
              <div
                role="tabpanel"
                aria-labelledby="tab-mapa-imagem"
                hidden={mapViewTab !== 'imagem'}
                className={mapViewTab === 'imagem' ? '' : 'hidden'}
              >
                {hasTerritoryStaticMapCandidate(territory) ? (
                  <TerritoryImageLeafletMap
                    territory={territory}
                    resizeToken={imageResizeToken}
                  />
                ) : (
                  <div className="rounded-2xl border border-dashed border-apple-line bg-apple-fill px-4 py-10 text-center text-[14px] text-apple-secondary">
                    Defina o <strong className="text-apple-ink">Terr. N.º</strong> do cartão para
                    associar a imagem (ex.: N.º 28 →{' '}
                    <code className="text-[12px]">t28.webp</code> ou{' '}
                    <code className="text-[12px]">t28.jpg</code>).
                  </div>
                )}
              </div>
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
                                    key={`${block.id}:${house}`}
                                    type="button"
                                    disabled={busy || !can('block:manage')}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void toggleHouse(block, house);
                                    }}
                                    data-tooltip={tooltipText(
                                      !can('block:manage')
                                        ? 'Sem permissão para alterar'
                                        : doneHouse
                                          ? 'Desmarcar (pede confirmação)'
                                          : 'Marcar como feito',
                                    )}
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

    {/* Modal de comparação Mapa & Imagem — tela cheia, dois quadros */}    {splitOpen ? (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Mapa e Imagem lado a lado"
        className="fixed inset-0 z-[9000] flex flex-col bg-slate-100 dark:bg-black"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-apple-line bg-apple-surface px-3 py-2 shadow-sm sm:px-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-apple-ink">
            <span className="flex items-center">
              <IconMap className="h-4 w-4" />
              <IconImage className="-ml-1 h-4 w-4" />
            </span>
            Mapa &amp; Imagem
          </p>
          <div className="flex items-center gap-2">
            <span className="max-w-[240px] truncate text-[12px] font-medium text-apple-secondary">
              {splitAreaCount}
            </span>
            <button
              type="button"
              onClick={rotateSplit}
              data-tooltip={
                splitOrientation === 'horizontal'
                  ? 'Empilhar na vertical'
                  : 'Colocar lado a lado (horizontal)'
              }
              data-tooltip-side="bottom"
              aria-label="Girar orientação"
              aria-pressed={splitOrientation === 'vertical'}
              className="app-icon-btn"
            >
              {splitOrientation === 'horizontal' ? (
                <IconRows className="h-5 w-5" />
              ) : (
                <IconColumns className="h-5 w-5" />
              )}
            </button>
            <button
              type="button"
              onClick={closeSplit}
              data-tooltip="Fechar (Esc)"
              data-tooltip-side="bottom"
              data-tooltip-align="end"
              aria-label="Fechar"
              className="app-icon-btn"
            >
              <IconX className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div
          className={`flex min-h-0 flex-1 gap-2 p-2 sm:gap-3 sm:p-3 ${
            splitOrientation === 'horizontal' ? 'flex-col sm:flex-row' : 'flex-col'
          }`}
        >
          {/* Quadro: mapa principal */}
          <div className="min-h-0 flex-1 overflow-hidden">
            <TerritoryMap
              value={territory.geojson}
              centerLat={
                territory.map_lat != null ? Number(territory.map_lat) : mapConfig?.lat ?? null
              }
              centerLng={
                territory.map_lng != null ? Number(territory.map_lng) : mapConfig?.lng ?? null
              }
              cepLabel={mapConfig ? `${mapConfig.cep} — ${mapConfig.label}` : null}
              editable={false}
              hideSearch
              hideAreaCount
              fillHeight
              resizeToken={splitResizeToken}
              finishedKeys={blocksByQuadra
                .filter(([, streets]) => streets.every((b) => blockProgress(b).finished))
                .map(([name]) => name)}
            />
          </div>

          {/* Quadro: imagem do cartão */}
          <div className="min-h-0 flex-1 overflow-hidden">
            {hasTerritoryStaticMapCandidate(territory) ? (
              <TerritoryImageLeafletMap
                territory={territory}
                resizeToken={splitResizeToken}
                fillHeight
              />
            ) : (
              <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-apple-line bg-apple-fill px-4 text-center text-[14px] text-apple-secondary">
                Defina o <strong className="text-apple-ink">Terr. N.º</strong> do cartão para
                associar a imagem (ex.: N.º 28 →{' '}
                <code className="mx-1 text-[12px]">t28.webp</code>).
              </div>
            )}
          </div>
        </div>
      </div>
    ) : null}
    </>
  );
}
