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

export type RecordFinishOptions = {
  /** Número de pessoas no campo (obrigatório ao Finalizar no dashboard) */
  peopleCount?: number | null;
  /** Usuário da sessão que realizou a finalização */
  finishedByUserId?: number | null;
  finishedByName?: string | null;
};

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
  const weekday = weekdayForDateStr(fieldDate);
  const peopleCount =
    options.peopleCount != null && Number.isFinite(options.peopleCount)
      ? Math.max(0, Math.floor(Number(options.peopleCount)))
      : null;
  const finishedByUserId =
    options.finishedByUserId != null && Number.isFinite(Number(options.finishedByUserId))
      ? Number(options.finishedByUserId)
      : null;
  const finishedByName = options.finishedByName?.trim() || null;

  // Dirigentes do dia (datados + fixos)
  const [dated] = await pool.execute(
    `SELECT assignee_name, fixed_time FROM field_assignments
     WHERE is_fixed = 0 AND service_date = ?
     ORDER BY sort_order ASC, id ASC`,
    [fieldDate],
  );
  const [fixed] = await pool.execute(
    `SELECT assignee_name, fixed_time FROM field_assignments
     WHERE is_fixed = 1 AND fixed_weekday = ?
     ORDER BY sort_order ASC, id ASC`,
    [weekday],
  );

  const leaders = [
    ...(dated as Array<{ assignee_name: string; fixed_time: string | null }>),
    ...(fixed as Array<{ assignee_name: string; fixed_time: string | null }>),
  ];

  const leaderName =
    leaders
      .map((l) => l.assignee_name?.trim())
      .filter(Boolean)
      .join(', ') || null;

  const fieldTime = leaders.map((l) => l.fixed_time?.trim()).find((t) => t) || null;

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

/**
 * Auto-registro ao completar checklist: não grava sozinho no histórico.
 * O histórico só recebe linha no botão Finalizar do território do dia
 * (para não gerar linhas sem pessoas / duplicadas sem ação explícita).
 */
export async function maybeRecordTerritoryFinished(_territoryId: number | string): Promise<boolean> {
  return false;
}
