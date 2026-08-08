import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { searchAddressNominatim } from './lib/cep.js';
import { getMapConfig } from './lib/map-config.js';
import { rateLimit } from './middleware/rateLimit.js';
import { requireAuth } from './middleware/requireAuth.js';
import authRoutes from './routes/auth.js';
import fieldAssignmentRoutes from './routes/field-assignments.js';
import presenceRoutes from './routes/presence.js';
import territoryRoutes from './routes/territories.js';
import userRoutes from './routes/users.js';

const app = express();
const port = Number(process.env.PORT) || 3001;
const isProd = process.env.NODE_ENV === 'production';

app.use(
  cors({
    origin: process.env.VITE_APP_URL || 'http://localhost:3000',
    credentials: true,
  }),
);
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

/** CEP global do sistema (.env TERRITORY_CEP) — centra o mapa nesta versão */
app.get('/api/config/map', async (_req, res) => {
  try {
    const config = await getMapConfig();
    res.json(config);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Erro ao carregar CEP do sistema.',
    });
  }
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
app.use('/api/territories', territoryRoutes);
app.use('/api/field-assignments', fieldAssignmentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/presence', presenceRoutes);

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
