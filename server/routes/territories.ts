import { Router } from 'express';
import pool from '../lib/db.js';
import { getMapConfig } from '../lib/map-config.js';
import { territorySchema, blockSchema, toggleHouseSchema } from '../lib/validations.js';
import { requireAuth, type AuthedRequest } from '../middleware/requireAuth.js';

const router = Router();

function isValidTerritoryGeoJson(geojson: string): boolean {
  try {
    const parsed = JSON.parse(geojson) as {
      type?: string;
      features?: Array<{ geometry?: { coordinates?: number[][][] } }>;
      geometry?: { coordinates?: number[][][] };
      coordinates?: number[][][];
    };

    const rings: number[][][] = [];

    if (parsed.type === 'FeatureCollection' && Array.isArray(parsed.features)) {
      for (const feature of parsed.features) {
        const ring = feature?.geometry?.coordinates?.[0];
        if (Array.isArray(ring)) rings.push(ring);
      }
    } else {
      const ring = parsed?.geometry?.coordinates?.[0] ?? parsed?.coordinates?.[0];
      if (Array.isArray(ring)) rings.push(ring);
    }

    // anel fechado: mínimo 4 posições (3 pontos + fechamento)
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

router.get('/', requireAuth, async (req, res) => {
  const user = (req as AuthedRequest).user;
  const [rows] = await pool.execute(
    'SELECT * FROM territories WHERE user_id = ? ORDER BY created_at DESC',
    [user.id],
  );
  res.json(rows);
});

router.get('/dashboard', requireAuth, async (req, res) => {
  const user = (req as AuthedRequest).user;

  const [territories] = await pool.execute(
    'SELECT * FROM territories WHERE user_id = ? ORDER BY created_at DESC',
    [user.id],
  );
  const territoryList = territories as Array<Record<string, unknown>>;

  const [dailyRows] = await pool.execute(
    'SELECT * FROM territories WHERE user_id = ? AND is_daily = 1 LIMIT 1',
    [user.id],
  );
  const dailyList = dailyRows as Array<Record<string, unknown>>;
  const daily = dailyList[0] ?? null;

  // Todas as quadras do usuário (para progresso e lista "Não finalizados")
  const [allBlockRows] = await pool.execute(
    `SELECT b.* FROM blocks b
     INNER JOIN territories t ON t.id = b.territory_id
     WHERE t.user_id = ?
     ORDER BY b.sort_order ASC, b.id ASC`,
    [user.id],
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

  // Territórios com pelo menos uma quadra ainda não finalizada no checklist
  const unfinished = territoryList
    .map((t) => {
      const blocks = blocksByTerritory.get(Number(t.id)) ?? [];
      const openBlocks = blocks.filter((b) => !b.is_finished);
      if (openBlocks.length === 0) return null;

      const pendingHouses = openBlocks.reduce(
        (sum, b) => sum + Math.max(0, (b.total as number) - (b.done_count as number)),
        0,
      );

      return {
        ...t,
        unfinished_blocks: openBlocks.length,
        total_blocks: blocks.length,
        pending_houses: pendingHouses,
        blocks: openBlocks,
      };
    })
    .filter(Boolean);

  res.json({
    user,
    territories: territoryList,
    daily: daily ? { ...daily, blocks: dailyBlocks } : null,
    unfinished,
  });
});

router.post('/', requireAuth, async (req, res) => {
  const user = (req as AuthedRequest).user;
  const parsed = territorySchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' });
    return;
  }

  const { name, number, geojson, is_daily } = parsed.data;

  // Valida FeatureCollection ou Feature/Polygon com pelo menos um anel válido
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
    await pool.execute('UPDATE territories SET is_daily = 0 WHERE user_id = ?', [user.id]);
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

router.get('/:id', requireAuth, async (req, res) => {
  const user = (req as AuthedRequest).user;
  const { id } = req.params;

  const [rows] = await pool.execute('SELECT * FROM territories WHERE id = ? AND user_id = ?', [id, user.id]);
  const territories = rows as Array<Record<string, unknown>>;

  if (!territories[0]) {
    res.status(404).json({ error: 'Território não encontrado.' });
    return;
  }

  const [blockRows] = await pool.execute(
    'SELECT * FROM blocks WHERE territory_id = ? ORDER BY sort_order ASC',
    [id],
  );

  const blocks = (blockRows as Array<Record<string, unknown>>).map(mapBlock);

  res.json({ ...territories[0], blocks });
});

router.put('/:id', requireAuth, async (req, res) => {
  const user = (req as AuthedRequest).user;
  const { id } = req.params;
  const parsed = territorySchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' });
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
     WHERE id = ? AND user_id = ?`,
    [name.trim(), number ?? null, location.cep, geojson, location.lat, location.lng, id, user.id],
  );

  res.json({
    message: 'Território atualizado com sucesso.',
    cep: location.cep,
    map_lat: location.lat,
    map_lng: location.lng,
    address: location.label,
  });
});

router.delete('/:id', requireAuth, async (req, res) => {
  const user = (req as AuthedRequest).user;
  const { id } = req.params;
  await pool.execute('DELETE FROM territories WHERE id = ? AND user_id = ?', [id, user.id]);
  res.json({ message: 'Território excluído com sucesso.' });
});

router.post('/:id/daily', requireAuth, async (req, res) => {
  const user = (req as AuthedRequest).user;
  const { id } = req.params;

  await pool.execute('UPDATE territories SET is_daily = 0 WHERE user_id = ?', [user.id]);
  await pool.execute('UPDATE territories SET is_daily = 1 WHERE id = ? AND user_id = ?', [id, user.id]);

  res.json({ message: 'Território do dia atualizado com sucesso.' });
});

/** Remove o vínculo de território do dia (nenhum fica destacado) */
router.delete('/:id/daily', requireAuth, async (req, res) => {
  const user = (req as AuthedRequest).user;
  const { id } = req.params;

  const [result] = await pool.execute(
    'UPDATE territories SET is_daily = 0 WHERE id = ? AND user_id = ?',
    [id, user.id],
  );

  const updateResult = result as { affectedRows?: number };
  if (!updateResult.affectedRows) {
    res.status(404).json({ error: 'Território não encontrado.' });
    return;
  }

  res.json({ message: 'Território do dia desvinculado com sucesso.' });
});

router.get('/:id/blocks', requireAuth, async (req, res) => {
  const user = (req as AuthedRequest).user;
  const { id } = req.params;

  const [rows] = await pool.execute(
    `SELECT b.* FROM blocks b
     INNER JOIN territories t ON t.id = b.territory_id
     WHERE b.territory_id = ? AND t.user_id = ?
     ORDER BY b.sort_order ASC`,
    [id, user.id],
  );

  const blocks = (rows as Array<Record<string, unknown>>).map(mapBlock);

  res.json(blocks);
});

router.post('/:id/blocks', requireAuth, async (req, res) => {
  const user = (req as AuthedRequest).user;
  const { id } = req.params;

  const [owned] = await pool.execute('SELECT id FROM territories WHERE id = ? AND user_id = ?', [id, user.id]);
  if (!(owned as unknown[]).length) {
    res.status(404).json({ error: 'Território não encontrado.' });
    return;
  }

  const parsed = blockSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' });
    return;
  }

  const { name, street_name, house_numbers, sort_order } = parsed.data;

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
    message: 'Registro de não em casa adicionado com sucesso.',
  });
});

/** Atualiza quadra / rua / números (edição do formulário) */
router.put('/:id/blocks/:blockId', requireAuth, async (req, res) => {
  const user = (req as AuthedRequest).user;
  const { id, blockId } = req.params;

  const parsed = blockSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' });
    return;
  }

  const { name, street_name, house_numbers, sort_order } = parsed.data;
  const houses = house_numbers.map(String);

  const [rows] = await pool.execute(
    `SELECT b.* FROM blocks b
     INNER JOIN territories t ON t.id = b.territory_id
     WHERE b.id = ? AND b.territory_id = ? AND t.user_id = ?`,
    [blockId, id, user.id],
  );
  const list = rows as Array<Record<string, unknown>>;
  const block = list[0];
  if (!block) {
    res.status(404).json({ error: 'Registro não encontrado.' });
    return;
  }

  // Mantém só as casas concluídas que ainda existem na lista
  const prevCompleted = parseHouseNumbers(block.completed_houses);
  const completed = prevCompleted.filter((h) => houses.includes(h));

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

  const [updatedRows] = await pool.execute('SELECT * FROM blocks WHERE id = ?', [blockId]);
  res.json(mapBlock((updatedRows as Array<Record<string, unknown>>)[0]));
});

/** Checklist: marcar / desmarcar número de casa já trabalhado */
router.patch('/:id/blocks/:blockId/houses', requireAuth, async (req, res) => {
  const user = (req as AuthedRequest).user;
  const { id, blockId } = req.params;

  const parsed = toggleHouseSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' });
    return;
  }

  const { house_number, done } = parsed.data;

  const [rows] = await pool.execute(
    `SELECT b.* FROM blocks b
     INNER JOIN territories t ON t.id = b.territory_id
     WHERE b.id = ? AND b.territory_id = ? AND t.user_id = ?`,
    [blockId, id, user.id],
  );
  const list = rows as Array<Record<string, unknown>>;
  const block = list[0];
  if (!block) {
    res.status(404).json({ error: 'Registro não encontrado.' });
    return;
  }

  const houses = parseHouseNumbers(block.house_numbers);
  if (!houses.includes(house_number)) {
    res.status(400).json({ error: 'Este número não pertence a esta quadra.' });
    return;
  }

  let completed = parseHouseNumbers(block.completed_houses);
  if (done) {
    if (!completed.includes(house_number)) completed = [...completed, house_number];
  } else {
    completed = completed.filter((n) => n !== house_number);
  }

  await pool.execute('UPDATE blocks SET completed_houses = ? WHERE id = ?', [
    JSON.stringify(completed),
    blockId,
  ]);

  res.json(
    mapBlock({
      ...block,
      completed_houses: completed,
    }),
  );
});

router.delete('/:id/blocks/:blockId', requireAuth, async (req, res) => {
  const user = (req as AuthedRequest).user;
  const { id, blockId } = req.params;

  const [result] = await pool.execute(
    `DELETE b FROM blocks b
     INNER JOIN territories t ON t.id = b.territory_id
     WHERE b.id = ? AND b.territory_id = ? AND t.user_id = ?`,
    [blockId, id, user.id],
  );

  const deleteResult = result as { affectedRows?: number };
  if (!deleteResult.affectedRows) {
    res.status(404).json({ error: 'Registro não encontrado.' });
    return;
  }

  res.json({ message: 'Registro removido com sucesso.' });
});

/** Apaga várias quadras de não em casa de uma vez */
router.post('/:id/blocks/bulk-delete', requireAuth, async (req, res) => {
  const user = (req as AuthedRequest).user;
  const { id } = req.params;
  const rawIds = (req.body as { ids?: unknown })?.ids;

  if (!Array.isArray(rawIds) || rawIds.length === 0) {
    res.status(400).json({ error: 'Informe ao menos uma quadra para apagar.' });
    return;
  }

  const ids = [...new Set(rawIds.map((v) => Number(v)).filter((n) => Number.isFinite(n) && n > 0))];
  if (ids.length === 0) {
    res.status(400).json({ error: 'IDs inválidos.' });
    return;
  }

  // Confirma que o território é do usuário
  const [territoryRows] = await pool.execute(
    'SELECT id FROM territories WHERE id = ? AND user_id = ?',
    [id, user.id],
  );
  if ((territoryRows as Array<unknown>).length === 0) {
    res.status(404).json({ error: 'Território não encontrado.' });
    return;
  }

  const placeholders = ids.map(() => '?').join(', ');
  const [result] = await pool.execute(
    `DELETE b FROM blocks b
     INNER JOIN territories t ON t.id = b.territory_id
     WHERE b.territory_id = ? AND t.user_id = ? AND b.id IN (${placeholders})`,
    [id, user.id, ...ids],
  );

  const deleteResult = result as { affectedRows?: number };
  res.json({
    message: 'Quadras removidas com sucesso.',
    deleted: deleteResult.affectedRows ?? 0,
  });
});

export default router;
