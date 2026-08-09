import { Router } from 'express';
import pool from '../lib/db.js';
import { recordTerritoryFinished } from '../lib/finish-history.js';
import { getMapConfig } from '../lib/map-config.js';
import { territorySchema, blockSchema, toggleHouseSchema } from '../lib/validations.js';
import { requireAuth, type AuthedRequest } from '../middleware/requireAuth.js';
import { requireAdmin, requirePermission } from '../middleware/requirePermission.js';

const router = Router();

function isValidTerritoryGeoJson(geojson: string): boolean {
  try {
    const parsed = JSON.parse(geojson) as {
      type?: string;
      features?: Array<{
        geometry?: { type?: string; coordinates?: unknown };
        properties?: { kind?: string };
      }>;
      geometry?: { type?: string; coordinates?: unknown };
      coordinates?: unknown;
    };

    const rings: number[][][] = [];

    if (parsed.type === 'FeatureCollection' && Array.isArray(parsed.features)) {
      for (const feature of parsed.features) {
        // Notas (Point) e outros tipos não contam como área do território
        if (feature?.properties?.kind === 'note') continue;
        if (feature?.geometry?.type && feature.geometry.type !== 'Polygon') continue;
        const coords = feature?.geometry?.coordinates;
        const ring = Array.isArray(coords) ? (coords as number[][][])[0] : null;
        if (Array.isArray(ring) && Array.isArray(ring[0])) rings.push(ring);
      }
    } else if (parsed?.geometry?.type !== 'Point') {
      const coords = parsed?.geometry?.coordinates ?? parsed?.coordinates;
      const ring = Array.isArray(coords) ? (coords as number[][][])[0] : null;
      if (Array.isArray(ring) && Array.isArray(ring[0])) rings.push(ring);
    }

    return rings.some((ring) => ring.length >= 4);
  } catch {
    return false;
  }
}

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

function mapBlock(row: Record<string, unknown>) {
  const house_numbers = parseHouseNumbers(row.house_numbers);
  const completed_houses = parseHouseNumbers(row.completed_houses).filter((n) =>
    house_numbers.includes(n),
  );
  const done_count = completed_houses.length;
  const total = house_numbers.length;
  return {
    ...row,
    house_numbers,
    completed_houses,
    done_count,
    total,
    is_finished: total > 0 && done_count >= total,
  };
}

/** Territórios são compartilhados (congregação); RBAC controla o que cada papel pode fazer. */
async function findTerritory(id: string | number) {
  const [rows] = await pool.execute('SELECT * FROM territories WHERE id = ?', [String(id)]);
  return (rows as Array<Record<string, unknown>>)[0] ?? null;
}

function paramId(value: string | string[]): string {
  return Array.isArray(value) ? String(value[0]) : String(value);
}

router.get('/', requireAuth, requirePermission('territory:read'), async (_req, res) => {
  // Lista por Terr. N.º (numérico); sem número por último; desempate por nome
  const [rows] = await pool.execute(
    `SELECT * FROM territories
     ORDER BY
       CASE WHEN number IS NULL OR TRIM(number) = '' THEN 1 ELSE 0 END ASC,
       CAST(number AS UNSIGNED) ASC,
       number ASC,
       name ASC`,
  );
  res.json(rows);
});

router.get('/dashboard', requireAuth, requirePermission('territory:read'), async (req, res) => {
  const user = (req as AuthedRequest).user;

  const [territories] = await pool.execute(
    `SELECT * FROM territories
     ORDER BY
       CASE WHEN number IS NULL OR TRIM(number) = '' THEN 1 ELSE 0 END ASC,
       CAST(number AS UNSIGNED) ASC,
       number ASC,
       name ASC`,
  );
  const territoryList = territories as Array<Record<string, unknown>>;

  const [dailyRows] = await pool.execute(
    'SELECT * FROM territories WHERE is_daily = 1 LIMIT 1',
  );
  const dailyList = dailyRows as Array<Record<string, unknown>>;
  const daily = dailyList[0] ?? null;

  const [allBlockRows] = await pool.execute(
    `SELECT b.* FROM blocks b
     INNER JOIN territories t ON t.id = b.territory_id
     ORDER BY b.sort_order ASC, b.id ASC`,
  );
  const allBlocks = (allBlockRows as Array<Record<string, unknown>>).map((row) => ({
    ...mapBlock(row),
    territory_id: Number(row.territory_id),
  }));

  const blocksByTerritory = new Map<number, (typeof allBlocks)[number][]>();
  for (const block of allBlocks) {
    const tid = Number(block.territory_id);
    const list = blocksByTerritory.get(tid) ?? [];
    list.push(block);
    blocksByTerritory.set(tid, list);
  }

  let dailyBlocks: (typeof allBlocks)[number][] = [];
  if (daily) {
    dailyBlocks = blocksByTerritory.get(Number(daily.id)) ?? [];
  }

  const dailyFinished =
    dailyBlocks.length > 0 && dailyBlocks.every((b) => Boolean(b.is_finished));

  const unfinished = territoryList
    .map((t) => {
      const blocks = blocksByTerritory.get(Number(t.id)) ?? [];
      const openBlocks = blocks.filter((b) => !b.is_finished);
      if (openBlocks.length === 0) return null;

      // Quadra = name (várias ruas = vários blocks com o mesmo name)
      const unfinishedQuadras = new Set(
        openBlocks.map((b) => String((b as { name?: string }).name ?? '').trim().toLowerCase()),
      );
      const pendingHouses = openBlocks.reduce(
        (sum, b) => sum + Math.max(0, (b.total as number) - (b.done_count as number)),
        0,
      );
      const pendingHouseNumbers = openBlocks.reduce((sum, b) => sum + (b.total as number), 0);

      return {
        ...t,
        /** @deprecated use unfinished_streets — contagem de registros/ruas abertas */
        unfinished_blocks: openBlocks.length,
        unfinished_streets: openBlocks.length,
        unfinished_quadras: unfinishedQuadras.size,
        total_blocks: blocks.length,
        total_streets: blocks.length,
        pending_houses: pendingHouses,
        /** total de números de casa nas ruas ainda incompletas */
        open_house_numbers: pendingHouseNumbers,
        blocks: openBlocks,
      };
    })
    .filter(Boolean);

  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
      isAdmin: user.isAdmin,
    },
    territories: territoryList,
    daily: daily
      ? { ...daily, blocks: dailyBlocks, is_finished: dailyFinished }
      : null,
    unfinished,
  });
});

/** Histórico de territórios finalizados (dia, horário, dirigente) */
router.get(
  '/finished-history',
  requireAuth,
  requirePermission('territory:read'),
  async (_req, res) => {
    try {
      const [rows] = await pool.execute(
        `SELECT id, territory_id, territory_name, territory_number,
                field_date, field_time, leader_name, people_count,
                finished_by_user_id, finished_by_name, finished_at
         FROM territory_finish_history
         ORDER BY field_date DESC, finished_at DESC, id DESC`,
      );
      res.json(rows);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (/doesn't exist|Unknown table|territory_finish_history/i.test(msg)) {
        res.status(503).json({
          error: 'Histórico ainda não configurado. Rode: npm run migrate:finish-history',
        });
        return;
      }
      console.error('[finished-history]', error);
      res.status(500).json({ error: 'Erro ao carregar histórico.' });
    }
  },
);

/** Remove uma linha do histórico — apenas administrador */
router.delete(
  '/finished-history/:historyId',
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const historyId = paramId(req.params.historyId);
    try {
      const [result] = await pool.execute(
        'DELETE FROM territory_finish_history WHERE id = ?',
        [historyId],
      );
      const deleteResult = result as { affectedRows?: number };
      if (!deleteResult.affectedRows) {
        res.status(404).json({ error: 'Registro do histórico não encontrado.' });
        return;
      }
      res.json({ message: 'Registro removido do histórico.' });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (/doesn't exist|Unknown table|territory_finish_history/i.test(msg)) {
        res.status(503).json({
          error: 'Histórico ainda não configurado. Rode: npm run migrate:finish-history',
        });
        return;
      }
      console.error('[finished-history/delete]', error);
      res.status(500).json({ error: 'Erro ao remover do histórico.' });
    }
  },
);

router.post('/', requireAuth, requirePermission('territory:create'), async (req, res) => {
  const user = (req as AuthedRequest).user;
  const parsed = territorySchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' });
    return;
  }

  const { name, number, geojson, is_daily } = parsed.data;

  if (!isValidTerritoryGeoJson(geojson)) {
    res.status(400).json({
      error: 'Área inválida. Desenhe ao menos um contorno no mapa (mínimo 3 pontos).',
    });
    return;
  }

  let location;
  try {
    location = await getMapConfig();
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'CEP do sistema (TERRITORY_CEP) inválido.',
    });
    return;
  }

  if (is_daily) {
    await pool.execute('UPDATE territories SET is_daily = 0');
  }

  const [result] = await pool.execute(
    `INSERT INTO territories (user_id, name, number, cep, geojson, map_lat, map_lng, is_daily)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      user.id,
      name.trim(),
      number ?? null,
      location.cep,
      geojson,
      location.lat,
      location.lng,
      is_daily ? 1 : 0,
    ],
  );

  const insertResult = result as { insertId: number };
  res.status(201).json({
    id: insertResult.insertId,
    message: 'Território criado com sucesso.',
    cep: location.cep,
    map_lat: location.lat,
    map_lng: location.lng,
    address: location.label,
  });
});

router.get('/:id', requireAuth, requirePermission('territory:read'), async (req, res) => {
  const id = paramId(req.params.id);
  const territory = await findTerritory(id);

  if (!territory) {
    res.status(404).json({ error: 'Território não encontrado.' });
    return;
  }

  const [blockRows] = await pool.execute(
    'SELECT * FROM blocks WHERE territory_id = ? ORDER BY sort_order ASC',
    [id],
  );

  const blocks = (blockRows as Array<Record<string, unknown>>).map(mapBlock);

  res.json({ ...territory, blocks });
});

router.put('/:id', requireAuth, requirePermission('territory:update'), async (req, res) => {
  const id = paramId(req.params.id);
  const parsed = territorySchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' });
    return;
  }

  const existing = await findTerritory(id);
  if (!existing) {
    res.status(404).json({ error: 'Território não encontrado.' });
    return;
  }

  const { name, number, geojson } = parsed.data;

  if (!isValidTerritoryGeoJson(geojson)) {
    res.status(400).json({
      error: 'Área inválida. Desenhe ao menos um contorno no mapa (mínimo 3 pontos).',
    });
    return;
  }

  let location;
  try {
    location = await getMapConfig();
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'CEP do sistema (TERRITORY_CEP) inválido.',
    });
    return;
  }

  await pool.execute(
    `UPDATE territories
     SET name = ?, number = ?, cep = ?, geojson = ?, map_lat = ?, map_lng = ?
     WHERE id = ?`,
    [name.trim(), number ?? null, location.cep, geojson, location.lat, location.lng, id],
  );

  res.json({
    message: 'Território atualizado com sucesso.',
    cep: location.cep,
    map_lat: location.lat,
    map_lng: location.lng,
    address: location.label,
  });
});

router.delete('/:id', requireAuth, requirePermission('territory:delete'), async (req, res) => {
  const id = paramId(req.params.id);
  const [result] = await pool.execute('DELETE FROM territories WHERE id = ?', [id]);
  const deleteResult = result as { affectedRows?: number };
  if (!deleteResult.affectedRows) {
    res.status(404).json({ error: 'Território não encontrado.' });
    return;
  }
  res.json({ message: 'Território excluído com sucesso.' });
});

router.post(
  '/:id/daily',
  requireAuth,
  requirePermission('territory:set_daily'),
  async (req, res) => {
    const id = paramId(req.params.id);
    const territory = await findTerritory(id);
    if (!territory) {
      res.status(404).json({ error: 'Território não encontrado.' });
      return;
    }

    await pool.execute('UPDATE territories SET is_daily = 0');
    await pool.execute('UPDATE territories SET is_daily = 1 WHERE id = ?', [id]);

    res.json({ message: 'Território do dia atualizado com sucesso.' });
  },
);

/** Remove o vínculo de território do dia (nenhum fica destacado) */
router.delete(
  '/:id/daily',
  requireAuth,
  requirePermission('territory:set_daily'),
  async (req, res) => {
    const id = paramId(req.params.id);

    const [result] = await pool.execute('UPDATE territories SET is_daily = 0 WHERE id = ?', [id]);

    const updateResult = result as { affectedRows?: number };
    if (!updateResult.affectedRows) {
      res.status(404).json({ error: 'Território não encontrado.' });
      return;
    }

    res.json({ message: 'Território do dia desvinculado com sucesso.' });
  },
);

/**
 * Finaliza o território do dia:
 * - grava no histórico (dia, horário, dirigente, pessoas no campo)
 * - desvincula do dia
 */
router.post(
  '/:id/finish',
  requireAuth,
  requirePermission('territory:set_daily'),
  async (req, res) => {
    const id = paramId(req.params.id);
    const territory = await findTerritory(id);
    if (!territory) {
      res.status(404).json({ error: 'Território não encontrado.' });
      return;
    }

    const body = req.body as { people_count?: unknown; assignment_id?: unknown };
    const rawPeople = body?.people_count;
    const peopleCount = Number(rawPeople);
    if (!Number.isFinite(peopleCount) || peopleCount < 1 || peopleCount > 999) {
      res.status(400).json({
        error: 'Informe o número de pessoas no campo (mínimo 1).',
      });
      return;
    }

    let assignmentId: number | null = null;
    if (body?.assignment_id != null && body.assignment_id !== '') {
      const n = Number(body.assignment_id);
      if (!Number.isFinite(n) || n < 1) {
        res.status(400).json({ error: 'Dirigente inválido.' });
        return;
      }
      assignmentId = Math.floor(n);
    }

    const authUser = (req as AuthedRequest).user;

    try {
      await recordTerritoryFinished(id, {
        peopleCount: Math.floor(peopleCount),
        finishedByUserId: authUser.id,
        finishedByName: authUser.name,
        assignmentId,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === 'DIRIGENTE_OBRIGATORIO') {
        res.status(400).json({
          error: 'Há mais de um dirigente hoje. Selecione qual dirigiu este território.',
        });
        return;
      }
      if (msg === 'DIRIGENTE_INVALIDO') {
        res.status(400).json({ error: 'Dirigente selecionado não é válido para hoje.' });
        return;
      }
      console.error('[finish]', err);
      res.status(500).json({ error: 'Erro ao registrar no histórico de finalizados.' });
      return;
    }

    await pool.execute('UPDATE territories SET is_daily = 0 WHERE id = ?', [id]);

    res.json({
      message: 'Território finalizado, registrado no histórico e desvinculado do dia.',
    });
  },
);

router.get('/:id/blocks', requireAuth, requirePermission('territory:read'), async (req, res) => {
  const id = paramId(req.params.id);

  const territory = await findTerritory(id);
  if (!territory) {
    res.status(404).json({ error: 'Território não encontrado.' });
    return;
  }

  const [rows] = await pool.execute(
    `SELECT b.* FROM blocks b
     WHERE b.territory_id = ?
     ORDER BY b.sort_order ASC`,
    [id],
  );

  const blocks = (rows as Array<Record<string, unknown>>).map(mapBlock);

  res.json(blocks);
});

router.post('/:id/blocks', requireAuth, requirePermission('block:manage'), async (req, res) => {
  const id = paramId(req.params.id);

  const territory = await findTerritory(id);
  if (!territory) {
    res.status(404).json({ error: 'Território não encontrado.' });
    return;
  }

  const parsed = blockSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' });
    return;
  }

  const { name, street_name, description, house_numbers, sort_order } = parsed.data;

  try {
    const [result] = await pool.execute(
      `INSERT INTO blocks (territory_id, name, street_name, description, house_numbers, completed_houses, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        name.trim(),
        street_name.trim(),
        description ?? null,
        JSON.stringify(house_numbers.map(String)),
        JSON.stringify([]),
        sort_order ?? 0,
      ],
    );

    const insertResult = result as { insertId: number };
    res.status(201).json({
      id: insertResult.insertId,
      message: 'Registro de não em casa adicionado com sucesso.',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // coluna description ainda não migrada
    if (/description|Unknown column/i.test(msg)) {
      const [result] = await pool.execute(
        `INSERT INTO blocks (territory_id, name, street_name, house_numbers, completed_houses, sort_order)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          id,
          name.trim(),
          street_name.trim(),
          JSON.stringify(house_numbers.map(String)),
          JSON.stringify([]),
          sort_order ?? 0,
        ],
      );
      const insertResult = result as { insertId: number };
      res.status(201).json({
        id: insertResult.insertId,
        message:
          'Registro adicionado (sem descrição — rode npm run migrate:block-description para habilitar).',
      });
      return;
    }
    throw err;
  }
});

/** Atualiza quadra / rua / números / descrição (edição do formulário) */
router.put(
  '/:id/blocks/:blockId',
  requireAuth,
  requirePermission('block:manage'),
  async (req, res) => {
    const id = paramId(req.params.id);
    const blockId = paramId(req.params.blockId);

    const parsed = blockSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' });
      return;
    }

    const { name, street_name, description, house_numbers, sort_order } = parsed.data;
    const houses = house_numbers.map(String);

    const [rows] = await pool.execute(
      `SELECT b.* FROM blocks b
       WHERE b.id = ? AND b.territory_id = ?`,
      [blockId, id],
    );
    const list = rows as Array<Record<string, unknown>>;
    const block = list[0];
    if (!block) {
      res.status(404).json({ error: 'Registro não encontrado.' });
      return;
    }

    const prevCompleted = parseHouseNumbers(block.completed_houses);
    const completed = prevCompleted.filter((h) => houses.includes(h));

    try {
      await pool.execute(
        `UPDATE blocks
         SET name = ?, street_name = ?, description = ?, house_numbers = ?, completed_houses = ?, sort_order = COALESCE(?, sort_order)
         WHERE id = ?`,
        [
          name.trim(),
          street_name.trim(),
          description ?? null,
          JSON.stringify(houses),
          JSON.stringify(completed),
          sort_order ?? null,
          blockId,
        ],
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/description|Unknown column/i.test(msg)) {
        await pool.execute(
          `UPDATE blocks
           SET name = ?, street_name = ?, house_numbers = ?, completed_houses = ?, sort_order = COALESCE(?, sort_order)
           WHERE id = ?`,
          [
            name.trim(),
            street_name.trim(),
            JSON.stringify(houses),
            JSON.stringify(completed),
            sort_order ?? null,
            blockId,
          ],
        );
      } else {
        throw err;
      }
    }

    const [updatedRows] = await pool.execute('SELECT * FROM blocks WHERE id = ?', [blockId]);
    res.json(mapBlock((updatedRows as Array<Record<string, unknown>>)[0]));
  },
);

/** Checklist: marcar / desmarcar número de casa já trabalhado */
router.patch(
  '/:id/blocks/:blockId/houses',
  requireAuth,
  requirePermission('block:manage'),
  async (req, res) => {
    const id = paramId(req.params.id);
    const blockId = paramId(req.params.blockId);

    const parsed = toggleHouseSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' });
      return;
    }

    const { house_number, done } = parsed.data;

    const [rows] = await pool.execute(
      `SELECT b.* FROM blocks b
       WHERE b.id = ? AND b.territory_id = ?`,
      [blockId, id],
    );
    const list = rows as Array<Record<string, unknown>>;
    const block = list[0];
    if (!block) {
      res.status(404).json({ error: 'Registro não encontrado.' });
      return;
    }

    const houseKey = String(house_number).trim();
    const houses = parseHouseNumbers(block.house_numbers).map((h) => String(h).trim());
    // Match estrito: "1" não é "11" / "12" / "15"
    if (!houses.includes(houseKey)) {
      res.status(400).json({ error: 'Este número não pertence a esta quadra.' });
      return;
    }

    let completed = parseHouseNumbers(block.completed_houses)
      .map((h) => String(h).trim())
      .filter((h) => houses.includes(h));
    if (done) {
      if (!completed.includes(houseKey)) completed = [...completed, houseKey];
    } else {
      completed = completed.filter((n) => n !== houseKey);
    }

    // Atualiza só este block.id — cada rua/quadra tem id único no banco
    await pool.execute('UPDATE blocks SET completed_houses = ? WHERE id = ? AND territory_id = ?', [
      JSON.stringify(completed),
      blockId,
      id,
    ]);

    res.json(
      mapBlock({
        ...block,
        completed_houses: completed,
      }),
    );
  },
);

router.delete(
  '/:id/blocks/:blockId',
  requireAuth,
  requirePermission('block:manage'),
  async (req, res) => {
    const id = paramId(req.params.id);
    const blockId = paramId(req.params.blockId);

    const [result] = await pool.execute(
      `DELETE FROM blocks WHERE id = ? AND territory_id = ?`,
      [blockId, id],
    );

    const deleteResult = result as { affectedRows?: number };
    if (!deleteResult.affectedRows) {
      res.status(404).json({ error: 'Registro não encontrado.' });
      return;
    }

    res.json({ message: 'Registro removido com sucesso.' });
  },
);

/** Apaga várias quadras de não em casa de uma vez */
router.post(
  '/:id/blocks/bulk-delete',
  requireAuth,
  requirePermission('block:manage'),
  async (req, res) => {
    const id = paramId(req.params.id);
    const rawIds = (req.body as { ids?: unknown })?.ids;

    if (!Array.isArray(rawIds) || rawIds.length === 0) {
      res.status(400).json({ error: 'Informe ao menos uma quadra para apagar.' });
      return;
    }

    const ids = [
      ...new Set(rawIds.map((v) => Number(v)).filter((n) => Number.isFinite(n) && n > 0)),
    ];
    if (ids.length === 0) {
      res.status(400).json({ error: 'IDs inválidos.' });
      return;
    }

    const territory = await findTerritory(id);
    if (!territory) {
      res.status(404).json({ error: 'Território não encontrado.' });
      return;
    }

    const placeholders = ids.map(() => '?').join(', ');
    const [result] = await pool.execute(
      `DELETE FROM blocks WHERE territory_id = ? AND id IN (${placeholders})`,
      [id, ...ids],
    );

    const deleteResult = result as { affectedRows?: number };
    res.json({
      message: 'Quadras removidas com sucesso.',
      deleted: deleteResult.affectedRows ?? 0,
    });
  },
);

export default router;
