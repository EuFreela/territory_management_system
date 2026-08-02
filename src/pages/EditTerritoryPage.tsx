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
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* 1. Localidade + mapa */}
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <Link
            to={`/territories/${id}`}
            title="Voltar"
            aria-label="Voltar"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
          >
            <IconArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">Editar cartão de território</h1>
          <p className="mt-1 text-sm text-slate-600">
            Ajuste localidade e áreas no mapa. Em seguida gerencie o <strong>não em casa</strong>. O
            botão de salvar fica no final da página.
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

        {/* 2. Não em casa (meio da página) */}
        <div
          id="nao-em-casa"
          className="scroll-mt-6 rounded-2xl border-2 border-amber-200 bg-white p-6 shadow-sm"
        >
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold tracking-wide text-amber-900">NÃO EM CASA</h2>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              Anotações do cartão
            </span>
          </div>
          <p className="mb-4 text-sm text-slate-600">
            A <strong>quadra</strong> deve ser a mesma desenhada no mapa. Escolha no select, informe a{' '}
            <strong>rua</strong> e os <strong>números</strong>. Clique em um card para editar e destacar a
            área no mapa (sem subir a página).
          </p>

          {mapQuadraOptions.length === 0 ? (
            <div className="mb-4 rounded-xl border border-dashed border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Nenhuma área no mapa ainda. Desenhe as quadras no mapa (acima), salve a localidade e área, e
              depois cadastre o não em casa.
            </div>
          ) : null}

          <form
            id="nao-em-casa-form"
            onSubmit={saveBlock}
            className={`mb-6 space-y-3 rounded-xl border p-4 ${
              editingBlockId != null
                ? 'border-sky-300 bg-sky-50/50'
                : 'border-transparent bg-transparent p-0'
            }`}
          >
            {editingBlockId != null ? (
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-sky-800">
                  Editando quadra · {blockName || editingBlockId}
                </p>
                <button
                  type="button"
                  onClick={clearBlockForm}
                  title="Cancelar edição"
                  aria-label="Cancelar edição"
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  <IconX className="h-3.5 w-3.5" />
                  Nova entrada
                </button>
              </div>
            ) : null}

            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label
                  htmlFor="block-quadra-select"
                  className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500"
                >
                  Quadra (mapa)
                </label>
                <select
                  id="block-quadra-select"
                  value={blockName}
                  onChange={(event) => setBlockName(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
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
                <p className="mt-1 text-xs text-slate-500">
                  Mesmo nome/número da área desenhada no mapa.
                </p>
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Nome da rua
                </label>
                <input
                  value={streetName}
                  onChange={(event) => setStreetName(event.target.value)}
                  placeholder="Ex: Rua Bahia, Av. da Saudade…"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                Números das casas (não em casa)
              </label>
              <input
                value={houseNumbers}
                onChange={(event) => setHouseNumbers(event.target.value)}
                placeholder="Ex: 101, 103, 105, 210"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                required
              />
              <p className="mt-1 text-xs text-slate-500">
                Separe por vírgula ou espaço. Ao editar, você pode incluir ou remover números.
              </p>
            </div>

            {blockError ? <p className="text-sm text-red-600">{blockError}</p> : null}

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="submit"
                disabled={
                  addingBlock ||
                  (mapQuadraOptions.length === 0 && editingBlockId == null) ||
                  selectableQuadraOptions.length === 0
                }
                title={
                  addingBlock
                    ? 'Salvando…'
                    : editingBlockId != null
                      ? 'Salvar alterações'
                      : 'Adicionar não em casa'
                }
                aria-label={
                  editingBlockId != null ? 'Salvar alterações' : 'Adicionar não em casa'
                }
                className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 font-semibold text-white shadow-sm disabled:opacity-70 ${
                  editingBlockId != null
                    ? 'bg-sky-600 hover:bg-sky-700'
                    : 'bg-amber-700 hover:bg-amber-800'
                }`}
              >
                {editingBlockId != null ? (
                  <>
                    <IconSave className="h-5 w-5" />
                    <span className="text-sm">Salvar edição</span>
                  </>
                ) : (
                  <>
                    <IconPlus className="h-5 w-5" />
                    <span className="text-sm">Adicionar</span>
                  </>
                )}
              </button>
              {editingBlockId != null ? (
                <button
                  type="button"
                  onClick={clearBlockForm}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
              ) : null}
            </div>
          </form>

          {blocks.length > 0 ? (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
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
                  className="h-4 w-4 rounded border-slate-300 text-amber-700 focus:ring-amber-500"
                />
                {bulkSelectedIds.length === 0
                  ? 'Selecionar quadras'
                  : bulkSelectedIds.length === blocks.length
                    ? 'Todas selecionadas'
                    : `${bulkSelectedIds.length} selecionada(s)`}
              </label>

              <div className="ml-auto flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={bulkBusy || bulkSelectedIds.length === 0}
                  onClick={() => void bulkDeleteSelected()}
                  title="Apagar quadras selecionadas"
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <IconTrash className="h-4 w-4" />
                  Apagar selecionadas
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
              // Finalizado + selecionado: base cinza de concluído + anel de seleção
              const cardTone = inBulk
                ? 'border-red-300 bg-red-50/80 ring-2 ring-red-200'
                : selected
                  ? finished
                    ? 'border-sky-500 bg-slate-100 ring-2 ring-sky-400 opacity-100'
                    : 'border-sky-400 bg-sky-50 ring-2 ring-sky-300'
                  : finished
                    ? 'border-slate-200 bg-slate-100/80 opacity-75 hover:opacity-100'
                    : 'border-amber-200 bg-amber-50 hover:border-amber-300';
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
                  className={`flex cursor-pointer flex-wrap items-start justify-between gap-3 rounded-xl border p-4 text-left transition hover:shadow-md ${cardTone}`}
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
                      className="mt-1.5 h-4 w-4 shrink-0 rounded border-slate-300 text-red-600 focus:ring-red-400"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p
                          className={`text-xs font-medium uppercase tracking-wide ${
                            finished ? 'text-slate-500' : 'text-amber-800'
                          }`}
                        >
                          Quadra · clique para destacar no mapa
                          {finished ? ' · finalizada' : ''}
                        </p>
                        {isEditing ? (
                          <span className="rounded-full bg-sky-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                            Em edição
                          </span>
                        ) : null}
                        {onMap && !isEditing ? (
                          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold uppercase text-sky-800 ring-1 ring-sky-300">
                            No mapa
                          </span>
                        ) : null}
                        {finished ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">
                            Finalizado
                          </span>
                        ) : (
                          <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-amber-900 ring-1 ring-amber-200">
                            {done}/{total} feitos
                          </span>
                        )}
                        {selected && finished ? (
                          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold uppercase text-sky-800 ring-1 ring-sky-300">
                            Selecionada
                          </span>
                        ) : null}
                      </div>
                      <p
                        className={`text-2xl font-bold ${
                          finished ? 'text-slate-500 line-through decoration-slate-400' : 'text-slate-900'
                        }`}
                      >
                        {block.name}
                      </p>
                      {block.street_name ? (
                        <p className="mt-1 text-sm font-medium text-slate-800">
                          Rua: <span className="font-normal text-slate-700">{block.street_name}</span>
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-slate-500">Sem rua informada</p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-2">
                        {block.house_numbers.map((item) => {
                          const house = String(item);
                          const isDone = completed.includes(house);
                          return (
                            <span
                              key={house}
                              className={`rounded-full px-2 py-1 text-xs font-medium ring-1 ${
                                isDone
                                  ? 'bg-emerald-600 text-white ring-emerald-700 line-through'
                                  : 'bg-white text-slate-700 ring-amber-200'
                              }`}
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
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-white text-red-700 hover:bg-red-50"
                  >
                    <IconTrash className="h-5 w-5" />
                  </button>
                </div>
              );
            })}
            {blocks.length === 0 ? (
              <p className="text-sm text-slate-600">Nenhum registro de não em casa ainda.</p>
            ) : null}
          </div>
        </div>

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
