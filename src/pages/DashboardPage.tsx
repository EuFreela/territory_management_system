import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  IconLogOut,
  IconMap,
  IconPencil,
  IconSave,
  IconUnlink,
  IconUsers,
  IconX,
} from '@/components/Map/mapIcons';
import { useConfirm } from '@/components/ui/ConfirmModal';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import type { DashboardData, FieldAssignment, FieldLeadersToday } from '@/lib/types';

export default function DashboardPage() {
  const { user, logout, can } = useAuth();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [data, setData] = useState<DashboardData | null>(null);
  const [leaders, setLeaders] = useState<FieldLeadersToday | null>(null);
  const [error, setError] = useState('');
  const [unlinking, setUnlinking] = useState(false);

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

  async function onLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  async function unlinkDaily(event: React.MouseEvent, territoryId: number) {
    event.preventDefault();
    event.stopPropagation();
    const ok = await confirm({
      title: 'Desvincular território do dia',
      message: 'Este território deixará de ser o destaque do dia. Você poderá marcar outro quando quiser.',
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
      <main className="flex min-h-screen items-center justify-center p-6">
        <p className="text-red-600">{error}</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="flex min-h-screen items-center justify-center text-slate-600">
        Carregando dashboard…
      </main>
    );
  }

  const { daily, unfinished = [] } = data;
  const datedLeaders = leaders?.dated ?? [];
  const fixedLeaders = leaders?.fixed ?? [];

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">
              Olá, {user?.name}
              {user?.role?.name ? (
                <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700">
                  {user.role.name}
                </span>
              ) : null}
            </p>
            <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
          </div>

          <div className="flex items-center gap-2">
            {can('user:manage') ? (
              <Link
                to="/usuarios"
                title="Usuários e papéis"
                aria-label="Usuários e papéis"
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-violet-300 bg-white text-violet-700 hover:bg-violet-50"
              >
                <IconUsers className="h-5 w-5" />
              </Link>
            ) : null}
            <Link
              to="/dirigentes"
              title="Dirigentes"
              aria-label="Dirigentes"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            >
              <IconUsers className="h-5 w-5" />
            </Link>
            {can('territory:read') ? (
              <Link
                to="/territories"
                title="Territórios"
                aria-label="Territórios"
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              >
                <IconMap className="h-5 w-5" />
              </Link>
            ) : null}
            <button
              type="button"
              onClick={onLogout}
              title="Sair"
              aria-label="Sair"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            >
              <IconLogOut className="h-5 w-5" />
            </button>
          </div>
        </header>

        {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

        {/* Território do dia */}
        <section className="mb-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Território do Dia</h2>
          </div>

          {daily ? (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 shadow-sm">
              <Link
                to={`/territories/${daily.id}`}
                className="min-w-0 flex-1 rounded-lg outline-none ring-sky-400 focus-visible:ring-2"
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="rounded-full bg-sky-600 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-white">
                    Do dia
                  </span>
                  <span className="truncate text-base font-bold text-slate-900">{daily.name}</span>
                  {daily.number ? (
                    <span className="text-sm text-slate-600">
                      Terr. N.º <strong>{daily.number}</strong>
                    </span>
                  ) : null}
                  <span className="text-sm font-medium text-sky-700">Abrir cartão →</span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">Clique para ver mapa, áreas e não em casa</p>
              </Link>

              {can('territory:set_daily') ? (
                <button
                  type="button"
                  disabled={unlinking}
                  onClick={(e) => void unlinkDaily(e, daily.id)}
                  title="Desvincular território do dia"
                  aria-label="Desvincular território do dia"
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  <IconUnlink className="h-5 w-5" />
                </button>
              ) : null}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center">
              <p className="text-sm font-medium text-slate-700">Nenhum território do dia</p>
              <p className="mt-1 text-xs text-slate-500">
                Marque um em{' '}
                <Link to="/territories" className="font-medium text-sky-700 underline">
                  Territórios
                </Link>
                .
              </p>
            </div>
          )}
        </section>

        {/* Dirigente(s) do dia — logo abaixo do território */}
        <section className="mb-8">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Dirigente do serviço de campo</h2>
            <Link to="/dirigentes" className="text-sm font-medium text-sky-700">
              Ver escala
            </Link>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {leaders?.weekday_label ?? 'Hoje'}
              {leaders?.date ? ` · ${leaders.date.split('-').reverse().join('/')}` : ''}
            </p>

            {datedLeaders.length === 0 && fixedLeaders.length === 0 ? (
              <p className="mt-2 text-sm text-slate-600">Nenhum dirigente designado para hoje.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {datedLeaders.map((row) => (
                  <div
                    key={row.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-slate-500">Designado ({row.weekday_label})</p>
                      {editingLeaderId === row.id ? (
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <input
                            value={editLeaderName}
                            onChange={(e) => setEditLeaderName(e.target.value)}
                            className="min-w-[12rem] flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                            autoFocus
                          />
                          <button
                            type="button"
                            disabled={savingLeader}
                            onClick={() => void saveLeaderName()}
                            title="Salvar"
                            aria-label="Salvar"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-sky-600 text-white"
                          >
                            <IconSave className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingLeaderId(null)}
                            title="Cancelar"
                            aria-label="Cancelar"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50"
                          >
                            <IconX className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="mt-0.5 flex items-center gap-2">
                          <p className="text-lg font-bold text-slate-900">{row.assignee_name}</p>
                          <button
                            type="button"
                            onClick={() => startEditLeader(row)}
                            title="Editar dirigente"
                            aria-label="Editar dirigente"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-white"
                          >
                            <IconPencil className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {fixedLeaders.map((row) => (
                  <div
                    key={row.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-100 bg-emerald-50/60 px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-emerald-800">
                        Fixo · {row.weekday_label}
                        {row.fixed_time ? ` · ${row.fixed_time}` : ''}
                      </p>
                      {editingLeaderId === row.id ? (
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <input
                            value={editLeaderName}
                            onChange={(e) => setEditLeaderName(e.target.value)}
                            className="min-w-[12rem] flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                            autoFocus
                          />
                          <button
                            type="button"
                            disabled={savingLeader}
                            onClick={() => void saveLeaderName()}
                            title="Salvar"
                            aria-label="Salvar"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-sky-600 text-white"
                          >
                            <IconSave className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingLeaderId(null)}
                            title="Cancelar"
                            aria-label="Cancelar"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50"
                          >
                            <IconX className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="mt-0.5 flex items-center gap-2">
                          <p className="text-base font-bold text-slate-900">{row.assignee_name}</p>
                          <button
                            type="button"
                            onClick={() => startEditLeader(row)}
                            title="Editar dirigente"
                            aria-label="Editar dirigente"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200 bg-white text-slate-600 hover:bg-emerald-50"
                          >
                            <IconPencil className="h-4 w-4" />
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

        {/* Não finalizados */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Não finalizados</h2>
            {unfinished.length > 0 ? (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
                {unfinished.length}
              </span>
            ) : null}
          </div>

          {unfinished.length > 0 ? (
            <div className="space-y-2">
              {unfinished.map((item) => (
                <Link
                  key={Number(item.id)}
                  to={`/territories/${item.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-white px-4 py-3 shadow-sm transition hover:border-amber-300 hover:bg-amber-50/60"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">{item.name}</p>
                    <p className="text-xs text-slate-500">
                      {item.number ? (
                        <>
                          Terr. N.º <strong className="text-slate-700">{item.number}</strong>
                          {' · '}
                        </>
                      ) : null}
                      {item.unfinished_blocks}{' '}
                      {item.unfinished_blocks === 1 ? 'quadra pendente' : 'quadras pendentes'}
                      {item.pending_houses > 0 ? (
                        <>
                          {' · '}
                          {item.pending_houses}{' '}
                          {item.pending_houses === 1 ? 'casa' : 'casas'}
                        </>
                      ) : null}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-medium text-amber-800">Continuar →</span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center">
              <p className="text-sm font-medium text-slate-700">Nada pendente</p>
              <p className="mt-1 text-xs text-slate-500">
                Todas as quadras de “não em casa” estão finalizadas (ou ainda não há registros).
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
