import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { IconArrowLeft, IconPlus, IconSave, IconTrash, IconX } from '@/components/Map/mapIcons';
import TerritoryMap, {
  areaMatchesBlock,
  hasValidMapArea,
  parseGeoJsonToAreas,
  resolveAreaByKey,
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
  /** Uma ou mais ruas no mesmo cadastro de quadra (cada linha vira um registro no banco) */
  type StreetRow = { key: string; streetName: string; houseNumbers: string; description: string };
  const [streetRows, setStreetRows] = useState<StreetRow[]>([
    { key: 'r0', streetName: '', houseNumbers: '', description: '' },
  ]);
  /** null = novo registro; number = editando esse block (uma rua) */
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

  /** Todas as quadras do mapa (pode repetir: várias ruas na mesma quadra) */
  const selectableQuadraOptions = useMemo(() => {
    const current = blockName.trim();
    const set = new Set(mapQuadraOptions);
    if (current) set.add(current);
    return [...set];
  }, [mapQuadraOptions, blockName]);

  /** Agrupa registros de rua pela quadra (mesmo name) */
  const blocksByQuadra = useMemo(() => {
    const map = new Map<string, Block[]>();
    for (const b of blocks) {
      const key = (b.name ?? '').trim() || '—';
      const list = map.get(key) ?? [];
      list.push(b);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [blocks]);

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

  function newStreetRow(): StreetRow {
    return {
      key: `r${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      streetName: '',
      houseNumbers: '',
      description: '',
    };
  }

  function clearBlockForm() {
    setEditingBlockId(null);
    setBlockName('');
    setStreetRows([newStreetRow()]);
    setBlockError('');
    setMapSelectedKey(null);
  }

  function loadBlockForEdit(block: Block) {
    const name = (block.name ?? '').trim();
    setEditingBlockId(block.id);
    setBlockName(name);
    setStreetRows([
      {
        key: `edit-${block.id}`,
        streetName: block.street_name ?? '',
        houseNumbers: (block.house_numbers ?? []).join(', '),
        description: block.description ?? '',
      },
    ]);
    setBlockError('');
    setMapSelectedKey(name || null);
    setMapFocusToken((n) => n + 1);
  }

  /** Clique na área do mapa → destaca por **id** (único; nomes iguais não colidem) */
  function onMapAreaSelect(area: { id: string; label: string }) {
    setMapSelectedKey(area.id);
    setMapFocusToken((n) => n + 1);
    // pré-preenche a quadra para nova rua (pode já existir outra rua nessa quadra)
    setEditingBlockId(null);
    setBlockName(area.label);
    setStreetRows([newStreetRow()]);
    setBlockError('');
  }

  /** Card de quadra destacado? Aceita selectedKey = id da área ou rótulo da quadra. */
  function isQuadraSelectedOnMap(quadraName: string) {
    if (mapSelectedKey == null || mapSelectedKey === '') return false;
    if (
      mapSelectedKey.trim().toLowerCase() === quadraName.trim().toLowerCase() ||
      areaMatchesBlock(mapSelectedKey, quadraName)
    ) {
      return true;
    }
    const area = resolveAreaByKey(parseGeoJsonToAreas(geojson), mapSelectedKey);
    return area ? areaMatchesBlock(area.label, quadraName) || area.label === quadraName : false;
  }

  function parseHouseList(raw: string) {
    return raw
      .split(/[,\s;]+/)
      .map((v) => v.trim())
      .filter(Boolean);
  }

  async function saveBlock(event: FormEvent) {
    event.preventDefault();
    if (!id) return;

    if (!blockName.trim()) {
      setBlockError('Selecione a quadra desenhada no mapa.');
      return;
    }
    if (mapQuadraOptions.length === 0 && editingBlockId == null) {
      setBlockError('Desenhe e salve as áreas no mapa antes de cadastrar não em casa.');
      return;
    }

    const rowsParsed = streetRows.map((row) => ({
      street_name: row.streetName.trim(),
      house_numbers: parseHouseList(row.houseNumbers),
      description: row.description.trim() || null,
    }));

    for (const row of rowsParsed) {
      if (!row.street_name || row.house_numbers.length === 0) {
        setBlockError('Preencha o nome da rua e ao menos uma casa em cada linha.');
        return;
      }
    }

    setAddingBlock(true);
    setBlockError('');

    try {
      if (editingBlockId != null) {
        // edição de uma rua existente
        const row = rowsParsed[0];
        await api(`/api/territories/${id}/blocks/${editingBlockId}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: blockName.trim(),
            street_name: row.street_name,
            house_numbers: row.house_numbers,
            description: row.description,
          }),
        });
      } else {
        // várias ruas na mesma quadra = vários registros com o mesmo name
        for (const row of rowsParsed) {
          await api(`/api/territories/${id}/blocks`, {
            method: 'POST',
            body: JSON.stringify({
              name: blockName.trim(),
              street_name: row.street_name,
              house_numbers: row.house_numbers,
              description: row.description,
            }),
          });
        }
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
    return (
      <main className="app-page">
        <p className="text-[15px] text-apple-secondary">Carregando…</p>
      </main>
    );
  }

  return (
    <main className="app-page space-y-6">
      <div className="space-y-6">
        {/* 1. Localidade + mapa */}
        <div className="app-card-pad">
          <Link
            to={`/territories/${id}`}
            data-tooltip="Voltar"
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
                finishedKeys={blocksByQuadra
                  .filter(([, streetBlocks]) =>
                    streetBlocks.every((b) => {
                      const total = b.house_numbers.length;
                      const done = (b.completed_houses ?? []).filter((h) =>
                        b.house_numbers.includes(h),
                      ).length;
                      return total > 0 && done >= total;
                    }),
                  )
                  .map(([quadraName]) => quadraName)}
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
              Quadra igual ao mapa · uma ou mais ruas por quadra · toque na rua para editar
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
                  Editando rua · Quadra {blockName || editingBlockId}
                </p>
                <button type="button" onClick={clearBlockForm} className="app-btn-secondary h-8 px-3 text-[12px]">
                  <IconX className="h-3.5 w-3.5" />
                  Nova entrada
                </button>
              </div>
            ) : null}

            <div>
              <label htmlFor="block-quadra-select" className="app-label">
                Quadra (mapa)
              </label>
              <select
                id="block-quadra-select"
                value={blockName}
                onChange={(event) => setBlockName(event.target.value)}
                className="app-input max-w-md"
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
                    {blocks.some((b) => b.name.trim().toLowerCase() === label.toLowerCase())
                      ? ' (já tem rua — pode adicionar outra)'
                      : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[13px] font-semibold text-apple-ink">
                  {editingBlockId != null ? 'Rua' : 'Ruas nesta quadra'}
                </p>
                {editingBlockId == null ? (
                  <button
                    type="button"
                    onClick={() => setStreetRows((prev) => [...prev, newStreetRow()])}
                    className="app-btn-secondary h-9 px-3 text-[13px]"
                  >
                    <IconPlus className="h-3.5 w-3.5" />
                    Adicionar rua
                  </button>
                ) : null}
              </div>

              {streetRows.map((row, index) => (
                <div
                  key={row.key}
                  className="space-y-3 rounded-apple border border-apple-line bg-apple-surface p-3.5 sm:p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-apple-tertiary">
                      Rua {index + 1}
                    </p>
                    {editingBlockId == null && streetRows.length > 1 ? (
                      <button
                        type="button"
                        onClick={() =>
                          setStreetRows((prev) => prev.filter((r) => r.key !== row.key))
                        }
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-apple-red transition hover:bg-apple-red/10"
                        data-tooltip="Remover esta rua"
                        aria-label={`Remover rua ${index + 1}`}
                      >
                        <IconTrash className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>
                  <div>
                    <label className="app-label" htmlFor={`street-name-${row.key}`}>
                      Nome da rua
                    </label>
                    <input
                      id={`street-name-${row.key}`}
                      value={row.streetName}
                      onChange={(event) => {
                        const value = event.target.value;
                        setStreetRows((prev) =>
                          prev.map((r) =>
                            r.key === row.key ? { ...r, streetName: value } : r,
                          ),
                        );
                      }}
                      placeholder="Ex: Rua das Mangabeiras…"
                      className="app-input"
                      required
                    />
                  </div>
                  <div>
                    <label className="app-label" htmlFor={`street-houses-${row.key}`}>
                      Números das casas
                    </label>
                    <input
                      id={`street-houses-${row.key}`}
                      value={row.houseNumbers}
                      onChange={(event) => {
                        const value = event.target.value;
                        setStreetRows((prev) =>
                          prev.map((r) =>
                            r.key === row.key ? { ...r, houseNumbers: value } : r,
                          ),
                        );
                      }}
                      placeholder="Ex: 101, 103, 105, 210"
                      className="app-input"
                      required
                    />
                    <p className="mt-1.5 text-[12px] text-apple-tertiary">
                      Separe por vírgula ou espaço.
                    </p>
                  </div>
                  <div>
                    <label className="app-label" htmlFor={`street-desc-${row.key}`}>
                      Descrição <span className="font-normal text-apple-tertiary">(opcional)</span>
                    </label>
                    <input
                      id={`street-desc-${row.key}`}
                      value={row.description}
                      onChange={(event) => {
                        const value = event.target.value;
                        setStreetRows((prev) =>
                          prev.map((r) =>
                            r.key === row.key ? { ...r, description: value } : r,
                          ),
                        );
                      }}
                      placeholder="Nota informativa (ex.: portão lateral, cães…)"
                      className="app-input"
                      maxLength={500}
                    />
                    <p className="mt-1.5 text-[12px] text-apple-tertiary">
                      Só aparece no card se preenchida — não é clicável, só leitura.
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {blockError ? (
              <p className="rounded-apple border border-apple-red/25 bg-apple-red/10 px-3 py-2 text-[13px] text-apple-red">
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
                    Salvar rua
                  </>
                ) : (
                  <>
                    <IconPlus className="h-4 w-4" />
                    Salvar {streetRows.length > 1 ? `${streetRows.length} ruas` : 'quadra / rua'}
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

          <div className="space-y-4">
            {blocksByQuadra.map(([quadraName, streetBlocks]) => {
              const allDone = streetBlocks.every((b) => {
                const total = b.house_numbers.length;
                const done = (b.completed_houses ?? []).filter((h) =>
                  b.house_numbers.includes(h),
                ).length;
                return total > 0 && done >= total;
              });
              const doneSum = streetBlocks.reduce((s, b) => {
                return (
                  s + (b.completed_houses ?? []).filter((h) => b.house_numbers.includes(h)).length
                );
              }, 0);
              const totalSum = streetBlocks.reduce((s, b) => s + b.house_numbers.length, 0);
              const onMap = isQuadraSelectedOnMap(quadraName);

              return (
                <div
                  key={quadraName}
                  className={[
                    'rounded-[20px] border p-5 transition',
                    allDone
                      ? 'border-apple-green/30 bg-emerald-500/10 dark:bg-emerald-500/12'
                      : onMap
                        ? 'border-apple-blue/40 bg-apple-surface shadow-[0_0_0_2px_rgb(var(--apple-blue))]'
                        : 'border-apple-line bg-apple-surface shadow-soft',
                  ].join(' ')}
                >
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-apple-tertiary">
                        Quadra{allDone ? ' · concluída' : ''} · {streetBlocks.length}{' '}
                        {streetBlocks.length === 1 ? 'rua' : 'ruas'}
                      </p>
                      <p className="mt-1 text-[24px] font-semibold tracking-tightish text-apple-ink">
                        {quadraName}
                      </p>
                    </div>
                    <span className="rounded-full bg-apple-fill px-2.5 py-1 text-[11px] font-semibold tabular-nums text-apple-secondary">
                      {doneSum}/{totalSum}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {streetBlocks.map((block) => {
                      const completed = block.completed_houses ?? [];
                      const done = completed.filter((h) => block.house_numbers.includes(h)).length;
                      const total = block.house_numbers.length;
                      const finished = total > 0 && done >= total;
                      const isEditing = editingBlockId === block.id;
                      const inBulk = bulkSelectedIds.includes(block.id);

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
                            'flex cursor-pointer flex-wrap items-start justify-between gap-3 rounded-apple border p-3.5 transition',
                            inBulk
                              ? 'border-apple-red/40 bg-apple-red/5'
                              : isEditing
                                ? 'border-apple-blue/40 bg-apple-blue/5'
                                : 'border-apple-line bg-apple-fill/80 hover:bg-apple-fill',
                          ].join(' ')}
                        >
                          <div className="flex min-w-0 flex-1 items-start gap-3">
                            <input
                              type="checkbox"
                              checked={inBulk}
                              onChange={() => toggleBulkSelect(block.id)}
                              onClick={(e) => e.stopPropagation()}
                              onKeyDown={(e) => e.stopPropagation()}
                              data-tooltip="Selecionar para apagar em massa"
                              aria-label={`Selecionar rua ${block.street_name ?? block.id}`}
                              className="mt-1 h-4 w-4 shrink-0 rounded border-apple-line text-apple-red focus:ring-apple-red/30"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <p className="text-[15px] font-semibold text-apple-ink">
                                  {block.street_name?.trim() || 'Sem rua'}
                                </p>
                                {isEditing ? (
                                  <span className="rounded-full bg-apple-blue/10 px-2 py-0.5 text-[11px] font-semibold text-apple-blue">
                                    Edição
                                  </span>
                                ) : null}
                                {finished ? (
                                  <span className="rounded-full bg-apple-green px-2 py-0.5 text-[11px] font-semibold text-white">
                                    Finalizado
                                  </span>
                                ) : (
                                  <span className="rounded-full bg-apple-fill px-2 py-0.5 text-[11px] font-semibold tabular-nums text-apple-secondary">
                                    {done}/{total}
                                  </span>
                                )}
                              </div>
                              {block.description?.trim() ? (
                                <p className="mt-1.5 text-[13px] leading-relaxed text-apple-secondary">
                                  {block.description.trim()}
                                </p>
                              ) : null}
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {block.house_numbers.map((item) => {
                                  const house = String(item);
                                  const isDone = completed.includes(house);
                                  return (
                                    <span
                                      key={house}
                                      className={[
                                        'inline-flex min-w-[2.25rem] items-center justify-center rounded-full px-2.5 py-1',
                                        'text-[13px] font-medium tabular-nums',
                                        isDone
                                          ? 'bg-apple-green text-white'
                                          : 'bg-apple-surface text-apple-ink ring-1 ring-apple-line',
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
                            data-tooltip="Remover esta rua"
                            aria-label="Remover esta rua"
                            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-apple-red/25 bg-apple-surface text-apple-red transition hover:bg-apple-red/10"
                          >
                            <IconTrash className="h-4 w-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {blocks.length === 0 ? (
              <div className="app-empty">
                <p className="text-[14px] text-apple-tertiary">Nenhum registro ainda.</p>
              </div>
            ) : null}
          </div>
        </section>

        {/* 3. Salvar por último (localidade + áreas do mapa) */}
        <SaveActionBar hint="Grava localidade, Terr. N.º e áreas do mapa. Os registros de não em casa já são salvos ao adicionar/editar cada quadra.">
          <Link
            to={`/territories/${id}`}
            className="app-btn-secondary gap-2 px-5 py-3"
            data-tooltip="Sair sem salvar localidade/mapa"
          >
            <IconArrowLeft className="h-4 w-4 shrink-0" />
            Sair da edição
          </Link>
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
