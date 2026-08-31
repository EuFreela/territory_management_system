import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { IconMap } from '@/components/Map/mapIcons';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/Spinner';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { can } from '@/lib/permissions';
import { confirmToast } from '@/lib/confirm-toast';
import { formatCep, onlyDigits } from '@/lib/cep';
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
  const { user, refresh } = useAuth();
  const canChangeRegion = can(user, 'config:cep');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [config, setConfig] = useState<CepConfig | null>(null);
  const [cep, setCep] = useState('');

  async function load() {
    setLoading(true);
    try {
      const data = await api<CepConfig>('/api/config/cep');
      setConfig(data);
      setCep(data.cep);
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

  function applyConfig(data: CepConfig) {
    setConfig(data);
    setCep(data.cep);
  }

  async function persistRegion(nextCep: string | null) {
    setSaving(true);
    try {
      const data = await api<CepConfig>('/api/config/cep', {
        method: 'PUT',
        body: JSON.stringify({ cep: nextCep }),
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

  function saveCep(nextCep: string | null) {
    const digits = nextCep ? onlyDigits(nextCep) : '';
    if (nextCep != null && digits.length !== 8) {
      toast.error('Informe um CEP com 8 dígitos.');
      return;
    }

    const currentDigits = onlyDigits(config?.cep ?? '');
    const sameCep = Boolean(digits && digits === currentDigits);
    if (sameCep) {
      toast.success('Esta já é a região de trabalho atual.');
      return;
    }

    const targetLabel = digits
      ? formatCep(digits)
      : config?.default_cep
        ? `padrão ${config.default_cep}`
        : 'padrão';

    confirmToast({
      title: 'Trocar região de trabalho?',
      description: `Territórios, mapas, dirigentes e o histórico passam a ser os de ${targetLabel}. Os dados das outras regiões continuam salvos.`,
      confirmLabel: 'Trocar região',
      onConfirm: () => void persistRegion(nextCep),
    });
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8 sm:py-10">
      <p className="text-sm font-medium text-muted-foreground">Sistema</p>
      <h1 className="mt-1 text-[1.75rem] font-semibold tracking-tight sm:text-[2rem]">
        Configuração
      </h1>
      <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">
        Veja a região de trabalho e a congregação do sistema. O cadastro e a definição da
        congregação ativa são feitos na página Congregações.
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
                      : 'Sua região de trabalho. Outros usuários permanecem na congregação definida no cadastro deles.'}
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

          {canChangeRegion && config?.regions && config.regions.length > 0 ? (
            <Card>
              <CardContent className="pt-6">
                <h2 className="text-lg font-semibold tracking-tight">Regiões já cadastradas</h2>
                <p className="mb-4 mt-1 text-sm leading-relaxed text-muted-foreground">
                  CEPs que já possuem territórios neste sistema.
                </p>
                <div className="flex flex-wrap gap-2">
                  {config.regions.map((region) => {
                    const active = onlyDigits(region.cep) === onlyDigits(config.cep);
                    return (
                      <button
                        key={region.cep}
                        type="button"
                        disabled={saving}
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
