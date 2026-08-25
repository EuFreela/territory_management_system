/** Abre o tutorial e verifica overflow de cada folha A4. */
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';

const BASE = process.env.TUTORIAL_URL || 'http://localhost:3000/docs/tutorial.html';
const OUT = path.resolve('scripts/_tutorial-preview');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  defaultViewport: { width: 900, height: 1200, deviceScaleFactor: 1 },
  args: ['--hide-scrollbars'],
});

try {
  const page = await browser.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.addStyleTag({
    content: `
      .print-toolbar { display: none !important; }
      .sheet-stack { transform: none !important; margin: 0 !important; padding: 8px !important; gap: 16px !important; }
    `,
  });

  const report = await page.evaluate(() => {
    const pages = [...document.querySelectorAll('article.page')];
    return pages.map((el, i) => {
      const inner = el.querySelector('.page-inner') || el;
      const foot = el.querySelector('.page-foot');
      const prev = {
        overflow: inner.style.overflow,
        height: inner.style.height,
        flex: inner.style.flex,
        minHeight: inner.style.minHeight,
      };
      inner.style.overflow = 'visible';
      inner.style.height = 'auto';
      inner.style.minHeight = '0';
      inner.style.flex = 'none';
      const contentH = inner.scrollHeight;
      const footH = foot ? foot.getBoundingClientRect().height : 0;
      const pad = 14 * 3.7795 * 2;
      const usable = el.clientHeight - pad - footH;
      inner.style.overflow = prev.overflow;
      inner.style.height = prev.height;
      inner.style.flex = prev.flex;
      inner.style.minHeight = prev.minHeight;
      return {
        i: i + 1,
        id: el.id,
        label: el.getAttribute('aria-label'),
        pageH: el.clientHeight,
        contentH: Math.round(contentH),
        usable: Math.round(usable),
        overflow: contentH > usable + 8,
      };
    });
  });

  console.log('Folhas:', report.length);
  for (const row of report) {
    const mark = row.overflow ? 'OVERFLOW' : 'ok';
    console.log(
      `${String(row.i).padStart(2, '0')} ${mark.padEnd(8)} #${row.id}  content=${row.contentH} usable=${row.usable}  ${row.label}`,
    );
  }

  const targets = report.filter((r) => r.i >= 13);
  for (const row of targets) {
    const handle = await page.$(`#${row.id}`);
    if (!handle) continue;
    const png = await handle.screenshot({ type: 'png' });
    const name = `${String(row.i).padStart(2, '0')}-${row.id || 'page'}.jpg`;
    await sharp(png).jpeg({ quality: 72 }).toFile(path.join(OUT, name));
  }
  console.log('previews in', OUT);
} finally {
  await browser.close();
}
