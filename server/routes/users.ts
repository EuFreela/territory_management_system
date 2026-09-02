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
import { requireAdmin, requirePermission } from '../middleware/requirePermission.js';

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

/** Escopos que elevam o alcance de um usuário (não são "usuário comum"). */
const ELEVATED_USER_SCOPES: Scope[] = ['user:manage', 'config:cep', 'congregation:manage'];

/** Gestor restrito = tem user:manage mas não é admin → gerencia só a própria congregação. */
function isRestrictedManager(authUser: AuthedRequest['user']): boolean {
  return !authUser.isAdmin;
}

/** CEP efetivo da congregação do usuário (null/ausente cai no CEP padrão do sistema). */
function congregationCepOf(activeCep: string | null | undefined): string {
  try {
    return resolveWorkingCep({ active_cep: activeCep ?? null });
  } catch {
    return formatCep(onlyDigits(activeCep ?? ''));
  }
}

function inSameCongregation(
  authUser: AuthedRequest['user'],
  activeCep: string | null | undefined,
): boolean {
  const own = onlyDigits(congregationCepOf(authUser.active_cep));
  const other = onlyDigits(congregationCepOf(activeCep));
  return own.length === 8 && own === other;
}

/** Verdadeiro se o usuário alvo for admin ou tiver escopo elevado (não é usuário comum). */
async function targetIsPrivileged(userId: number): Promise<boolean> {
  const elevPlaceholders = ELEVATED_USER_SCOPES.map(() => '?').join(', ');
  const sql = `SELECT
      (SELECT COUNT(*) FROM roles r WHERE r.id = u.role_id AND r.slug = ?) AS is_admin,
      (SELECT COUNT(*) FROM role_permissions rp
         INNER JOIN roles r ON r.id = rp.role_id AND r.id = u.role_id
         WHERE rp.permission IN (${elevPlaceholders})) AS from_role,
      (SELECT COUNT(*) FROM user_permissions up
         WHERE up.user_id = u.id AND up.permission IN (${elevPlaceholders})) AS from_extra
    FROM users u
    WHERE u.id = ?
    LIMIT 1`;
  try {
    const [rows] = await pool.execute(sql, [
      ROLE_ADMIN,
      ...ELEVATED_USER_SCOPES,
      ...ELEVATED_USER_SCOPES,
      userId,
    ]);
    const row = (rows as Array<{ is_admin: number; from_role: number; from_extra: number }>)[0];
    if (!row) return true;
    return Number(row.is_admin) > 0 || Number(row.from_role) > 0 || Number(row.from_extra) > 0;
  } catch {
    return true;
  }
}

async function roleSlugById(roleId: number): Promise<string | null> {
  try {
    const [rows] = await pool.execute('SELECT slug FROM roles WHERE id = ?', [roleId]);
    return (rows as Array<{ slug: string }>)[0]?.slug ?? null;
  } catch {
    return null;
  }
}

/** Slug para papel: minúsculo, sem acentos, hífens (ex.: "Editor de mapa" → editor-de-mapa). */
function slugifyRoleName(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug;
}

const upsertRoleSchema = z.object({
  name: z
    .string()
    .min(2, 'Nome do papel deve ter pelo menos 2 caracteres')
    .max(100)
    .transform((v) => v.trim())
    .refine((v) => v.length >= 2, 'Nome do papel deve ter pelo menos 2 caracteres'),
  description: z
    .string()
    .max(255, 'Descrição deve ter no máximo 255 caracteres')
    .optional()
    .nullable()
    .transform((v) => (v == null ? null : v.trim() || null)),
  permissions: z
    .array(z.string())
    .min(1, 'Selecione ao menos uma permissão para o papel')
    .refine((arr) => arr.every(isScope), 'Permissão inválida.'),
});

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
      `SELECT r.id, r.slug, r.name, r.description, r.is_system,
              (SELECT COUNT(*) FROM role_permissions rp WHERE rp.role_id = r.id) AS permission_count
       FROM roles r
       ORDER BY r.id ASC`,
    );
    const roles = rows as Array<{
      id: number;
      slug: string;
      name: string;
      description: string | null;
      is_system: number;
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
        is_system: Boolean(role.is_system),
        permissions: (perms as Array<{ permission: string }>).map((p) => p.permission),
      });
    }

    res.json({ roles: withPerms, scopes: SCOPES });
  } catch (error) {
    console.error('[users/roles]', error);
    res.status(500).json({ error: 'Erro ao listar papéis. Rode a migração RBAC.' });
  }
});

/** Cria papel customizado (slugs únicos; somente admin). */
router.post('/roles', requireAuth, requireAdmin, async (req, res) => {
  try {
    const parsed = upsertRoleSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' });
      return;
    }

    const { name, description, permissions } = parsed.data;
    const slug = slugifyRoleName(name);
    if (!slug) {
      res.status(400).json({ error: 'O nome informado gera um identificador inválido.' });
      return;
    }

    const [dup] = await pool.execute('SELECT id FROM roles WHERE slug = ?', [slug]);
    if ((dup as unknown[]).length) {
      res.status(409).json({ error: 'Já existe um papel com esse nome.' });
      return;
    }

    const [ins] = await pool.execute(
      'INSERT INTO roles (slug, name, description, is_system) VALUES (?, ?, ?, 0)',
      [slug, name, description],
    );
    const roleId = (ins as { insertId: number }).insertId;
    const unique = [...new Set(permissions)];
    for (const permission of unique) {
      await pool.execute(
        'INSERT INTO role_permissions (role_id, permission) VALUES (?, ?)',
        [roleId, permission],
      );
    }

    res.status(201).json({
      role: { id: roleId, slug, name, description, is_system: false, permissions: unique },
    });
  } catch (error) {
    console.error('[users/roles] create', error);
    res.status(500).json({ error: 'Erro ao criar papel.' });
  }
});

/** Edita nome, descrição e permissões de um papel (o papel admin é protegido). */
router.put('/roles/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: 'ID inválido.' });
      return;
    }

    const [rows] = await pool.execute('SELECT id, slug, name, description, is_system FROM roles WHERE id = ?', [id]);
    const role = (rows as Array<{ id: number; slug: string; name: string; description: string | null; is_system: number }>)[0];
    if (!role) {
      res.status(404).json({ error: 'Papel não encontrado.' });
      return;
    }
    if (role.slug === ROLE_ADMIN) {
      res.status(400).json({ error: 'O papel administrador não pode ser alterado.' });
      return;
    }

    const parsed = upsertRoleSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' });
      return;
    }

    const { name, description, permissions } = parsed.data;
    const slug = slugifyRoleName(name);
    if (slug && slug !== role.slug) {
      const [dup] = await pool.execute('SELECT id FROM roles WHERE slug = ? AND id <> ?', [slug, id]);
      if ((dup as unknown[]).length) {
        res.status(409).json({ error: 'Já existe um papel com esse nome.' });
        return;
      }
    }

    await pool.execute('UPDATE roles SET name = ?, description = ?, slug = ? WHERE id = ?', [
      name,
      description,
      slug || role.slug,
      id,
    ]);

    const unique = [...new Set(permissions)];
    await pool.execute('DELETE FROM role_permissions WHERE role_id = ?', [id]);
    for (const permission of unique) {
      await pool.execute(
        'INSERT INTO role_permissions (role_id, permission) VALUES (?, ?)',
        [id, permission],
      );
    }

    res.json({
      role: { id, slug: slug || role.slug, name, description, is_system: Boolean(role.is_system), permissions: unique },
    });
  } catch (error) {
    console.error('[users/roles] update', error);
    res.status(500).json({ error: 'Erro ao atualizar papel.' });
  }
});

/** Exclui papel customizado (somente admin; papel de sistema e admin são protegidos). */
router.delete('/roles/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: 'ID inválido.' });
      return;
    }

    const [rows] = await pool.execute('SELECT id, slug, is_system FROM roles WHERE id = ?', [id]);
    const role = (rows as Array<{ id: number; slug: string; is_system: number }>)[0];
    if (!role) {
      res.status(404).json({ error: 'Papel não encontrado.' });
      return;
    }
    if (role.slug === ROLE_ADMIN) {
      res.status(400).json({ error: 'O papel administrador não pode ser excluído.' });
      return;
    }
    if (role.is_system) {
      res.status(403).json({ error: 'Papéis de sistema não podem ser excluídos.' });
      return;
    }

    const [inUse] = await pool.execute(
      'SELECT COUNT(*) AS c FROM users WHERE role_id = ?',
      [id],
    );
    if (Number((inUse as Array<{ c: number }>)[0]?.c ?? 0) > 0) {
      res.status(400).json({ error: 'Este papel está em uso por usuário(s). Reatribua-os antes de excluir.' });
      return;
    }

    await pool.execute('DELETE FROM roles WHERE id = ?', [id]);
    res.json({ message: 'Papel excluído com sucesso.' });
  } catch (error) {
    console.error('[users/roles] delete', error);
    res.status(500).json({ error: 'Erro ao excluir papel.' });
  }
});

/**
 * Lista congregações para o formulário de usuário.
 * Sem ?q: retorna as últimas 5 cadastradas (para o select rápido).
 * Com ?q: busca por nome ou CEP (resultados limitados).
 */
router.get('/congregations', requireAuth, requirePermission('user:manage'), async (req, res) => {
  try {
    const authUser = (req as AuthedRequest).user;
    const restricted = isRestrictedManager(authUser);
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    let sql: string;
    let params: Array<string | number> = [];
    if (restricted) {
      // Gestor restrito só vê a própria congregação (CEP do usuário logado).
      const digits = onlyDigits(congregationCepOf(authUser.active_cep));
      sql = `SELECT c.id, c.cep, c.name, c.address
             FROM congregations c
             WHERE REPLACE(REPLACE(COALESCE(c.cep, ''), '-', ''), ' ', '') = ?
             ORDER BY c.name ASC
             LIMIT 50`;
      params = [digits];
    } else if (q) {
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
  const authUser = (req as AuthedRequest).user;
  const restricted = isRestrictedManager(authUser);
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
    const list = (rows as Array<Record<string, unknown>>).map((u) => {
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
    });
    // Gestor restrito vê apenas os usuários da própria congregação.
    res.json(restricted ? list.filter((u) => inSameCongregation(authUser, u.active_cep)) : list);
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
      const list = (rows as Array<Record<string, unknown>>).map((u) => ({
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
      }));
      res.json(restricted ? list.filter((u) => inSameCongregation(authUser, u.active_cep)) : list);
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
    const restricted = isRestrictedManager(creator);
    const { name, email, password, role_id, congregation_id } = parsed.data;
    const emailNorm = email.toLowerCase();

    if (restricted) {
      // Gestor restrito não cria administradores nem usuários de outras congregações.
      if (role_id != null && (await roleSlugById(role_id)) === ROLE_ADMIN) {
        res.status(403).json({ error: 'Você não pode criar usuários com papel administrador.' });
        return;
      }
    }

    let activeCep = formatCep(resolveWorkingCep(creator));
    if (congregation_id != null) {
      const cep = await congregationCepById(congregation_id);
      if (!cep) {
        res.status(400).json({ error: 'Congregação não encontrada.' });
        return;
      }
      if (restricted && !inSameCongregation(creator, cep)) {
        res.status(403).json({ error: 'Você só pode criar usuários na sua própria congregação.' });
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
      `SELECT u.id, u.role_id, u.active_cep, r.slug AS role_slug
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.id = ?`,
      [id],
    );
    const target = (rows as Array<{
      id: number;
      role_id: number | null;
      active_cep: string | null;
      role_slug: string | null;
    }>)[0];
    if (!target) {
      res.status(404).json({ error: 'Usuário não encontrado.' });
      return;
    }

    const authUser = (req as AuthedRequest).user;
    const restricted = isRestrictedManager(authUser);
    if (restricted) {
      // Somente o administrador edita administradores ou usuários com escopo elevado;
      // gestores restritos só mexem em usuários comuns da própria congregação.
      const isAdminTarget = target.role_slug === ROLE_ADMIN;
      if (
        isAdminTarget ||
        (id !== authUser.id && (await targetIsPrivileged(id))) ||
        !inSameCongregation(authUser, target.active_cep)
      ) {
        res.status(403).json({
          error: 'Você só pode gerenciar usuários comuns da sua própria congregação.',
        });
        return;
      }
    }

    const { name, email, role_id, password, congregation_id } = parsed.data;

    if (restricted && role_id != null && (await roleSlugById(role_id)) === ROLE_ADMIN) {
      res.status(403).json({ error: 'Você não pode definir o papel administrador.' });
      return;
    }

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
        if (restricted && !inSameCongregation(authUser, null)) {
          res.status(403).json({ error: 'Você só pode manter usuários na sua congregação.' });
          return;
        }
        sets.push('active_cep = ?');
        params.push(null);
      } else {
        const cep = await congregationCepById(congregation_id);
        if (!cep) {
          res.status(400).json({ error: 'Congregação não encontrada.' });
          return;
        }
        if (restricted && !inSameCongregation(authUser, cep)) {
          res.status(403).json({ error: 'Você só pode manter usuários na sua congregação.' });
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

    const [rows] = await pool.execute(
      `SELECT u.id, u.active_cep, r.slug AS role_slug
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.id = ?`,
      [id],
    );
    const target = (rows as Array<{ id: number; active_cep: string | null; role_slug: string | null }>)[0];
    if (!target) {
      res.status(404).json({ error: 'Usuário não encontrado.' });
      return;
    }

    // Gestor restrito: só bloqueia/desbloqueia usuários comuns da própria congregação.
    // Somente o administrador bloqueia administradores.
    if (isRestrictedManager(authUser) && target.role_slug === ROLE_ADMIN) {
      res.status(403).json({
        error: 'Somente o administrador pode bloquear um administrador.',
      });
      return;
    }
    if (isRestrictedManager(authUser)) {
      if ((await targetIsPrivileged(id)) || !inSameCongregation(authUser, target.active_cep)) {
        res.status(403).json({
          error: 'Você só pode bloquear usuários comuns da sua própria congregação.',
        });
        return;
      }
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
    const authUser = (req as AuthedRequest).user;
    const restricted = isRestrictedManager(authUser);
    if (restricted) {
      // Permissões exclusivas: restrito ao administrador.
      res.status(403).json({
        error: 'Permissões exclusivas são restritas ao administrador.',
      });
      return;
    }

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
    const authUser = (req as AuthedRequest).user;
    const restricted = isRestrictedManager(authUser);
    if (restricted) {
      // Editar permissões exclusivas: restrito ao administrador.
      res.status(403).json({
        error: 'Permissões exclusivas são restritas ao administrador.',
      });
      return;
    }

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
      `SELECT u.id, u.active_cep, r.slug AS role_slug
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.id = ?`,
      [id],
    );
    const target = (rows as Array<{ id: number; active_cep: string | null; role_slug: string | null }>)[0];
    if (!target) {
      res.status(404).json({ error: 'Usuário não encontrado.' });
      return;
    }

    // Gestor restrito: só exclui usuários comuns da própria congregação.
    // Somente o administrador exclui administradores.
    if (isRestrictedManager(authUser) && target.role_slug === ROLE_ADMIN) {
      res.status(403).json({
        error: 'Somente o administrador pode excluir um administrador.',
      });
      return;
    }
    if (isRestrictedManager(authUser)) {
      if ((await targetIsPrivileged(id)) || !inSameCongregation(authUser, target.active_cep)) {
        res.status(403).json({
          error: 'Você só pode excluir usuários comuns da sua própria congregação.',
        });
        return;
      }
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
