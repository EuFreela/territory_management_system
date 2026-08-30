import { Router } from 'express';
import { z } from 'zod';
import pool from '../lib/db.js';
import { formatCep, onlyDigits } from '../lib/cep.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requirePermission } from '../middleware/requirePermission.js';

const router = Router();

const CONGREGATION_NAME_MAX = 120;
const CONGREGATION_ADDRESS_MAX = 255;

function sanitizeCep(raw: unknown): { ok: true; cep: string } | { ok: false; error: string } {
  if (typeof raw !== 'string') return { ok: false, error: 'CEP inválido.' };
  const digits = onlyDigits(raw);
  if (digits.length !== 8) return { ok: false, error: 'CEP inválido.' };
  return { ok: true, cep: formatCep(digits) };
}

function sanitizeName(raw: unknown): { ok: true; name: string } | { ok: false; error: string } {
  if (typeof raw !== 'string') return { ok: false, error: 'Nome da congregação inválido.' };
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  if (!trimmed) return { ok: false, error: 'Informe o nome da congregação.' };
  if (/[\u0000-\u001F\u007F]/.test(trimmed) || /[<>]/.test(trimmed)) {
    return { ok: false, error: 'O nome da congregação contém caracteres inválidos.' };
  }
  if (trimmed.length < 2) {
    return { ok: false, error: 'Nome da congregação deve ter pelo menos 2 caracteres.' };
  }
  if (trimmed.length > CONGREGATION_NAME_MAX) {
    return {
      ok: false,
      error: `Nome da congregação no máximo ${CONGREGATION_NAME_MAX} caracteres.`,
    };
  }
  return { ok: true, name: trimmed };
}

function sanitizeAddress(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  if (!trimmed) return null;
  return trimmed.slice(0, CONGREGATION_ADDRESS_MAX);
}

const bodySchema = z.object({
  cep: z.unknown(),
  name: z.unknown(),
  address: z.unknown(),
});

/** Lista todas as congregações do sistema (todos os CEPs). */
router.get('/', requireAuth, requirePermission('congregation:manage'), async (_req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT c.id, c.cep, c.name, c.address, c.created_at, c.updated_at
       FROM congregations c
       ORDER BY c.name ASC, c.cep ASC`,
    );
    res.json({ congregations: rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/congregations|doesn't exist|Unknown table/i.test(message)) {
      res.status(503).json({
        error: 'Cadastro de congregações ainda não migrado. Rode: npm run migrate:congregations',
      });
      return;
    }
    console.error('[congregations] list', error);
    res.status(500).json({ error: 'Erro ao listar congregações.' });
  }
});

/** Cria uma congregação. */
router.post('/', requireAuth, requirePermission('congregation:manage'), async (req, res) => {
  try {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Dados inválidos.' });
      return;
    }
    const cepRes = sanitizeCep(parsed.data.cep);
    if (!cepRes.ok) {
      res.status(400).json({ error: cepRes.error });
      return;
    }
    const nameRes = sanitizeName(parsed.data.name);
    if (!nameRes.ok) {
      res.status(400).json({ error: nameRes.error });
      return;
    }
    const address = sanitizeAddress(parsed.data.address);

    try {
      const [ins] = await pool.execute(
        `INSERT INTO congregations (cep, name, address) VALUES (?, ?, ?)`,
        [cepRes.cep, nameRes.name, address],
      );
      const id = (ins as { insertId: number }).insertId;
      res.status(201).json({ id });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/Duplicate/i.test(msg)) {
        res
          .status(409)
          .json({ error: 'Já existe uma congregação com esse nome para este CEP.' });
        return;
      }
      if (/congregations|doesn't exist|Unknown table/i.test(msg)) {
        res.status(503).json({
          error:
            'Cadastro de congregações ainda não migrado. Rode: npm run migrate:congregations',
        });
        return;
      }
      throw err;
    }
  } catch (error) {
    console.error('[congregations] create', error);
    res.status(500).json({ error: 'Erro ao criar congregação.' });
  }
});

/** Atualiza uma congregação. */
router.put('/:id', requireAuth, requirePermission('congregation:manage'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'Identificador inválido.' });
    return;
  }
  try {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Dados inválidos.' });
      return;
    }
    const cepRes = sanitizeCep(parsed.data.cep);
    if (!cepRes.ok) {
      res.status(400).json({ error: cepRes.error });
      return;
    }
    const nameRes = sanitizeName(parsed.data.name);
    if (!nameRes.ok) {
      res.status(400).json({ error: nameRes.error });
      return;
    }
    const address = sanitizeAddress(parsed.data.address);

    try {
      const [result] = await pool.execute(
        `UPDATE congregations SET cep = ?, name = ?, address = ? WHERE id = ?`,
        [cepRes.cep, nameRes.name, address, id],
      );
      if ((result as { affectedRows: number }).affectedRows === 0) {
        res.status(404).json({ error: 'Congregação não encontrada.' });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/Duplicate/i.test(msg)) {
        res
          .status(409)
          .json({ error: 'Já existe uma congregação com esse nome para este CEP.' });
        return;
      }
      if (/congregations|doesn't exist|Unknown table/i.test(msg)) {
        res.status(503).json({
          error:
            'Cadastro de congregações ainda não migrado. Rode: npm run migrate:congregations',
        });
        return;
      }
      throw err;
    }
  } catch (error) {
    console.error('[congregations] update', error);
    res.status(500).json({ error: 'Erro ao atualizar congregação.' });
  }
});

/** Remove uma congregação. */
router.delete('/:id', requireAuth, requirePermission('congregation:manage'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'Identificador inválido.' });
    return;
  }
  try {
    const [result] = await pool.execute('DELETE FROM congregations WHERE id = ?', [id]);
    if ((result as { affectedRows: number }).affectedRows === 0) {
      res.status(404).json({ error: 'Congregação não encontrada.' });
      return;
    }
    res.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/congregations|doesn't exist|Unknown table/i.test(message)) {
      res.status(503).json({
        error: 'Cadastro de congregações ainda não migrado. Rode: npm run migrate:congregations',
      });
      return;
    }
    console.error('[congregations] delete', error);
    res.status(500).json({ error: 'Erro ao remover congregação.' });
  }
});

export default router;
