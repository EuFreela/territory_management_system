import { Router } from 'express';
import { z } from 'zod';
import pool from '../lib/db.js';
import { requireAuth, type AuthedRequest } from '../middleware/requireAuth.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { rateLimit } from '../middleware/rateLimit.js';
import {
  resolveWorkingCep,
  resolveWorkingCepDigits,
  sqlCepDigitsEq,
} from '../lib/map-config.js';
import {
  parseScheduleProgram,
  sanitizeScheduleText,
  SCHEDULE_MAX_ITEMS,
  SCHEDULE_TEXT_MAX,
} from '../lib/schedule-import.js';
import { todayIsoInAppTz, weekdayForDateStr } from '../lib/timezone.js';

const router = Router();

const assignmentSchema = z.object({
  service_date: z.string().nullable().optional(),
  weekday_label: z.string().min(1).max(40),
  assignee_name: z.string().min(1, 'Nome do dirigente é obrigatório').max(180),
  period_label: z.string().max(80).nullable().optional(),
  is_fixed: z.boolean().optional(),
  fixed_weekday: z.number().int().min(0).max(6).nullable().optional(),
  /** Horário ou período (ex: 08:00, Noite, Manhã) — vale para fixos e datados */
  fixed_time: z.string().max(40).nullable().optional(),
  sort_order: z.number().int().optional(),
});

const updateNameSchema = z.object({
  assignee_name: z.string().min(1, 'Nome do dirigente é obrigatório').max(180),
});

const importSchema = z.object({
  text: z.string().min(1, 'Cole a programação ou envie um .txt.').max(SCHEDULE_TEXT_MAX),
});

const importLimiter = rateLimit({
  name: 'field-assignments-import',
  windowMs: 15 * 60 * 1000,
  max: 8,
});

const clearProgramLimiter = rateLimit({
  name: 'field-assignments-clear',
  windowMs: 15 * 60 * 1000,
  max: 5,
});

function weekdayLabelPt(day: number) {
  const labels = [
    'Domingo',
    'Segunda-feira',
    'Terça-feira',
    'Quarta-feira',
    'Quinta-feira',
    'Sexta-feira',
    'Sábado',
  ];
  return labels[day] ?? '';
}

function workingDigits(req: AuthedRequest): string {
  return resolveWorkingCepDigits(req.user);
}

/** Lista completa (tabela de designações) — restrita a quem gerencia a escala */
router.get('/', requireAuth, requirePermission('block:manage'), async (req, res) => {
  const digits = workingDigits(req as AuthedRequest);
  const [rows] = await pool.execute(
    `SELECT * FROM field_assignments
     WHERE ${sqlCepDigitsEq('cep')}
     ORDER BY is_fixed ASC,
       COALESCE(service_date, '9999-12-31') ASC,
       fixed_weekday ASC,
       sort_order ASC,
       id ASC`,
    [digits],
  );
  res.json(rows);
});

/**
 * Dirigentes do dia (data por query ?date=YYYY-MM-DD ou hoje local)
 * Retorna designação datada + fixa do dia da semana, se houver.
 */
router.get('/today', requireAuth, requirePermission('territory:read'), async (req, res) => {
  // "Hoje" sempre no fuso Brasil (America/Sao_Paulo), não UTC do servidor
  const dateStr =
    typeof req.query.date === 'string' && req.query.date ? req.query.date : todayIsoInAppTz();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    res.status(400).json({ error: 'Data inválida.' });
    return;
  }

  const weekday = weekdayForDateStr(dateStr);
  const digits = workingDigits(req as AuthedRequest);

  const [datedRows] = await pool.execute(
    `SELECT * FROM field_assignments
     WHERE is_fixed = 0 AND service_date = ? AND ${sqlCepDigitsEq('cep')}
     ORDER BY sort_order ASC, id ASC`,
    [dateStr, digits],
  );

  const [fixedRows] = await pool.execute(
    `SELECT * FROM field_assignments
     WHERE is_fixed = 1 AND fixed_weekday = ? AND ${sqlCepDigitsEq('cep')}
     ORDER BY sort_order ASC, id ASC`,
    [weekday, digits],
  );

  res.json({
    date: dateStr,
    weekday,
    weekday_label: weekdayLabelPt(weekday),
    dated: datedRows,
    fixed: fixedRows,
  });
});

router.post(
  '/import',
  requireAuth,
  requirePermission('block:manage'),
  importLimiter,
  async (req, res) => {
    const parsedBody = importSchema.safeParse(req.body);
    if (!parsedBody.success) {
      res.status(400).json({ error: parsedBody.error.issues[0]?.message ?? 'Dados inválidos.' });
      return;
    }

    const sanitized = sanitizeScheduleText(parsedBody.data.text);
    if (!sanitized.ok) {
      res.status(400).json({ error: sanitized.error });
      return;
    }

    const { items, skipped } = parseScheduleProgram(sanitized.text);
    if (items.length === 0) {
      res.status(400).json({
        error:
          'Nenhuma linha no formato. Use o modelo: 25/08/2026 19:30 Nome  ou  FIXO Terça-feira 08:00 Nome.',
        created: 0,
        skipped,
        duplicates: 0,
      });
      return;
    }

    const user = (req as AuthedRequest).user;
    const cep = resolveWorkingCep(user);
    const digits = resolveWorkingCepDigits(user);
    const conn = await pool.getConnection();
    let created = 0;
    let duplicates = 0;

    try {
      await conn.beginTransaction();
      for (const item of items.slice(0, SCHEDULE_MAX_ITEMS)) {
        if (item.is_fixed) {
          const [existing] = await conn.execute(
            `SELECT id FROM field_assignments
             WHERE is_fixed = 1
               AND fixed_weekday = ?
               AND assignee_name = ?
               AND COALESCE(fixed_time, '') = ?
               AND ${sqlCepDigitsEq('cep')}
             LIMIT 1`,
            [item.fixed_weekday, item.assignee_name, item.fixed_time, digits],
          );
          if ((existing as Array<{ id: number }>).length > 0) {
            duplicates += 1;
            continue;
          }
          await conn.execute(
            `INSERT INTO field_assignments
              (service_date, weekday_label, assignee_name, period_label, is_fixed, fixed_weekday, fixed_time, sort_order, cep)
             VALUES (NULL, ?, ?, NULL, 1, ?, ?, 0, ?)`,
            [
              item.weekday_label,
              item.assignee_name,
              item.fixed_weekday,
              item.fixed_time,
              cep,
            ],
          );
          created += 1;
          continue;
        }

        const [existing] = await conn.execute(
          `SELECT id FROM field_assignments
           WHERE is_fixed = 0
             AND service_date = ?
             AND assignee_name = ?
             AND COALESCE(fixed_time, '') = ?
             AND ${sqlCepDigitsEq('cep')}
           LIMIT 1`,
          [item.service_date, item.assignee_name, item.fixed_time, digits],
        );
        if ((existing as Array<{ id: number }>).length > 0) {
          duplicates += 1;
          continue;
        }
        await conn.execute(
          `INSERT INTO field_assignments
            (service_date, weekday_label, assignee_name, period_label, is_fixed, fixed_weekday, fixed_time, sort_order, cep)
           VALUES (?, ?, ?, ?, 0, NULL, ?, 0, ?)`,
          [
            item.service_date,
            item.weekday_label,
            item.assignee_name,
            item.period_label || null,
            item.fixed_time,
            cep,
          ],
        );
        created += 1;
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      console.error('[field-assignments/import]', err);
      res.status(500).json({ error: 'Não foi possível gravar a programação.' });
      return;
    } finally {
      conn.release();
    }

    res.status(201).json({
      message: 'Programação importada.',
      created,
      skipped,
      duplicates,
    });
  },
);

router.post('/', requireAuth, requirePermission('block:manage'), async (req, res) => {
  const parsed = assignmentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' });
    return;
  }

  const data = parsed.data;
  const isFixed = Boolean(data.is_fixed);
  const scheduleTime = data.fixed_time?.trim() || null;

  const cep = resolveWorkingCep((req as AuthedRequest).user);
  const [result] = await pool.execute(
    `INSERT INTO field_assignments
      (service_date, weekday_label, assignee_name, period_label, is_fixed, fixed_weekday, fixed_time, sort_order, cep)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      isFixed ? null : data.service_date || null,
      data.weekday_label.trim(),
      data.assignee_name.trim(),
      data.period_label ?? null,
      isFixed ? 1 : 0,
      isFixed ? (data.fixed_weekday ?? null) : null,
      scheduleTime,
      data.sort_order ?? 0,
      cep,
    ],
  );

  const insertResult = result as { insertId: number };
  res.status(201).json({ id: insertResult.insertId, message: 'Designação criada.' });
});

router.put('/:id', requireAuth, requirePermission('block:manage'), async (req, res) => {
  const { id } = req.params;
  const digits = workingDigits(req as AuthedRequest);

  // atalho: só atualizar nome
  if (req.body && Object.keys(req.body).length === 1 && 'assignee_name' in req.body) {
    const nameParsed = updateNameSchema.safeParse(req.body);
    if (!nameParsed.success) {
      res.status(400).json({ error: nameParsed.error.issues[0]?.message ?? 'Nome inválido.' });
      return;
    }
    const [result] = await pool.execute(
      `UPDATE field_assignments SET assignee_name = ? WHERE id = ? AND ${sqlCepDigitsEq('cep')}`,
      [nameParsed.data.assignee_name.trim(), id, digits],
    );
    const updateResult = result as { affectedRows?: number };
    if (!updateResult.affectedRows) {
      res.status(404).json({ error: 'Designação não encontrada.' });
      return;
    }
    const [rows] = await pool.execute(
      `SELECT * FROM field_assignments WHERE id = ? AND ${sqlCepDigitsEq('cep')}`,
      [id, digits],
    );
    res.json((rows as unknown[])[0]);
    return;
  }

  const parsed = assignmentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' });
    return;
  }

  const data = parsed.data;
  const isFixed = Boolean(data.is_fixed);
  const scheduleTime = data.fixed_time?.trim() || null;

  const [result] = await pool.execute(
    `UPDATE field_assignments SET
      service_date = ?,
      weekday_label = ?,
      assignee_name = ?,
      period_label = ?,
      is_fixed = ?,
      fixed_weekday = ?,
      fixed_time = ?,
      sort_order = ?
     WHERE id = ? AND ${sqlCepDigitsEq('cep')}`,
    [
      isFixed ? null : data.service_date || null,
      data.weekday_label.trim(),
      data.assignee_name.trim(),
      data.period_label ?? null,
      isFixed ? 1 : 0,
      isFixed ? (data.fixed_weekday ?? null) : null,
      scheduleTime,
      data.sort_order ?? 0,
      id,
      digits,
    ],
  );

  const updateResult = result as { affectedRows?: number };
  if (!updateResult.affectedRows) {
    res.status(404).json({ error: 'Designação não encontrada.' });
    return;
  }

  const [rows] = await pool.execute(
    `SELECT * FROM field_assignments WHERE id = ? AND ${sqlCepDigitsEq('cep')}`,
    [id, digits],
  );
  res.json((rows as unknown[])[0]);
});

router.delete(
  '/program',
  requireAuth,
  requirePermission('block:manage'),
  clearProgramLimiter,
  async (req, res) => {
    const digits = workingDigits(req as AuthedRequest);
    const [result] = await pool.execute(
      `DELETE FROM field_assignments WHERE ${sqlCepDigitsEq('cep')}`,
      [digits],
    );
    const deleted = Number((result as { affectedRows?: number }).affectedRows ?? 0);
    res.json({ deleted, message: 'Programação excluída.' });
  },
);

router.delete('/:id', requireAuth, requirePermission('block:manage'), async (req, res) => {
  const { id } = req.params;
  if (!/^\d+$/.test(String(id))) {
    res.status(400).json({ error: 'Identificador inválido.' });
    return;
  }
  const [result] = await pool.execute(
    `DELETE FROM field_assignments WHERE id = ? AND ${sqlCepDigitsEq('cep')}`,
    [id, workingDigits(req as AuthedRequest)],
  );
  const deleteResult = result as { affectedRows?: number };
  if (!deleteResult.affectedRows) {
    res.status(404).json({ error: 'Designação não encontrada.' });
    return;
  }
  res.json({ message: 'Designação removida.' });
});

export default router;
