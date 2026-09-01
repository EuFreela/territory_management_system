import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import pool from '../lib/db.js';
import { formatCep, onlyDigits } from '../lib/cep.js';
import { listCongregationNames } from '../lib/cep-region.js';
import { resolveWorkingCep } from '../lib/map-config.js';
import { ROLE_ADMIN, SCOPES, isScope, type Scope } from '../lib/rbac.js';
import { isStrongPassword, validateStrongPassword } from '../lib/password.js';
import { removeGpsPresence, removeSessionPresence } from '../lib/presence.js';
import { requireAuth, type AuthedRequest } from '../middleware/requireAuth.js';
import { requirePermission } from '../middleware/requirePermission.js';

const router = Router();
const BCRYPT_ROUNDS = 12;

/** Mapa CEP formatado → nome de congregação, priorizando a tabela congregations. */
async function congregationNameByCep(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const [rows] = await pool.execute('SELECT cep, name FROM congregations');
    for (const row of rows as Array<{ cep: string; name: string }>) {
      const digits = onlyDigits(String(row.cep ?? ''));
      if (digits.length !== 8) continue;
      const name = String(row.name ?? '').trim();
      if (!name) continue;
      map.set(formatCep(digits), name);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/congregations|doesn't exist|Unknown table/i.test(msg)) return map;
    throw err;
  }
  return map;
}

/** Resolve o CEP de uma congregação pelo id (null se não houver). */
async function congregationCepById(id: number): Promise<string | null> {
  try {
    const [rows] = await pool.execute('SELECT cep FROM congregations WHERE id = ?', [id]);
    const row = (rows as Array<{ cep: string }>)[0];
    if (!row) return null;
    const digits = onlyDigits(String(row.cep ?? ''));
    return digits.length === 8 ? formatCep(digits) : null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/congregations|doesn't exist|Unknown table/i.test(msg)) return null;
    throw err;
  }
}

const createUserSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(150),
  email: z.string().email('Email inválido'),
  password: z.string().superRefine((value, ctx) => {
    const err = validateStrongPassword(value);
    if (err) ctx.addIssue({ code: 'custom', message: err });
  }),
  role_id: z.number().int().positive('Informe o papel (role)'),
  congregation_id: z.number().int().positive().nullable().optional(),
});

const updateUserSchema = z.object({
  name: z.string().min(2).max(150).optional(),
  email: z.string().email().optional(),
  role_id: z.number().int().positive().nullable().optional(),
  congregation_id: z.number().int().positive().nullable().optional(),
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

/**
 * Lista congregações para o formulário de usuário.
 * Sem ?q: retorna as últimas 5 cadastradas (para o select rápido).
 * Com ?q: busca por nome ou CEP (resultados limitados).
 */
router.get('/congregations', requireAuth, requirePermission('user:manage'), async (req, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    let sql: string;
    let params: Array<string | number> = [];
    if (q) {
      const like = `%${q}%`;
      const digitsQ = onlyDigits(q);
      // CEP pode estar armazenado com hífen ("37150-000") ou sem; busca cobre
      // nome, forma exibida e só-membros (digitado pelo usuário sem hífen).
      const cepMatch =
        digitsQ.length > 0 ? ` OR REPLACE(c.cep, '-', '') LIKE ?` : '';
      sql = `SELECT c.id, c.cep, c.name, c.address
             FROM congregations c
             WHERE c.name LIKE ? OR c.cep LIKE ?${cepMatch}
             ORDER BY c.name ASC
             LIMIT 50`;
      params = [like, like];
      if (digitsQ.length > 0) params.push(`%${digitsQ}%`);
    } else {
      sql = `SELECT c.id, c.cep, c.name, c.address
             FROM congregations c
             ORDER BY c.created_at DESC, c.id DESC
             LIMIT 5`;
    }
    const [rows] = await pool.execute(sql, params);
    const cong = (rows as Array<{ id: number; cep: string; name: string; address: string | null }>).map(
      (c) => ({
        id: c.id,
        cep: onlyDigits(String(c.cep ?? '')).length === 8 ? formatCep(String(c.cep)) : c.cep,
        name: String(c.name ?? '').trim(),
        address: c.address,
      }),
    );
    res.json({ congregations: cong });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (/congregations|doesn't exist|Unknown table/i.test(msg)) {
      res.status(503).json({
        error: 'Cadastro de congregações ainda não migrado. Rode: npm run migrate:congregations',
      });
      return;
    }
    console.error('[users/congregations]', error);
    res.status(500).json({ error: 'Erro ao listar congregações.' });
  }
});

/** Lista todos os usuários do sistema (admin vê todos, com ou sem congregação). */
router.get('/', requireAuth, requirePermission('user:manage'), async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT u.id, u.name, u.email, u.role_id, u.active_cep, u.blocked, u.created_at,
              r.slug AS role_slug, r.name AS role_name
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       ORDER BY u.name ASC`,
    );
    const names = await congregationNameByCep();
    const namesFallback = await listCongregationNames();
    for (const [cep, name] of namesFallback) {
      if (!names.has(cep)) names.set(cep, name);
    }
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
          blocked: Boolean(u.blocked),
          created_at: u.created_at,
        };
      }),
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (/active_cep|Unknown column/i.test(msg)) {
      // Banco ainda sem a migração active_cep: lista sem o vínculo de congregação.
      const [rows] = await pool.execute(
        `SELECT u.id, u.name, u.email, u.role_id, u.blocked, u.created_at,
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
          blocked: Boolean(u.blocked),
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
    const { name, email, password, role_id, congregation_id } = parsed.data;
    const emailNorm = email.toLowerCase();

    let activeCep = formatCep(resolveWorkingCep(creator));
    if (congregation_id != null) {
      const cep = await congregationCepById(congregation_id);
      if (!cep) {
        res.status(400).json({ error: 'Congregação não encontrada.' });
        return;
      }
      activeCep = cep;
    }

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

    const { name, email, role_id, password, congregation_id } = parsed.data;

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
    if (congregation_id !== undefined) {
      if (congregation_id == null) {
        sets.push('active_cep = ?');
        params.push(null);
      } else {
        const cep = await congregationCepById(congregation_id);
        if (!cep) {
          res.status(400).json({ error: 'Congregação não encontrada.' });
          return;
        }
        sets.push('active_cep = ?');
        params.push(cep);
      }
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

/** Bloqueia ou desbloqueia um usuário (bloqueado não consegue entrar). */
router.put('/:id/block-status', requireAuth, requirePermission('user:manage'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: 'ID inválido.' });
      return;
    }
    const authUser = (req as AuthedRequest).user;
    const blocked = req.body?.blocked === true || req.body?.blocked === 'true';

    if (authUser.id === id) {
      res.status(400).json({ error: 'Você não pode bloquear a própria conta.' });
      return;
    }

    const [rows] = await pool.execute('SELECT id FROM users WHERE id = ?', [id]);
    if (!(rows as unknown[]).length) {
      res.status(404).json({ error: 'Usuário não encontrado.' });
      return;
    }

    try {
      await pool.execute('UPDATE users SET blocked = ? WHERE id = ?', [blocked ? 1 : 0, id]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/blocked|Unknown column/i.test(msg)) throw err;
      res.status(503).json({
        error: 'Bloqueio de usuário ainda não migrado. Rode: npm run migrate:user-blocked',
      });
      return;
    }

    // Usuário bloqueado: remove a presença online/GPS na hora — sai do chat e do mapa já.
    if (blocked) {
      removeSessionPresence(id);
      removeGpsPresence(id);
    }

    res.json({ message: blocked ? 'Usuário bloqueado.' : 'Usuário desbloqueado.', blocked });
  } catch (error) {
    console.error('[users/block-status]', error);
    res.status(500).json({ error: 'Erro ao atualizar o bloqueio do usuário.' });
  }
});

/** Lista as permissões exclusivas (além do papel) de um usuário. */
router.get('/permissions/:id', requireAuth, requirePermission('user:manage'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: 'ID inválido.' });
    return;
  }
  try {
    const [users] = await pool.execute(
      'SELECT u.id, u.role_id FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.id = ?',
      [id],
    );
    const target = (users as Array<{ id: number; role_id: number | null }>)[0];
    if (!target) {
      res.status(404).json({ error: 'Usuário não encontrado.' });
      return;
    }

    let rolePermissions: string[] = [];
    if (target.role_id != null) {
      try {
        const [permRows] = await pool.execute(
          'SELECT permission FROM role_permissions WHERE role_id = ?',
          [target.role_id],
        );
        rolePermissions = (permRows as Array<{ permission: string }>)
          .map((p) => p.permission)
          .filter(isScope);
      } catch {
        rolePermissions = [];
      }
    }

    let extraPermissions: string[] = [];
    try {
      const [extraRows] = await pool.execute(
        'SELECT permission FROM user_permissions WHERE user_id = ? ORDER BY permission',
        [id],
      );
      extraPermissions = (extraRows as Array<{ permission: string }>)
        .map((p) => p.permission)
        .filter(isScope);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const code = (err as { code?: string })?.code;
      if (/user_permissions|Unknown table|doesn't exist|não existe/i.test(msg) || code === 'ER_NO_SUCH_TABLE') {
        res.status(503).json({
          error:
            'Permissões exclusivas por usuário ainda não migradas. Rode: npm run migrate:user-permissions',
        });
        return;
      }
      console.error('[users/permissions] get', err);
      throw err;
    }

    res.json({ scopes: [...SCOPES], role_permissions: rolePermissions, extra_permissions: extraPermissions });
  } catch (error) {
    console.error('[users/permissions] get', error);
    res.status(500).json({ error: 'Erro ao carregar permissões do usuário.' });
  }
});

/** Define as permissões exclusivas (além do papel) de um usuário.
 *  Body: { permissions: string[] } — substitui o conjunto extra atual. */
router.put('/permissions/:id', requireAuth, requirePermission('user:manage'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: 'ID inválido.' });
    return;
  }
  try {
    const [users] = await pool.execute('SELECT id FROM users WHERE id = ?', [id]);
    if (!(users as unknown[]).length) {
      res.status(404).json({ error: 'Usuário não encontrado.' });
      return;
    }

    const raw = (req.body as { permissions?: unknown })?.permissions;
    if (!Array.isArray(raw)) {
      res.status(400).json({ error: 'Informe a lista de permissões.' });
      return;
    }
    const permissions = raw.filter((p): p is Scope => typeof p === 'string' && isScope(p));
    const unique = [...new Set(permissions)];

    try {
      await pool.execute('DELETE FROM user_permissions WHERE user_id = ?', [id]);
      for (const permission of unique) {
        await pool.execute(
          'INSERT INTO user_permissions (user_id, permission) VALUES (?, ?)',
          [id, permission],
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const code = (err as { code?: string })?.code;
      if (/user_permissions|Unknown table|doesn't exist|não existe/i.test(msg) || code === 'ER_NO_SUCH_TABLE') {
        res.status(503).json({
          error:
            'Permissões exclusivas por usuário ainda não migradas. Rode: npm run migrate:user-permissions',
        });
        return;
      }
      console.error('[users/permissions] put', err);
      throw err;
    }

    res.json({ extra_permissions: unique });
  } catch (error) {
    console.error('[users/permissions] put', error);
    res.status(500).json({ error: 'Erro ao salvar permissões do usuário.' });
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
