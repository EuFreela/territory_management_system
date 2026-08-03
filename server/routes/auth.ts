import { Router } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../lib/db.js';
import { cookieOptions, getUserFromRequest, signToken } from '../lib/auth.js';
import { loginSchema, registerSchema } from '../lib/validations.js';

const router = Router();

router.post('/register', async (req, res) => {
  try {
    const parsed = registerSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' });
      return;
    }

    const { name, email, password } = parsed.data;
    const passwordHash = await bcrypt.hash(password, 10);

    const [result] = await pool.execute(
      'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
      [name.trim(), email.toLowerCase(), passwordHash],
    );

    const insertResult = result as { insertId?: number };
    res.status(201).json({ id: insertResult.insertId, message: 'Usuário registrado com sucesso.' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '';
    const status = message.toLowerCase().includes('duplicate') ? 409 : 500;
    res.status(status).json({
      error: status === 409 ? 'Email já cadastrado.' : 'Erro ao registrar usuário.',
    });
  }
});

router.post('/login', async (req, res) => {
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

    if (!user) {
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
    res.json({
      message: 'Login realizado com sucesso.',
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (error) {
    console.error('[auth/login]', error);
    res.status(500).json({ error: 'Erro ao fazer login.' });
  }
});

router.post('/logout', (_req, res) => {
  res.clearCookie('auth_token', cookieOptions);
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

export default router;
