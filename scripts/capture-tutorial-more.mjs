/**
 * Captura Chat, Editar território, mapa e Relatório A4.
 * Uso: node scripts/capture-tutorial-more.mjs
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'public', 'docs', 'tutorial');
const BASE = process.env.VITE_APP_URL || 'http://localhost:3000';
const TEMP_PASS = 'Tutorial!Capture26';
const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
];

function chromePath() {
  const found = CHROME_CANDIDATES.find((p) => p && fs.existsSync(p));
  if (!found) throw new Error('Chrome/Edge não encontrado.');
  return found;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function toWebp(png, name) {
  const dest = path.join(OUT, name);
  await sharp(png).webp({ lossless: true }).toFile(dest);
  const { size } = fs.statSync(dest);
  const meta = await sharp(dest).metadata();
  console.log(`  ${name}  ${meta.width}×${meta.height}  ${size} bytes`);
}

async function shotPage(page, name) {
  await toWebp(await page.screenshot({ type: 'png' }), name);
}

async function shotSel(page, selector, name) {
  const el = await page.$(selector);
  if (!el) {
    console.warn(`  skip ${name} — ${selector}`);
    return false;
  }
  const box = await el.boundingBox();
  if (!box || box.width < 4 || box.height < 4) {
    console.warn(`  skip ${name} — caixa vazia`);
    return false;
  }
  await toWebp(await el.screenshot({ type: 'png' }), name);
  return true;
}

async function hideScrollTop(page) {
  await page.addStyleTag({
    content: `[aria-label="Voltar ao topo"] { display: none !important; }`,
  });
}

async function hideChat(page) {
  await page.addStyleTag({
    content: `
      [aria-label="Abrir chat"],
      [aria-label="Recolher chat"],
      [aria-label="Chat do campo"] { display: none !important; }
      div.pointer-events-none.fixed.bottom-4 { display: none !important; }
    `,
  });
}

async function waitSettled(page) {
  await page.waitForFunction(() => document.fonts?.status === 'loaded', { timeout: 8000 }).catch(() => {});
  await sleep(400);
}

async function gotoApp(page, pathName, { hideChatWidget = true } = {}) {
  await page.goto(`${BASE}${pathName}`, { waitUntil: 'networkidle2', timeout: 45000 });
  await hideScrollTop(page);
  if (hideChatWidget) await hideChat(page);
  await page
    .waitForFunction((t) => !document.body.innerText.includes(t), { timeout: 15000 }, 'Carregando…')
    .catch(() => {});
  await waitSettled(page);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'campo',
  });

  const [users] = await conn.execute(
    `SELECT u.id, u.email, u.password_hash
     FROM users u
     LEFT JOIN roles r ON r.id = u.role_id
     WHERE r.slug = 'admin'
       AND u.password_hash IS NOT NULL
       AND u.password_hash <> ''
     LIMIT 1`,
  );
  const admin = users[0];
  if (!admin) throw new Error('Nenhum admin com senha no banco.');

  const previousHash = admin.password_hash;
  await conn.execute('UPDATE users SET password_hash = ? WHERE id = ?', [
    await bcrypt.hash(TEMP_PASS, 12),
    admin.id,
  ]);

  let browser;
  try {
    try {
      await conn.execute("UPDATE users SET theme_preference = 'light' WHERE id = ?", [admin.id]);
    } catch {
      /* ignore */
    }

    browser = await puppeteer.launch({
      executablePath: chromePath(),
      headless: true,
      defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 1 },
      args: ['--hide-scrollbars', '--window-size=1440,900', '--lang=pt-BR'],
    });
    const page = await browser.newPage();
    const ctx = page.browserContext ? page.browserContext() : browser.defaultBrowserContext();
    await ctx.overridePermissions(BASE, ['geolocation']).catch(() => {});
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);

    console.log('Login…');
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForSelector('#email');
    await page.type('#email', admin.email, { delay: 10 });
    await page.type('#password', TEMP_PASS, { delay: 10 });
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }),
      page.click('button[type="submit"]'),
    ]);
    if (page.url().includes('/login')) throw new Error('Login falhou.');
    const darkToggle = await page.$('[aria-label="Ativar modo claro"]');
    if (darkToggle) {
      await darkToggle.click();
      await sleep(250);
    }

    // ——— Chat ———
    console.log('Chat…');
    await gotoApp(page, '/dashboard', { hideChatWidget: false });
    await page.waitForSelector('button[aria-label="Abrir chat"]', { timeout: 10000 });
    await shotSel(page, 'button[aria-label="Abrir chat"]', 'chat-botao.webp');
    await page.click('button[aria-label="Abrir chat"]');
    await page.waitForSelector('[aria-label="Chat do campo"]', { timeout: 8000 });
    await sleep(500);
    await shotPage(page, 'chat-painel.webp');
    await shotSel(page, '[aria-label="Chat do campo"]', 'chat-caixa.webp');

    // ——— Editar território ———
    console.log('Editar…');
    await gotoApp(page, '/territories');
    const editHref = await page.evaluate(() => {
      const link = document.querySelector('a[aria-label="Editar área"]');
      return link ? link.getAttribute('href') : null;
    });
    if (editHref) {
      await gotoApp(page, editHref);
      await page.waitForSelector('.leaflet-container, #nao-em-casa', { timeout: 25000 }).catch(() => {});
      await sleep(1800);
      await shotPage(page, 'editar.webp');
      await shotSel(page, '#nao-em-casa', 'editar-nao-em-casa.webp');
      await shotSel(page, '#nao-em-casa-form', 'editar-form-rua.webp');
    } else {
      console.warn('  skip editar — sem link');
    }

    // ——— Mapa / GPS no cartão ———
    console.log('Mapa…');
    await gotoApp(page, '/territories');
    const viewHref = await page.evaluate(() => {
      const link = document.querySelector('a[aria-label="Ver cartão"]');
      return link ? link.getAttribute('href') : null;
    });
    if (viewHref) {
      await gotoApp(page, viewHref);
      await page.waitForSelector('.leaflet-container', { timeout: 25000 }).catch(() => {});
      await sleep(2000);
      await shotSel(page, '.leaflet-container', 'mapa.webp');
      const mapTools = await page.evaluate(() => {
        const gps = document.querySelector('[aria-label="Ativar minha localização"]');
        const bar = gps?.parentElement;
        if (!bar) return null;
        const r = bar.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      });
      if (mapTools && mapTools.width > 4) {
        const pad = 6;
        const png = await page.screenshot({
          type: 'png',
          clip: {
            x: Math.max(0, mapTools.x - pad),
            y: Math.max(0, mapTools.y - pad),
            width: mapTools.width + pad * 2,
            height: mapTools.height + pad * 2,
          },
        });
        await toWebp(png, 'mapa-controles.webp');
      }
      const search = await page.$('[aria-label="Buscar endereço"]');
      if (search) {
        const wrap = await page.evaluate(() => {
          const btn = document.querySelector('[aria-label="Buscar endereço"]');
          const box = btn?.closest('div');
          const host = box?.parentElement ?? box;
          if (!host) return null;
          const r = host.getBoundingClientRect();
          return { x: r.x, y: r.y, width: Math.min(r.width, 520), height: Math.min(r.height, 80) };
        });
        if (wrap && wrap.width > 20) {
          const png = await page.screenshot({
            type: 'png',
            clip: {
              x: Math.max(0, wrap.x),
              y: Math.max(0, wrap.y),
              width: wrap.width,
              height: Math.max(wrap.height, 40),
            },
          });
          await toWebp(png, 'mapa-busca.webp');
        }
      }
    }

    // ——— Relatório A4 ———
    console.log('Relatório…');
    await gotoApp(page, '/territories/finalizados');
    const reportBtn = await page.$('button[data-tooltip="Gerar relatório"]');
    if (reportBtn) {
      await reportBtn.click();
      await sleep(400);
      const selectAll = await page.$('button[data-tooltip="Selecionar todos"]');
      if (selectAll) await selectAll.click();
      await sleep(300);
      await shotPage(page, 'relatorio-selecao.webp');
      const gen = await page.$('button[data-tooltip^="Gerar relatório"]');
      if (gen) {
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {}),
          gen.click(),
        ]);
        await sleep(800);
        await shotPage(page, 'relatorio.webp');
        const cover = await page.$('.rep-cover, article, .rep-page, [class*="rep-"]');
        if (cover) await shotSel(page, '.rep-cover', 'relatorio-capa.webp').catch(() => {});
      }
    } else {
      console.warn('  skip relatório — sem botão');
    }

    console.log('OK');
  } finally {
    if (browser) await browser.close().catch(() => {});
    await conn.execute('UPDATE users SET password_hash = ? WHERE id = ?', [previousHash, admin.id]);
    await conn.end();
    console.log('Senha do admin restaurada.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
