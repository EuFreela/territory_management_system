import { Router } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../lib/db.js';
import { cookieOptions, getUserFromRequest, signToken } from '../lib/auth.js';
import { isStrongPassword } from '../lib/password.js';
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

    const token = await signToken({ id: user.id, email: user.email, name: user.name });
    res.cookie('auth_token', token, cookieOptions);

    const passwordIsWeak = !isStrongPassword(password);

    res.json({
      message: 'Login realizado com sucesso.',
      user: { id: user.id, email: user.email, name: user.name },
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
    const list = rows as Array<{ id: number; password_hash: string }>;
    const row = list[0];
    if (!row) {
      res.status(404).json({ error: 'Usuário não encontrado.' });
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
