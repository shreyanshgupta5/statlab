// Exports each 1080x1350 slide of the Brazil carousel as a PNG.
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const outDir = require("path").resolve(__dirname, "slides");
  fs.mkdirSync(outDir, { recursive: true });
  const b = await chromium.launch(); const errs = [];
  const p = await b.newPage({ viewport: { width: 1200, height: 1400 }, deviceScaleFactor: 1 });
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto('file://' + require("path").resolve(__dirname, "brazil-carousel.html"));
  await p.addStyleTag({ content: '.frame{width:1080px!important;border-radius:0!important}' });
  await p.evaluate(() => document.fonts.ready); await p.evaluate(() => dispatchEvent(new Event('resize'))); await p.waitForTimeout(600);
  const frames = await p.$$('.frame');
  for (let i = 0; i < frames.length; i++) await frames[i].screenshot({ path: `${outDir}/statlab-brazil-quali-${i + 1}.png` });
  const fams = await p.evaluate(() => [...new Set([...document.fonts].filter(f => f.status === 'loaded').map(f => f.family))]);
  console.log(frames.length, 'slides · fonts', fams.join(', '), '· errors', errs); await b.close();
})();
