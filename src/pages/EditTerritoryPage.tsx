import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { IconArrowLeft, IconPlus, IconSave, IconTrash, IconX } from '@/components/Map/mapIcons';
import TerritoryMap, {
  areaMatchesBlock,
  hasValidMapArea,
  parseGeoJsonToAreas,
  resolveAreaByKey,
} from '@/components/Map/TerritoryMap';
import { toast } from 'sonner';
import { confirmToast } from '@/lib/confirm-toast';
import FieldError from '@/components/ui/FieldError';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import type { Block, CepLocation, Territory } from '@/lib/types';

type StreetRow = { key: string; streetName: string; houseNumbers: string; description: string };

const SELECT_CLASS =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-muted';

const INPUT_ERROR_CLASS = 'border-destructive/60 ring-2 ring-destructive/25';

const STREET_HINT_CLASS = 'mt-1.5 text-xs text-muted-foreground';

export default function EditTerritoryPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [localidade, setLocalidade] = useState('');
  const [number, setNumber] = useState('');
  const [mapConfig, setMapConfig] = useState<CepLocation | null>(null);
  const [geojson, setGeojson] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [blockName, setBlockName] = useState('');
  /** Uma ou mais ruas no mesmo cadastro de quadra (cada linha vira um registro no banco) */
  const [streetRows, setStreetRows] = useState<StreetRow[]>([
    { key: 'r0', streetName: '', houseNumbers: '', description: '' },
  ]);
  /** null = novo registro; number = editando esse block (uma rua) */
  const [editingBlockId, setEditingBlockId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [blockError, setBlockError] = useState('');
  const [blockNameError, setBlockNameError] = useState('');
  const [streetRowErrors, setStreetRowErrors] = useState<
    Record<string, { streetName?: string; houseNumbers?: string }>
  >({});
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
    const collator = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });
    return [...set].sort(collator.compare);
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
    setBlockNameError('');
    setStreetRowErrors({});
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
    setBlockNameError('');
    setStreetRowErrors({});
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

    let nameError = '';
    if (!blockName.trim()) {
      nameError = 'Selecione a quadra desenhada no mapa.';
    } else if (mapQuadraOptions.length === 0 && editingBlockId == null) {
      nameError = 'Desenhe e salve as áreas no mapa antes de cadastrar não em casa.';
    }

    const rowErrors: Record<string, { streetName?: string; houseNumbers?: string }> = {};
    for (const row of streetRows) {
      if (!row.streetName.trim() && row.houseNumbers.trim() === '') {
        rowErrors[row.key] = {
          streetName: 'Preencha o nome da rua.',
          houseNumbers: 'Informe ao menos uma casa.',
        };
      } else {
        if (!row.streetName.trim()) {
          rowErrors[row.key] = { streetName: 'Preencha o nome da rua.' };
        } else if (row.houseNumbers.trim() === '') {
          rowErrors[row.key] = { houseNumbers: 'Informe ao menos uma casa.' };
        }
      }
    }

    setBlockNameError(nameError);
    setStreetRowErrors(rowErrors);

    if (nameError || Object.keys(rowErrors).length > 0) return;

    const rowsParsed = streetRows.map((row) => ({
      street_name: row.streetName.trim(),
      house_numbers: parseHouseList(row.houseNumbers),
      description: row.description.trim() || null,
    }));

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

  function removeBlock(blockId: number) {
    if (!id) return;
    confirmToast({
      title: 'Remover não em casa',
      description:
        'Este registro de casas sem resposta será apagado. Essa ação não pode ser desfeita.',
      confirmLabel: 'Remover',
      tone: 'danger',
      onConfirm: async () => {
        try {
          await api(`/api/territories/${id}/blocks/${blockId}`, { method: 'DELETE' });
          setBlocks((prev) => prev.filter((b) => b.id !== blockId));
          setBulkSelectedIds((prev) => prev.filter((x) => x !== blockId));
          if (editingBlockId === blockId) clearBlockForm();
          toast.success('Registro removido.');
        } catch (err) {
          setBlockError(err instanceof Error ? err.message : 'Erro ao remover.');
        }
      },
    });
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

  function bulkDeleteSelected() {
    if (!id || bulkSelectedIds.length === 0) return;
    const count = bulkSelectedIds.length;
    confirmToast({
      title: 'Apagar quadras selecionadas',
      description: `${count} ${count === 1 ? 'quadra será apagada' : 'quadras serão apagadas'} do não em casa (rua e números). Essa ação não pode ser desfeita.`,
      confirmLabel: count === 1 ? 'Apagar 1 quadra' : `Apagar ${count} quadras`,
      tone: 'danger',
      onConfirm: async () => {
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
          toast.success(count === 1 ? 'Quadra apagada.' : `${count} quadras apagadas.`);
        } catch (err) {
          setBlockError(err instanceof Error ? err.message : 'Erro ao apagar em massa.');
        } finally {
          setBulkBusy(false);
        }
      },
    });
  }

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8 sm:py-10">
        <div className="flex min-h-[16rem] items-center justify-center text-muted-foreground">
          <Spinner label="Carregando…" />
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8 sm:py-10">
      <div className="space-y-6">
        {/* 1. Localidade + mapa */}
        <Card>
          <CardContent className="pt-6">
            <Button
              asChild
              variant="outline"
              size="icon"
              data-tooltip="Voltar"
              aria-label="Voltar"
            >
              <Link to={`/territories/${id}`}>
                <IconArrowLeft />
              </Link>
            </Button>
            <h1 className="mt-4 text-[1.75rem] font-semibold tracking-tight sm:text-[2rem]">
              Editar território
            </h1>
            <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">
              Ajuste localidade e áreas no mapa. Em seguida gerencie o{' '}
              <strong className="font-semibold text-foreground">não em casa</strong>.
            </p>

            <form id="territory-form" onSubmit={saveTerritory} className="mt-6 space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="localidade-input">Localidade</Label>
                  <Input
                    id="localidade-input"
                    value={localidade}
                    onChange={(event) => setLocalidade(event.target.value)}
                    placeholder="Ex: Mundo Novo"
                    required
                  />
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="terr-numero-input">Terr. N.º</Label>
                  <Input
                    id="terr-numero-input"
                    value={number}
                    onChange={(event) => setNumber(event.target.value)}
                    placeholder="Ex: 31"
                  />
                </div>
              </div>

              {mapConfig ? (
                <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300">
                  <span className="font-medium">CEP base:</span> {mapConfig.cep} — {mapConfig.label}
                </div>
              ) : null}

              <div id="territorio-mapa-edit" className="scroll-mt-6">
                <Label className="text-sm font-medium text-foreground">
                  Área do território no mapa
                </Label>
                <p className="mb-2 text-[13px] leading-relaxed text-muted-foreground">
                  Clique no card de não em casa ou na área do mapa para destacar a quadra (sem rolar
                  a página).
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

              {error ? <p className="text-sm text-destructive">{error}</p> : null}
            </form>
          </CardContent>
        </Card>

        {/* 2. Não em casa */}
        <section id="nao-em-casa" className="scroll-mt-6">
          <Card>
            <CardContent className="pt-6">
              <div className="mb-5">
                <p className="text-sm font-medium text-muted-foreground">Checklist</p>
                <h2 className="mt-1 text-[1.375rem] font-semibold tracking-tight">Não em casa</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Quadra igual ao mapa · uma ou mais ruas por quadra · toque na rua para editar
                </p>
              </div>

              {mapQuadraOptions.length === 0 ? (
                <div className="mb-5 rounded-xl border border-dashed border-border bg-muted px-4 py-3 text-[13px] text-muted-foreground">
                  Nenhuma área no mapa ainda. Desenhe as quadras acima, salve, e depois cadastre
                  aqui.
                </div>
              ) : null}

              <form
                id="nao-em-casa-form"
                onSubmit={saveBlock}
                noValidate
                className={cn(
                  'mb-6 space-y-4 rounded-xl border p-4 sm:p-5',
                  editingBlockId != null
                    ? 'border-primary/25 bg-primary/[0.04]'
                    : 'border-border bg-muted/50',
                )}
              >
                {editingBlockId != null ? (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-primary">
                      Editando rua · Quadra {blockName || editingBlockId}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={clearBlockForm}
                      data-tooltip="Nova entrada"
                      aria-label="Nova entrada"
                    >
                      <IconX />
                    </Button>
                  </div>
                ) : null}

                <div className="grid gap-1.5">
                  <Label htmlFor="block-quadra-select">Quadra (mapa)</Label>
                  <select
                    id="block-quadra-select"
                    value={blockName}
                    onChange={(event) => {
                      setBlockName(event.target.value);
                      if (blockNameError) setBlockNameError('');
                    }}
                    className={cn(SELECT_CLASS, 'max-w-md', blockNameError && INPUT_ERROR_CLASS)}
                    disabled={mapQuadraOptions.length === 0 && !blockName}
                    aria-invalid={Boolean(blockNameError)}
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
                  {blockNameError ? <FieldError>{blockNameError}</FieldError> : null}
                </div>

                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[13px] font-semibold">
                      {editingBlockId != null ? 'Rua' : 'Ruas nesta quadra'}
                    </p>
                    {editingBlockId == null ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setStreetRows((prev) => [...prev, newStreetRow()])}
                        data-tooltip="Adicionar rua"
                        aria-label="Adicionar rua"
                      >
                        <IconPlus />
                      </Button>
                    ) : null}
                  </div>

                  {streetRows.map((row, index) => (
                    <div
                      key={row.key}
                      className="space-y-3 rounded-xl border border-border bg-card p-3.5 sm:p-4"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                          Rua {index + 1}
                        </p>
                        {editingBlockId == null && streetRows.length > 1 ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() =>
                              setStreetRows((prev) => prev.filter((r) => r.key !== row.key))
                            }
                            className="text-destructive hover:text-destructive"
                            data-tooltip="Remover esta rua"
                            aria-label={`Remover rua ${index + 1}`}
                          >
                            <IconTrash />
                          </Button>
                        ) : null}
                      </div>
                      <div className="grid gap-1.5">
                        <Label htmlFor={`street-name-${row.key}`}>Nome da rua</Label>
                        <Input
                          id={`street-name-${row.key}`}
                          value={row.streetName}
                          onChange={(event) => {
                            const value = event.target.value;
                            setStreetRows((prev) =>
                              prev.map((r) =>
                                r.key === row.key ? { ...r, streetName: value } : r,
                              ),
                            );
                            if (streetRowErrors[row.key]?.streetName) {
                              setStreetRowErrors((prev) => ({
                                ...prev,
                                [row.key]: { ...prev[row.key], streetName: undefined },
                              }));
                            }
                          }}
                          placeholder="Ex: Rua das Mangabeiras…"
                          className={streetRowErrors[row.key]?.streetName ? INPUT_ERROR_CLASS : ''}
                          aria-invalid={Boolean(streetRowErrors[row.key]?.streetName)}
                        />
                        {streetRowErrors[row.key]?.streetName ? (
                          <FieldError>{streetRowErrors[row.key].streetName}</FieldError>
                        ) : null}
                      </div>
                      <div className="grid gap-1.5">
                        <Label htmlFor={`street-houses-${row.key}`}>Números das casas</Label>
                        <Input
                          id={`street-houses-${row.key}`}
                          value={row.houseNumbers}
                          onChange={(event) => {
                            const value = event.target.value;
                            setStreetRows((prev) =>
                              prev.map((r) =>
                                r.key === row.key ? { ...r, houseNumbers: value } : r,
                              ),
                            );
                            if (streetRowErrors[row.key]?.houseNumbers) {
                              setStreetRowErrors((prev) => ({
                                ...prev,
                                [row.key]: { ...prev[row.key], houseNumbers: undefined },
                              }));
                            }
                          }}
                          placeholder="Ex: 101, 103, 105, 210"
                          className={streetRowErrors[row.key]?.houseNumbers ? INPUT_ERROR_CLASS : ''}
                          aria-invalid={Boolean(streetRowErrors[row.key]?.houseNumbers)}
                        />
                        {streetRowErrors[row.key]?.houseNumbers ? (
                          <FieldError>{streetRowErrors[row.key].houseNumbers}</FieldError>
                        ) : null}
                        <p className={STREET_HINT_CLASS}>Separe por vírgula ou espaço.</p>
                      </div>
                      <div className="grid gap-1.5">
                        <Label htmlFor={`street-desc-${row.key}`}>
                          Descrição{' '}
                          <span className="font-normal text-muted-foreground">(opcional)</span>
                        </Label>
                        <Input
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
                          maxLength={500}
                        />
                        <p className={STREET_HINT_CLASS}>
                          Só aparece no card se preenchida — não é clicável, só leitura.
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {blockError ? (
                  <p className="rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
                    {blockError}
                  </p>
                ) : null}

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="submit"
                    size="icon"
                    disabled={
                      addingBlock ||
                      (mapQuadraOptions.length === 0 && editingBlockId == null) ||
                      selectableQuadraOptions.length === 0
                    }
                    data-tooltip={editingBlockId != null ? 'Salvar rua' : 'Salvar quadra / rua'}
                    aria-label={editingBlockId != null ? 'Salvar rua' : 'Salvar quadra / rua'}
                  >
                    <IconPlus />
                  </Button>
                  {editingBlockId != null ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={clearBlockForm}
                      data-tooltip="Cancelar"
                      aria-label="Cancelar"
                    >
                      <IconX />
                    </Button>
                  ) : null}
                </div>
              </form>

              {blocks.length > 0 ? (
                <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/50 px-3.5 py-2.5">
                  <span className="inline-flex cursor-pointer items-center gap-2 text-[13px] font-medium text-muted-foreground">
                    <Checkbox
                      checked={
                        bulkSelectedIds.length === blocks.length
                          ? true
                          : bulkSelectedIds.length > 0
                            ? 'indeterminate'
                            : false
                      }
                      onCheckedChange={toggleSelectAllBlocks}
                      aria-label="Selecionar todas as quadras"
                    />
                    {bulkSelectedIds.length === 0
                      ? 'Selecionar'
                      : bulkSelectedIds.length === blocks.length
                        ? 'Todas'
                        : `${bulkSelectedIds.length} selecionada(s)`}
                  </span>

                  <div className="ml-auto">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      disabled={bulkBusy || bulkSelectedIds.length === 0}
                      onClick={() => void bulkDeleteSelected()}
                      data-tooltip={
                        bulkSelectedIds.length > 0
                          ? `Apagar (${bulkSelectedIds.length})`
                          : 'Apagar'
                      }
                      aria-label="Apagar selecionadas"
                      className="text-destructive hover:text-destructive"
                    >
                      <IconTrash />
                    </Button>
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
                      s +
                      (b.completed_houses ?? []).filter((h) => b.house_numbers.includes(h)).length
                    );
                  }, 0);
                  const totalSum = streetBlocks.reduce((s, b) => s + b.house_numbers.length, 0);
                  const onMap = isQuadraSelectedOnMap(quadraName);

                  return (
                    <div
                      key={quadraName}
                      className={cn(
                        'rounded-[20px] border bg-card p-5 transition',
                        allDone
                          ? 'border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-500/12'
                          : onMap
                            ? 'border-primary/40 bg-card shadow-[0_0_0_2px_var(--primary)]'
                            : 'border-border bg-card',
                      )}
                    >
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                            Quadra{allDone ? ' · concluída' : ''} · {streetBlocks.length}{' '}
                            {streetBlocks.length === 1 ? 'rua' : 'ruas'}
                          </p>
                          <p className="mt-1 text-2xl font-semibold tracking-tight">
                            {quadraName}
                          </p>
                        </div>
                        <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold tabular-nums text-muted-foreground">
                          {doneSum}/{totalSum}
                        </span>
                      </div>

                      <div className="space-y-3">
                        {streetBlocks.map((block) => {
                          const completed = block.completed_houses ?? [];
                          const done = completed.filter((h) =>
                            block.house_numbers.includes(h),
                          ).length;
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
                              className={cn(
                                'flex cursor-pointer flex-wrap items-start justify-between gap-3 rounded-xl border bg-card p-3.5 transition',
                                inBulk
                                  ? 'border-destructive/40 bg-destructive/5'
                                  : isEditing
                                    ? 'border-primary/40 bg-primary/5'
                                    : 'border-border bg-muted/50 hover:bg-muted',
                              )}
                            >
                              <div className="flex min-w-0 flex-1 items-start gap-3">
                                <Checkbox
                                  checked={inBulk}
                                  onCheckedChange={() => toggleBulkSelect(block.id)}
                                  onClick={(e) => e.stopPropagation()}
                                  onKeyDown={(e) => e.stopPropagation()}
                                  data-tooltip="Selecionar para apagar em massa"
                                  aria-label={`Selecionar rua ${block.street_name ?? block.id}`}
                                  className="mt-1 shrink-0"
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <p className="text-[15px] font-semibold">
                                      {block.street_name?.trim() || 'Sem rua'}
                                    </p>
                                    {isEditing ? (
                                      <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[11px] font-semibold text-sky-700 dark:text-sky-300">
                                        Edição
                                      </span>
                                    ) : null}
                                    {finished ? (
                                      <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                                        Finalizado
                                      </span>
                                    ) : (
                                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
                                        {done}/{total}
                                      </span>
                                    )}
                                  </div>
                                  {block.description?.trim() ? (
                                    <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
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
                                          className={cn(
                                            'inline-flex min-w-[2.25rem] items-center justify-center rounded-full px-2.5 py-1',
                                            'text-[13px] font-medium tabular-nums',
                                            isDone
                                              ? 'bg-emerald-600 text-white'
                                              : 'bg-card text-foreground ring-1 ring-border',
                                          )}
                                        >
                                          {house}
                                        </span>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void removeBlock(block.id);
                                }}
                                className="shrink-0 text-destructive hover:text-destructive"
                                data-tooltip="Remover esta rua"
                                aria-label="Remover esta rua"
                              >
                                <IconTrash />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                {blocks.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
                    Nenhum registro ainda.
                  </p>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* 3. Salvar por último (localidade + áreas do mapa) */}
        <Card>
          <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold">Salvar alterações</p>
              <p className="mt-0.5 text-xs text-muted-foreground sm:max-w-md">
                Grava localidade, Terr. N.º e áreas do mapa. Os registros de não em casa já são
                salvos ao adicionar/editar cada quadra.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:gap-3">
              <Button
                asChild
                variant="outline"
                size="icon"
                data-tooltip="Sair sem salvar localidade/mapa"
              >
                <Link to={`/territories/${id}`}>
                  <IconArrowLeft />
                </Link>
              </Button>
              <Button
                type="submit"
                form="territory-form"
                size="icon"
                disabled={saving}
                aria-busy={saving}
                data-tooltip="Salvar localidade e área"
              >
                <IconSave />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
