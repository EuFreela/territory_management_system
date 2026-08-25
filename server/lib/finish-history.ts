import pool from './db.js';
import { formatCep } from './cep.js';
import { sqlCepDigitsEq } from './map-config.js';
import { todayIsoInAppTz, weekdayForDateStr } from './timezone.js';

function parseHouseNumbers(value: unknown): string[] {
  let list: string[];
  if (Array.isArray(value)) list = value.map(String);
  else if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      list = Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      list = [];
    }
  } else {
    list = [];
  }
  // Casas duplicadas no não em casa contam uma única vez
  return [...new Set(list)];
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
  /** Dígitos do CEP da região — filtra dirigentes e grava no histórico */
  cepDigits?: string | null;
};

/** Lista dirigentes de hoje (datados + fixos), ordenados. Filtra pela região (CEP) quando informado. */
export async function listTodayLeaders(cepDigits?: string | null): Promise<TodayLeaderOption[]> {
  const fieldDate = todayIsoInAppTz();
  const weekday = weekdayForDateStr(fieldDate);
  const digits = cepDigits && /^\d{8}$/.test(cepDigits) ? cepDigits : null;
  const cepClause = digits ? `AND ${sqlCepDigitsEq('cep')}` : '';
  const datedParams = digits ? [fieldDate, digits] : [fieldDate];
  const fixedParams = digits ? [weekday, digits] : [weekday];

  const [dated] = await pool.execute(
    `SELECT id, assignee_name, fixed_time FROM field_assignments
     WHERE is_fixed = 0 AND service_date = ? ${cepClause}
     ORDER BY sort_order ASC, id ASC`,
    datedParams,
  );
  const [fixed] = await pool.execute(
    `SELECT id, assignee_name, fixed_time FROM field_assignments
     WHERE is_fixed = 1 AND fixed_weekday = ? ${cepClause}
     ORDER BY sort_order ASC, id ASC`,
    fixedParams,
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
    'SELECT id, name, number, cep FROM territories WHERE id = ? LIMIT 1',
    [territoryId],
  );
  const territory = (
    tRows as Array<{ id: number; name: string; number: string | null; cep?: string | null }>
  )[0];
  if (!territory) return false;

  const territoryCep = territory.cep ? formatCep(territory.cep) : null;
  const regionDigits = options.cepDigits || (territoryCep ? territoryCep.replace(/\D/g, '') : null);

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

  // Totais de "não em casa" registrados no território no momento da finalização
  const [bRows] = await pool.execute(
    'SELECT name, house_numbers, completed_houses FROM blocks WHERE territory_id = ?',
    [territoryId],
  );
  const blocks = bRows as Array<{
    name: string;
    house_numbers: unknown;
    completed_houses: unknown;
  }>;
  const quadrasCount = new Set(
    blocks.map((b) => String(b.name ?? '').trim() || '—'),
  ).size;
  const ruasCount = blocks.length;
  const casasCount = blocks.reduce(
    (acc, b) => acc + parseHouseNumbers(b.house_numbers).length,
    0,
  );
  const restamCasas = blocks.reduce((acc, b) => {
    const houses = parseHouseNumbers(b.house_numbers);
    const completed = new Set(parseHouseNumbers(b.completed_houses));
    return acc + houses.filter((n) => !completed.has(n)).length;
  }, 0);

  const leaders = await listTodayLeaders(regionDigits);
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
        (territory_id, territory_name, territory_number, cep, field_date, field_time, leader_name,
         people_count, quadras_count, ruas_count, casas_count, restam_casas,
         finished_by_user_id, finished_by_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        territory.id,
        territory.name,
        territory.number ?? null,
        territoryCep,
        fieldDate,
        fieldTime,
        leaderName,
        peopleCount,
        quadrasCount,
        ruasCount,
        casasCount,
        restamCasas,
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
    if (/people_count|finished_by|Unknown column|cep/i.test(msg)) {
      console.warn('[finish-history] colunas novas ausentes — rode migrate:finish-history');
      return false;
    }
    throw err;
  }
}
