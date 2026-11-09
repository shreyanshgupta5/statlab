// Renders every cover in covers.html to <id>.png (1080x1920) and <id>-grid.png (the 1080x1440 profile-grid crop).
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1200, height: 2000 }, deviceScaleFactor: 1 }); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + path.resolve(__dirname, 'covers.html')); await p.evaluate(() => document.fonts.ready); await p.waitForSelector('body[data-fitted]'); await p.waitForTimeout(300);
  const ids = await p.$$eval('.cover', (cs) => cs.map((c) => c.id));
  for (const id of ids) {
    const el = await p.$('#' + id); const box = await el.evaluate((c) => { const r = c.getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY }; });
    await el.screenshot({ path: path.resolve(__dirname, 'out', `statlab-cover-${id}.png`) });
    await p.screenshot({ path: path.resolve(__dirname, 'out', `statlab-cover-${id}-grid.png`), fullPage: true, clip: { x: box.x, y: box.y + 240, width: 1080, height: 1440 } });
    const over = await el.evaluate((c) => { const top = c.getBoundingClientRect().top; return [...c.querySelectorAll('.safe *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width && (r.top - top < 240 || r.bottom - top > 1680); }).map((e) => e.className.baseVal ?? e.className); });
    const wide = await el.evaluate((c) => [...c.querySelectorAll('.safe *')].filter((e) => e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflow !== 'visible').length);
    console.log(id, 'outside grid crop:', over.length ? over : 'none', wide ? `overflowing: ${wide}` : '');
  }
  console.log('errors', errs); await b.close();
})();
