import 'dotenv/config';
import express from 'express';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatCep, onlyDigits, searchAddressNominatim } from './lib/cep.js';
import { getUserFromRequest } from './lib/auth.js';
import pool from './lib/db.js';
import { hasPermission } from './lib/rbac.js';
import {
  getCongregationName,
  listCongregationNames,
  sanitizeCongregationName,
  upsertCongregationName,
} from './lib/cep-region.js';
import { getDefaultCep, getMapConfig, resolveWorkingCep } from './lib/map-config.js';
import { rateLimit } from './middleware/rateLimit.js';
import { securityHeaders } from './middleware/securityHeaders.js';
import { requireAuth, type AuthedRequest } from './middleware/requireAuth.js';
import { requirePermission } from './middleware/requirePermission.js';
import authRoutes from './routes/auth.js';
import fieldAssignmentRoutes from './routes/field-assignments.js';
import googleAuthRoutes, { googleLoginEnabled } from './routes/google-auth.js';
import chatRoutes from './routes/chat.js';
import presenceRoutes from './routes/presence.js';
import territoryRoutes from './routes/territories.js';
import userRoutes from './routes/users.js';

const app = express();
const port = Number(process.env.PORT) || 3001;
const isProd = process.env.NODE_ENV === 'production';

app.disable('x-powered-by');

app.use(
  cors({
    origin: process.env.VITE_APP_URL || 'http://localhost:3000',
    credentials: true,
  }),
);
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use(compression());
app.use(securityHeaders);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

async function listKnownRegions(): Promise<
  Array<{ cep: string; territory_count: number; congregation_name: string | null }>
> {
  try {
    const [rows] = await pool.execute(
      `SELECT cep FROM territories WHERE cep IS NOT NULL AND TRIM(cep) <> ''`,
    );
    const counts = new Map<string, number>();
    for (const row of rows as Array<{ cep: string }>) {
      const digits = onlyDigits(row.cep);
      if (digits.length !== 8) continue;
      const formatted = formatCep(digits);
      counts.set(formatted, (counts.get(formatted) ?? 0) + 1);
    }
    const names = await listCongregationNames();
    return [...counts.entries()]
      .map(([cep, territory_count]) => ({
        cep,
        territory_count,
        congregation_name: names.get(cep) ?? null,
      }))
      .sort((a, b) => b.territory_count - a.territory_count || a.cep.localeCompare(b.cep));
  } catch {
    return [];
  }
}

/** Centro do mapa da região de trabalho do usuário (ou CEP padrão do .env). */
app.get('/api/config/map', async (req, res) => {
  try {
    const user = await getUserFromRequest(req);
    const config = await getMapConfig(resolveWorkingCep(user));
    res.json(config);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Erro ao carregar CEP da região.',
    });
  }
});

/** Região de trabalho atual + CEPs já usados no sistema. */
app.get('/api/config/cep', requireAuth, async (req, res) => {
  try {
    const user = (req as AuthedRequest).user;
    const stored = user.active_cep;
    const working = resolveWorkingCep(user);
    const defaultCep = getDefaultCep();
    const location = await getMapConfig(working);
    // Lista de congregações conhecidas: só quem pode trocar de região a enxerga
    const regions = hasPermission(user, 'config:cep') ? await listKnownRegions() : [];
    const congregation_name = await getCongregationName(working);
    res.json({
      cep: working,
      active_cep: stored,
      is_default: onlyDigits(working) === onlyDigits(defaultCep) && !stored,
      default_cep: defaultCep,
      congregation_name,
      location,
      regions,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Erro ao carregar configuração de CEP.',
    });
  }
});

const cepLimiter = rateLimit({
  name: 'cep-config',
  windowMs: 60 * 1000,
  max: 20,
});

/** Valida o CEP (BrasilAPI) sem gravar. Só papéis com privilégio podem trocar de região. */
app.post(
  '/api/config/cep/preview',
  requireAuth,
  requirePermission('config:cep'),
  cepLimiter,
  async (req, res) => {
  try {
    const raw = (req.body as { cep?: unknown })?.cep;
    if (typeof raw !== 'string' || onlyDigits(raw).length !== 8) {
      res.status(400).json({ error: 'CEP inválido. Use 8 dígitos (ex: 01310-100).' });
      return;
    }
    const location = await getMapConfig(raw);
    res.json({ location });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao consultar CEP.';
    const status = /inválido|não encontrado|sem coordenadas/i.test(message) ? 400 : 500;
    res.status(status).json({ error: message });
  }
});

/** Define o CEP da região de trabalho deste usuário. Body: { cep, congregation_name? }. */
app.put(
  '/api/config/cep',
  requireAuth,
  requirePermission('config:cep'),
  cepLimiter,
  async (req, res) => {
  const user = (req as AuthedRequest).user;
  const body = req.body as { cep?: unknown; congregation_name?: unknown };
  const raw = body?.cep;

  try {
    let stored: string | null = null;
    let working: string;

    if (raw == null || raw === '') {
      stored = null;
      working = getDefaultCep();
    } else if (typeof raw !== 'string') {
      res.status(400).json({ error: 'CEP inválido.' });
      return;
    } else {
      const location = await getMapConfig(raw);
      stored = location.cep;
      working = location.cep;
    }

    const nameProvided = Object.prototype.hasOwnProperty.call(body ?? {}, 'congregation_name');
    let congregationName: string | null | undefined;
    if (nameProvided) {
      const parsedName = sanitizeCongregationName(body.congregation_name);
      if (!parsedName.ok) {
        res.status(400).json({ error: parsedName.error });
        return;
      }
      congregationName = parsedName.name;
    }

    try {
      await pool.execute('UPDATE users SET active_cep = ? WHERE id = ?', [stored, user.id]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/active_cep|Unknown column/i.test(msg)) {
        res.status(503).json({
          error: 'Configuração de CEP ainda não migrada. Rode: npm run migrate:active-cep',
        });
        return;
      }
      throw err;
    }

    if (nameProvided) {
      await upsertCongregationName(working, congregationName ?? null);
    }

    const location = await getMapConfig(working);
    const defaultCep = getDefaultCep();
    const regions = await listKnownRegions();
    const congregation_name = await getCongregationName(working);
    const named = congregation_name ? ` (${congregation_name})` : '';
    res.json({
      cep: working,
      active_cep: stored,
      is_default: stored == null,
      default_cep: defaultCep,
      congregation_name,
      location,
      regions,
      message:
        stored == null
          ? `Região definida pelo CEP padrão (${working})${named}.`
          : `Região de trabalho atualizada para ${working}${named}.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao salvar CEP.';
    const status = /inválido|não encontrado|sem coordenadas|não migrado/i.test(message)
      ? /não migrado/i.test(message)
        ? 503
        : 400
      : 500;
    res.status(status).json({ error: message });
  }
});

/** Login com Google habilitado? (botão visível no login apenas quando configurado) */
app.get('/api/config/google', (_req, res) => {
  res.json({ enabled: googleLoginEnabled() });
});

const geocodeLimiter = rateLimit({
  name: 'geocode',
  windowMs: 60 * 1000,
  max: 20,
});

/** Busca endereço → coordenadas (Nominatim / Brasil) para o mapa */
app.get('/api/config/geocode', requireAuth, geocodeLimiter, async (req, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const results = await searchAddressNominatim(q, 6);
    res.json({ results });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao buscar endereço.';
    const status = /3 caracteres/i.test(message) ? 400 : 500;
    res.status(status).json({ error: message });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/auth', googleAuthRoutes);
app.use('/api/territories', territoryRoutes);
app.use('/api/field-assignments', fieldAssignmentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/presence', presenceRoutes);
app.use('/api/chat', chatRoutes);

if (isProd) {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const dist = path.resolve(__dirname, '../dist');
  app.use(express.static(dist));
  // Express 5 / path-to-regexp: use named wildcard ( '*' sozinho quebra o boot )
  app.get('/{*path}', (_req, res) => {
    res.sendFile(path.join(dist, 'index.html'));
  });
}

app.listen(port, () => {
  console.log(`[campo-api] http://localhost:${port}`);
});
