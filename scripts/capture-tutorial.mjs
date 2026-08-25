/**
 * Captura telas reais do CAMPO em WebP lossless para o tutorial A4.
 * Uso (app já rodando em :3000):
 *   npm install --no-save puppeteer-core sharp
 *   node scripts/capture-tutorial.mjs
 *
 * Troca a senha do admin só durante a captura e restaura em seguida.
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
  const png = await page.screenshot({ type: 'png' });
  await toWebp(png, name);
}

async function shotSel(page, selector, name) {
  const el = await page.$(selector);
  if (!el) {
    console.warn(`  skip ${name} — seletor ausente: ${selector}`);
    return false;
  }
  const box = await el.boundingBox();
  if (!box || box.width < 4 || box.height < 4) {
    console.warn(`  skip ${name} — caixa vazia: ${selector}`);
    return false;
  }
  const png = await el.screenshot({ type: 'png' });
  await toWebp(png, name);
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
  await sleep(350);
}

async function waitGone(page, text, timeout = 15000) {
  await page.waitForFunction(
    (t) => !document.body.innerText.includes(t),
    { timeout },
    text,
  );
}

async function clickFirst(page, selectors) {
  for (const sel of selectors) {
    const el = await page.$(sel);
    if (el) {
      await el.click();
      return sel;
    }
  }
  return null;
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
  if (!admin) {
    throw new Error('Nenhum admin com senha no banco.');
  }

  const previousHash = admin.password_hash;
  const hash = await bcrypt.hash(TEMP_PASS, 12);
  await conn.execute('UPDATE users SET password_hash = ? WHERE id = ?', [hash, admin.id]);

  let browser;
  try {
    try {
      await conn.execute("UPDATE users SET theme_preference = 'light' WHERE id = ?", [admin.id]);
    } catch {
      /* coluna pode não existir */
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
    await page.type('#email', admin.email, { delay: 15 });
    await page.type('#password', TEMP_PASS, { delay: 15 });
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }),
      page.click('button[type="submit"]'),
    ]);
    if (page.url().includes('/login')) {
      throw new Error('Login falhou — ainda em /login.');
    }
    if (page.url().includes('change-password')) {
      throw new Error('Senha considerada fraca — redirecionou para troca.');
    }

    await hideWidgets(page);
    const darkToggle = await page.$('[aria-label="Ativar modo claro"]');
    if (darkToggle) {
      await darkToggle.click();
      await sleep(300);
    }

    // ——— Lista de territórios ———
    console.log('Territórios…');
    await page.goto(`${BASE}/territories`, { waitUntil: 'networkidle2', timeout: 30000 });
    await hideWidgets(page);
    await waitGone(page, 'Carregando…').catch(() => {});
    await waitSettled(page);
    await shotPage(page, 'territorios.webp');

    await shotSel(page, 'main > div > div.mb-8', 'territorios-cabecalho.webp');
    await shotSel(page, 'main .relative', 'territorios-busca.webp');

    const dailyCard = await page.evaluateHandle(() => {
      const cards = [...document.querySelectorAll('[data-slot="card"]')];
      return (
        cards.find((c) => c.textContent?.includes('Território do dia')) ||
        cards.find((c) => c.querySelector('h2')) ||
        null
      );
    });
    const dailyEl = dailyCard.asElement();
    if (dailyEl) {
      const png = await dailyEl.screenshot({ type: 'png' });
      await toWebp(png, 'territorios-cartao.webp');
    } else {
      console.warn('  skip territorios-cartao.webp');
    }

    const reviewedCard = await page.evaluateHandle(() => {
      const cards = [...document.querySelectorAll('[data-slot="card"]')];
      return cards.find((c) => c.textContent?.includes('Revisado e aprovado')) || null;
    });
    const reviewedEl = reviewedCard.asElement();
    if (reviewedEl) {
      const png = await reviewedEl.screenshot({ type: 'png' });
      await toWebp(png, 'territorios-cartao-revisado.webp');
    }

    // Modal território do dia
    const starClicked = await clickFirst(page, [
      'button[aria-label="Marcar do dia"]',
      'button[aria-label="Trocar dirigente do dia"]',
    ]);
    if (starClicked) {
      await page.waitForSelector('[role="dialog"]', { timeout: 8000 });
      await waitSettled(page);
      await shotPage(page, 'territorios-modal-dia.webp');
      await shotSel(page, '[role="dialog"]', 'territorios-modal-dia-caixa.webp');
      await page.keyboard.press('Escape');
      await sleep(400);
    } else {
      console.warn('  skip modal do dia — sem botão estrela');
    }

    // Confirmação revisar
    const reviewClicked = await clickFirst(page, [
      'button[aria-label="Marcar como revisado e aprovado"]',
      'button[aria-label="Remover revisão"]',
    ]);
    if (reviewClicked) {
      await sleep(500);
      await shotPage(page, 'territorios-confirmar-revisao.webp');
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

    // Confirmação desvincular (se houver)
    const unlinkClicked = await clickFirst(page, ['button[aria-label="Desvincular do dia"]']);
    if (unlinkClicked) {
      await sleep(500);
      await shotPage(page, 'territorios-confirmar-desvincular.webp');
      await page.evaluate(() => {
        const btns = [...document.querySelectorAll('button')];
        const c = btns.find((b) => b.textContent?.trim() === 'Cancelar');
        c?.click();
      });
      await sleep(400);
    }

    // ——— Cartão (detalhe) ———
    console.log('Cartão…');
    const viewHref = await page.evaluate(() => {
      const link = document.querySelector('a[aria-label="Ver cartão"]');
      return link ? link.getAttribute('href') : null;
    });
    if (viewHref) {
      await page.goto(`${BASE}${viewHref}`, { waitUntil: 'networkidle2', timeout: 45000 });
      await hideWidgets(page);
      await waitGone(page, 'Carregando…').catch(() => {});
      await page.waitForSelector('.leaflet-container, #nao-em-casa-cards', { timeout: 25000 }).catch(() => {});
      await sleep(2500);
      await waitSettled(page);
      await shotPage(page, 'cartao.webp');
      await shotSel(
        page,
        'main [data-slot="card"]',
        'cartao-topo.webp',
      );
      await shotSel(page, '[role="tablist"]', 'cartao-abas.webp');
      await shotSel(page, '#nao-em-casa-cards', 'cartao-nao-em-casa.webp');

      const firstBlock = await page.$('#nao-em-casa-cards [role="button"]');
      if (firstBlock) {
        const png = await firstBlock.screenshot({ type: 'png' });
        await toWebp(png, 'cartao-quadra.webp');
      }

      const imgTab = await page.$('#tab-mapa-imagem');
      if (imgTab) {
        await imgTab.click();
        await sleep(1800);
        await shotPage(page, 'cartao-imagem.webp');
      }

      const splitTab = await page.$('#tab-mapa-imagem-juntas');
      if (splitTab) {
        await splitTab.click();
        await sleep(1800);
        await shotPage(page, 'cartao-mapa-imagem.webp');
        await page.keyboard.press('Escape');
        await sleep(400);
      }
    } else {
      console.warn('  skip cartão — sem link Ver cartão');
    }

    // ——— Novo território ———
    console.log('Novo território…');
    await page.goto(`${BASE}/territories/new`, { waitUntil: 'networkidle2', timeout: 45000 });
    await hideWidgets(page);
    await page.waitForSelector('#localidade', { timeout: 15000 });
    await sleep(1500);
    await waitSettled(page);
    await shotPage(page, 'novo-territorio.webp');
    await shotSel(page, 'form', 'novo-territorio-form.webp');

    const imageTabBtn = await page.evaluateHandle(() => {
      const tabs = [...document.querySelectorAll('[role="tab"]')];
      return tabs.find((t) => t.textContent?.includes('Imagem')) || null;
    });
    const imageTabEl = imageTabBtn.asElement();
    if (imageTabEl) {
      await imageTabEl.click();
      await sleep(600);
      await shotPage(page, 'novo-territorio-imagem.webp');
      await shotSel(page, '#image-url', 'novo-territorio-link.webp');
    }

    console.log('OK');
  } finally {
    if (browser) await browser.close().catch(() => {});
    await conn.execute('UPDATE users SET password_hash = ? WHERE id = ?', [previousHash, admin.id]);
    await conn.end();
    console.log('Senha do admin restaurada.');
  }
}

main().catch(async (err) => {
  console.error(err);
  process.exitCode = 1;
});
