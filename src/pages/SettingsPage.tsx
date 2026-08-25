import { FormEvent, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { IconMap, IconSave, IconSearch } from '@/components/Map/mapIcons';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import FieldError from '@/components/ui/FieldError';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/Spinner';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { confirmToast } from '@/lib/confirm-toast';
import { formatCep, maskCepInput, onlyDigits } from '@/lib/cep';
import type { CepLocation } from '@/lib/types';

type RegionOption = {
  cep: string;
  territory_count: number;
  congregation_name?: string | null;
};

type CepConfig = {
  cep: string;
  active_cep: string | null;
  is_default: boolean;
  default_cep: string;
  congregation_name?: string | null;
  location: CepLocation;
  regions: RegionOption[];
  message?: string;
};

export default function SettingsPage() {
  const { refresh } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState('');
  const [cepError, setCepError] = useState('');
  const [nameError, setNameError] = useState('');
  const [config, setConfig] = useState<CepConfig | null>(null);
  const [cep, setCep] = useState('');
  const [congregationName, setCongregationName] = useState('');
  const [preview, setPreview] = useState<CepLocation | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await api<CepConfig>('/api/config/cep');
      setConfig(data);
      setCep(data.cep);
      setCongregationName(data.congregation_name ?? '');
      setPreview(data.location);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar configuração.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function runPreview(value: string) {
    const digits = onlyDigits(value);
    if (digits.length !== 8) {
      setCepError('Informe um CEP com 8 dígitos.');
      return;
    }
    setPreviewing(true);
    setCepError('');
    try {
      const data = await api<{ location: CepLocation }>('/api/config/cep/preview', {
        method: 'POST',
        body: JSON.stringify({ cep: digits }),
      });
      setPreview(data.location);
    } catch (err) {
      setPreview(null);
      setCepError(err instanceof Error ? err.message : 'Não foi possível consultar o CEP.');
    } finally {
      setPreviewing(false);
    }
  }

  function applyConfig(data: CepConfig) {
    setConfig(data);
    setCep(data.cep);
    setCongregationName(data.congregation_name ?? '');
    setPreview(data.location);
  }

  async function persistRegion(options: {
    nextCep: string | null;
    congregationName?: string | null;
    includeName: boolean;
  }) {
    setSaving(true);
    setCepError('');
    setNameError('');
    try {
      const body: { cep: string | null; congregation_name?: string | null } = {
        cep: options.nextCep,
      };
      if (options.includeName) {
        body.congregation_name = options.congregationName ?? null;
      }
      const data = await api<CepConfig>('/api/config/cep', {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      applyConfig(data);
      await refresh();
      toast.success(data.message || 'Configuração da região atualizada.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar a região.');
    } finally {
      setSaving(false);
    }
  }

  async function saveCep(
    nextCep: string | null,
    locationHint?: CepLocation | null,
    options?: { congregationName?: string; includeName?: boolean },
  ) {
    const digits = nextCep ? onlyDigits(nextCep) : '';
    if (nextCep != null && digits.length !== 8) {
      setCepError('Informe um CEP com 8 dígitos.');
      return;
    }

    const includeName = options?.includeName ?? false;
    const nameRaw = options?.congregationName;
    if (includeName && nameRaw != null) {
      const trimmed = nameRaw.trim();
      if (trimmed && trimmed.length < 2) {
        setNameError('Nome da congregação deve ter pelo menos 2 caracteres.');
        return;
      }
      if (trimmed.length > 120) {
        setNameError('Nome da congregação no máximo 120 caracteres.');
        return;
      }
    }

    const currentDigits = onlyDigits(config?.cep ?? '');
    const sameCep = Boolean(digits && digits === currentDigits);
    const targetLabel =
      locationHint?.label ||
      (digits ? formatCep(digits) : config?.default_cep ? `padrão ${config.default_cep}` : 'padrão');

    const apply = () =>
      persistRegion({
        nextCep,
        congregationName: includeName ? (nameRaw ?? '').trim() || null : undefined,
        includeName,
      });

    if (sameCep && includeName) {
      await apply();
      return;
    }

    if (sameCep && !includeName) {
      toast.success('Esta já é a região de trabalho atual.');
      return;
    }

    confirmToast({
      title: 'Trocar região de trabalho?',
      description: `Territórios, mapas, dirigentes e o histórico passam a ser os de ${targetLabel}. Os dados das outras regiões continuam salvos.`,
      confirmLabel: 'Trocar região',
      onConfirm: () => void apply(),
    });
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void saveCep(cep, preview, { congregationName, includeName: true });
  }

  const location = preview ?? config?.location ?? null;

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8 sm:py-10">
      <p className="text-sm font-medium text-muted-foreground">Sistema</p>
      <h1 className="mt-1 text-[1.75rem] font-semibold tracking-tight sm:text-[2rem]">
        Configuração
      </h1>
      <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">
        Defina o CEP da região de trabalho e o nome da congregação. Territórios, mapas,
        dirigentes e o histórico ficam vinculados a este CEP.
      </p>

      {error ? (
        <div className="mt-6 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="mt-10 flex justify-center">
          <Spinner label="Carregando configuração…" />
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
                  <IconMap className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold tracking-tight">Região atual</h2>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {config?.is_default
                      ? 'Usando o CEP padrão do sistema (.env).'
                      : 'CEP gravado na sua conta. Outros usuários da mesma congregação devem usar o mesmo CEP.'}
                  </p>
                  {config?.congregation_name ? (
                    <p className="mt-3 text-[15px] font-medium text-foreground">
                      {config.congregation_name}
                    </p>
                  ) : null}
                  {config?.location ? (
                    <p
                      className={`text-[15px] ${config.congregation_name ? 'mt-0.5 text-muted-foreground' : 'mt-3 font-medium text-foreground'}`}
                    >
                      {config.location.cep}
                      {config.location.city ? ` · ${config.location.city}` : ''}
                      {config.location.state ? `/${config.location.state}` : ''}
                    </p>
                  ) : null}
                  {config?.location?.label ? (
                    <p className="mt-0.5 text-sm text-muted-foreground">{config.location.label}</p>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h2 className="text-lg font-semibold tracking-tight">Alterar região</h2>
              <p className="mb-4 mt-1 text-sm leading-relaxed text-muted-foreground">
                Informe o CEP da área e o nome da congregação. O mapa e as criações passam a usar
                essa localidade.
              </p>

              <form onSubmit={onSubmit} noValidate className="space-y-4">
                <div className="grid gap-1.5 sm:max-w-md">
                  <Label htmlFor="settings-congregation">Nome da congregação</Label>
                  <Input
                    id="settings-congregation"
                    value={congregationName}
                    onChange={(event) => {
                      setCongregationName(event.target.value);
                      if (nameError) setNameError('');
                    }}
                    placeholder="Ex: Alpinópolis"
                    maxLength={120}
                    disabled={saving}
                    autoComplete="organization"
                    aria-invalid={Boolean(nameError)}
                    aria-describedby={nameError ? 'settings-congregation-error' : undefined}
                  />
                  {nameError ? (
                    <FieldError id="settings-congregation-error">{nameError}</FieldError>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Este nome identifica o CEP no sistema (a congregação desta região).
                    </p>
                  )}
                </div>

                <div className="grid gap-1.5 sm:max-w-xs">
                  <Label htmlFor="settings-cep">CEP</Label>
                  <div className="flex gap-2">
                    <Input
                      id="settings-cep"
                      value={cep}
                      onChange={(event) => {
                        const next = maskCepInput(event.target.value);
                        setCep(next);
                        if (cepError) setCepError('');
                      }}
                      inputMode="numeric"
                      autoComplete="postal-code"
                      placeholder="00000-000"
                      maxLength={9}
                      disabled={saving}
                      aria-invalid={Boolean(cepError)}
                      aria-describedby={cepError ? 'settings-cep-error' : undefined}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      disabled={saving || previewing || onlyDigits(cep).length !== 8}
                      onClick={() => void runPreview(cep)}
                      data-tooltip="Consultar CEP"
                      aria-label="Consultar CEP"
                    >
                      <IconSearch className="size-4" />
                    </Button>
                  </div>
                  {cepError ? <FieldError id="settings-cep-error">{cepError}</FieldError> : null}
                </div>

                {previewing ? (
                  <p className="text-sm text-muted-foreground">Consultando CEP…</p>
                ) : location ? (
                  <div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm">
                    <p className="font-medium text-foreground">
                      {location.city || location.cep}
                      {location.state ? `/${location.state}` : ''}
                    </p>
                    <p className="mt-0.5 text-muted-foreground">{location.label}</p>
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Button type="submit" disabled={saving || onlyDigits(cep).length !== 8}>
                    <IconSave />
                    {saving ? 'Salvando…' : 'Salvar região'}
                  </Button>
                  {config && !config.is_default ? (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={saving}
                      onClick={() => void saveCep(null, null)}
                    >
                      Usar CEP padrão ({config.default_cep})
                    </Button>
                  ) : null}
                </div>
              </form>
            </CardContent>
          </Card>

          {config?.regions && config.regions.length > 0 ? (
            <Card>
              <CardContent className="pt-6">
                <h2 className="text-lg font-semibold tracking-tight">Regiões já cadastradas</h2>
                <p className="mb-4 mt-1 text-sm leading-relaxed text-muted-foreground">
                  CEPs que já possuem territórios neste sistema. Clique para mudar para essa
                  região.
                </p>
                <div className="flex flex-wrap gap-2">
                  {config.regions.map((region) => {
                    const active = onlyDigits(region.cep) === onlyDigits(config.cep);
                    return (
                      <button
                        key={region.cep}
                        type="button"
                        disabled={saving || active}
                        onClick={() => {
                          setCep(region.cep);
                          void saveCep(region.cep);
                        }}
                        className={[
                          'inline-flex h-8 items-center rounded-full border px-3 text-[13px] font-medium transition',
                          active
                            ? 'border-transparent bg-foreground text-background'
                            : 'border-border bg-background text-foreground hover:bg-muted',
                          'disabled:opacity-70',
                        ].join(' ')}
                      >
                        {region.congregation_name || region.cep}
                        <span className="ml-1.5 text-[11px] opacity-70">
                          {region.congregation_name
                            ? `${region.cep} · ${region.territory_count}`
                            : region.territory_count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}
    </main>
  );
}
