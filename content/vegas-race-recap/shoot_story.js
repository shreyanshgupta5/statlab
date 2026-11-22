// node shoot_story.js -> stills/story-1..8.png
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  for (let f = 1; f <= 8; f++) { await p.goto('file://' + __dirname + '/story.built.html?f=' + f); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(500); await p.screenshot({ path: __dirname + `/stills/story-${f}.png` }); }
  console.log(errs); await b.close(); })();
