import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { IconArrowLeft, IconImage, IconMap, IconSave } from '@/components/Map/mapIcons';
import TerritoryImageLeafletMap from '@/components/Map/TerritoryImageLeafletMap';
import TerritoryMap, { hasValidMapArea } from '@/components/Map/TerritoryMap';
import ImageUrlField from '@/components/territory/ImageUrlField';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import FieldError from '@/components/ui/FieldError';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { sanitizeImageUrl } from '@/lib/image-url';
import { cn } from '@/lib/utils';
import type { CepLocation, Territory } from '@/lib/types';

type CreateTab = 'mapa' | 'imagem';

export default function NewTerritoryPage() {
  const navigate = useNavigate();
  const [localidade, setLocalidade] = useState('');
  const [number, setNumber] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageUrlError, setImageUrlError] = useState('');
  const [geojson, setGeojson] = useState<string | null>(null);
  const [mapConfig, setMapConfig] = useState<CepLocation | null>(null);
  const [error, setError] = useState('');
  const [localidadeError, setLocalidadeError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadingMap, setLoadingMap] = useState(true);
  const [tab, setTab] = useState<CreateTab>('mapa');
  const [imageResizeToken, setImageResizeToken] = useState(0);

  useEffect(() => {
    api<CepLocation>('/api/config/map')
      .then(setMapConfig)
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar mapa.'))
      .finally(() => setLoadingMap(false));
  }, []);

  const sanitizedImage = sanitizeImageUrl(imageUrl);
  const previewTerritory: Territory = {
    id: 0,
    user_id: 0,
    name: localidade,
    number,
    image_url: sanitizedImage.ok ? sanitizedImage.url : null,
    is_daily: 0,
  };

  function selectTab(next: CreateTab) {
    setTab(next);
    if (next === 'imagem') {
      setImageResizeToken((n) => n + 1);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setLocalidadeError('');
    setImageUrlError('');

    if (localidade.trim() === '') {
      setLocalidadeError('Preencha este campo.');
      return;
    }

    const imageResult = sanitizeImageUrl(imageUrl);
    if (!imageResult.ok) {
      setImageUrlError(imageResult.error);
      selectTab('imagem');
      return;
    }

    if (!geojson || !hasValidMapArea(geojson)) {
      setError('Desenhe ao menos uma área no mapa (lápis → pontos → ✓) antes de salvar.');
      selectTab('mapa');
      return;
    }

    setSubmitting(true);

    try {
      const data = await api<{ id: number }>('/api/territories', {
        method: 'POST',
        body: JSON.stringify({
          name: localidade,
          number: number || null,
          image_url: imageResult.url,
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
          Preencha a localidade e o número, cole o link da imagem do cartão, desenhe a área no
          mapa e salve.
        </p>

        <Card className="mt-6">
          <CardContent className="pt-6">
            <form onSubmit={onSubmit} noValidate className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="localidade">Localidade</Label>
                  <Input
                    id="localidade"
                    value={localidade}
                    onChange={(event) => {
                      setLocalidade(event.target.value);
                      if (localidadeError) setLocalidadeError('');
                    }}
                    placeholder="Ex: Mundo Novo"
                    disabled={submitting}
                    aria-invalid={Boolean(localidadeError)}
                    aria-describedby={localidadeError ? 'localidade-error' : undefined}
                  />
                  {localidadeError ? (
                    <FieldError id="localidade-error">{localidadeError}</FieldError>
                  ) : null}
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
                    Área e imagem do cartão
                  </Label>
                  {mapConfig ? (
                    <span className="text-xs text-muted-foreground">
                      CEP base: {mapConfig.cep} · {mapConfig.city}/{mapConfig.state}
                    </span>
                  ) : null}
                </div>

                <div
                  className="mb-3 inline-flex w-full rounded-full bg-muted p-1 sm:w-auto"
                  role="tablist"
                  aria-label="Mapa ou imagem"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={tab === 'mapa'}
                    onClick={() => selectTab('mapa')}
                    className={cn(
                      'flex h-8 flex-1 items-center justify-center gap-1.5 rounded-full px-5 text-sm font-medium transition sm:flex-none',
                      tab === 'mapa'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <IconMap className="size-3.5 shrink-0" />
                    Mapa
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={tab === 'imagem'}
                    onClick={() => selectTab('imagem')}
                    className={cn(
                      'flex h-8 flex-1 items-center justify-center gap-1.5 rounded-full px-5 text-sm font-medium transition sm:flex-none',
                      tab === 'imagem'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <IconImage className="size-3.5 shrink-0" />
                    Imagem
                  </button>
                </div>

                <div hidden={tab !== 'mapa'} className={tab === 'mapa' ? '' : 'hidden'}>
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

                <div hidden={tab !== 'imagem'} className={tab === 'imagem' ? 'space-y-4' : 'hidden'}>
                  <ImageUrlField
                    value={imageUrl}
                    onChange={(next) => {
                      setImageUrl(next);
                      if (imageUrlError) setImageUrlError('');
                    }}
                    error={imageUrlError}
                    disabled={submitting}
                  />
                  {sanitizedImage.ok && sanitizedImage.url ? (
                    <TerritoryImageLeafletMap
                      territory={previewTerritory}
                      resizeToken={imageResizeToken}
                    />
                  ) : (
                    <div className="flex min-h-[12rem] items-center justify-center rounded-2xl border border-dashed border-border bg-muted px-4 text-center text-sm text-muted-foreground">
                      Cole um link https da imagem do cartão para ver o preview aqui.
                    </div>
                  )}
                </div>
              </div>

              {error ? <p className="text-sm text-destructive">{error}</p> : null}

              <div className="flex justify-end">
                <Button
                  type="submit"
                  size="icon"
                  disabled={submitting || loadingMap}
                  data-tooltip="Salvar território e área"
                >
                  <IconSave />
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
