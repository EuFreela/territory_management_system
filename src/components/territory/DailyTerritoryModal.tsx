import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconCheckCircle, IconSearch, IconStar, IconX } from '@/components/Map/mapIcons';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import type { FieldAssignment, Territory } from '@/lib/types';

function normalize(text: string) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

type Props = {
  /** Já escolheu o território? Então o modal escolhe o dirigente. */
  territoryId?: number;
  /** Já escolheu o dirigente? Então o modal escolhe o território. */
  assignmentId?: number;
  onClose: () => void;
  /** Chamado após vincular com sucesso (página recarrega) */
  onDone?: () => void;
};

/**
 * Vincula um território do dia a um dirigente.
 * - Com `territoryId`: escolhe o dirigente (ou "sem dirigente" se não houver escala hoje).
 * - Com `assignmentId`: escolhe o território para aquele dirigente.
 * Cada dirigente tem um território do dia; vincular troca o vínculo anterior dele.
 */
export default function DailyTerritoryModal({
  territoryId,
  assignmentId,
  onClose,
  onDone,
}: Props) {
  const [leaders, setLeaders] = useState<FieldAssignment[]>([]);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [selectedLeader, setSelectedLeader] = useState('');
  const [selectedTerritory, setSelectedTerritory] = useState('');
  const [territorySearch, setTerritorySearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api<{ dated: FieldAssignment[]; fixed: FieldAssignment[] }>('/api/field-assignments/today'),
      api<Territory[]>('/api/territories'),
    ])
      .then(([leadersData, territoryData]) => {
        if (cancelled) return;
        const allLeaders = [...(leadersData.dated ?? []), ...(leadersData.fixed ?? [])];
        setLeaders(allLeaders);
        setTerritories(Array.isArray(territoryData) ? territoryData : []);
        if (assignmentId != null) {
          setSelectedLeader(String(assignmentId));
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Erro ao carregar.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [assignmentId]);

  const leaderOptions = useMemo(() => {
    return [...leaders]
      .sort((a, b) => Number(b.is_fixed) - Number(a.is_fixed))
      .map((row) => {
        const kind = row.is_fixed ? 'Fixo' : 'Designado';
        const time = row.fixed_time?.trim();
        const label = time
          ? `${row.assignee_name} · ${time} (${kind})`
          : `${row.assignee_name} (${kind})`;
        return { id: String(row.id), label };
      });
  }, [leaders]);

  const territoryOptions = useMemo(() => {
    return [...territories].sort((a, b) => {
      const an = Number(a.number);
      const bn = Number(b.number);
      if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
      return String(a.name).localeCompare(String(b.name));
    });
  }, [territories]);

  const filteredTerritories = useMemo(() => {
    const q = normalize(territorySearch);
    if (!q) return territoryOptions;
    return territoryOptions.filter((t) =>
      normalize(`${t.name} ${t.number ?? ''}`).includes(q),
    );
  }, [territoryOptions, territorySearch]);

  const hasLeaders = leaderOptions.length > 0;

  async function confirm() {
    setSaving(true);
    setError('');
    try {
      let tid: number;
      let aid: string;
      if (territoryId != null) {
        tid = territoryId;
        aid = selectedLeader;
      } else if (assignmentId != null) {
        tid = Number(selectedTerritory);
        aid = String(assignmentId);
      } else {
        setError('Dados incompletos.');
        return;
      }
      if (!Number.isFinite(tid) || tid < 1) {
        setError('Escolha o território do dia.');
        return;
      }
      if (territoryId != null && hasLeaders && !aid) {
        setError('Escolha o dirigente.');
        return;
      }
      const body = aid ? { assignment_id: Number(aid) } : {};
      await api(`/api/territories/${tid}/daily`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      toast.success('Território do dia vinculado ao dirigente.');
      onDone?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao vincular.');
    } finally {
      setSaving(false);
    }
  }

  const title =
    territoryId != null ? 'Território do dia — dirigente' : 'Dirigente — território do dia';

  return createPortal(
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center p-4"
      role="presentation"
    >
      <button
        type="button"
        aria-label="Fechar"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px] transition dark:bg-black/55"
        onClick={onClose}
        disabled={saving}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="daily-territory-modal-title"
        className="relative z-10 w-full max-w-md overflow-hidden rounded-[22px] border border-apple-line bg-apple-surface shadow-float"
      >
        <div className="h-1 w-full bg-apple-blue" />
        <div className="px-6 pb-6 pt-5">
          <div className="flex items-start justify-between gap-3">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-apple-blue/15 text-apple-blue">
              <IconStar className="h-5 w-5" />
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              aria-label="Fechar"
              className="-mr-1.5 -mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-apple-secondary transition hover:bg-apple-fill hover:text-apple-ink"
            >
              <IconX className="h-4 w-4" />
            </button>
          </div>

          <h2
            id="daily-territory-modal-title"
            className="text-[17px] font-semibold tracking-tightish text-apple-ink"
          >
            {title}
          </h2>
          <p className="mt-1.5 text-[14px] leading-relaxed text-apple-secondary">
            {territoryId != null
              ? 'Cada dirigente do serviço de campo tem um território do dia. Escolha qual dirigente vai trabalhar este território hoje.'
              : 'Cada dirigente do serviço de campo tem um território do dia. Escolha qual território este dirigente vai trabalhar hoje.'}
          </p>

          <div className="mt-5 space-y-4">
            {loading ? (
              <p className="text-[13px] text-apple-tertiary">Carregando…</p>
            ) : territoryId != null ? (
              <div>
                <label htmlFor="daily-leader" className="app-label">
                  Dirigente
                </label>
                <select
                  id="daily-leader"
                  value={selectedLeader}
                  onChange={(e) => {
                    setSelectedLeader(e.target.value);
                    setError('');
                  }}
                  className="app-input"
                  disabled={saving}
                  autoFocus
                >
                  <option value="">
                    {hasLeaders ? 'Selecione um dirigente…' : 'Sem dirigente'}
                  </option>
                  {leaderOptions.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-[12px] text-apple-tertiary">
                  {!hasLeaders
                    ? 'Não há dirigentes na escala de hoje — o território ficará sem dirigente.'
                    : 'Se o dirigente já tiver outro território do dia, o vínculo é trocado.'}
                </p>
              </div>
            ) : (
              <div>
                <label htmlFor="daily-territory-search" className="app-label">
                  Território do dia
                </label>
                <div className="relative">
                  <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-apple-tertiary" />
                  <input
                    id="daily-territory-search"
                    type="search"
                    value={territorySearch}
                    onChange={(e) => {
                      setTerritorySearch(e.target.value);
                      setError('');
                    }}
                    placeholder="Buscar por nome ou número…"
                    className="app-input pl-9"
                    disabled={saving}
                    autoFocus
                  />
                </div>
                <div className="mt-2 max-h-56 space-y-1.5 overflow-y-auto rounded-apple border border-apple-line bg-apple-fill p-1.5">
                  {filteredTerritories.length === 0 ? (
                    <p className="px-2.5 py-2 text-[13px] text-apple-tertiary">
                      Nenhum território encontrado.
                    </p>
                  ) : (
                    filteredTerritories.map((t) => {
                      const isSelected = String(t.id) === selectedTerritory;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            setSelectedTerritory(String(t.id));
                            setError('');
                          }}
                          className={`flex w-full items-center justify-between gap-2 rounded-[10px] px-3 py-2 text-left transition ${
                            isSelected
                              ? 'bg-apple-blue text-white'
                              : 'bg-apple-surface text-apple-ink hover:bg-apple-line'
                          }`}
                        >
                          <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                            {t.number ? `${t.name} · N.º ${t.number}` : t.name}
                          </span>
                          {t.is_daily ? (
                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                isSelected
                                  ? 'bg-white/20 text-white'
                                  : 'bg-apple-blue/10 text-apple-blue'
                              }`}
                            >
                              do dia
                            </span>
                          ) : null}
                        </button>
                      );
                    })
                  )}
                </div>
                <p className="mt-1.5 text-[12px] text-apple-tertiary">
                  Se este território já estiver vinculado a outro dirigente, o vínculo é trocado.
                </p>
              </div>
            )}
          </div>

          {error ? (
            <p className="mt-3 rounded-[12px] border border-apple-red/25 bg-apple-red/10 px-3 py-2 text-[13px] text-apple-red">
              {error}
            </p>
          ) : null}

          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <button type="button" onClick={onClose} disabled={saving} className="app-btn-secondary">
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void confirm()}
              disabled={
                saving ||
                (assignmentId != null && !selectedTerritory) ||
                (territoryId != null && hasLeaders && !selectedLeader)
              }
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-apple-blue px-4 text-[14px] font-semibold text-white shadow-soft transition hover:bg-apple-blue-hover disabled:opacity-50"
            >
              <IconCheckCircle className="h-4 w-4" />
              {saving ? 'Vinculando…' : 'Vincular ao dia'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
