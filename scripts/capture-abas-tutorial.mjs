/**
 * Recaptura as ABAS (controle segmentado) do tutorial: Cartão, Sobre, Finalizados.
 * Uso: node scripts/capture-abas-tutorial.mjs
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
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

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

async function hideWidgets(page) {
  await page.addStyleTag({
    content: `
      [aria-label="Abrir chat"], [aria-label="Recolher chat"], [aria-label="Chat do campo"],
      [aria-label="Voltar ao topo"] { display: none !important; }
      div.pointer-events-none.fixed.bottom-4 { display: none !important; }
    `,
  });
}

async function waitSettled(page) {
  await page.waitForFunction(() => document.fonts?.status === 'loaded', { timeout: 8000 }).catch(() => {});
  await sleep(400);
}

async function gotoApp(page, url, opts = {}) {
  await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle2', timeout: 45000 });
  await page.waitForFunction((t) => !document.body.innerText.includes(t), { timeout: 15000 }, 'Carregando…').catch(() => {});
  await sleep(800);
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
     FROM users u LEFT JOIN roles r ON r.id = u.role_id
     WHERE r.slug = 'admin' AND u.password_hash IS NOT NULL AND u.password_hash <> ''
     LIMIT 1`,
  );
  const admin = users[0];
  if (!admin) throw new Error('Nenhum admin com senha.');
  const previousHash = admin.password_hash;
  await conn.execute('UPDATE users SET password_hash = ? WHERE id = ?', [
    await bcrypt.hash(TEMP_PASS, 12),
    admin.id,
  ]);
  try {
    await conn.execute("UPDATE users SET theme_preference = 'light' WHERE id = ?", [admin.id]);
  } catch {
    /* ignore */
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: CHROME,
      headless: true,
      defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 1 },
      args: ['--hide-scrollbars', '--window-size=1440,900', '--lang=pt-BR'],
    });
    const page = await browser.newPage();
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);

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
    await hideWidgets(page);

    // ——— Sobre — abas ———
    console.log('Sobre (abas)...');
    await gotoApp(page, '/sobre');
    await shotSel(page, '[role="tablist"]', 'sobre-abas.webp');
    const tabAtualizacoes = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('[role="tab"]')];
      const b = btns.find((el) => el.textContent?.trim() === 'Atualizações');
      if (b) {
        b.click();
        return true;
      }
      return false;
    });
    if (tabAtualizacoes) {
      await sleep(400);
      await waitSettled(page);
      await shotPage(page, 'sobre-atualizacoes.webp');
    }

    // ——— Finalizados — abas ———
    console.log('Finalizados (abas)...');
    await gotoApp(page, '/territories/finalizados');
    await shotSel(page, '[role="tablist"]', 'finalizados-abas.webp');
    await shotPage(page, 'finalizados.webp');

    // ——— Cartão — abas ———
    console.log('Cartão (abas)...');
    await gotoApp(page, '/territories');
    const viewHref = await page.evaluate(() => {
      const link = document.querySelector('a[aria-label="Ver cartão"]');
      return link ? link.getAttribute('href') : null;
    });
    if (viewHref) {
      await page.goto(`${BASE}${viewHref}`, { waitUntil: 'networkidle2', timeout: 45000 });
      await hideWidgets(page);
      await page.waitForSelector('.leaflet-container, #nao-em-casa-cards', { timeout: 25000 }).catch(() => {});
      await sleep(2500);
      await waitSettled(page);
      await shotSel(page, '[role="tablist"]', 'cartao-abas.webp');
    } else {
      console.warn('  skip cartao-abas.webp — sem cartão disponível');
    }

    console.log('OK');
  } finally {
    if (browser) await browser.close();
    await conn.execute('UPDATE users SET password_hash = ? WHERE id = ?', [previousHash, admin.id]);
    await conn.end();
    console.log('Senha do admin restaurada.');
  }
}

main().catch((e) => {
  console.error('ERR', e);
  process.exit(1);
});
