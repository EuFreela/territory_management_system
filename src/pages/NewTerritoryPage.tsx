import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { IconArrowLeft } from '@/components/Map/mapIcons';
import TerritoryMap, { hasValidMapArea } from '@/components/Map/TerritoryMap';
import SaveButton, { SaveActionBar } from '@/components/ui/SaveButton';
import { api } from '@/lib/api';
import type { CepLocation } from '@/lib/types';

export default function NewTerritoryPage() {
  const navigate = useNavigate();
  const [localidade, setLocalidade] = useState('');
  const [number, setNumber] = useState('');
  const [geojson, setGeojson] = useState<string | null>(null);
  const [mapConfig, setMapConfig] = useState<CepLocation | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadingMap, setLoadingMap] = useState(true);

  useEffect(() => {
    api<CepLocation>('/api/config/map')
      .then(setMapConfig)
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar mapa.'))
      .finally(() => setLoadingMap(false));
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');

    if (!geojson || !hasValidMapArea(geojson)) {
      setError('Desenhe ao menos uma área no mapa (lápis → pontos → ✓) antes de salvar.');
      return;
    }

    setSubmitting(true);

    try {
      const data = await api<{ id: number }>('/api/territories', {
        method: 'POST',
        body: JSON.stringify({
          name: localidade,
          number: number || null,
          geojson,
        }),
      });
      navigate(`/territories/${data.id}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar território.');
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <Link
            to="/territories"
            title="Voltar"
            aria-label="Voltar"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
          >
            <IconArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">Cartão de mapa de território</h1>
          <p className="mt-1 text-sm text-slate-600">
            Preencha a localidade e o número, desenhe a área no mapa e salve. Só a área desenhada será
            gravada.
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="localidade" className="mb-1 block text-sm font-medium text-slate-700">
                  Localidade
                </label>
                <input
                  id="localidade"
                  value={localidade}
                  onChange={(event) => setLocalidade(event.target.value)}
                  placeholder="Ex: Mundo Novo"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  required
                  disabled={submitting}
                />
              </div>

              <div>
                <label htmlFor="number" className="mb-1 block text-sm font-medium text-slate-700">
                  Terr. N.º
                </label>
                <input
                  id="number"
                  value={number}
                  onChange={(event) => setNumber(event.target.value)}
                  placeholder="Ex: 31"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  disabled={submitting}
                />
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="block text-sm font-medium text-slate-700">Área do território no mapa</label>
                {mapConfig ? (
                  <span className="text-xs text-slate-500">
                    CEP base: {mapConfig.cep} · {mapConfig.city}/{mapConfig.state}
                  </span>
                ) : null}
              </div>

              {loadingMap ? (
                <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-slate-500">
                  Carregando mapa…
                </div>
              ) : (
                <TerritoryMap
                  value={geojson}
                  onChange={setGeojson}
                  centerLat={mapConfig?.lat ?? null}
                  centerLng={mapConfig?.lng ?? null}
                  cepLabel={mapConfig ? `${mapConfig.cep} — ${mapConfig.label}` : null}
                  editable
                />
              )}
            </div>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            <SaveActionBar>
              <SaveButton
                loading={submitting}
                disabled={loadingMap}
                label="Salvar território e área"
                loadingLabel="Salvando…"
              />
            </SaveActionBar>
          </form>
        </div>
      </div>
    </main>
  );
}
