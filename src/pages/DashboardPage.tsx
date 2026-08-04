import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  IconCheckCircle,
  IconPencil,
  IconSave,
  IconUnlink,
  IconX,
} from '@/components/Map/mapIcons';
import { useConfirm } from '@/components/ui/ConfirmModal';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import type { DashboardData, FieldAssignment, FieldLeadersToday } from '@/lib/types';

export default function DashboardPage() {
  const { can } = useAuth();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [leaders, setLeaders] = useState<FieldLeadersToday | null>(null);
  const [error, setError] = useState('');
  const [unlinking, setUnlinking] = useState(false);
  const [finishing, setFinishing] = useState(false);
  /** Modal finalizar: território + pessoas no campo */
  const [finishModalId, setFinishModalId] = useState<number | null>(null);
  const [finishPeople, setFinishPeople] = useState('1');
  const [finishModalError, setFinishModalError] = useState('');

  const [editingLeaderId, setEditingLeaderId] = useState<number | null>(null);
  const [editLeaderName, setEditLeaderName] = useState('');
  const [savingLeader, setSavingLeader] = useState(false);

  async function load() {
    const [next, todayLeaders] = await Promise.all([
      api<DashboardData>('/api/territories/dashboard'),
      api<FieldLeadersToday>('/api/field-assignments/today'),
    ]);
    setData(next);
    setLeaders(todayLeaders);
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar dashboard.'));
  }, []);

  async function unlinkDaily(event: React.MouseEvent, territoryId: number) {
    event.preventDefault();
    event.stopPropagation();
    const ok = await confirm({
      title: 'Desvincular território do dia',
      message:
        'Este território deixará de ser o destaque do dia. Você poderá marcar outro quando quiser.',
      confirmLabel: 'Desvincular',
      cancelLabel: 'Cancelar',
      tone: 'warning',
    });
    if (!ok) return;

    setUnlinking(true);
    try {
      await api(`/api/territories/${territoryId}/daily`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao desvincular.');
    } finally {
      setUnlinking(false);
    }
  }

  function openFinishModal(event: React.MouseEvent, territoryId: number) {
    event.preventDefault();
    event.stopPropagation();
    setFinishModalId(territoryId);
    setFinishPeople('1');
    setFinishModalError('');
  }

  function closeFinishModal() {
    if (finishing) return;
    setFinishModalId(null);
    setFinishPeople('1');
    setFinishModalError('');
  }

  /** Finaliza: grava no histórico (com pessoas), desvincula do dia e vai para Finalizados */
  async function confirmFinishDaily() {
    if (finishModalId == null) return;
    const people = Number(finishPeople);
    if (!Number.isFinite(people) || people < 1 || people > 999) {
      setFinishModalError('Informe quantas pessoas estavam no campo (mínimo 1).');
      return;
    }

    setFinishing(true);
    setFinishModalError('');
    setError('');
    try {
      await api(`/api/territories/${finishModalId}/finish`, {
        method: 'POST',
        body: JSON.stringify({ people_count: Math.floor(people) }),
      });
      setFinishModalId(null);
      navigate('/territories/finalizados');
    } catch (err) {
      setFinishModalError(err instanceof Error ? err.message : 'Erro ao finalizar território.');
      setFinishing(false);
    }
  }

  function startEditLeader(row: FieldAssignment) {
    setEditingLeaderId(row.id);
    setEditLeaderName(row.assignee_name);
  }

  async function saveLeaderName() {
    if (editingLeaderId == null || !editLeaderName.trim()) return;
    setSavingLeader(true);
    try {
      await api(`/api/field-assignments/${editingLeaderId}`, {
        method: 'PUT',
        body: JSON.stringify({ assignee_name: editLeaderName.trim() }),
      });
      setEditingLeaderId(null);
      const todayLeaders = await api<FieldLeadersToday>('/api/field-assignments/today');
      setLeaders(todayLeaders);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar dirigente.');
    } finally {
      setSavingLeader(false);
    }
  }

  if (error && !data) {
    return (
      <main className="app-page-wide">
        <p className="text-[15px] text-apple-red">{error}</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="app-page-wide">
        <p className="text-[15px] text-apple-secondary">Carregando…</p>
      </main>
    );
  }

  const { daily, unfinished = [] } = data;
  const datedLeaders = leaders?.dated ?? [];
  const fixedLeaders = leaders?.fixed ?? [];

  return (
    <main className="app-page-wide">
      <header className="mb-10">
        <p className="app-section-title">Visão geral</p>
        <h1 className="app-title mt-1">Início</h1>
        <p className="app-subtitle">Território do dia, dirigentes e o que ainda falta.</p>
      </header>

      {error ? (
        <p className="mb-6 rounded-apple bg-red-50 px-3 py-2 text-[13px] text-apple-red">{error}</p>
      ) : null}

      {/* Território do dia */}
      <section className="mb-10">
        <h2 className="app-section-title mb-3">Território do dia</h2>

        {daily ? (
          <div className="app-card flex flex-wrap items-center gap-4 p-5 sm:p-6">
            <Link
              to={`/territories/${daily.id}`}
              className="min-w-0 flex-1 rounded-apple outline-none ring-apple-blue/30 focus-visible:ring-2"
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="app-badge-blue">Do dia</span>
                <span className="text-[17px] font-semibold tracking-tightish text-apple-ink">
                  {daily.name}
                </span>
                {daily.number ? (
                  <span className="text-[14px] text-apple-secondary">
                    Terr. N.º <span className="font-medium text-apple-ink">{daily.number}</span>
                  </span>
                ) : null}
              </div>
              <p className="mt-1.5 text-[13px] text-apple-tertiary">
                {daily.is_finished
                  ? 'Checklist concluído — use Finalizar para enviar ao histórico'
                  : 'Toque para abrir mapa, áreas e não em casa'}
              </p>
            </Link>

            <div className="flex items-center gap-2">
              {daily.is_finished && can('territory:set_daily') ? (
                <button
                  type="button"
                  disabled={finishing || unlinking}
                  onClick={(e) => openFinishModal(e, Number(daily.id))}
                  title="Finalizar território do dia e enviar para Finalizados"
                  aria-label="Finalizar território do dia"
                  className="inline-flex h-10 items-center gap-1.5 rounded-full bg-[#34c759] px-3.5 text-[13px] font-semibold text-white shadow-soft transition hover:bg-[#2db84d] active:scale-[0.97] disabled:opacity-50"
                >
                  <IconCheckCircle className="h-4 w-4" />
                  <span className="hidden sm:inline">Finalizar</span>
                </button>
              ) : null}
              {can('territory:set_daily') ? (
                <button
                  type="button"
                  disabled={unlinking || finishing}
                  onClick={(e) => void unlinkDaily(e, daily.id)}
                  title="Desvincular território do dia"
                  aria-label="Desvincular território do dia"
                  className="app-icon-btn disabled:opacity-50"
                >
                  <IconUnlink className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="app-empty">
            <p className="text-[15px] font-medium text-apple-ink">Nenhum território do dia</p>
            <p className="mt-1 text-[13px] text-apple-secondary">
              Marque um em{' '}
              <Link to="/territories" className="app-link">
                Territórios
              </Link>
              .
            </p>
          </div>
        )}
      </section>

      {/* Dirigentes */}
      <section className="mb-10">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="app-section-title">Dirigente do serviço de campo</h2>
          <Link to="/dirigentes" className="text-[13px] font-medium text-apple-blue hover:underline">
            Ver escala
          </Link>
        </div>

        <div className="app-card-pad">
          <p className="text-[13px] font-medium text-apple-tertiary">
            {leaders?.weekday_label ?? 'Hoje'}
            {leaders?.date ? ` · ${leaders.date.split('-').reverse().join('/')}` : ''}
          </p>

          {datedLeaders.length === 0 && fixedLeaders.length === 0 ? (
            <p className="mt-3 text-[15px] text-apple-secondary">
              Nenhum dirigente designado para hoje.
            </p>
          ) : (
            <div className="mt-4 space-y-2">
              {datedLeaders.map((row) => (
                <div
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-apple bg-apple-fill px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] text-apple-tertiary">
                      Designado ({row.weekday_label}
                      {row.fixed_time ? ` · ${row.fixed_time}` : ''})
                    </p>
                    {editingLeaderId === row.id ? (
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <input
                          value={editLeaderName}
                          onChange={(e) => setEditLeaderName(e.target.value)}
                          className="app-input min-w-[12rem] flex-1 py-2"
                          autoFocus
                        />
                        <button
                          type="button"
                          disabled={savingLeader}
                          onClick={() => void saveLeaderName()}
                          title="Salvar"
                          aria-label="Salvar"
                          className="app-icon-btn bg-apple-blue text-white hover:bg-apple-blue-hover"
                        >
                          <IconSave className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingLeaderId(null)}
                          title="Cancelar"
                          aria-label="Cancelar"
                          className="app-icon-btn"
                        >
                          <IconX className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="mt-0.5 flex items-center gap-2">
                        <p className="text-[17px] font-semibold tracking-tightish text-apple-ink">
                          {row.assignee_name}
                        </p>
                        <button
                          type="button"
                          onClick={() => startEditLeader(row)}
                          title="Editar dirigente"
                          aria-label="Editar dirigente"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-apple-tertiary transition hover:bg-white hover:text-apple-ink"
                        >
                          <IconPencil className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {fixedLeaders.map((row) => (
                <div
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-apple border border-emerald-500/15 bg-emerald-500/[0.06] px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] text-emerald-800/80">
                      Fixo · {row.weekday_label}
                      {row.fixed_time ? ` · ${row.fixed_time}` : ''}
                    </p>
                    {editingLeaderId === row.id ? (
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <input
                          value={editLeaderName}
                          onChange={(e) => setEditLeaderName(e.target.value)}
                          className="app-input min-w-[12rem] flex-1 py-2"
                          autoFocus
                        />
                        <button
                          type="button"
                          disabled={savingLeader}
                          onClick={() => void saveLeaderName()}
                          title="Salvar"
                          aria-label="Salvar"
                          className="app-icon-btn bg-apple-blue text-white hover:bg-apple-blue-hover"
                        >
                          <IconSave className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingLeaderId(null)}
                          title="Cancelar"
                          aria-label="Cancelar"
                          className="app-icon-btn"
                        >
                          <IconX className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="mt-0.5 flex items-center gap-2">
                        <p className="text-[16px] font-semibold tracking-tightish text-apple-ink">
                          {row.assignee_name}
                        </p>
                        <button
                          type="button"
                          onClick={() => startEditLeader(row)}
                          title="Editar dirigente"
                          aria-label="Editar dirigente"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-apple-tertiary transition hover:bg-white hover:text-apple-ink"
                        >
                          <IconPencil className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Modal: finalizar + pessoas no campo */}
      {finishModalId != null ? (
        <div
          className="fixed inset-0 z-[10050] flex items-center justify-center p-4"
          role="presentation"
        >
          <button
            type="button"
            aria-label="Fechar"
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            onClick={closeFinishModal}
            disabled={finishing}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="finish-modal-title"
            className="relative z-10 w-full max-w-md overflow-hidden rounded-[22px] border border-black/[0.06] bg-white shadow-[0_20px_60px_rgba(0,0,0,0.18)]"
          >
            <div className="h-1 w-full bg-[#34c759]" />
            <div className="px-6 pb-6 pt-5">
              <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-full bg-[#34c759]/[0.12] text-[#248a3d]">
                <IconCheckCircle className="h-5 w-5" />
              </div>
              <h2
                id="finish-modal-title"
                className="mt-3 text-[17px] font-semibold tracking-tight text-[#1d1d1f]"
              >
                Finalizar território do dia?
              </h2>
              <p className="mt-1.5 text-[14px] leading-relaxed text-[#6e6e73]">
                O território será registrado em Finalizados, desvinculado do dia e você irá para a
                lista de finalizados.
              </p>

              <div className="mt-5">
                <label htmlFor="finish-people" className="app-label">
                  Pessoas no campo
                </label>
                <input
                  id="finish-people"
                  type="number"
                  min={1}
                  max={999}
                  step={1}
                  inputMode="numeric"
                  value={finishPeople}
                  onChange={(e) => {
                    setFinishPeople(e.target.value);
                    setFinishModalError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void confirmFinishDaily();
                    }
                  }}
                  className="app-input"
                  autoFocus
                  disabled={finishing}
                />
                <p className="mt-1.5 text-[12px] text-[#86868b]">
                  Informe quantas pessoas participaram do campo hoje.
                </p>
              </div>

              {finishModalError ? (
                <p className="mt-3 rounded-[12px] bg-red-50 px-3 py-2 text-[13px] text-[#ff3b30]">
                  {finishModalError}
                </p>
              ) : null}

              <div className="mt-6 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={closeFinishModal}
                  disabled={finishing}
                  className="app-btn-secondary"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void confirmFinishDaily()}
                  disabled={finishing}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[#34c759] px-4 text-[14px] font-medium text-white transition hover:bg-[#2db84d] disabled:opacity-50"
                >
                  <IconCheckCircle className="h-4 w-4" />
                  {finishing ? 'Finalizando…' : 'Finalizar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Não finalizados */}
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="app-section-title">Não finalizados</h2>
          {unfinished.length > 0 ? (
            <span className="app-badge-amber">{unfinished.length}</span>
          ) : null}
        </div>

        {unfinished.length > 0 ? (
          <div className="space-y-2">
            {unfinished.map((item) => (
              <Link
                key={Number(item.id)}
                to={`/territories/${item.id}`}
                className="app-card flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition hover:shadow-card"
              >
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold tracking-tightish text-apple-ink">
                    {item.name}
                  </p>
                  <p className="mt-0.5 text-[13px] text-apple-tertiary">
                    {item.number ? (
                      <>
                        Terr. N.º <span className="font-medium text-apple-secondary">{item.number}</span>
                        {' · '}
                      </>
                    ) : null}
                    {item.unfinished_blocks}{' '}
                    {item.unfinished_blocks === 1 ? 'quadra pendente' : 'quadras pendentes'}
                    {item.pending_houses > 0 ? (
                      <>
                        {' · '}
                        {item.pending_houses} {item.pending_houses === 1 ? 'casa' : 'casas'}
                      </>
                    ) : null}
                  </p>
                </div>
                <span className="shrink-0 text-[13px] font-medium text-apple-blue">Continuar</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="app-empty">
            <p className="text-[15px] font-medium text-apple-ink">Nada pendente</p>
            <p className="mt-1 text-[13px] text-apple-secondary">
              Todas as quadras de “não em casa” estão finalizadas (ou ainda não há registros).
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
