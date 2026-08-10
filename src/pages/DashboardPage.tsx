import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  IconCheckCircle,
  IconChevronRight,
  IconPencil,
  IconSave,
  IconStar,
  IconUnlink,
  IconX,
} from '@/components/Map/mapIcons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { confirmToast } from '@/lib/confirm-toast';
import { toast } from 'sonner';
import { LoadingBox } from '@/components/ui/Spinner';
import DailyTerritoryModal from '@/components/territory/DailyTerritoryModal';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import type { DashboardData, FieldAssignment, FieldLeadersToday } from '@/lib/types';

export default function DashboardPage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [leaders, setLeaders] = useState<FieldLeadersToday | null>(null);
  const [error, setError] = useState('');
  const [unlinking, setUnlinking] = useState(false);
  const [finishing, setFinishing] = useState(false);
  /** Modal finalizar: território + pessoas + dirigente (se houver mais de um) */
  const [finishModalId, setFinishModalId] = useState<number | null>(null);
  const [finishPeople, setFinishPeople] = useState('1');
  /** id de field_assignments — vazio = não escolhido */
  const [finishLeaderId, setFinishLeaderId] = useState('');
  const [finishModalError, setFinishModalError] = useState('');
  /** Casas de "não em casa" pendentes do território sendo finalizado */
  const [finishPendingNaoEmCasa, setFinishPendingNaoEmCasa] = useState(0);
  /** Modal de vínculo território do dia ↔ dirigente */
  const [dailyModal, setDailyModal] = useState<
    | { kind: 'for-territory'; territoryId: number }
    | { kind: 'for-leader'; assignmentId: number }
    | null
  >(null);

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

  function unlinkDaily(event: React.MouseEvent, territoryId: number) {
    event.preventDefault();
    event.stopPropagation();
    confirmToast({
      title: 'Desvincular território do dia',
      description:
        'Este território deixará de ser o destaque do dia. Você poderá marcar outro quando quiser.',
      confirmLabel: 'Desvincular',
      onConfirm: async () => {
        setUnlinking(true);
        try {
          await api(`/api/territories/${territoryId}/daily`, { method: 'DELETE' });
          await load();
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Erro ao desvincular.');
        } finally {
          setUnlinking(false);
        }
      },
    });
  }

  function openFinishModal(event: React.MouseEvent, territoryId: number) {
    event.preventDefault();
    event.stopPropagation();
    const d = (data?.daily ?? []).find((x) => Number(x.id) === territoryId);
    setFinishModalId(territoryId);
    setFinishPeople('1');
    setFinishModalError('');
    setFinishPendingNaoEmCasa(
      d?.blocks?.reduce((acc, b) => {
        const houses = new Set((b.house_numbers ?? []).map(String));
        const completed = new Set((b.completed_houses ?? []).map(String));
        return acc + [...houses].filter((n) => !completed.has(n)).length;
      }, 0) ?? 0,
    );
    const todayLeaders = [...(leaders?.dated ?? []), ...(leaders?.fixed ?? [])];
    // Vinculado a um dirigente: pré-seleciona; vários: usuário escolhe; nenhum: sem campo
    const linked = d?.assignment_id != null ? String(d.assignment_id) : '';
    setFinishLeaderId(todayLeaders.some((l) => String(l.id) === linked) ? linked : '');
  }

  function closeFinishModal() {
    if (finishing) return;
    setFinishModalId(null);
    setFinishPeople('1');
    setFinishLeaderId('');
    setFinishModalError('');
  }

  /** Finaliza: grava no histórico (com pessoas e dirigente), desvincula do dia e vai para Finalizados */
  async function confirmFinishDaily() {
    if (finishModalId == null) return;
    const people = Number(finishPeople);
    if (!Number.isFinite(people) || people < 1 || people > 999) {
      setFinishModalError('Informe quantas pessoas estavam no campo (mínimo 1).');
      return;
    }

    const todayLeaders = [...(leaders?.dated ?? []), ...(leaders?.fixed ?? [])];
    if (todayLeaders.length > 1 && !finishLeaderId) {
      setFinishModalError('Selecione o dirigente deste horário.');
      return;
    }

    setFinishing(true);
    setFinishModalError('');
    setError('');
    try {
      const body: { people_count: number; assignment_id?: number } = {
        people_count: Math.floor(people),
      };
      if (finishLeaderId) {
        body.assignment_id = Number(finishLeaderId);
      }
      await api(`/api/territories/${finishModalId}/finish`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (finishPendingNaoEmCasa > 0) {
        toast.warning(
          finishPendingNaoEmCasa === 1
            ? 'Atenção: ainda faltou 1 casa para fazer no não em casa.'
            : `Atenção: ainda faltaram ${finishPendingNaoEmCasa} casas para fazer no não em casa.`,
        );
      }
      setFinishModalId(null);
      setFinishPeople('1');
      setFinishLeaderId('');
      await load();
      navigate('/territories/finalizados');
    } catch (err) {
      setFinishModalError(err instanceof Error ? err.message : 'Erro ao finalizar território.');
    } finally {
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
      <main className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-10">
        <Card>
          <CardContent className="flex flex-col items-start gap-3 pt-4">
            <p className="text-sm text-destructive">{error}</p>
            <Button type="button" variant="outline" onClick={() => window.location.reload()}>
              Recarregar
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-10">
        <LoadingBox label="Carregando…" className="min-h-[16rem]" />
      </main>
    );
  }

  const daily = data.daily ?? [];
  const unfinished = data.unfinished ?? [];
  const datedLeaders = leaders?.dated ?? [];
  const fixedLeaders = leaders?.fixed ?? [];
  const finishLeaderOptions = [...datedLeaders, ...fixedLeaders];

  // Mapa: dirigente do dia ↔ território do dia (um por dirigente)
  const dailyByAssignment = new Map<number, (typeof daily)[number]>();
  for (const d of daily) {
    if (d.assignment_id != null) dailyByAssignment.set(Number(d.assignment_id), d);
  }

  const leaderDailyCards = [...datedLeaders, ...fixedLeaders].map((leader) => ({
    leader,
    daily: dailyByAssignment.get(Number(leader.id)) ?? null,
  }));

  // Territórios do dia sem dirigente (legado) ou cujo dirigente não está na escala de hoje
  const orphanDaily = daily.filter(
    (d) => d.assignment_id == null || !leaderDailyCards.some((c) => c.daily?.id === d.id),
  );

  const sectionTitle =
    'text-xs font-semibold uppercase tracking-wider text-muted-foreground';

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-10">
      <header className="mb-10">
        <p className="text-sm font-medium text-muted-foreground">Visão geral</p>
        <h1 className="mt-1 text-[1.75rem] font-semibold tracking-tight sm:text-[2rem]">Início</h1>
        <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">
          Território do dia, dirigentes e o que ainda falta.
        </p>
      </header>

      {error ? (
        <div className="mb-6 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <span>{error}</span>
        </div>
      ) : null}

      {/* Dirigentes */}
      <section className="mb-10">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className={sectionTitle}>Dirigente do serviço de campo</h2>
          <Link
            to="/dirigentes"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Ver escala
          </Link>
        </div>

        <Card>
          <CardContent className="space-y-3 pt-4">
            <p className="text-sm text-muted-foreground">
              {leaders?.weekday_label ?? 'Hoje'}
              {leaders?.date ? ` · ${leaders.date.split('-').reverse().join('/')}` : ''}
            </p>

            {datedLeaders.length === 0 && fixedLeaders.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum dirigente designado para hoje.</p>
            ) : (
              <div className="space-y-2">
                {datedLeaders.map((row) => (
                  <div
                    key={row.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/40 px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        Designado ({row.weekday_label}
                        {row.fixed_time ? ` · ${row.fixed_time}` : ''})
                      </p>
                      {editingLeaderId === row.id ? (
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <Input
                            value={editLeaderName}
                            onChange={(e) => setEditLeaderName(e.target.value)}
                            className="h-8 w-full min-w-[12rem] max-w-[16rem] flex-1"
                            autoFocus
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            disabled={savingLeader}
                            onClick={() => void saveLeaderName()}
                            aria-label="Salvar"
                          >
                            <IconSave />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingLeaderId(null)}
                            aria-label="Cancelar"
                          >
                            <IconX />
                          </Button>
                        </div>
                      ) : (
                        <div className="mt-0.5 flex items-center gap-2">
                          <p className="text-base font-semibold tracking-tight">
                            {row.assignee_name}
                          </p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => startEditLeader(row)}
                            aria-label="Editar dirigente"
                          >
                            <IconPencil />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {fixedLeaders.map((row) => (
                  <div
                    key={row.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-300/60 bg-emerald-50 px-4 py-3 dark:border-emerald-500/30 dark:bg-emerald-500/10"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                        Fixo · {row.weekday_label}
                        {row.fixed_time ? ` · ${row.fixed_time}` : ''}
                      </p>
                      {editingLeaderId === row.id ? (
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <Input
                            value={editLeaderName}
                            onChange={(e) => setEditLeaderName(e.target.value)}
                            className="h-8 w-full min-w-[12rem] max-w-[16rem] flex-1"
                            autoFocus
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            disabled={savingLeader}
                            onClick={() => void saveLeaderName()}
                            aria-label="Salvar"
                          >
                            <IconSave />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingLeaderId(null)}
                            aria-label="Cancelar"
                          >
                            <IconX />
                          </Button>
                        </div>
                      ) : (
                        <div className="mt-0.5 flex items-center gap-2">
                          <p className="text-base font-semibold tracking-tight">
                            {row.assignee_name}
                          </p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => startEditLeader(row)}
                            aria-label="Editar dirigente"
                          >
                            <IconPencil />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Territórios do dia — um por dirigente */}
      <section className="mb-10">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className={sectionTitle}>Território do dia</h2>
          {daily.length > 0 ? <Badge>{daily.length}</Badge> : null}
        </div>

        {leaderDailyCards.length === 0 && orphanDaily.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center py-10 text-center">
              <p className="text-sm font-medium">Nenhum território do dia</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Marque um em{' '}
                <Link
                  to="/territories"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Territórios
                </Link>{' '}
                e escolha o dirigente da escala de hoje.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {leaderDailyCards.map(({ leader, daily: cardDaily }) => {
              const leaderLabel = leader.fixed_time?.trim()
                ? `${leader.assignee_name} · ${leader.fixed_time}`
                : leader.assignee_name;
              return (
                <Card key={leader.id}>
                  <CardContent className="space-y-3 pt-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="flex items-center gap-2 text-sm font-semibold">
                        <IconStar className="size-4 text-primary" />
                        {leaderLabel}
                      </p>
                      <Badge variant={leader.is_fixed ? 'secondary' : 'outline'}>
                        {leader.is_fixed ? 'Fixo' : 'Designado'}
                      </Badge>
                    </div>

                    {cardDaily ? (
                      <div className="flex flex-wrap items-center gap-4">
                        <Link to={`/territories/${cardDaily.id}`} className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <Badge className="bg-blue-600/10 text-blue-700 hover:bg-blue-600/15 dark:bg-blue-500/15 dark:text-blue-300">
                              Do dia
                            </Badge>
                            <span className="text-base font-semibold tracking-tight">
                              {cardDaily.name}
                            </span>
                            {cardDaily.number ? (
                              <span className="text-sm text-muted-foreground">
                                Terr. N.º{' '}
                                <span className="font-medium text-foreground">
                                  {cardDaily.number}
                                </span>
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Toque para abrir mapa e checklist.
                          </p>
                        </Link>

                        <div className="flex items-center gap-2">
                          {can('territory:set_daily') ? (
                            <Button
                              type="button"
                              disabled={finishing || unlinking}
                              onClick={(e) => openFinishModal(e, Number(cardDaily.id))}
                              data-tooltip="Finaliza campo"
                              aria-label="Finalizar território do dia"
                              className="bg-emerald-600 text-white hover:bg-emerald-700"
                            >
                              <IconCheckCircle />
                              <span className="hidden sm:inline">Finalizar</span>
                            </Button>
                          ) : null}
                          {can('territory:set_daily') ? (
                            <>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                disabled={unlinking || finishing}
                                onClick={() =>
                                  setDailyModal({
                                    kind: 'for-leader',
                                    assignmentId: Number(leader.id),
                                  })
                                }
                                data-tooltip="Trocar território do dia"
                                aria-label="Trocar território do dia"
                              >
                                <IconStar />
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                disabled={unlinking || finishing}
                                onClick={(e) => void unlinkDaily(e, Number(cardDaily.id))}
                                data-tooltip="Desvincular território do dia"
                                aria-label="Desvincular território do dia"
                              >
                                <IconUnlink />
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm text-muted-foreground">
                          Sem território do dia marcado para este dirigente.
                        </p>
                        {can('territory:set_daily') ? (
                          <Button
                            type="button"
                            onClick={() =>
                              setDailyModal({
                                kind: 'for-leader',
                                assignmentId: Number(leader.id),
                              })
                            }
                          >
                            <IconStar />
                            Marcar território do dia
                          </Button>
                        ) : null}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}

            {orphanDaily.map((d) => (
              <Card key={d.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Sem dirigente na escala
                    </p>
                    <p className="mt-0.5 text-base font-semibold">
                      {d.name}
                      {d.number ? (
                        <span className="ml-1 font-normal text-muted-foreground">
                          · N.º {d.number}
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {can('territory:set_daily') ? (
                      <Button
                        type="button"
                        disabled={finishing || unlinking}
                        onClick={(e) => openFinishModal(e, Number(d.id))}
                        data-tooltip="Finaliza campo"
                        aria-label="Finalizar território do dia"
                        className="bg-emerald-600 text-white hover:bg-emerald-700"
                      >
                        <IconCheckCircle />
                        <span className="hidden sm:inline">Finalizar</span>
                      </Button>
                    ) : null}
                    {can('territory:set_daily') ? (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() =>
                            setDailyModal({ kind: 'for-territory', territoryId: Number(d.id) })
                          }
                          data-tooltip="Vincular a um dirigente"
                          aria-label="Vincular a um dirigente"
                        >
                          <IconStar />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          disabled={unlinking || finishing}
                          onClick={(e) => void unlinkDaily(e, Number(d.id))}
                          data-tooltip="Desvincular território do dia"
                          aria-label="Desvincular território do dia"
                        >
                          <IconUnlink />
                        </Button>
                      </>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Modal: finalizar + pessoas no campo */}
      {finishModalId != null ? (
        <Dialog
          open={finishModalId != null}
          onOpenChange={(open) => {
            if (!open) closeFinishModal();
          }}
        >
          <DialogContent className="sm:max-w-md" showCloseButton={false}>
            <DialogHeader>
              <DialogTitle>Finalizar território do dia?</DialogTitle>
              <DialogDescription>
                Será gravado em{' '}
                <span className="font-medium text-foreground">Finalizados</span> (dia, horário,
                dirigente, pessoas e quem registrou), o território sai do dia e você vai para a
                lista de finalizados.
              </DialogDescription>
            </DialogHeader>

            {finishPendingNaoEmCasa > 0 ? (
              <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm dark:border-amber-500/40 dark:bg-amber-500/10">
                <span className="font-semibold">Atenção:</span> ainda{' '}
                {finishPendingNaoEmCasa === 1
                  ? 'falta 1 casa'
                  : `faltam ${finishPendingNaoEmCasa} casas`}{' '}
                para fazer no não em casa.
              </p>
            ) : null}

            <div className="space-y-4">
              {finishLeaderOptions.length > 1 ? (
                <div className="grid gap-1.5">
                  <Label htmlFor="finish-leader">Dirigente</Label>
                  <select
                    id="finish-leader"
                    value={finishLeaderId}
                    onChange={(e) => {
                      setFinishLeaderId(e.target.value);
                      setFinishModalError('');
                    }}
                    className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-muted"
                    disabled={finishing}
                    required
                    autoFocus
                  >
                    <option value="">Selecione o dirigente…</option>
                    {finishLeaderOptions.map((row) => {
                      const kind = row.is_fixed ? 'Fixo' : 'Designado';
                      const time = row.fixed_time?.trim();
                      const label = time
                        ? `${row.assignee_name} · ${time} (${kind})`
                        : `${row.assignee_name} (${kind})`;
                      return (
                        <option key={row.id} value={row.id}>
                          {label}
                        </option>
                      );
                    })}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Há mais de um dirigente hoje — escolha quem dirigiu este território.
                  </p>
                </div>
              ) : finishLeaderOptions.length === 1 ? (
                <div className="rounded-lg border bg-muted/40 px-3.5 py-2.5">
                  <p className="text-xs font-medium text-muted-foreground">Dirigente</p>
                  <p className="mt-0.5 text-base font-semibold">
                    {finishLeaderOptions[0].assignee_name}
                    {finishLeaderOptions[0].fixed_time?.trim()
                      ? ` · ${finishLeaderOptions[0].fixed_time}`
                      : ''}
                  </p>
                </div>
              ) : (
                <p className="rounded-lg border bg-muted/40 px-3.5 py-2.5 text-sm text-muted-foreground">
                  Nenhum dirigente na escala de hoje — o histórico ficará sem dirigente.
                </p>
              )}

              <div className="grid gap-1.5">
                <Label htmlFor="finish-people">Pessoas no campo</Label>
                <Input
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
                  autoFocus={finishLeaderOptions.length <= 1}
                  disabled={finishing}
                />
                <p className="text-xs text-muted-foreground">
                  Informe quantas pessoas participaram do campo neste horário.
                </p>
              </div>
            </div>

            {finishModalError ? (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {finishModalError}
              </p>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeFinishModal}
                disabled={finishing}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() => void confirmFinishDaily()}
                disabled={finishing}
                className="bg-emerald-600 text-white hover:bg-emerald-700"
              >
                <IconCheckCircle />
                {finishing ? 'Finalizando…' : 'Finalizar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      {/* Não finalizados */}
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className={sectionTitle}>Não finalizados</h2>
          {unfinished.length > 0 ? <Badge variant="secondary">{unfinished.length}</Badge> : null}
        </div>

        {unfinished.length > 0 ? (
          <div className="space-y-2">
            {unfinished.map((item) => (
              <Link
                key={Number(item.id)}
                to={`/territories/${item.id}`}
                className="group flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3.5 transition-colors hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold tracking-tight">{item.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {item.number ? (
                      <>
                        Terr. N.º <span className="font-medium text-foreground">{item.number}</span>
                        {' · '}
                      </>
                    ) : null}
                    {(() => {
                      const quadras = item.unfinished_quadras ?? item.unfinished_blocks;
                      const ruas = item.unfinished_streets ?? item.unfinished_blocks;
                      const casas = item.open_house_numbers ?? item.pending_houses;
                      const parts: string[] = [];
                      parts.push(
                        `${quadras} ${quadras === 1 ? 'quadra' : 'quadras'}`,
                      );
                      parts.push(`${ruas} ${ruas === 1 ? 'rua' : 'ruas'}`);
                      if (casas > 0) {
                        parts.push(`${casas} ${casas === 1 ? 'casa' : 'casas'}`);
                      }
                      return parts.join(' · ');
                    })()}
                  </p>
                </div>
                <IconChevronRight className="size-4 shrink-0 text-muted-foreground transition group-hover:text-foreground" />
              </Link>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center py-10 text-center">
              <p className="text-sm font-medium">Nada pendente</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Todas as quadras de “não em casa” estão finalizadas (ou ainda não há registros).
              </p>
            </CardContent>
          </Card>
        )}
      </section>

      {dailyModal ? (
        <DailyTerritoryModal
          territoryId={
            dailyModal.kind === 'for-territory' ? dailyModal.territoryId : undefined
          }
          assignmentId={
            dailyModal.kind === 'for-leader' ? dailyModal.assignmentId : undefined
          }
          onClose={() => setDailyModal(null)}
          onDone={() => void load()}
        />
      ) : null}
    </main>
  );
}
