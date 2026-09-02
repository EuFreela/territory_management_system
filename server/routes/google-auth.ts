import { randomBytes } from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import { createLocalJWKSet, jwtVerify } from 'jose';
import pool from '../lib/db.js';
import { cookieOptions, cookieSecure, signToken } from '../lib/auth.js';
import { loadRbacUserById } from '../lib/load-user.js';
import { resolveWorkingCep } from '../lib/map-config.js';
import { rateLimit } from '../middleware/rateLimit.js';

const router = Router();

/** Papel padrão de contas criadas automaticamente ao entrar com Google
 *  (visualizador = menor privilégio: apenas leitura de territórios). */
const DEFAULT_GOOGLE_ROLE = 'viewer';

const GOOGLE_CLIENT_ID = (process.env.GOOGLE_CLIENT_ID || '').trim();
const GOOGLE_CLIENT_SECRET = (process.env.GOOGLE_CLIENT_SECRET || '').trim();
/** Opcional: lista de e-mails permitidos (separados por vírgula). Quando vazia,
 *  o Google só permite o login de contas que JÁ existem no sistema (não cria
 *  usuários novos automaticamente), evitando "registro aberto". */
const GOOGLE_ALLOWED_EMAILS = (process.env.GOOGLE_ALLOWED_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function googleLoginEnabled() {
  return Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
}

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';

function appOrigin() {
  return (process.env.VITE_APP_URL || '').trim().replace(/\/+$/, '');
}

/**
 * URI de callback que o Google deve chamar de volta.
 * Usa VITE_APP_URL quando definido (origem estável, independente do Host do proxy);
 * caso contrário, cai no host da requisição.
 */
function buildRedirectUri(req: Request) {
  const origin = appOrigin();
  if (origin) {
    return `${origin}/api/auth/google/callback`;
  }
  return `${req.protocol}://${req.get('host')}/api/auth/google/callback`;
}

const loginLimiter = rateLimit({
  name: 'google-login',
  windowMs: 15 * 60 * 1000,
  max: 10,
});

const callbackLimiter = rateLimit({
  name: 'google-callback',
  windowMs: 15 * 60 * 1000,
  max: 30,
});

function stateCookieOptions() {
  return {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 10 * 60 * 1000,
  };
}

/** Início do fluxo: redireciona para a tela de autorização do Google */
router.get('/google', loginLimiter, (req, res) => {
  try {
    if (!googleLoginEnabled()) {
      res.status(503).json({ error: 'Login com Google não configurado no servidor.' });
      return;
    }

    const state = randomBytes(24).toString('hex');
    const redirectUri = buildRedirectUri(req);

    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      prompt: 'select_account',
      access_type: 'online',
      // Evita que a sessão do Google seja reutilizada sem escolha de conta
      include_granted_scopes: 'true',
    });

    res.cookie('oauth_state', state, stateCookieOptions());
    res.redirect(`${AUTH_URL}?${params.toString()}`);
  } catch (error) {
    console.error('[auth/google]', error);
    res.status(500).json({ error: 'Erro ao iniciar login com Google.' });
  }
});

type GoogleClaims = {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
};

let cachedJwks: { keys: Array<Record<string, unknown>> } | null = null;
let jwksFetchedAt = 0;

async function getJwks(force = false) {
  if (!force && cachedJwks && Date.now() - jwksFetchedAt < 60 * 60 * 1000) {
    return cachedJwks;
  }
  const response = await fetch(JWKS_URL);
  if (!response.ok) {
    throw new Error('Não foi possível obter as chaves de verificação do Google.');
  }
  cachedJwks = (await response.json()) as { keys: Array<Record<string, unknown>> };
  jwksFetchedAt = Date.now();
  return cachedJwks;
}

/** Verifica o id_token do Google localmente (jose + JWKS com cache e re-fetch em rotação) */
async function verifyGoogleIdToken(idToken: string): Promise<GoogleClaims> {
  const verify = async (keys: Array<Record<string, unknown>>) => {
    const { payload } = await jwtVerify(idToken, createLocalJWKSet({ keys }), {
      issuer: ['accounts.google.com', 'https://accounts.google.com'],
      audience: GOOGLE_CLIENT_ID,
    });
    return payload as GoogleClaims;
  };

  try {
    return await verify((await getJwks()).keys);
  } catch {
    // Possível rotação de chaves: busca keyset novo e tenta mais uma vez
    return await verify((await getJwks(true)).keys);
  }
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Erro desconhecido.';
}

function redirectToLogin(res: Response, message: string) {
  const origin = appOrigin() || 'http://localhost:3000';
  res.redirect(`${origin}/login?error=${encodeURIComponent(message)}`);
}

/** Callback: recebe o code, troca por tokens, verifica e abre a sessão */
router.get('/google/callback', callbackLimiter, async (req, res) => {
  try {
    if (!googleLoginEnabled()) {
      redirectToLogin(res, 'Login com Google não configurado no servidor.');
      return;
    }

    const expectedState = req.cookies?.oauth_state as string | undefined;
    const sentState = typeof req.query.state === 'string' ? req.query.state : '';
    res.clearCookie('oauth_state', { ...stateCookieOptions(), maxAge: 0 });

    if (!expectedState || !sentState || expectedState !== sentState) {
      redirectToLogin(res, 'Sessão de login inválida. Tente novamente.');
      return;
    }

    const code = typeof req.query.code === 'string' ? req.query.code : '';
    if (!code) {
      redirectToLogin(res, 'Autorização não concedida.');
      return;
    }

    const redirectUri = buildRedirectUri(req);

    // Troca o código de autorização por tokens
    const tokenResponse = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    const tokenData = (await tokenResponse.json()) as { id_token?: string; error?: string };
    if (!tokenResponse.ok || !tokenData.id_token) {
      console.error('[auth/google/callback] token exchange:', tokenData.error || 'sem id_token');
      redirectToLogin(res, 'Não foi possível concluir a autenticação com o Google.');
      return;
    }

    // Verifica o id_token (assinatura, emissor, público e expiração)
    const claims = await verifyGoogleIdToken(tokenData.id_token);

    if (claims.email_verified !== true || !claims.email) {
      redirectToLogin(res, 'O e-mail da conta Google não foi verificado.');
      return;
    }

    const email = claims.email.trim().toLowerCase();

    const allowlistActive = GOOGLE_ALLOWED_EMAILS.length > 0;
    if (allowlistActive && !GOOGLE_ALLOWED_EMAILS.includes(email)) {
      redirectToLogin(res, 'Este e-mail não está autorizado a entrar no CAMPO.');
      return;
    }

    // Busca ou cria o usuário
    const [rows] = await pool.execute(
      'SELECT id, name, email FROM users WHERE email = ? LIMIT 1',
      [email],
    );
    const existing = (rows as Array<{ id: number; name: string; email: string }>)[0];

    let userId = existing?.id;

    if (!userId) {
      // Sem allowlist configurada, não criamos contas novas por conta própria —
      // evita o "registro aberto por Google" (qualquer e-mail verificado entra).
      // O administrador deve adicionar o e-mail a GOOGLE_ALLOWED_EMAILS ou criar
      // o usuário para que o acesso por Google funcione.
      if (!allowlistActive) {
        redirectToLogin(res, 'Conta não encontrada. Fale com o administrador para obter acesso.');
        return;
      }
      const name = (claims.name || claims.given_name || email.split('@')[0] || 'Usuário').trim().slice(
        0,
        150,
      );
      const [fieldRole] = await pool.execute('SELECT id FROM roles WHERE slug = ?', [
        DEFAULT_GOOGLE_ROLE,
      ]);
      const roleId = (fieldRole as Array<{ id: number }>)[0]?.id ?? null;

      try {
        const defaultCep = resolveWorkingCep(null);
        let insertResult;
        try {
          [insertResult] = await pool.execute(
            'INSERT INTO users (name, email, password_hash, role_id, active_cep) VALUES (?, ?, NULL, ?, ?)',
            [name, email, roleId, defaultCep],
          );
        } catch (inner) {
          const innerMsg = extractErrorMessage(inner);
          if (!/active_cep|Unknown column/i.test(innerMsg)) throw inner;
          [insertResult] = await pool.execute(
            'INSERT INTO users (name, email, password_hash, role_id) VALUES (?, ?, NULL, ?)',
            [name, email, roleId],
          );
        }
        userId = Number((insertResult as { insertId: number }).insertId);
      } catch (err) {
        const msg = extractErrorMessage(err);
        if (/password_hash|doesn't have a default/i.test(msg)) {
          redirectToLogin(
            res,
            'Estrutura do banco desatualizada. Rode: npm run migrate:google-oauth',
          );
          return;
        }
        throw err;
      }
    }

    const token = await signToken({
      id: userId,
      email,
      name: existing?.name || (claims.name || '').slice(0, 150),
    });
    res.cookie('auth_token', token, cookieOptions);

    const origin = appOrigin() || 'http://localhost:3000';
    res.redirect(`${origin}/dashboard`);
  } catch (error) {
    console.error('[auth/google/callback]', error);
    redirectToLogin(res, 'Não foi possível entrar com o Google. Tente novamente.');
  }
});

export default router;
