import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { IconArrowLeft, IconPlus, IconSave, IconTrash, IconX } from '@/components/Map/mapIcons';
import TerritoryMap, {
  areaMatchesBlock,
  hasValidMapArea,
  parseGeoJsonToAreas,
} from '@/components/Map/TerritoryMap';
import { useConfirm } from '@/components/ui/ConfirmModal';
import SaveButton, { SaveActionBar } from '@/components/ui/SaveButton';
import { api } from '@/lib/api';
import type { Block, CepLocation, Territory } from '@/lib/types';

export default function EditTerritoryPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [localidade, setLocalidade] = useState('');
  const [number, setNumber] = useState('');
  const [mapConfig, setMapConfig] = useState<CepLocation | null>(null);
  const [geojson, setGeojson] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [blockName, setBlockName] = useState('');
  const [streetName, setStreetName] = useState('');
  const [houseNumbers, setHouseNumbers] = useState('');
  /** null = novo registro; number = editando esse block */
  const [editingBlockId, setEditingBlockId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [blockError, setBlockError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addingBlock, setAddingBlock] = useState(false);
  /** Destaque mapa ↔ card de não em casa */
  const [mapSelectedKey, setMapSelectedKey] = useState<string | null>(null);
  const [mapFocusToken, setMapFocusToken] = useState(0);
  /** IDs selecionados para exclusão em massa */
  const [bulkSelectedIds, setBulkSelectedIds] = useState<number[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);

  useEffect(() => {
    if (!id) return;

    Promise.all([api<Territory>(`/api/territories/${id}`), api<CepLocation>('/api/config/map')])
      .then(([territory, config]) => {
        setLocalidade(territory.name ?? '');
        setNumber(territory.number ?? '');
        setGeojson(territory.geojson ?? null);
        setBlocks(territory.blocks ?? []);
        setMapConfig(config);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar.'))
      .finally(() => setLoading(false));
  }, [id]);

  // Abre direto na seção NÃO EM CASA quando vem de "Gerenciar não em casa" (#nao-em-casa)
  useEffect(() => {
    if (loading) return;
    if (typeof window === 'undefined') return;
    if (window.location.hash !== '#nao-em-casa') return;

    const scrollToSection = () => {
      const el = document.getElementById('nao-em-casa');
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const firstField = el.querySelector<HTMLElement>('select, input');
      firstField?.focus({ preventScroll: true });
    };

    // espera o mapa/layout renderizar para não “voltar” para o topo
    const t1 = window.setTimeout(scrollToSection, 80);
    const t2 = window.setTimeout(scrollToSection, 350);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [loading, id]);

  /** Nomes das áreas desenhadas no mapa (fonte do select de quadra) */
  const mapQuadraOptions = useMemo(() => {
    const areas = parseGeoJsonToAreas(geojson);
    const labels = areas
      .map((a) => a.label.trim())
      .filter(Boolean);
    // únicos, mantendo ordem
    return [...new Set(labels)];
  }, [geojson]);

  /** No cadastro novo: só quadras ainda sem registro de não em casa */
  const selectableQuadraOptions = useMemo(() => {
    if (editingBlockId != null) {
      // em edição: todas as do mapa + a atual (se não estiver no mapa por legado)
      const current = blockName.trim();
      const set = new Set(mapQuadraOptions);
      if (current) set.add(current);
      return [...set];
    }
    const used = new Set(blocks.map((b) => b.name.trim().toLowerCase()));
    return mapQuadraOptions.filter((label) => !used.has(label.toLowerCase()));
  }, [mapQuadraOptions, blocks, editingBlockId, blockName]);

  async function saveTerritory(event: FormEvent) {
    event.preventDefault();
    if (!id) return;

    if (!geojson || !hasValidMapArea(geojson)) {
      setError('Desenhe ao menos uma área no mapa (lápis → pontos → ✓) antes de salvar.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      await api(`/api/territories/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: localidade,
          number: number || null,
          geojson,
        }),
      });
      navigate(`/territories/${id}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar.');
      setSaving(false);
    }
  }

  function clearBlockForm() {
    setEditingBlockId(null);
    setBlockName('');
    setStreetName('');
    setHouseNumbers('');
    setBlockError('');
    setMapSelectedKey(null);
  }

  function loadBlockForEdit(block: Block) {
    const name = (block.name ?? '').trim();
    setEditingBlockId(block.id);
    setBlockName(name);
    setStreetName(block.street_name ?? '');
    setHouseNumbers((block.house_numbers ?? []).join(', '));
    setBlockError('');
    // Destaca a quadra no mapa (sem rolar a página)
    setMapSelectedKey(name || null);
    setMapFocusToken((n) => n + 1);
  }

  /** Clique na área do mapa → destaca / prepara formulário (sem rolar para não em casa) */
  function onMapAreaSelect(area: { id: string; label: string }) {
    setMapSelectedKey(area.label);
    setMapFocusToken((n) => n + 1);
    // se já existe card com esse nome, carrega para edição (usuário permanece no mapa)
    const match = blocks.find(
      (b) => b.name.trim().toLowerCase() === area.label.trim().toLowerCase(),
    );
    if (match) {
      setEditingBlockId(match.id);
      setBlockName(match.name ?? '');
      setStreetName(match.street_name ?? '');
      setHouseNumbers((match.house_numbers ?? []).join(', '));
      setBlockError('');
    } else {
      // pré-preenche a quadra no formulário novo
      setEditingBlockId(null);
      setBlockName(area.label);
    }
  }

  async function saveBlock(event: FormEvent) {
    event.preventDefault();
    if (!id) return;

    const numbers = houseNumbers
      .split(/[,\s;]+/)
      .map((v) => v.trim())
      .filter(Boolean);

    if (!blockName.trim()) {
      setBlockError('Selecione a quadra desenhada no mapa.');
      return;
    }
    if (mapQuadraOptions.length === 0) {
      setBlockError('Desenhe e salve as áreas no mapa antes de cadastrar não em casa.');
      return;
    }
    if (!streetName.trim() || numbers.length === 0) {
      setBlockError('Preencha o nome da rua e ao menos uma casa.');
      return;
    }

    setAddingBlock(true);
    setBlockError('');

    const payload = {
      name: blockName.trim(),
      street_name: streetName.trim(),
      house_numbers: numbers,
    };

    try {
      if (editingBlockId != null) {
        await api(`/api/territories/${id}/blocks/${editingBlockId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await api(`/api/territories/${id}/blocks`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      const refreshed = await api<Territory>(`/api/territories/${id}`);
      setBlocks(refreshed.blocks ?? []);
      clearBlockForm();
    } catch (err) {
      setBlockError(
        err instanceof Error
          ? err.message
          : editingBlockId != null
            ? 'Erro ao atualizar não em casa.'
            : 'Erro ao adicionar não em casa.',
      );
    } finally {
      setAddingBlock(false);
    }
  }

  async function removeBlock(blockId: number) {
    if (!id) return;
    const ok = await confirm({
      title: 'Remover não em casa',
      message: 'Este registro de casas sem resposta será apagado. Essa ação não pode ser desfeita.',
      confirmLabel: 'Remover',
      cancelLabel: 'Cancelar',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await api(`/api/territories/${id}/blocks/${blockId}`, { method: 'DELETE' });
      setBlocks((prev) => prev.filter((b) => b.id !== blockId));
      setBulkSelectedIds((prev) => prev.filter((x) => x !== blockId));
      if (editingBlockId === blockId) clearBlockForm();
    } catch (err) {
      setBlockError(err instanceof Error ? err.message : 'Erro ao remover.');
    }
  }

  function toggleBulkSelect(blockId: number) {
    setBulkSelectedIds((prev) =>
      prev.includes(blockId) ? prev.filter((x) => x !== blockId) : [...prev, blockId],
    );
  }

  function toggleSelectAllBlocks() {
    if (bulkSelectedIds.length === blocks.length) {
      setBulkSelectedIds([]);
    } else {
      setBulkSelectedIds(blocks.map((b) => b.id));
    }
  }

  async function bulkDeleteSelected() {
    if (!id || bulkSelectedIds.length === 0) return;
    const count = bulkSelectedIds.length;
    const ok = await confirm({
      title: 'Apagar quadras selecionadas',
      message: `${count} ${count === 1 ? 'quadra será apagada' : 'quadras serão apagadas'} do não em casa (rua e números). Essa ação não pode ser desfeita.`,
      confirmLabel: count === 1 ? 'Apagar 1 quadra' : `Apagar ${count} quadras`,
      cancelLabel: 'Cancelar',
      tone: 'danger',
    });
    if (!ok) return;

    setBulkBusy(true);
    setBlockError('');
    try {
      await api(`/api/territories/${id}/blocks/bulk-delete`, {
        method: 'POST',
        body: JSON.stringify({ ids: bulkSelectedIds }),
      });
      const removed = new Set(bulkSelectedIds);
      setBlocks((prev) => prev.filter((b) => !removed.has(b.id)));
      if (editingBlockId != null && removed.has(editingBlockId)) clearBlockForm();
      setBulkSelectedIds([]);
    } catch (err) {
      setBlockError(err instanceof Error ? err.message : 'Erro ao apagar em massa.');
    } finally {
      setBulkBusy(false);
    }
  }


  if (loading) {
    return <main className="flex min-h-screen items-center justify-center text-slate-600">Carregando…</main>;
  }

  return (
    <main className="app-page space-y-6">
      <div className="space-y-6">
        {/* 1. Localidade + mapa */}
        <div className="app-card-pad">
          <Link
            to={`/territories/${id}`}
            title="Voltar"
            aria-label="Voltar"
            className="app-icon-btn"
          >
            <IconArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="app-title mt-4">Editar território</h1>
          <p className="app-subtitle">
            Ajuste localidade e áreas no mapa. Em seguida gerencie o <strong>não em casa</strong>.
          </p>

          <form id="territory-form" onSubmit={saveTerritory} className="mt-6 space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Localidade</label>
                <input
                  value={localidade}
                  onChange={(event) => setLocalidade(event.target.value)}
                  placeholder="Ex: Mundo Novo"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Terr. N.º</label>
                <input
                  value={number}
                  onChange={(event) => setNumber(event.target.value)}
                  placeholder="Ex: 31"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
            </div>

            {mapConfig ? (
              <div className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-slate-700">
                <span className="font-medium">CEP base:</span> {mapConfig.cep} — {mapConfig.label}
              </div>
            ) : null}

            <div id="territorio-mapa-edit" className="scroll-mt-6">
              <label className="mb-2 block text-sm font-medium text-slate-700">Área do território no mapa</label>
              <p className="mb-2 text-xs text-slate-500">
                Clique no card de não em casa ou na área do mapa para destacar a quadra (sem rolar a
                página).
              </p>
              <TerritoryMap
                value={geojson}
                onChange={setGeojson}
                centerLat={mapConfig?.lat ?? null}
                centerLng={mapConfig?.lng ?? null}
                cepLabel={mapConfig ? `${mapConfig.cep} — ${mapConfig.label}` : null}
                editable
                selectedKey={mapSelectedKey}
                focusToken={mapFocusToken}
                onAreaSelect={onMapAreaSelect}
                onClearSelection={() => {
                  setMapSelectedKey(null);
                  setMapFocusToken(0);
                }}
                finishedKeys={blocks
                  .filter((b) => {
                    const total = b.house_numbers.length;
                    const done = (b.completed_houses ?? []).filter((h) =>
                      b.house_numbers.includes(h),
                    ).length;
                    return total > 0 && done >= total;
                  })
                  .map((b) => b.name)}
              />
            </div>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}
          </form>
        </div>

        {/* 2. Não em casa */}
        <section id="nao-em-casa" className="app-card-pad scroll-mt-6">
          <div className="mb-5">
            <p className="app-section-title">Checklist</p>
            <h2 className="mt-1 text-[22px] font-semibold tracking-tightish text-apple-ink">
              Não em casa
            </h2>
            <p className="mt-1 text-[14px] text-apple-secondary">
              Quadra igual ao mapa · informe rua e números · toque no card para editar
            </p>
          </div>

          {mapQuadraOptions.length === 0 ? (
            <div className="mb-5 rounded-apple border border-dashed border-apple-line bg-apple-fill px-4 py-3 text-[13px] text-apple-secondary">
              Nenhuma área no mapa ainda. Desenhe as quadras acima, salve, e depois cadastre aqui.
            </div>
          ) : null}

          <form
            id="nao-em-casa-form"
            onSubmit={saveBlock}
            className={`mb-6 space-y-4 rounded-apple-lg border p-4 sm:p-5 ${
              editingBlockId != null
                ? 'border-apple-blue/25 bg-apple-blue/[0.04]'
                : 'border-apple-line bg-apple-fill'
            }`}
          >
            {editingBlockId != null ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[14px] font-semibold text-apple-blue">
                  Editando · {blockName || editingBlockId}
                </p>
                <button type="button" onClick={clearBlockForm} className="app-btn-secondary h-8 px-3 text-[12px]">
                  <IconX className="h-3.5 w-3.5" />
                  Nova entrada
                </button>
              </div>
            ) : null}

            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label htmlFor="block-quadra-select" className="app-label">
                  Quadra (mapa)
                </label>
                <select
                  id="block-quadra-select"
                  value={blockName}
                  onChange={(event) => setBlockName(event.target.value)}
                  className="app-input"
                  required
                  disabled={mapQuadraOptions.length === 0 && !blockName}
                >
                  <option value="">
                    {mapQuadraOptions.length === 0
                      ? 'Nenhuma quadra no mapa'
                      : 'Selecione a quadra…'}
                  </option>
                  {selectableQuadraOptions.map((label) => (
                    <option key={label} value={label}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="app-label">Nome da rua</label>
                <input
                  value={streetName}
                  onChange={(event) => setStreetName(event.target.value)}
                  placeholder="Ex: Rua Bahia, Av. da Saudade…"
                  className="app-input"
                  required
                />
              </div>
            </div>

            <div>
              <label className="app-label">Números das casas</label>
              <input
                value={houseNumbers}
                onChange={(event) => setHouseNumbers(event.target.value)}
                placeholder="Ex: 101, 103, 105, 210"
                className="app-input"
                required
              />
              <p className="mt-1.5 text-[12px] text-apple-tertiary">
                Separe por vírgula ou espaço.
              </p>
            </div>

            {blockError ? (
              <p className="rounded-apple bg-red-50 px-3 py-2 text-[13px] text-apple-red">
                {blockError}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="submit"
                disabled={
                  addingBlock ||
                  (mapQuadraOptions.length === 0 && editingBlockId == null) ||
                  selectableQuadraOptions.length === 0
                }
                className="app-btn-primary disabled:opacity-50"
              >
                {editingBlockId != null ? (
                  <>
                    <IconSave className="h-4 w-4" />
                    Salvar edição
                  </>
                ) : (
                  <>
                    <IconPlus className="h-4 w-4" />
                    Adicionar
                  </>
                )}
              </button>
              {editingBlockId != null ? (
                <button type="button" onClick={clearBlockForm} className="app-btn-secondary">
                  Cancelar
                </button>
              ) : null}
            </div>
          </form>

          {blocks.length > 0 ? (
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-apple border border-apple-line bg-apple-fill px-3.5 py-2.5">
              <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] font-medium text-apple-secondary">
                <input
                  type="checkbox"
                  checked={bulkSelectedIds.length === blocks.length && blocks.length > 0}
                  ref={(el) => {
                    if (el) {
                      el.indeterminate =
                        bulkSelectedIds.length > 0 && bulkSelectedIds.length < blocks.length;
                    }
                  }}
                  onChange={toggleSelectAllBlocks}
                  className="h-4 w-4 rounded border-apple-line text-apple-blue focus:ring-apple-blue/30"
                />
                {bulkSelectedIds.length === 0
                  ? 'Selecionar'
                  : bulkSelectedIds.length === blocks.length
                    ? 'Todas'
                    : `${bulkSelectedIds.length} selecionada(s)`}
              </label>

              <div className="ml-auto">
                <button
                  type="button"
                  disabled={bulkBusy || bulkSelectedIds.length === 0}
                  onClick={() => void bulkDeleteSelected()}
                  className="app-btn-danger h-9 px-3 text-[13px] disabled:opacity-40"
                >
                  <IconTrash className="h-3.5 w-3.5" />
                  Apagar
                  {bulkSelectedIds.length > 0 ? ` (${bulkSelectedIds.length})` : ''}
                </button>
              </div>
            </div>
          ) : null}

          <div className="space-y-3">
            {blocks.map((block) => {
              const completed = block.completed_houses ?? [];
              const done = completed.filter((h) => block.house_numbers.includes(h)).length;
              const total = block.house_numbers.length;
              const finished = total > 0 && done >= total;
              const isEditing = editingBlockId === block.id;
              const onMap =
                mapSelectedKey != null &&
                (mapSelectedKey.trim().toLowerCase() === block.name.trim().toLowerCase() ||
                  areaMatchesBlock(mapSelectedKey, block.name));
              const selected = isEditing || onMap;
              const inBulk = bulkSelectedIds.includes(block.id);
              const progress = total > 0 ? Math.round((done / total) * 100) : 0;

              return (
                <div
                  key={block.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => loadBlockForEdit(block)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      loadBlockForEdit(block);
                    }
                  }}
                  className={[
                    'flex cursor-pointer flex-wrap items-start justify-between gap-3 rounded-[20px] border p-5 text-left transition duration-200',
                    'hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)]',
                    inBulk
                      ? 'border-transparent bg-white shadow-[0_0_0_2px_#ff3b30,0_4px_16px_rgba(255,59,48,0.1)]'
                      : finished
                        ? selected
                          ? 'border-transparent bg-[#f0fdf4] shadow-[0_0_0_2px_#34c759,0_8px_24px_rgba(52,199,89,0.14)]'
                          : 'border-[#34c759]/25 bg-[#f0fdf4] shadow-[0_1px_2px_rgba(52,199,89,0.06)]'
                        : selected
                          ? 'border-transparent bg-white shadow-[0_0_0_2px_#0071e3,0_8px_24px_rgba(0,113,227,0.12)]'
                          : 'border-black/[0.06] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]',
                  ].join(' ')}
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <input
                      type="checkbox"
                      checked={inBulk}
                      onChange={() => toggleBulkSelect(block.id)}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                      title="Selecionar para apagar em massa"
                      aria-label={`Selecionar quadra ${block.name}`}
                      className="mt-1.5 h-4 w-4 shrink-0 rounded border-[#d2d2d7] text-[#ff3b30] focus:ring-[#ff3b30]/30"
                    />
                    <div className="min-w-0 flex-1">
                      {finished ? (
                        <div className="mb-2.5 h-[3px] max-w-[8rem] overflow-hidden rounded-full bg-[#34c759]/15">
                          <div className="h-full w-full rounded-full bg-[#34c759]" />
                        </div>
                      ) : null}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p
                          className={`text-[11px] font-medium uppercase tracking-[0.08em] ${
                            finished ? 'text-[#248a3d]' : 'text-[#86868b]'
                          }`}
                        >
                          Quadra{finished ? ' · concluída' : ''}
                        </p>
                        {isEditing ? (
                          <span className="rounded-full bg-[#0071e3]/[0.1] px-2 py-0.5 text-[11px] font-semibold text-[#0071e3]">
                            Edição
                          </span>
                        ) : null}
                        {onMap && !isEditing ? (
                          <span className="rounded-full bg-[#0071e3]/[0.1] px-2 py-0.5 text-[11px] font-semibold text-[#0071e3]">
                            No mapa
                          </span>
                        ) : null}
                        {finished ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#34c759] px-2 py-0.5 text-[11px] font-semibold text-white">
                            Finalizado
                          </span>
                        ) : (
                          <span className="rounded-full bg-[#f5f5f7] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[#6e6e73]">
                            {done}/{total}
                          </span>
                        )}
                      </div>
                      <p
                        className={`mt-1 text-[24px] font-semibold leading-none tracking-[-0.03em] ${
                          finished ? 'text-[#1b4332]' : 'text-[#1d1d1f]'
                        }`}
                      >
                        {block.name}
                      </p>
                      {block.street_name ? (
                        <p
                          className={`mt-1.5 text-[14px] ${
                            finished ? 'text-[#2d6a4f]' : 'text-[#6e6e73]'
                          }`}
                        >
                          {block.street_name}
                        </p>
                      ) : (
                        <p className="mt-1.5 text-[12px] text-[#86868b]">Sem rua</p>
                      )}

                      {!finished && total > 0 ? (
                        <div className="mt-3 h-[3px] max-w-xs overflow-hidden rounded-full bg-[#f5f5f7]">
                          <div
                            className="h-full rounded-full bg-[#0071e3] transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      ) : null}

                      <div className="mt-3 flex flex-wrap gap-2">
                        {block.house_numbers.map((item) => {
                          const house = String(item);
                          const isDone = completed.includes(house);
                          return (
                            <span
                              key={house}
                              className={[
                                'inline-flex min-w-[2.25rem] items-center justify-center rounded-full px-2.5 py-1.5',
                                'text-[13px] font-medium tabular-nums',
                                isDone
                                  ? 'bg-[#34c759] text-white'
                                  : finished
                                    ? 'bg-white/90 text-[#1b4332] ring-1 ring-[#34c759]/25'
                                    : 'bg-[#f5f5f7] text-[#1d1d1f]',
                              ].join(' ')}
                            >
                              {house}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void removeBlock(block.id);
                    }}
                    title="Remover"
                    aria-label="Remover"
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-black/[0.06] bg-white text-[#ff3b30] transition hover:bg-[#fff5f5]"
                  >
                    <IconTrash className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
            {blocks.length === 0 ? (
              <div className="rounded-[20px] border border-dashed border-black/[0.08] bg-white px-6 py-10 text-center">
                <p className="text-[14px] text-[#86868b]">Nenhum registro ainda.</p>
              </div>
            ) : null}
          </div>
        </section>

        {/* 3. Salvar por último (localidade + áreas do mapa) */}
        <SaveActionBar hint="Grava localidade, Terr. N.º e áreas do mapa. Os registros de não em casa já são salvos ao adicionar/editar cada quadra.">
          <SaveButton
            form="territory-form"
            loading={saving}
            label="Salvar localidade e área"
            loadingLabel="Salvando…"
          />
        </SaveActionBar>
      </div>
    </main>
  );
}
