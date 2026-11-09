const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 }); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + require("path").resolve(__dirname, "cover.html")); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(400);
  await (await p.$('#cover')).screenshot({ path: require("path").resolve(__dirname, "statlab-interlagos-recap-cover.png") });
  const over = await p.evaluate(() => [...document.querySelectorAll('.safe *')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.top < 240 || r.bottom > 1680 || r.right > 1080 || r.left < 0); }).map(e => e.className || e.tagName));
  console.log('outside safe area:', over, 'errors', errs); await b.close(); })();
