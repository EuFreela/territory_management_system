import pool from './db.js';
import { todayIsoInAppTz, weekdayForDateStr } from './timezone.js';

function parseHouseNumbers(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function blockIsFinished(row: Record<string, unknown>) {
  const houses = parseHouseNumbers(row.house_numbers);
  if (houses.length === 0) return false;
  const completed = parseHouseNumbers(row.completed_houses).filter((n) => houses.includes(n));
  return completed.length >= houses.length;
}

/** Todos os blocks do território estão 100% feitos (e há ao menos um block). */
export async function isTerritoryFullyFinished(territoryId: number | string): Promise<boolean> {
  const [rows] = await pool.execute(
    'SELECT house_numbers, completed_houses FROM blocks WHERE territory_id = ?',
    [territoryId],
  );
  const list = rows as Array<Record<string, unknown>>;
  if (list.length === 0) return false;
  return list.every(blockIsFinished);
}

export type TodayLeaderOption = {
  id: number;
  assignee_name: string;
  fixed_time: string | null;
  kind: 'dated' | 'fixed';
  /** Rótulo para UI: "Fabio · 18:00" */
  label: string;
};

export type RecordFinishOptions = {
  /** Número de pessoas no campo (obrigatório ao Finalizar no dashboard) */
  peopleCount?: number | null;
  /** Usuário da sessão que realizou a finalização */
  finishedByUserId?: number | null;
  finishedByName?: string | null;
  /**
   * Dirigente escolhido (field_assignments.id).
   * Obrigatório quando há mais de um dirigente no dia.
   */
  assignmentId?: number | null;
};

/** Lista dirigentes de hoje (datados + fixos), ordenados. */
export async function listTodayLeaders(): Promise<TodayLeaderOption[]> {
  const fieldDate = todayIsoInAppTz();
  const weekday = weekdayForDateStr(fieldDate);

  const [dated] = await pool.execute(
    `SELECT id, assignee_name, fixed_time FROM field_assignments
     WHERE is_fixed = 0 AND service_date = ?
     ORDER BY sort_order ASC, id ASC`,
    [fieldDate],
  );
  const [fixed] = await pool.execute(
    `SELECT id, assignee_name, fixed_time FROM field_assignments
     WHERE is_fixed = 1 AND fixed_weekday = ?
     ORDER BY sort_order ASC, id ASC`,
    [weekday],
  );

  const mapRow = (
    row: { id: number; assignee_name: string; fixed_time: string | null },
    kind: 'dated' | 'fixed',
  ): TodayLeaderOption => {
    const name = String(row.assignee_name ?? '').trim() || '—';
    const time = row.fixed_time?.trim() || null;
    const kindLabel = kind === 'fixed' ? 'Fixo' : 'Designado';
    const label = time ? `${name} · ${time} (${kindLabel})` : `${name} (${kindLabel})`;
    return {
      id: Number(row.id),
      assignee_name: name,
      fixed_time: time,
      kind,
      label,
    };
  };

  return [
    ...(dated as Array<{ id: number; assignee_name: string; fixed_time: string | null }>).map((r) =>
      mapRow(r, 'dated'),
    ),
    ...(fixed as Array<{ id: number; assignee_name: string; fixed_time: string | null }>).map((r) =>
      mapRow(r, 'fixed'),
    ),
  ];
}

/**
 * Sempre insere uma nova linha no histórico (não substitui).
 * Cada finalização do território do dia gera um registro novo.
 */
export async function recordTerritoryFinished(
  territoryId: number | string,
  options: RecordFinishOptions = {},
): Promise<boolean> {
  const [tRows] = await pool.execute(
    'SELECT id, name, number FROM territories WHERE id = ? LIMIT 1',
    [territoryId],
  );
  const territory = (tRows as Array<{ id: number; name: string; number: string | null }>)[0];
  if (!territory) return false;

  const fieldDate = todayIsoInAppTz();
  const peopleCount =
    options.peopleCount != null && Number.isFinite(options.peopleCount)
      ? Math.max(0, Math.floor(Number(options.peopleCount)))
      : null;
  const finishedByUserId =
    options.finishedByUserId != null && Number.isFinite(Number(options.finishedByUserId))
      ? Number(options.finishedByUserId)
      : null;
  const finishedByName = options.finishedByName?.trim() || null;

  const leaders = await listTodayLeaders();
  let leaderName: string | null = null;
  let fieldTime: string | null = null;

  if (options.assignmentId != null && Number.isFinite(Number(options.assignmentId))) {
    const chosen = leaders.find((l) => l.id === Number(options.assignmentId));
    if (!chosen) {
      throw new Error('DIRIGENTE_INVALIDO');
    }
    leaderName = chosen.assignee_name;
    fieldTime = chosen.fixed_time;
  } else if (leaders.length === 1) {
    leaderName = leaders[0].assignee_name;
    fieldTime = leaders[0].fixed_time;
  } else if (leaders.length > 1) {
    throw new Error('DIRIGENTE_OBRIGATORIO');
  }

  try {
    await pool.execute(
      `INSERT INTO territory_finish_history
        (territory_id, territory_name, territory_number, field_date, field_time, leader_name,
         people_count, finished_by_user_id, finished_by_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        territory.id,
        territory.name,
        territory.number ?? null,
        fieldDate,
        fieldTime,
        leaderName,
        peopleCount,
        finishedByUserId,
        finishedByName,
      ],
    );
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'DIRIGENTE_OBRIGATORIO' || msg === 'DIRIGENTE_INVALIDO') throw err;
    if (/territory_finish_history|doesn't exist|Unknown table/i.test(msg)) {
      console.warn('[finish-history] tabela ausente — rode npm run migrate:finish-history');
      return false;
    }
    if (/people_count|finished_by|Unknown column/i.test(msg)) {
      console.warn('[finish-history] colunas novas ausentes — rode migrate:finish-history');
      return false;
    }
    throw err;
  }
}
