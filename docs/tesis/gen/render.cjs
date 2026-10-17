// Pasa cada .svg de la carpeta indicada a .png (2x) con Chromium.
const { chromium } = require('playwright');
const { readdirSync, readFileSync } = require('node:fs');
const { join } = require('node:path');

const dir = process.argv[2];
(async () => {
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ deviceScaleFactor: 2 });
for (const f of readdirSync(dir).filter(f => f.endsWith('.svg'))) {
  const svg = readFileSync(join(dir, f), 'utf8');
  const w = Number(svg.match(/width="(\d+)"/)[1]), h = Number(svg.match(/height="(\d+)"/)[1]);
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<html><body style="margin:0;background:#fff">${svg}</body></html>`);
  await page.screenshot({ path: join(dir, f.replace('.svg', '.png')), omitBackground: false, clip: { x: 0, y: 0, width: w, height: h } });
}
await browser.close();
})();
