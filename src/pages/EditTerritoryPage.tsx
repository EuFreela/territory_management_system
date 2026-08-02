import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { IconArrowLeft, IconPlus, IconSave, IconTrash } from '@/components/Map/mapIcons';
import TerritoryMap, { hasValidMapArea } from '@/components/Map/TerritoryMap';
import { useConfirm } from '@/components/ui/ConfirmModal';
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
  const [error, setError] = useState('');
  const [blockError, setBlockError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addingBlock, setAddingBlock] = useState(false);

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

  async function addBlock(event: FormEvent) {
    event.preventDefault();
    if (!id) return;

    const numbers = houseNumbers
      .split(/[,\s;]+/)
      .map((v) => v.trim())
      .filter(Boolean);

    if (!blockName.trim() || !streetName.trim() || numbers.length === 0) {
      setBlockError('Preencha número da quadra, nome da rua e ao menos uma casa.');
      return;
    }

    setAddingBlock(true);
    setBlockError('');

    try {
      await api(`/api/territories/${id}/blocks`, {
        method: 'POST',
        body: JSON.stringify({
          name: blockName.trim(),
          street_name: streetName.trim(),
          house_numbers: numbers,
        }),
      });
      const refreshed = await api<Territory>(`/api/territories/${id}`);
      setBlocks(refreshed.blocks ?? []);
      setBlockName('');
      setStreetName('');
      setHouseNumbers('');
    } catch (err) {
      setBlockError(err instanceof Error ? err.message : 'Erro ao adicionar não em casa.');
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
    } catch (err) {
      setBlockError(err instanceof Error ? err.message : 'Erro ao remover.');
    }
  }

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center text-slate-600">Carregando…</main>;
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
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
            Ajuste a localidade e redesenhe a área no mapa se necessário. Ao salvar, grava só esta área.
          </p>

          <form onSubmit={saveTerritory} className="mt-6 space-y-5">
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

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Área do território no mapa</label>
              <TerritoryMap
                value={geojson}
                onChange={setGeojson}
                centerLat={mapConfig?.lat ?? null}
                centerLng={mapConfig?.lng ?? null}
                cepLabel={mapConfig ? `${mapConfig.cep} — ${mapConfig.label}` : null}
                editable
              />
            </div>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            <button
              type="submit"
              disabled={saving}
              title={saving ? 'Salvando…' : 'Salvar localidade e área'}
              aria-label={saving ? 'Salvando…' : 'Salvar localidade e área'}
              className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-sky-600 text-white shadow-sm hover:bg-sky-700 disabled:opacity-70"
            >
              <IconSave className="h-6 w-6" />
            </button>
          </form>
        </div>

        <div className="rounded-2xl border-2 border-amber-200 bg-white p-6 shadow-sm">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold tracking-wide text-amber-900">NÃO EM CASA</h2>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              Anotações do cartão
            </span>
          </div>
          <p className="mb-4 text-sm text-slate-600">
            Registre a <strong>quadra</strong>, a <strong>rua</strong> e os <strong>números das casas</strong>{' '}
            onde não havia ninguém em casa.
          </p>

          <form onSubmit={addBlock} className="mb-6 space-y-3">
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  N.º da quadra
                </label>
                <input
                  value={blockName}
                  onChange={(event) => setBlockName(event.target.value)}
                  placeholder="Ex: 1, 2, A…"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Nome da rua
                </label>
                <input
                  value={streetName}
                  onChange={(event) => setStreetName(event.target.value)}
                  placeholder="Ex: Rua Bahia, Av. da Saudade…"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
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
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                required
              />
              <p className="mt-1 text-xs text-slate-500">Separe os números por vírgula ou espaço.</p>
            </div>

            {blockError ? <p className="text-sm text-red-600">{blockError}</p> : null}

            <button
              type="submit"
              disabled={addingBlock}
              title={addingBlock ? 'Adicionando…' : 'Adicionar não em casa'}
              aria-label={addingBlock ? 'Adicionando…' : 'Adicionar não em casa'}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-amber-700 text-white shadow-sm hover:bg-amber-800 disabled:opacity-70"
            >
              <IconPlus className="h-6 w-6" />
            </button>
          </form>

          <div className="space-y-3">
            {blocks.map((block) => {
              const completed = block.completed_houses ?? [];
              const done = completed.filter((h) => block.house_numbers.includes(h)).length;
              const total = block.house_numbers.length;
              const finished = total > 0 && done >= total;
              return (
                <div
                  key={block.id}
                  className={`flex flex-wrap items-start justify-between gap-3 rounded-xl border p-4 ${
                    finished
                      ? 'border-slate-200 bg-slate-100/80 opacity-75'
                      : 'border-amber-200 bg-amber-50'
                  }`}
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p
                        className={`text-xs font-medium uppercase tracking-wide ${
                          finished ? 'text-slate-500' : 'text-amber-800'
                        }`}
                      >
                        Quadra
                      </p>
                      {finished ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                          Finalizado
                        </span>
                      ) : (
                        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-amber-900 ring-1 ring-amber-200">
                          {done}/{total} feitos
                        </span>
                      )}
                    </div>
                    <p
                      className={`text-2xl font-bold ${
                        finished ? 'text-slate-500' : 'text-slate-900'
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
                    <p className="mt-2 text-xs text-slate-500">
                      Marque os feitos no cartão do território (checklist).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void removeBlock(block.id)}
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
      </div>
    </main>
  );
}
