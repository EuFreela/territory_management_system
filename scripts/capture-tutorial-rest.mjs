/**
 * Captura as telas restantes do tutorial (Dirigentes, Usuários, Conta, Configuração, Finalizados).
 * Uso: npm install --no-save puppeteer-core sharp ; node scripts/capture-tutorial-rest.mjs
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

async function hideWidgets(page) {
  await page.addStyleTag({
    content: `
      [aria-label="Abrir chat"],
      [aria-label="Recolher chat"],
      [aria-label="Chat do campo"],
      [aria-label="Voltar ao topo"] { display: none !important; }
      div.pointer-events-none.fixed.bottom-4 { display: none !important; }
    `,
  });
}

async function waitSettled(page) {
  await page.waitForFunction(() => document.fonts?.status === 'loaded', { timeout: 8000 }).catch(() => {});
  await sleep(400);
}

async function gotoApp(page, pathName) {
  await page.goto(`${BASE}${pathName}`, { waitUntil: 'networkidle2', timeout: 30000 });
  await hideWidgets(page);
  await page.waitForFunction((t) => !document.body.innerText.includes(t), { timeout: 15000 }, 'Carregando…').catch(
    () => {},
  );
  await waitSettled(page);
}

async function shotByText(page, testFn, name) {
  const handle = await page.evaluateHandle(testFn);
  const el = handle.asElement();
  if (!el) {
    console.warn(`  skip ${name}`);
    return false;
  }
  await toWebp(await el.screenshot({ type: 'png' }), name);
  return true;
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

    // ——— Dirigentes ———
    console.log('Dirigentes…');
    await gotoApp(page, '/dirigentes');
    await shotPage(page, 'dirigentes.webp');
    await shotByText(
      page,
      () =>
        [...document.querySelectorAll('[data-slot="card"]')].find((c) =>
          c.textContent?.includes('Adicionar designação'),
        ) || null,
      'dirigentes-form.webp',
    );
    await shotByText(
      page,
      () =>
        [...document.querySelectorAll('[data-slot="card"]')].find((c) =>
          c.querySelector('h2')?.textContent?.includes('Hoje') ||
          (c.textContent?.includes('Hoje') && !c.textContent?.includes('Adicionar')),
        ) ||
        [...document.querySelectorAll('[data-slot="card"]')].find(
          (c) => c.querySelector('h2') && !c.textContent?.includes('Adicionar'),
        ) ||
        null,
      'dirigentes-hoje.webp',
    );
    await shotByText(
      page,
      () =>
        [...document.querySelectorAll('[data-slot="card"]')].find((c) =>
          c.textContent?.includes('Dias fixos'),
        ) || null,
      'dirigentes-fixos.webp',
    );

    // ——— Usuários ———
    console.log('Usuários…');
    await gotoApp(page, '/usuarios');
    await shotPage(page, 'usuarios.webp');
    await shotSel(page, '#novo-usuario', 'usuarios-novo.webp');
    await shotByText(
      page,
      () =>
        [...document.querySelectorAll('[data-slot="card"]')].find((c) =>
          c.querySelector('h2')?.textContent?.includes('Usuários'),
        ) || null,
      'usuarios-lista.webp',
    );

    const help = await page.$('button[aria-label="Ver papéis e permissões"]');
    if (help) {
      await help.click();
      await page.waitForSelector('[role="dialog"]', { timeout: 8000 });
      await sleep(300);
      await shotPage(page, 'usuarios-papeis.webp');
      await shotSel(page, '[role="dialog"]', 'usuarios-papeis-caixa.webp');
      await page.keyboard.press('Escape');
      await sleep(300);
    }

    const editBtn = await page.$('button[aria-label="Editar"]');
    if (editBtn) {
      await editBtn.click();
      await page.waitForSelector('[role="dialog"]', { timeout: 8000 });
      await sleep(300);
      await shotPage(page, 'usuarios-editar.webp');
      await page.keyboard.press('Escape');
      await sleep(300);
    }

    // ——— Minha conta ———
    console.log('Minha conta…');
    await gotoApp(page, '/perfil');
    await shotPage(page, 'conta.webp');
    await shotSel(page, 'main [data-slot="card"]', 'conta-perfil.webp');

    await gotoApp(page, '/change-password');
    await shotPage(page, 'conta-senha.webp');

    // ——— Configuração ———
    console.log('Configuração…');
    await gotoApp(page, '/configuracao');
    await page.waitForFunction((t) => !document.body.innerText.includes(t), { timeout: 15000 }, 'Carregando configuração…').catch(
      () => {},
    );
    await waitSettled(page);
    await shotPage(page, 'configuracao.webp');

    // ——— Congregações ———
    console.log('Congregações…');
    await gotoApp(page, '/congregacoes');
    await shotPage(page, 'congregacoes.webp');

    const congNew = await page.$('button[aria-label="Nova congregação"]');
    if (congNew) {
      await congNew.click();
      await page.waitForSelector('[role="dialog"]', { timeout: 8000 });
      await sleep(300);
      await shotSel(page, '[role="dialog"]', 'congregacoes-novo.webp');
      await page.keyboard.press('Escape');
      await sleep(300);
    }

    const congSet = await page.$('button[aria-label="Definir como congregação ativa"]');
    if (congSet) {
      await congSet.click();
      await sleep(500);
      await page
        .waitForFunction(() => document.querySelectorAll('[data-sonner-toaster] .sonner-toast').length > 0, {
          timeout: 8000,
        })
        .catch(() => {});
      await shotSel(page, '[data-sonner-toaster] .sonner-toast', 'congregacoes-definir.webp');
      const cancel = await page.evaluate(() => {
        const btns = [...document.querySelectorAll('button')];
        const c = btns.find((b) => b.textContent?.trim() === 'Cancelar');
        if (c) {
          c.click();
          return true;
        }
        return false;
      });
      if (!cancel) await page.keyboard.press('Escape');
      await sleep(400);
    }

    // ——— Finalizados ———
    console.log('Finalizados…');
    await gotoApp(page, '/territories/finalizados');
    await shotPage(page, 'finalizados.webp');
    await shotSel(page, '[role="tablist"]', 'finalizados-abas.webp');
    await shotByText(
      page,
      () => document.querySelector('table')?.closest('.overflow-hidden') || document.querySelector('table') || null,
      'finalizados-tabela.webp',
    );

    const reportBtn = await page.$('button[data-tooltip="Gerar relatório"]');
    if (reportBtn) {
      await reportBtn.click();
      await sleep(400);
      await shotPage(page, 'finalizados-selecao.webp');
      await page.keyboard.press('Escape').catch(() => {});
      const cancel = await page.$('button[data-tooltip="Cancelar"]');
      if (cancel) await cancel.click();
      await sleep(200);
    }

    const metricsTab = await page.evaluateHandle(() => {
      const tabs = [...document.querySelectorAll('[role="tab"]')];
      return tabs.find((t) => t.textContent?.includes('Métricas')) || null;
    });
    const metricsEl = metricsTab.asElement();
    if (metricsEl) {
      await metricsEl.click();
      await sleep(1200);
      await waitSettled(page);
      await shotPage(page, 'finalizados-metricas.webp');
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
