/**
 * Captura Sobre, menu da conta e tema escuro.
 * Uso: node scripts/capture-tutorial-conta.mjs
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
  await sleep(350);
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

    console.log('Sobre…');
    await page.goto(`${BASE}/sobre`, { waitUntil: 'networkidle2', timeout: 30000 });
    await hideWidgets(page);
    await waitSettled(page);
    await shotPage(page, 'sobre.webp');
    await shotSel(page, '[role="tablist"]', 'sobre-abas.webp');

    const tab = await page.$('#tab-atualizacoes');
    if (tab) {
      await tab.click();
      await sleep(400);
      await shotPage(page, 'sobre-atualizacoes.webp');
    }

    console.log('Conta…');
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle2', timeout: 30000 });
    await hideWidgets(page);
    await page
      .waitForFunction((t) => !document.body.innerText.includes(t), { timeout: 15000 }, 'Carregando…')
      .catch(() => {});
    await waitSettled(page);
    await page.click('button[aria-label="Conta"]');
    await page.waitForSelector('[role="menu"]', { timeout: 5000 });
    await sleep(250);
    await shotPage(page, 'conta-menu-pagina.webp');
    await shotSel(page, '[role="menu"]', 'conta-menu.webp');

    const headerBtns = await page.evaluate(() => {
      const conta = document.querySelector('button[aria-label="Conta"]');
      const tema =
        document.querySelector('[aria-label="Ativar modo escuro"]') ||
        document.querySelector('[aria-label="Ativar modo claro"]');
      if (!conta || !tema) return null;
      const a = conta.getBoundingClientRect();
      const b = tema.getBoundingClientRect();
      const x = Math.min(a.x, b.x) - 8;
      const y = Math.min(a.y, b.y) - 8;
      const r = Math.max(a.right, b.right) + 8;
      const bot = Math.max(a.bottom, b.bottom) + 8;
      return { x, y, width: r - x, height: bot - y };
    });
    if (headerBtns && headerBtns.width > 4) {
      const png = await page.screenshot({ type: 'png', clip: headerBtns });
      await toWebp(png, 'conta-tema-icones.webp');
    }

    console.log('Tema escuro…');
    await page.keyboard.press('Escape');
    await sleep(200);
    const moon = await page.$('[aria-label="Ativar modo escuro"]');
    if (moon) {
      await moon.click();
      await sleep(600);
      await hideWidgets(page);
      await shotPage(page, 'tema-escuro.webp');
      await page.goto(`${BASE}/sobre`, { waitUntil: 'networkidle2', timeout: 30000 });
      await hideWidgets(page);
      await waitSettled(page);
      await shotPage(page, 'sobre-escuro.webp');
    }

    console.log('OK');
  } finally {
    if (browser) await browser.close().catch(() => {});
    await conn.execute('UPDATE users SET password_hash = ? WHERE id = ?', [previousHash, admin.id]);
    try {
      await conn.execute("UPDATE users SET theme_preference = 'light' WHERE id = ?", [admin.id]);
    } catch {
      /* ignore */
    }
    await conn.end();
    console.log('Senha e tema restaurados.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
