// Reel cover for the Las Vegas preview: 1080x1920, key content inside the middle 1080x1440 (y 240-1680) that the profile grid shows.
// Reuses the reel page's styles, track and helmet() so the cover matches the video.
// Usage: node vegas-preview-carousel/export-cover.js   -> video/onef1-vegas-reel-cover.png + video/onef1-vegas-reel-cover-grid.png
const { chromium } = require('playwright'), path = require('path');
const OUT = path.join(__dirname, 'video');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  await p.goto('file://' + path.join(__dirname, 'vegas-reel.html')); await p.evaluate(() => document.fonts.ready);
  await p.evaluate(() => {
    const pts = TRACK.map((q) => q.join(",")).join(" ");
    const st = document.querySelector('.stage');
    st.innerHTML = `
    <style>
      .cv { position:absolute; inset:0; padding:250px 72px 0; }
      .cv .track { position:absolute; right:-60px; top:330px; width:640px; height:1040px; opacity:.9; }
      .cv .kick { margin:0; font-size:36px; }
      .cv .h { font-size:178px; line-height:.88; margin-top:18px; }
      .cv .h em { display:block; text-shadow:0 0 30px rgba(255,212,0,.35); }
      .cv .row4 { position:absolute; left:52px; right:52px; top:1080px; display:grid; grid-template-columns:repeat(4,1fr); gap:14px; z-index:3; }
      .cv .row4 .panel { display:flex; flex-direction:column; align-items:center; padding:18px 6px 14px; }
      .cv .row4 .led { font-size:44px; margin-top:4px; }
      .cv .tag { position:absolute; left:72px; top:1420px; z-index:3; display:flex; align-items:center; gap:22px; }
      .cv .chips2 { display:flex; gap:14px; position:absolute; left:72px; top:860px; z-index:3; }
      .cv .chips2 .panel { padding:14px 22px; } .cv .chips2 .led { font-size:52px; line-height:1; } .cv .chips2 .lbl { font-size:18px; display:block; margin-top:4px; }
      .cv .ftr { bottom:150px; }
    </style>
    <div class="hdr"><span class="brand"><span>ONE F1</span></span><span class="pg" style="color:#FF3EA5;text-shadow:0 0 8px rgba(255,62,165,.6)">PREVIEW</span></div>
    <div class="cv">
      <svg class="track" viewBox="-30 -30 240 360"><polyline points="${pts}" fill="none" stroke="#2A1530" stroke-width="20" stroke-linejoin="round"/>
        <polyline points="${pts}" fill="none" stroke="#FF3EA5" stroke-width="5" stroke-linejoin="round" style="filter:drop-shadow(0 0 6px #FF3EA5) drop-shadow(0 0 14px #FF3EA5)"/></svg>
      <div class="kick">LAS VEGAS GP · 22 NOV</div>
      <h1 class="h">Who<br>wins<em>Vegas?</em></h1>
      <div class="chips2">
        <div class="panel"><b class="led">347</b><span class="lbl">km/h top speed</span></div>
        <div class="panel"><b class="led" style="color:#7FD3FF;text-shadow:0 0 10px rgba(127,211,255,.6)">14°C</b><span class="lbl">coldest quali track</span></div>
      </div>
      <div class="row4">${[["VER", 6], ["RUS", 3], ["ANT", -3], ["HAM", -6]].map(([c, l]) => `<div class="panel">${helmet(c, { size: 190, look: l })}<b class="led">${c}</b></div>`).join("")}</div>
      <div class="tag"><span class="hand" style="font-size:92px;transform:rotate(-4deg);display:inline-block">4 contenders. 1 jackpot.</span><span style="font-size:80px">🎰</span></div>
    </div>
    <div class="ftr"><span>@F1STATLAB</span><span>DATA: OPENF1 · JOLPICA</span></div>`;
  });
  await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(OUT, 'onef1-vegas-reel-cover.png') });
  await p.screenshot({ path: path.join(OUT, 'onef1-vegas-reel-cover-grid.png'), clip: { x: 0, y: 240, width: 1080, height: 1440 } });
  await b.close(); console.log('cover written');
})();
