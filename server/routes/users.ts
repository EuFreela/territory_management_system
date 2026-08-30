import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import pool from '../lib/db.js';
import { formatCep, onlyDigits } from '../lib/cep.js';
import { listCongregationNames } from '../lib/cep-region.js';
import { resolveWorkingCep } from '../lib/map-config.js';
import { ROLE_ADMIN, SCOPES } from '../lib/rbac.js';
import { isStrongPassword, validateStrongPassword } from '../lib/password.js';
import { requireAuth, type AuthedRequest } from '../middleware/requireAuth.js';
import { requirePermission } from '../middleware/requirePermission.js';

const router = Router();
const BCRYPT_ROUNDS = 12;

const createUserSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(150),
  email: z.string().email('Email inválido'),
  password: z.string().superRefine((value, ctx) => {
    const err = validateStrongPassword(value);
    if (err) ctx.addIssue({ code: 'custom', message: err });
  }),
  role_id: z.number().int().positive('Informe o papel (role)'),
});

const updateUserSchema = z.object({
  name: z.string().min(2).max(150).optional(),
  email: z.string().email().optional(),
  role_id: z.number().int().positive().nullable().optional(),
  password: z
    .string()
    .optional()
    .superRefine((value, ctx) => {
      if (value == null || value === '') return;
      const err = validateStrongPassword(value);
      if (err) ctx.addIssue({ code: 'custom', message: err });
    }),
});

/** Lista papéis disponíveis (admin / user:manage) */
router.get('/roles', requireAuth, requirePermission('user:manage'), async (_req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT r.id, r.slug, r.name, r.description,
              (SELECT COUNT(*) FROM role_permissions rp WHERE rp.role_id = r.id) AS permission_count
       FROM roles r
       ORDER BY r.id ASC`,
    );
    const roles = rows as Array<{
      id: number;
      slug: string;
      name: string;
      description: string | null;
      permission_count: number;
    }>;

    const withPerms = [];
    for (const role of roles) {
      const [perms] = await pool.execute(
        'SELECT permission FROM role_permissions WHERE role_id = ? ORDER BY permission',
        [role.id],
      );
      withPerms.push({
        ...role,
        permissions: (perms as Array<{ permission: string }>).map((p) => p.permission),
      });
    }

    res.json({ roles: withPerms, scopes: SCOPES });
  } catch (error) {
    console.error('[users/roles]', error);
    res.status(500).json({ error: 'Erro ao listar papéis. Rode a migração RBAC.' });
  }
});

/** Lista usuários da mesma congregação (CEP de trabalho de quem consulta) */
router.get('/', requireAuth, requirePermission('user:manage'), async (req, res) => {
  try {
    const user = (req as AuthedRequest).user;
    const activeCep = formatCep(resolveWorkingCep(user));
    const [rows] = await pool.execute(
      `SELECT u.id, u.name, u.email, u.role_id, u.active_cep, u.created_at,
              r.slug AS role_slug, r.name AS role_name
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.active_cep = ?
       ORDER BY u.name ASC`,
      [activeCep],
    );
    const names = await listCongregationNames();
    res.json(
      (rows as Array<Record<string, unknown>>).map((u) => {
        const rawCep =
          typeof u.active_cep === 'string' && u.active_cep.trim() ? u.active_cep.trim() : null;
        const cepKey =
          rawCep && onlyDigits(rawCep).length === 8 ? formatCep(onlyDigits(rawCep)) : null;
        return {
          id: u.id,
          name: u.name,
          email: u.email,
          role_id: u.role_id,
          role: u.role_id
            ? { id: u.role_id, slug: u.role_slug, name: u.role_name }
            : null,
          active_cep: cepKey,
          congregation_name: cepKey ? (names.get(cepKey) ?? null) : null,
          created_at: u.created_at,
        };
      }),
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (/active_cep|Unknown column/i.test(msg)) {
      // Banco ainda sem a migração active_cep: lista sem o vínculo de congregação.
      const [rows] = await pool.execute(
        `SELECT u.id, u.name, u.email, u.role_id, u.created_at,
                r.slug AS role_slug, r.name AS role_name
         FROM users u
         LEFT JOIN roles r ON r.id = u.role_id
         ORDER BY u.name ASC`,
      );
      res.json(
        (rows as Array<Record<string, unknown>>).map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role_id: u.role_id,
          role: u.role_id
            ? { id: u.role_id, slug: u.role_slug, name: u.role_name }
            : null,
          active_cep: null,
          congregation_name: null,
          created_at: u.created_at,
        })),
      );
      return;
    }
    console.error('[users/list]', error);
    res.status(500).json({ error: 'Erro ao listar usuários.' });
  }
});

/** Cria usuário — vincula ao CEP da congregação já definido nas Configurações. */
router.post('/', requireAuth, requirePermission('user:manage'), async (req, res) => {
  try {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' });
      return;
    }

    const creator = (req as AuthedRequest).user;
    const activeCep = formatCep(resolveWorkingCep(creator));
    const { name, email, password, role_id } = parsed.data;
    const emailNorm = email.toLowerCase();

    const [roleRows] = await pool.execute('SELECT id, slug FROM roles WHERE id = ?', [role_id]);
    if (!(roleRows as unknown[]).length) {
      res.status(400).json({ error: 'Papel (role) inválido.' });
      return;
    }

    const [existing] = await pool.execute('SELECT id FROM users WHERE email = ?', [emailNorm]);
    if ((existing as unknown[]).length) {
      res.status(409).json({ error: 'Já existe um usuário com este email.' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    let result;
    try {
      [result] = await pool.execute(
        'INSERT INTO users (name, email, password_hash, role_id, active_cep) VALUES (?, ?, ?, ?, ?)',
        [name.trim(), emailNorm, passwordHash, role_id, activeCep],
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/active_cep|Unknown column/i.test(msg)) throw err;
      res.status(503).json({
        error:
          'Vínculo de congregação por CEP ainda não migrado. Rode: npm run migrate:active-cep',
      });
      return;
    }

    res.status(201).json({
      id: (result as { insertId: number }).insertId,
      message: `Usuário criado e vinculado à congregação do CEP ${activeCep}.`,
    });
  } catch (error) {
    console.error('[users/create]', error);
    res.status(500).json({ error: 'Erro ao criar usuário.' });
  }
});

/** Atualiza usuário (nome, email, role, senha opcional) */
router.put('/:id', requireAuth, requirePermission('user:manage'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: 'ID inválido.' });
      return;
    }

    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' });
      return;
    }

    const [rows] = await pool.execute(
      `SELECT u.id, u.role_id, r.slug AS role_slug
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.id = ?`,
      [id],
    );
    const target = (rows as Array<{ id: number; role_id: number | null; role_slug: string | null }>)[0];
    if (!target) {
      res.status(404).json({ error: 'Usuário não encontrado.' });
      return;
    }

    const { name, email, role_id, password } = parsed.data;

    // Não permite rebaixar o último admin
    if (role_id !== undefined && target.role_slug === ROLE_ADMIN) {
      const newRoleSlug =
        role_id == null
          ? null
          : (
              (
                await pool.execute('SELECT slug FROM roles WHERE id = ?', [role_id])
              )[0] as Array<{ slug: string }>
            )[0]?.slug;

      if (newRoleSlug !== ROLE_ADMIN) {
        const [adminCountRows] = await pool.execute(
          `SELECT COUNT(*) AS c FROM users u
           INNER JOIN roles r ON r.id = u.role_id
           WHERE r.slug = ?`,
          [ROLE_ADMIN],
        );
        const count = Number((adminCountRows as Array<{ c: number }>)[0]?.c ?? 0);
        if (count <= 1) {
          res.status(400).json({ error: 'Não é possível remover o último administrador.' });
          return;
        }
      }
    }

    if (email) {
      const emailNorm = email.toLowerCase();
      const [dup] = await pool.execute('SELECT id FROM users WHERE email = ? AND id <> ?', [
        emailNorm,
        id,
      ]);
      if ((dup as unknown[]).length) {
        res.status(409).json({ error: 'Já existe um usuário com este email.' });
        return;
      }
    }

    if (role_id != null) {
      const [roleRows] = await pool.execute('SELECT id FROM roles WHERE id = ?', [role_id]);
      if (!(roleRows as unknown[]).length) {
        res.status(400).json({ error: 'Papel (role) inválido.' });
        return;
      }
    }

    const sets: string[] = [];
    const params: Array<string | number | null> = [];

    if (name != null) {
      sets.push('name = ?');
      params.push(name.trim());
    }
    if (email != null) {
      sets.push('email = ?');
      params.push(email.toLowerCase());
    }
    if (role_id !== undefined) {
      sets.push('role_id = ?');
      params.push(role_id);
    }
    if (password) {
      if (!isStrongPassword(password)) {
        res.status(400).json({ error: validateStrongPassword(password) ?? 'Senha fraca.' });
        return;
      }
      sets.push('password_hash = ?');
      params.push(await bcrypt.hash(password, BCRYPT_ROUNDS));
    }

    if (sets.length === 0) {
      res.status(400).json({ error: 'Nada para atualizar.' });
      return;
    }

    params.push(id);
    await pool.execute(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, params);

    res.json({ message: 'Usuário atualizado com sucesso.' });
  } catch (error) {
    console.error('[users/update]', error);
    res.status(500).json({ error: 'Erro ao atualizar usuário.' });
  }
});

/** Remove usuário */
router.delete('/:id', requireAuth, requirePermission('user:manage'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const authUser = (req as AuthedRequest).user;

    if (authUser.id === id) {
      res.status(400).json({ error: 'Você não pode excluir a própria conta.' });
      return;
    }

    const [rows] = await pool.execute(
      `SELECT u.id, r.slug AS role_slug
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.id = ?`,
      [id],
    );
    const target = (rows as Array<{ id: number; role_slug: string | null }>)[0];
    if (!target) {
      res.status(404).json({ error: 'Usuário não encontrado.' });
      return;
    }

    if (target.role_slug === ROLE_ADMIN) {
      const [adminCountRows] = await pool.execute(
        `SELECT COUNT(*) AS c FROM users u
         INNER JOIN roles r ON r.id = u.role_id
         WHERE r.slug = ?`,
        [ROLE_ADMIN],
      );
      if (Number((adminCountRows as Array<{ c: number }>)[0]?.c ?? 0) <= 1) {
        res.status(400).json({ error: 'Não é possível excluir o último administrador.' });
        return;
      }
    }

    await pool.execute('DELETE FROM users WHERE id = ?', [id]);
    res.json({ message: 'Usuário removido com sucesso.' });
  } catch (error) {
    console.error('[users/delete]', error);
    res.status(500).json({ error: 'Erro ao remover usuário.' });
  }
});

export default router;
