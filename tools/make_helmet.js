// Renders tools/helmet-icon.html to PNGs: node tools/make_helmet.js OUTDIR  (one 1024px PNG per theme + a sheet)
const { chromium } = require('playwright'); const path = require('path');
const out = process.argv[2] || 'brand/helmet';
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1024, height: 1024 } });
  const url = 'file://' + path.resolve(__dirname, 'helmet-icon.html');
  await p.goto(url); const themes = await p.evaluate(() => window.THEMES);
  require('fs').mkdirSync(out, { recursive: true });
  for (const t of themes) { await p.goto(url + '?theme=' + t); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
    await p.screenshot({ path: path.join(out, `helmet-${t}.png`) }); console.log(t, await p.evaluate(() => window.LABEL)); }
  await b.close();
})();
