import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { IconArrowLeft } from '@/components/Map/mapIcons';
import TerritoryMap, { hasValidMapArea } from '@/components/Map/TerritoryMap';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
    <main className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8 sm:py-10">
      <div>
        <Link
          to="/territories"
          data-tooltip="Voltar"
          aria-label="Voltar"
          className="inline-flex"
        >
          <Button type="button" variant="outline" size="icon">
            <IconArrowLeft className="size-4" />
          </Button>
        </Link>
        <p className="mt-4 text-sm font-medium text-muted-foreground">Cartões</p>
        <h1 className="mt-1 text-[1.75rem] font-semibold tracking-tight sm:text-[2rem]">
          Novo território
        </h1>
        <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">
          Preencha a localidade e o número, desenhe a área no mapa e salve.
        </p>

        <Card className="mt-6">
          <CardContent className="pt-6">
            <form onSubmit={onSubmit} className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="localidade">Localidade</Label>
                  <Input
                    id="localidade"
                    value={localidade}
                    onChange={(event) => setLocalidade(event.target.value)}
                    placeholder="Ex: Mundo Novo"
                    required
                    disabled={submitting}
                  />
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="number">Terr. N.º</Label>
                  <Input
                    id="number"
                    value={number}
                    onChange={(event) => setNumber(event.target.value)}
                    placeholder="Ex: 31"
                    disabled={submitting}
                  />
                </div>
              </div>

              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <Label className="text-sm font-medium text-foreground">
                    Área do território no mapa
                  </Label>
                  {mapConfig ? (
                    <span className="text-xs text-muted-foreground">
                      CEP base: {mapConfig.cep} · {mapConfig.city}/{mapConfig.state}
                    </span>
                  ) : null}
                </div>

                {loadingMap ? (
                  <div className="flex h-64 items-center justify-center rounded-lg border border-border bg-muted/40">
                    <Spinner label="Carregando mapa…" className="text-muted-foreground" />
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

              {error ? <p className="text-sm text-destructive">{error}</p> : null}

              <div className="flex justify-end">
                <Button type="submit" disabled={submitting || loadingMap}>
                  {submitting ? 'Salvando…' : 'Salvar território e área'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
