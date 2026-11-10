// Reel cover options for the Las Vegas preview: 1080x1920, key content inside the middle 1080x1440 (y 240-1680) the profile grid shows.
// Reuses the reel page's styles, track and helmet() so each cover matches the video.
// Usage: node vegas-preview-carousel/export-cover.js  -> video/covers/onef1-vegas-cover-<id>.png (+ -grid.png) and contact sheet
//        option "decoded" (matches the final reel) is also copied to video/onef1-vegas-reel-cover.png
const { chromium } = require('playwright'), path = require('path'), fs = require('fs');
const OUT = path.join(__dirname, 'video', 'covers'); fs.mkdirSync(OUT, { recursive: true });

// each builder runs inside the reel page (TRACK and helmet() are available there)
const COVERS = {
  // A: neon night, the four contenders
  neon: () => { const pts = LAP.map((q) => q[0] + "," + q[1]).join(" "); return `
    <style>.cv{position:absolute;inset:0;padding:250px 72px 0}.cv .track{position:absolute;right:-60px;top:330px;width:640px;height:1040px;opacity:.9}
      .cv .kick{margin:0;font-size:36px}.cv .h{font-size:178px;line-height:.88;margin-top:18px}.cv .h em{display:block;text-shadow:0 0 30px rgba(255,212,0,.35)}
      .row4{position:absolute;left:52px;right:52px;top:1080px;display:grid;grid-template-columns:repeat(4,1fr);gap:14px;z-index:3}
      .row4 .panel{display:flex;flex-direction:column;align-items:center;padding:18px 6px 14px}.row4 .led{font-size:44px;margin-top:4px}
      .chips2{display:flex;gap:14px;position:absolute;left:72px;top:860px;z-index:3}.chips2 .panel{padding:14px 22px}.chips2 .led{font-size:52px;line-height:1}.chips2 .lbl{font-size:18px;display:block;margin-top:4px}</style>
    <div class="hdr"><span class="brand"><span>ONE F1</span></span><span class="pg" style="color:#FF3EA5">PREVIEW</span></div>
    <div class="cv"><svg class="track" viewBox="-44 -44 683 1088"><polyline points="${pts}" fill="none" stroke="#2A1530" stroke-width="60" stroke-linejoin="round"/>
      <polyline points="${pts}" fill="none" stroke="#FF3EA5" stroke-width="15" stroke-linejoin="round" style="filter:drop-shadow(0 0 6px #FF3EA5) drop-shadow(0 0 14px #FF3EA5)"/></svg>
      <div class="kick">LAS VEGAS GP · 22 NOV</div><h1 class="h">Who<br>wins<em>Vegas?</em></h1>
      <div class="chips2"><div class="panel"><b class="led">347</b><span class="lbl">km/h top speed</span></div>
        <div class="panel"><b class="led" style="color:#7FD3FF;text-shadow:0 0 10px rgba(127,211,255,.6)">14°C</b><span class="lbl">coldest quali track</span></div></div>
      <div class="row4">${[["VER", 6], ["RUS", 3], ["ANT", -3], ["HAM", -6]].map(([c, l]) => `<div class="panel">${helmet(c, { size: 190, look: l })}<b class="led">${c}</b></div>`).join("")}</div>
      <div style="position:absolute;left:72px;top:1420px;display:flex;align-items:center;gap:22px"><span class="hand" style="font-size:92px;transform:rotate(-4deg);display:inline-block">4 contenders. 1 jackpot.</span><span style="font-size:80px">🎰</span></div></div>`; },

  // B: slot machine, three reels landing on helmets
  slots: () => `
    <style>.stage{background:radial-gradient(80% 50% at 50% 50%,#3A0A14,#12040A 75%)!important}
      .mach{position:absolute;left:60px;right:60px;top:760px;padding:34px 30px 40px;border-radius:40px;background:linear-gradient(180deg,#FFD86B,#C8901C 60%,#7A4E08);box-shadow:0 0 60px rgba(255,190,40,.35),inset 0 4px 0 #FFF2B0}
      .mach .bulbs{position:absolute;left:24px;right:24px;top:12px;display:flex;justify-content:space-between}.mach .bulbs i{width:16px;height:16px;border-radius:50%;background:#FFF6C8;box-shadow:0 0 10px #FFE070}
      .win{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;padding:18px;border-radius:24px;background:#140508;border:6px solid #5A2A06;margin-top:14px}
      .win div{height:360px;border-radius:14px;background:linear-gradient(180deg,#CFCAC0,#FFFFFF 30%,#FFFFFF 70%,#CFCAC0);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;box-shadow:inset 0 10px 18px rgba(0,0,0,.35),inset 0 -10px 18px rgba(0,0,0,.35)}
      .win b{font-weight:900;font-style:italic;font-stretch:125%;font-size:46px;color:#160608}
      .payline{position:absolute;left:40px;right:40px;top:300px;height:6px;background:#FF2A4A;box-shadow:0 0 14px #FF2A4A;opacity:.85}
      .sign{position:absolute;left:0;right:0;top:300px;text-align:center}.sign .h{font-size:150px;color:#FFE27A;text-shadow:0 0 24px rgba(255,200,60,.55),0 6px 0 #7A1020}
      .sign .kick{color:#FF5C7A;margin:0;font-size:34px}</style>
    <div class="hdr"><span class="brand"><span>ONE F1</span></span><span class="pg" style="color:#FFD86B">LAS VEGAS GP</span></div>
    <div class="sign"><div class="kick">PLACE YOUR BETS · 22 NOV</div><h1 class="h" style="margin-top:14px">Spin the<br>grid</h1></div>
    <div class="mach"><div class="bulbs">${"<i></i>".repeat(14)}</div><div class="win">${[["VER", 6], ["RUS", 0], ["HAM", -6]].map(([c, l]) => `<div>${helmet(c, { size: 230, look: l })}<b>${c}</b></div>`).join("")}</div><div class="payline"></div></div>
    <div style="position:absolute;left:0;right:0;top:1400px;text-align:center"><span class="hand" style="font-size:96px;color:#FFE27A">who hits the jackpot? 🎰</span></div>`,

  // C: one hero number, Verstappen as the favourite (gold)
  hero: () => `
    <style>.stage{background:radial-gradient(70% 45% at 50% 40%,#2B2208,#0B0A06 75%)!important}
      .big347{position:absolute;left:0;right:0;top:300px;text-align:center;font-family:var(--led);font-weight:900;font-size:430px;line-height:1;color:#FFB000;text-shadow:0 0 30px rgba(255,176,0,.55)}
      .unit{position:absolute;left:0;right:0;top:740px;text-align:center;font-family:var(--mono);font-size:40px;letter-spacing:10px;color:#C9CDD2}
      .hh{position:absolute;left:0;right:0;top:850px;display:flex;justify-content:center}
      .ttl{position:absolute;left:0;right:0;top:1330px;text-align:center}.ttl .h{font-size:120px}</style>
    <div class="hdr"><span class="brand"><span>ONE F1</span></span><span class="pg" style="color:#FFB000">LAS VEGAS GP</span></div>
    <div class="big347">347</div><div class="unit">KM/H ON THE STRIP</div>
    <div class="hh">${helmet("VER", { size: 380, look: 0 })}</div>
    <div class="ttl"><h1 class="h">Max <em>again?</em></h1><div class="lbl" style="margin-top:22px;font-size:26px">2 wins in 3 Vegas races</div></div>`,

  // D: ice cold, 14 degrees
  ice: () => `
    <style>.stage{background:linear-gradient(170deg,#0B2A5C,#0A1B3D 55%,#060E22)!important}
      .t14{position:absolute;left:72px;top:330px;font-family:var(--led);font-weight:900;font-size:440px;line-height:.9;color:#9FE3FF;text-shadow:0 0 34px rgba(120,210,255,.65)}
      .t14 small{font-size:160px}
      .therm{position:absolute;right:90px;top:280px;width:84px;height:490px}
      .ttl{position:absolute;left:72px;right:72px;top:820px}.ttl .h{font-size:96px;white-space:nowrap}.ttl .h em{color:#9FE3FF}
      .row3{position:absolute;left:72px;right:72px;top:1180px;display:flex;gap:24px;align-items:flex-end}
      .flake{position:absolute;font-size:60px;opacity:.25}</style>
    <div class="hdr"><span class="brand"><span>ONE F1</span></span><span class="pg" style="color:#9FE3FF">LAS VEGAS GP</span></div>
    <span class="flake" style="left:820px;top:1100px">❄</span><span class="flake" style="left:600px;top:280px;font-size:44px">❄</span>
    <div class="t14">14<small>°C</small></div>
    <svg class="therm" viewBox="0 0 120 700"><rect x="35" y="10" width="50" height="600" rx="25" fill="#0A1838" stroke="#2B5AA8" stroke-width="4"/><rect x="45" y="420" width="30" height="190" rx="15" fill="#9FE3FF" style="filter:drop-shadow(0 0 10px #7FD3FF)"/><circle cx="60" cy="640" r="50" fill="#9FE3FF" style="filter:drop-shadow(0 0 14px #7FD3FF)"/></svg>
    <div class="ttl"><div class="kick" style="color:#9FE3FF;text-shadow:none;margin:0">COLDEST TRACK ON THE CALENDAR</div><h1 class="h" style="margin-top:14px">Who keeps<br><em>tyres alive?</em></h1></div>
    <div class="row3">${[["VER", 6], ["RUS", 3], ["ANT", -3], ["HAM", -6]].map(([c, l]) => `<div style="text-align:center">${helmet(c, { size: 200, look: l })}<div class="led" style="font-size:40px;color:#9FE3FF;text-shadow:none">${c}</div></div>`).join("")}</div>`,

  // E: poker hand, four driver cards on green felt
  cards: () => `
    <style>.stage{background:radial-gradient(75% 50% at 50% 50%,#0F6B3A,#063A1F 70%,#03200F)!important}
      .hand4{position:absolute;left:0;right:0;top:820px;height:560px}
      .card{position:absolute;left:50%;top:0;width:250px;height:370px;margin-left:-125px;border-radius:24px;background:#FBF8F2;border:4px solid #1A1A1A;box-shadow:0 18px 40px rgba(0,0,0,.45);transform-origin:50% 100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px}
      .card b{font-weight:900;font-style:italic;font-stretch:125%;font-size:48px;color:#14161A}
      .card .cn{position:absolute;font-family:var(--led);font-weight:900;font-size:40px}.card .tl{left:18px;top:12px}.card .br{right:18px;bottom:12px;transform:rotate(180deg)}
      .ttl{position:absolute;left:72px;right:72px;top:300px}.ttl .h{font-size:100px;white-space:nowrap}.ttl .h em{color:#FFD400}</style>
    <div class="hdr"><span class="brand"><span>ONE F1</span></span><span class="pg" style="color:#FFD400">LAS VEGAS GP</span></div>
    <div class="ttl"><div class="kick" style="color:#FFD400;text-shadow:none;margin:0">22 NOV · ALL IN</div><h1 class="h" style="margin-top:14px">Who holds<br>the <em>winning<br>hand?</em></h1></div>
    <div class="hand4">${[["VER", "♦", "#C8102E", -12, 6, -330, 40], ["RUS", "♠", "#14161A", -4, 3, -110, 0], ["ANT", "♣", "#14161A", 4, -3, 110, 0], ["HAM", "♥", "#C8102E", 12, -6, 330, 40]].map(([c, s, col, r, l, dx, dy]) =>
      `<div class="card" style="transform:translate(${dx}px,${dy}px) rotate(${r}deg)"><span class="cn tl" style="color:${col}">${s}</span><span class="cn br" style="color:${col}">${s}</span>${helmet(c, { size: 170, look: l })}<b>${c}</b></div>`).join("")}</div>
    <div style="position:absolute;left:0;right:0;top:1360px;text-align:center"><span class="hand" style="font-size:88px;color:#FFD400">pick your card 👇</span></div>`,
  // F: matches the final reel (skyline, marquee lights, the three things it explains, the four contenders). Built on top of the reel's own stage.
  decoded: () => { const pts = LAP.map((q) => q[0] + "," + q[1]).join(" "); return `
    <style>.cv{position:absolute;inset:0;z-index:4}.cv .track{position:absolute;right:-30px;top:250px;width:560px;height:892px;opacity:.5}
      .cv .kick{position:absolute;left:72px;top:262px;margin:0;font-size:36px}.cv .h{position:absolute;left:72px;top:318px;font-size:150px;line-height:.9;margin:0}.cv .h em{display:block;text-shadow:0 0 30px rgba(255,212,0,.4)}
      .tz{position:absolute;left:72px;right:72px;top:650px;display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
      .tz .panel{padding:22px 20px 20px;text-align:center}.tz b{display:block;font-size:76px;line-height:1;white-space:nowrap}.tz .lbl{display:block;margin-top:10px;font-size:19px;letter-spacing:2px}
      .row4{position:absolute;left:72px;right:72px;top:930px;display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
      .row4 .panel{display:flex;flex-direction:column;align-items:center;padding:18px 6px 14px}.row4 .led{font-size:42px;margin-top:4px}</style>
    <div class="hdr"><span class="brand"><span>ONE F1</span></span><span class="pg" style="color:#FF3EA5">RACE PREVIEW</span></div>
    <div class="cv"><svg class="track" viewBox="-44 -44 683 1088"><polyline points="${pts}" fill="none" stroke="#2A1530" stroke-width="60" stroke-linejoin="round"/>
      <polyline points="${pts}" fill="none" stroke="#FF3EA5" stroke-width="15" stroke-linejoin="round" style="filter:drop-shadow(0 0 12px #FF3EA5) drop-shadow(0 0 30px #FF3EA5)"/></svg>
      <div class="kick">LAS VEGAS GP · 22 NOV</div><h1 class="h">Vegas<em>decoded</em></h1>
      <div class="tz"><div class="panel" style="border-color:#2B5AA8"><b class="led" style="color:#7FD3FF;text-shadow:0 0 12px rgba(127,211,255,.6)">18°C</b><span class="lbl">cold track</span></div>
        <div class="panel"><b class="led" style="color:#F2F2F0;text-shadow:0 0 12px rgba(255,255,255,.4)">81%</b><span class="lbl">hard tyre laps</span></div>
        <div class="panel" style="border-color:#8A6A1F"><b class="led" style="word-spacing:-24px">1 or 2</b><span class="lbl">pit stops?</span></div></div>
      <div class="row4">${[["VER", 6], ["RUS", 3], ["ANT", -3], ["HAM", -6]].map(([c, l]) => `<div class="panel">${helmet(c, { size: 178, look: l })}<b class="led">${c}</b></div>`).join("")}</div>
      <div style="position:absolute;left:72px;top:1265px;display:flex;align-items:center;gap:20px"><span class="hand" style="font-size:104px;transform:rotate(-4deg);display:inline-block">who hits the jackpot?</span><span style="font-size:84px">🎰</span></div></div>`; },
};

(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  for (const [id, fn] of Object.entries(COVERS)) {
    await p.goto('file://' + path.join(__dirname, 'vegas-reel.html')); await p.evaluate(() => document.fonts.ready);
    await p.evaluate(([id, src]) => { const st = document.querySelector('.stage'), html = (0, eval)('(' + src + ')')(), ftr = '<div class="ftr"><span>@F1STATLAB</span><span>DATA: OPENF1 · JOLPICA</span></div>';
      if (id === 'decoded') { window.reel.seek(3); st.querySelectorAll('.scene,.sweep,.snow,.hdr,.ftr').forEach((e) => e.remove()); st.insertAdjacentHTML('beforeend', html + ftr); }   // keep the skyline and marquee lights
      else st.innerHTML = html + ftr; }, [id, fn.toString()]);
    await p.waitForTimeout(300);
    await p.screenshot({ path: path.join(OUT, `onef1-vegas-cover-${id}.png`) });
    await p.screenshot({ path: path.join(OUT, `onef1-vegas-cover-${id}-grid.png`), clip: { x: 0, y: 240, width: 1080, height: 1440 } });
  }
  fs.copyFileSync(path.join(OUT, 'onef1-vegas-cover-decoded.png'), path.join(__dirname, 'video', 'onef1-vegas-reel-cover.png'));
  fs.copyFileSync(path.join(OUT, 'onef1-vegas-cover-decoded-grid.png'), path.join(__dirname, 'video', 'onef1-vegas-reel-cover-grid.png'));
  // contact sheet of all options
  const ids = Object.keys(COVERS);
  await p.setViewportSize({ width: 360 * ids.length + 20 * (ids.length + 1), height: 720 });
  await p.setContent(`<body style="margin:0;background:#111;display:flex;gap:20px;padding:20px;font:700 22px sans-serif;color:#eee">${ids.map((id, k) =>
    `<div><img src="file://${path.join(OUT, `onef1-vegas-cover-${id}.png`)}" width="360"><div style="margin-top:6px">${String.fromCharCode(65 + k)} · ${id}</div></div>`).join("")}</body>`);
  await p.waitForTimeout(500); await p.screenshot({ path: path.join(OUT, 'onef1-vegas-cover-options.png'), fullPage: true });
  await b.close(); console.log('covers:', ids.join(', '));
})();
