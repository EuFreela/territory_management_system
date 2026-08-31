import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import pool from '../lib/db.js';
import { cookieOptions, getUserFromRequest, signToken } from '../lib/auth.js';
import { loadRbacUserById } from '../lib/load-user.js';
import { isStrongPassword } from '../lib/password.js';
import { normalizeThemePreference } from '../lib/rbac.js';
import { changePasswordSchema, loginSchema } from '../lib/validations.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { requireAuth, type AuthedRequest } from '../middleware/requireAuth.js';

const router = Router();

const BCRYPT_ROUNDS = 12;

const loginLimiter = rateLimit({
  name: 'auth-login',
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyExtra: (req) => String((req.body as { email?: string })?.email ?? '').toLowerCase(),
});

const changePasswordLimiter = rateLimit({
  name: 'auth-change-password',
  windowMs: 15 * 60 * 1000,
  max: 8,
});

/** Cadastro público desabilitado nesta versão (usuários só via seed/admin/DB). */
router.post('/register', (_req, res) => {
  res.status(403).json({
    error: 'Cadastro de usuários desabilitado. Solicite acesso ao administrador.',
  });
});

router.post('/login', loginLimiter, async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' });
      return;
    }

    const { email, password } = parsed.data;
    const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
    const users = rows as Array<{ id: number; name: string; email: string; password_hash: string }>;
    const user = users[0];

    // Mesma mensagem e custo aproximado (hash dummy) se usuário não existe — mitiga enumeração
    if (!user) {
      await bcrypt.hash(password, BCRYPT_ROUNDS);
      res.status(401).json({ error: 'Credenciais inválidas.' });
      return;
    }

    let validPassword = false;
    try {
      validPassword = await bcrypt.compare(password, user.password_hash);
    } catch {
      res.status(401).json({ error: 'Credenciais inválidas.' });
      return;
    }

    if (!validPassword) {
      res.status(401).json({ error: 'Credenciais inválidas.' });
      return;
    }

    if ((user as { blocked?: boolean }).blocked) {
      res.status(403).json({ error: 'Sua conta está bloqueada pelo administrador.' });
      return;
    }

    const token = await signToken({ id: user.id, email: user.email, name: user.name });
    res.cookie('auth_token', token, cookieOptions);

    const passwordIsWeak = !isStrongPassword(password);
    const rbacUser = (await loadRbacUserById(user.id)) ?? {
      id: user.id,
      email: user.email,
      name: user.name,
      role: null,
      permissions: [],
      isAdmin: false,
      theme_preference: 'light' as const,
      active_cep: null,
      working_cep: '',
      congregation_name: null,
      blocked: false,
    };

    res.json({
      message: 'Login realizado com sucesso.',
      user: rbacUser,
      password_is_weak: passwordIsWeak,
    });
  } catch (error) {
    console.error('[auth/login]', error);
    res.status(500).json({ error: 'Erro ao fazer login.' });
  }
});

router.post('/logout', (_req, res) => {
  res.clearCookie('auth_token', { ...cookieOptions, maxAge: 0 });
  res.json({ message: 'Logout realizado com sucesso.' });
});

router.get('/me', async (req, res) => {
  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: 'Não autorizado' });
    return;
  }
  res.json(user);
});

const themeSchema = z.object({
  theme: z.enum(['light', 'dark']),
});

const profileSchema = z.object({
  // Só o nome pode ser editado pelo próprio usuário (email e papel ficam restritos ao admin)
  name: z
    .string()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(150)
    .transform((v) => v.trim())
    .refine((v) => v.length >= 2, 'Nome deve ter pelo menos 2 caracteres'),
});

/** Preferência de tema (light/dark) salva no usuário logado */
router.put('/theme', requireAuth, async (req, res) => {
  try {
    const parsed = themeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Tema inválido.' });
      return;
    }

    const authUser = (req as AuthedRequest).user;
    const theme = normalizeThemePreference(parsed.data.theme);

    try {
      await pool.execute('UPDATE users SET theme_preference = ? WHERE id = ?', [theme, authUser.id]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/theme_preference|Unknown column/i.test(msg)) {
        res.status(503).json({
          error: 'Preferência de tema ainda não migrada. Rode: npm run migrate:theme',
        });
        return;
      }
      throw err;
    }

    const user = (await loadRbacUserById(authUser.id)) ?? {
      ...authUser,
      theme_preference: theme,
    };

    res.json({ message: 'Tema atualizado.', theme, user });
  } catch (error) {
    console.error('[auth/theme]', error);
    res.status(500).json({ error: 'Erro ao salvar tema.' });
  }
});

/** Edita o nome do próprio usuário (qualquer papel). Email e papel: restritos ao admin. */
router.put('/profile', requireAuth, async (req, res) => {
  try {
    const parsed = profileSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' });
      return;
    }

    const authUser = (req as AuthedRequest).user;
    const name = parsed.data.name;

    await pool.execute('UPDATE users SET name = ? WHERE id = ?', [name, authUser.id]);

    // Reemite cookie com o nome atualizado (payload do token fica consistente)
    const token = await signToken({ id: authUser.id, email: authUser.email, name });
    res.cookie('auth_token', token, cookieOptions);

    const user = (await loadRbacUserById(authUser.id)) ?? { ...authUser, name };
    res.json({ message: 'Nome atualizado com sucesso.', user });
  } catch (error) {
    console.error('[auth/profile]', error);
    res.status(500).json({ error: 'Erro ao atualizar perfil.' });
  }
});

/** Trocar senha (autenticado) — força política forte na nova senha */
router.post('/change-password', requireAuth, changePasswordLimiter, async (req, res) => {
  try {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' });
      return;
    }

    const authUser = (req as AuthedRequest).user;
    const { current_password, new_password } = parsed.data;

    if (current_password === new_password) {
      res.status(400).json({ error: 'A nova senha deve ser diferente da atual.' });
      return;
    }

    const [rows] = await pool.execute('SELECT id, password_hash FROM users WHERE id = ?', [
      authUser.id,
    ]);
    const list = rows as Array<{ id: number; password_hash: string | null }>;
    const row = list[0];
    if (!row) {
      res.status(404).json({ error: 'Usuário não encontrado.' });
      return;
    }

    if (!row.password_hash) {
      res.status(400).json({
        error: 'Esta conta entrou só com Google e não tem senha. Defina uma senha em Perfil.',
      });
      return;
    }

    const ok = await bcrypt.compare(current_password, row.password_hash);
    if (!ok) {
      res.status(401).json({ error: 'Senha atual incorreta.' });
      return;
    }

    const passwordHash = await bcrypt.hash(new_password, BCRYPT_ROUNDS);
    await pool.execute('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, authUser.id]);

    // Reemite cookie com sessão nova
    const token = await signToken({
      id: authUser.id,
      email: authUser.email,
      name: authUser.name,
    });
    res.cookie('auth_token', token, cookieOptions);

    res.json({ message: 'Senha atualizada com sucesso.' });
  } catch (error) {
    console.error('[auth/change-password]', error);
    res.status(500).json({ error: 'Erro ao alterar senha.' });
  }
});

export default router;
