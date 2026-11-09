const DATA = __DATA__;               // { order: [lap0 grid .. lap71 classification], drivers: {code: {team, color, last}} }
const ORDER = DATA.order, DRV = DATA.drivers, LAPS = 71;
const GRID = Object.fromEntries(ORDER[0].map((c, i) => [c, i + 1]));
const tyreAt = (lap) => (lap <= 16 ? "INTERS" : lap <= 62 ? "SLICKS" : "INTERS");   // the leader's tyres
const EVENTS = [
  { lap: 0,  kind: "START",    title: "LIGHTS OUT",                     body: ["80% risk of rain · everyone on inters", "Bottas does not start"], focus: [] },
  { lap: 1,  kind: "LEAD",     title: "ANTONELLI TAKES THE LEAD",       body: ["From P2 on the grid, past polesitter Norris", "on the opening lap"], focus: ["ANT", "NOR"], react: { say: "OOH", text: "OOOH!" } },
  { lap: 1,  kind: "LAP 1",    title: "HAMILTON +11 · VERSTAPPEN +8",   body: ["P20 → P9 and P21 → P13", "in a single lap"], focus: ["HAM", "VER"], react: { say: "YAY", text: "YAY!" } },
  { lap: 6,  kind: "INCIDENT", title: "HAMILTON OFF AT TURN 5",         body: ["Investigated for gaining an advantage", "No further action"], focus: ["HAM"], react: { say: "UHOH", text: "UH-OH" } },
  { lap: 16, kind: "PIT",      title: "THE SWITCH TO SLICKS",           body: ["Hamilton boxes first on lap 14", "11 cars pit on lap 16 alone"], focus: ["HAM"], react: { say: "HUH", text: "BOX BOX!" } },
  { lap: 17, kind: "OVERTAKE", title: "VERSTAPPEN UP TO P2",            body: ["21st on the grid, second after 17 laps", ""], focus: ["VER"], react: { say: "WOO", text: "WOOO!" } },
  { lap: 20, kind: "LEAD",     title: "NORRIS BACK IN FRONT",           body: ["Passes Antonelli for the lead", ""], focus: ["NOR", "ANT"], react: { say: "YAY", text: "YAY!" } },
  { lap: 30, kind: "OUT",      title: "STROLL RETIRES",                 body: ["Aston Martin's race ends on lap 30", ""], focus: [], react: { say: "WOMP", text: "WOMP WOMP" } },
  { lap: 37, kind: "PENALTY",  title: "ALBON vs GASLY, TURN 1",         body: ["Albon gets 5 seconds", "for rejoining the track unsafely"], focus: ["ALB", "GAS"], react: { say: "NO", text: "NOPE." } },
  { lap: 38, kind: "OVERTAKE", title: "VERSTAPPEN PASSES HADJAR",       body: ["Red Bull run 2-3 behind Norris", ""], focus: ["VER", "HAD"], react: { say: "OOH", text: "OOOH!" } },
  { lap: 50, kind: "PIT",      title: "PIT-STOP SHUFFLE",               body: ["Hadjar, then Antonelli lead", "while Norris makes his stop"], focus: ["HAD", "ANT"], react: { say: "HUH", text: "HUH?" } },
  { lap: 54, kind: "LEAD",     title: "NORRIS LEADS, VERSTAPPEN P2",    body: ["Verstappen passes Antonelli for second", ""], focus: ["NOR", "VER"], react: { say: "YAY", text: "YAY!" } },
  { lap: 62, kind: "RAIN",     title: "THE RAIN IS BACK",               body: ["14 cars switch to inters", "on laps 61 and 62"], focus: [], react: { say: "NO", text: "OH NO" } },
  { lap: 71, kind: "CONTACT",  title: "LAST-LAP CONTACT",               body: ["Leclerc and Lawson collide at Turn 12", "Leclerc crossed 7th, classified 8th after review"], focus: ["LEC", "LAW"], react: { say: "NO", text: "NOOO!" } },
];
const KIND_COLOUR = { START: "#3DDC84", LEAD: "#FFD400", "LAP 1": "#FFB000", INCIDENT: "#FF5A4E", PIT: "#4FA3FF", OVERTAKE: "#FFB000", OUT: "#FF5A4E", PENALTY: "#FF5A4E", RAIN: "#4FA3FF", CONTACT: "#FF5A4E" };

/* ---------- timeline: a pure function of t, so the video export can render any frame ---------- */
const LIGHTS = 1.25, PER_LAP = 0.2, SLOW_LAP = 0.5, HOLD = 3.8, MOVE = 0.18, FINISH = 10; // slow-in: the 2 laps before an event run at SLOW_LAP
const segs = [];          // {t0, t1, lap0, lap1} moving, or {t0, t1, lap, ev} holding
(() => {
  let t = LIGHTS, lap = 0;
  const holdsAt = (l) => EVENTS.filter((e) => e.lap === l);
  holdsAt(0).forEach((ev) => { segs.push({ t0: t, t1: t + HOLD, lap: 0, ev }); t += HOLD; });
  for (let l = 1; l <= LAPS; l++) {
    const d = EVENTS.some((e) => e.lap >= l && e.lap - l <= 1) ? SLOW_LAP : PER_LAP;
    segs.push({ t0: t, t1: t + d, lap0: l - 1, lap1: l }); t += d;
    holdsAt(l).forEach((ev) => { segs.push({ t0: t, t1: t + HOLD, lap: l, ev }); t += HOLD; });
  }
  segs.push({ t0: t, t1: t + FINISH, lap: LAPS, finish: true }); t += FINISH;
})();
const DURATION = segs[segs.length - 1].t1;
function stateAt(t) {
  if (t < LIGHTS) return { lapF: 0, lap: 0, ev: null, evT: 0 };
  const s = segs.find((x) => t >= x.t0 && t < x.t1) || segs[segs.length - 1];
  if (s.finish) return { lapF: LAPS, lap: LAPS, ev: null, finT: t - s.t0 };
  if (s.ev) return { lapF: s.lap, lap: s.lap, ev: s.ev, evT: t - s.t0 };
  const f = (t - s.t0) / (s.t1 - s.t0);
  return { lapF: s.lap0 + f, lap: f > .5 ? s.lap1 : s.lap0, ev: null };
}

/* ---------- drawing ---------- */
const NS = "http://www.w3.org/2000/svg";
const el = (tag, attrs = {}, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
const $ = (id) => document.getElementById(id);
const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const ROWS = 10, ROW_H = 66, PIN_Y = ROWS * ROW_H + 14;
const rows = {};
function buildTower() {
  const g = $("tower");
  el("rect", { x: 0, y: -10, width: 960, height: PIN_Y + ROW_H + 10, rx: 16, fill: "url(#dots)", stroke: "#2B2615", "stroke-width": 2 }, g);
  el("line", { x1: 16, x2: 944, y1: PIN_Y - 7, y2: PIN_Y - 7, stroke: "#3A3418", "stroke-width": 2, "stroke-dasharray": "6 8" }, g);
  Object.keys(DRV).forEach((c) => {
    const r = el("g", { opacity: 0 }, g);
    const hl = el("rect", { x: 6, y: 4, width: 948, height: ROW_H - 8, rx: 10, fill: "none", stroke: "#FFD400", "stroke-width": 3, opacity: 0 }, r);
    const pos = el("text", { class: "led glow", x: 70, y: 46, "text-anchor": "end", style: "font-size:38px" }, r);
    el("rect", { x: 90, y: 14, width: 10, height: ROW_H - 28, rx: 2, fill: DRV[c].color }, r);
    el("text", { class: "disp", x: 120, y: 47, style: "font-size:38px" }, r).textContent = c;
    el("text", { class: "mono", x: 262, y: 45, style: "font-size:21px" }, r).textContent = (DRV[c].team || "").toUpperCase();
    const delta = el("text", { class: "led", x: 930, y: 46, "text-anchor": "end", style: "font-size:32px" }, r);
    rows[c] = { r, pos, delta, hl };
  });
}
function buildStrip() {
  const g = $("strip"), W = 960, x = (l) => (l / LAPS) * W;
  el("rect", { x: 0, y: 0, width: x(16), height: 22, fill: "#4FA3FF" }, g);
  el("rect", { x: x(16), y: 0, width: x(62) - x(16), height: 22, fill: "#FF5A4E" }, g);
  el("rect", { x: x(62), y: 0, width: W - x(62), height: 22, fill: "#4FA3FF" }, g);
  [["INTERS", 8], ["SLICKS", 39], ["INTERS", 66.5]].forEach(([s, l]) => el("text", { class: "mono", x: x(l), y: 50, "text-anchor": "middle", style: "font-size:18px;letter-spacing:2px" }, g).textContent = s);
  [...new Set(EVENTS.map((e) => e.lap))].forEach((l) => el("rect", { x: x(l) - 2, y: -10, width: 4, height: 8, fill: "#FFB000" }, g));
}
// rank of a driver at fractional lap: interpolate between the two snapshots
function yFor(c, lapF) {
  const a = Math.floor(lapF), b = Math.min(LAPS, a + 1), f = ease((lapF - a) / 1);
  const ia = ORDER[a].indexOf(c), ib = ORDER[b].indexOf(c);
  if (ia < 0 && ib < 0) return null;
  const ra = ia < 0 ? 22 : ia, rb = ib < 0 ? 22 : ib;
  return ra + (rb - ra) * f;
}
function rough(x1, y1, x2, y2, seed) { let s = seed; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647); let d = `M${x1},${y1}`; for (let i = 1; i <= 6; i++) { const f = i / 6; d += ` L${(x1 + (x2 - x1) * f + (r() - .5) * 6).toFixed(1)},${(y1 + (y2 - y1) * f + (r() - .5) * 5).toFixed(1)}`; } return d; }
function burst(rx, ry, seed) { let s = seed * 7 + 3; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647); const pts = [];
  for (let i = 0; i < 22; i++) { const a = i / 22 * Math.PI * 2, k = i % 2 ? .78 : 1.08 + (r() - .5) * .12; pts.push(`${(Math.cos(a) * rx * k).toFixed(1)},${(Math.sin(a) * ry * k).toFixed(1)}`); }
  return "M" + pts.join(" L") + "Z"; }
const textW = (n) => { try { return n.getComputedTextLength(); } catch (e) { return n.textContent.length * 20; } };
let shownEv = null;
function renderAt(t) {
  const S = stateAt(t), lapF = S.lapF, cur = ORDER[Math.round(Math.min(lapF, LAPS))];
  const focus = S.ev ? S.ev.focus : [];
  const pinned = focus.find((c) => cur.indexOf(c) >= ROWS) || (cur.indexOf("VER") >= ROWS ? "VER" : null);
  Object.keys(rows).forEach((c) => {
    const R = rows[c], rk = yFor(c, lapF);
    if (rk == null || (S.lap === 0 && t < LIGHTS && rk >= ROWS && c !== pinned)) { R.r.setAttribute("opacity", 0); return; }
    let y, op;
    if (c === pinned && rk >= ROWS - .5) { y = PIN_Y; op = 1; }
    else { y = rk * ROW_H; op = rk < ROWS - .5 ? 1 : Math.max(0, 1 - (rk - (ROWS - .5)) * 2); }
    R.r.setAttribute("transform", `translate(0 ${y.toFixed(1)})`); R.r.setAttribute("opacity", op.toFixed(2));
    const p = cur.indexOf(c) + 1; R.pos.textContent = p > 0 ? p : "";
    const d = GRID[c] - p; R.delta.textContent = !p || S.lap === 0 ? "" : d > 0 ? "▲" + d : d < 0 ? "▼" + -d : "·";
    R.delta.setAttribute("style", `font-size:32px;fill:${d > 0 ? "#3DDC84" : d < 0 ? "#FF5A4E" : "#8A6A1F"}`);
    R.hl.setAttribute("opacity", focus.includes(c) ? 1 : 0);
  });
  const lapShown = Math.min(LAPS, Math.floor(lapF + 1e-6));
  $("lapTx").textContent = t < LIGHTS || lapShown === 0 ? "GRID" : String(lapShown).padStart(2, "0");
  $("lapOf").textContent = t < LIGHTS || lapShown === 0 ? "" : "/ 71";
  const ty = tyreAt(Math.max(1, lapShown)); $("tyreTx").textContent = ty; $("tyreDot").setAttribute("stroke", ty === "INTERS" ? "#4FA3FF" : "#FF5A4E");
  $("leadTx").textContent = cur[0];
  $("rain").setAttribute("opacity", ty === "INTERS" ? .9 : 0);
  $("cursor").setAttribute("x", (lapF / LAPS) * 960 - 2.5);
  // event card: stays up until the next event replaces it; a bar drains while the race is paused on it
  const card = $("card"), last = segs.filter((s) => s.ev && s.t0 <= t).pop();
  const A = S.finT == null ? last : null;
  if (A) {
    const e = A.ev, evT = t - A.t0;
    if (shownEv !== e) {
      shownEv = e; const col = KIND_COLOUR[e.kind] || "#FFB000";
      $("kindTx").textContent = e.kind; $("kindBg").setAttribute("width", textW($("kindTx")) + 28); $("kindBg").setAttribute("fill", col);
      $("cardLap").setAttribute("x", 28 + textW($("kindTx")) + 28 + 22); $("cardLap").setAttribute("text-anchor", "start");
      $("cardBox").setAttribute("stroke", col); $("cardBar").setAttribute("fill", col);
      $("cardLap").textContent = e.lap ? "LAP " + e.lap : "START";
      $("cardTitle").textContent = e.title; $("cardBody").textContent = e.body[0]; $("cardBody2").textContent = e.body[1] || "";
      $("cardTitle").style.fontSize = "58px"; const tw = textW($("cardTitle"));
      if (tw > 900) $("cardTitle").style.fontSize = (58 * 900 / tw).toFixed(1) + "px";   // long titles shrink to fit the card
      $("cardSwash").setAttribute("d", rough(30, 168, Math.min(930, 30 + textW($("cardTitle"))), 164, e.lap + 3));
      const st = $("sticker");
      if (e.react) { $("stickerTx").textContent = e.react.text; const w = textW($("stickerTx")) + 60; $("stickerBurst").setAttribute("d", burst(w / 2, 46, e.lap + 11)); st.dataset.on = 1; }
      else st.dataset.on = 0;
    }
    card.setAttribute("opacity", Math.min(1, evT / .2).toFixed(2));
    card.setAttribute("transform", `translate(60 ${(1236 + (1 - Math.min(1, evT / .3)) * 34).toFixed(1)})`);
    $("cardBar").setAttribute("width", (Math.max(0, 1 - evT / HOLD) * 904).toFixed(1));
    const st = $("sticker"), sT = evT - .35;
    if (st.dataset.on === "1" && sT > 0) {
      const sc = sT < .18 ? sT / .18 * 1.25 : sT < .3 ? 1.25 - (sT - .18) / .12 * .25 : 1;   // pop, overshoot, settle
      st.setAttribute("transform", `translate(820 -8) rotate(-8) scale(${sc.toFixed(3)})`); st.setAttribute("opacity", 1);
    } else st.setAttribute("opacity", 0);
  } else { card.setAttribute("opacity", 0); shownEv = null; }
  // start lights
  const beat = Math.floor(t / (LIGHTS / 4));
  $("lights").setAttribute("opacity", t < LIGHTS + .3 ? Math.min(1, (LIGHTS + .3 - t) / .25).toFixed(2) : 0);
  [0, 1, 2].forEach((i) => $("lt" + i).setAttribute("fill", beat >= 3 ? "#3DDC84" : beat >= i ? "#FF3B30" : "#2A1010"));
  // finish
  const fin = $("fin");
  if (S.finT != null) { fin.setAttribute("opacity", Math.min(1, S.finT / .4).toFixed(2)); finPage(S.finT < 4.8 ? 0 : 1); }
  else fin.setAttribute("opacity", 0);
}
let finShown = -1;
function finPage(p) {
  if (p === finShown) return; finShown = p;
  const g = $("fin"); g.textContent = "";
  el("rect", { x: 0, y: 1210, width: 1080, height: 600, fill: "#0E0F12" }, g);
  el("rect", { x: 60, y: 1236, width: 960, height: 520, rx: 18, fill: "url(#dots)", stroke: "#FFD400", "stroke-width": 3 }, g);
  if (p === 0) {
    el("text", { class: "led glow", x: 96, y: 1300, style: "font-size:30px;letter-spacing:3px" }, g).textContent = "CHEQUERED FLAG";
    el("text", { class: "disp", x: 92, y: 1380, style: "font-size:72px" }, g).textContent = "NORRIS WINS";
    [["P1", "NOR", "from P1"], ["P2", "VER", "from P21 · ▲19"], ["P3", "HAD", "from P5 · ▲2"]].forEach(([p, c, s], i) => {
      const y = 1462 + i * 84;
      el("text", { class: "led glow", x: 96, y, style: "font-size:46px" }, g).textContent = p;
      el("rect", { x: 186, y: y - 38, width: 10, height: 46, fill: DRV[c].color }, g);
      el("text", { class: "disp", x: 214, y: y + 2, style: "font-size:48px" }, g).textContent = DRV[c].last.toUpperCase();
      el("text", { class: "mono", x: 984, y: y - 4, "text-anchor": "end", style: `font-size:26px;fill:${c === "VER" ? "#FFD400" : "#C9CDD2"}` }, g).textContent = s;
    });
    el("text", { class: "hand", x: 984, y: 1720, "text-anchor": "end", style: "font-size:44px" }, g).textContent = "From P17+ to the podium, 3 years running";
  } else {
    el("text", { class: "led glow", x: 96, y: 1300, style: "font-size:30px;letter-spacing:3px" }, g).textContent = "BATTLE FOR P2 · 3 ROUNDS LEFT";
    [["P2", "VER", 279, "+18"], ["P3", "RUS", 262, "+12"], ["P4", "HAM", 261, "+2"], ["P5", "LEC", 249, "+4"]].forEach(([p, c, pts, add], i) => {
      const y = 1386 + i * 80;
      el("text", { class: "led glow", x: 96, y, style: "font-size:44px" }, g).textContent = p;
      el("rect", { x: 186, y: y - 36, width: 10, height: 44, fill: DRV[c].color }, g);
      el("text", { class: "disp", x: 214, y: y + 2, style: "font-size:46px" }, g).textContent = DRV[c].last.toUpperCase();
      el("text", { class: "mono", x: 820, y: y - 2, "text-anchor": "end", style: "font-size:26px;fill:#3DDC84" }, g).textContent = add;
      el("text", { class: "disp", x: 984, y: y + 2, "text-anchor": "end", style: "font-size:46px" }, g).textContent = pts;
    });
    el("text", { class: "mono", x: 96, y: 1724, style: "font-size:20px" }, g).textContent = "Points incl. sprints. Some incidents still under review.";
  }
}

/* ---------- sound: the chiptune loop + event sounds (Web Audio, original composition) ---------- */
const BPM = 192, BEAT = 60 / BPM, SIX = BEAT / 4;
const NOTE = (n) => { const m = n.match(/^([A-G])(#?)(\d)$/); const k = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] ? 1 : 0); return 440 * Math.pow(2, (k + 12 * (+m[3] + 1) - 69) / 12); };
const MELODY = ["A4:2 D5:2 F#5:2 A5:4 F#5:2 E5:2 D5:2", "F#5:2 E5:2 D5:2 B4:4 D5:2 E5:4", "D5:2 F#5:2 G5:2 B5:6 A5:2 G5:2", "F#5:3 E5:3 C#5:2 E5:4 R:4",
  "A5:2 F#5:2 A5:2 D6:4 C#6:2 B5:2 A5:2", "C#6:2 A5:2 F#5:2 C#5:4 E5:2 F#5:4", "G5:2 F#5:2 E5:2 D5:2 B4:2 D5:2 G5:4", "A5:4 G5:2 F#5:2 E5:2 C#5:2 A4:4"];
const CHORDS = [["D", "F#", "A", "C#"], ["B", "D", "F#", "A"], ["G", "B", "D", "F#"], ["A", "C#", "E", "G"], ["D", "F#", "A", "C#"], ["F#", "A", "C#", "E"], ["G", "B", "D", "F#"], ["A", "C#", "E", "G"]];
const BASS = ["D2", "B1", "G1", "A1", "D2", "F#1", "G1", "A1"];
let AC = null, master = null, bus = null, musicBus = null, pulse25, pulse12, noiseBuf, soundOn = false, schedUpTo = 0, events = [];
function voices(ctx) { const pw = (d) => { const n = 64, re = new Float32Array(n), im = new Float32Array(n); for (let k = 1; k < n; k++) re[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * d); return ctx.createPeriodicWave(re, im); };
  pulse25 = pw(.25); pulse12 = pw(.125); noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
function chain(ctx) { const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3; comp.connect(ctx.destination); const m = ctx.createGain(); m.gain.value = .33; m.connect(comp); return m; }
function tone(out, w, dur, f, wave, vol, slide) { const c = out.context, o = c.createOscillator(), g = c.createGain(); if (typeof wave === "string") o.type = wave; else o.setPeriodicWave(wave);
  o.frequency.setValueAtTime(f, w); if (slide) o.frequency.exponentialRampToValueAtTime(slide, w + dur); g.gain.setValueAtTime(0, w); g.gain.linearRampToValueAtTime(vol, w + .005); g.gain.setValueAtTime(vol, w + Math.max(.01, dur - .03)); g.gain.linearRampToValueAtTime(0, w + dur); o.connect(g).connect(out); o.start(w); o.stop(w + dur + .02); }
function noise(out, w, dur, vol, hp, lp) { const c = out.context, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = noiseBuf; f.type = lp ? "lowpass" : "highpass"; f.frequency.value = lp || hp; g.gain.setValueAtTime(vol, w); g.gain.exponentialRampToValueAtTime(.001, w + dur); s.connect(f).connect(g).connect(out); s.start(w, Math.random() * .5); s.stop(w + dur + .02); }
/* cartoon voices: a buzzy source through three formant filters, gliding between vowels (all synthesised, no samples) */
const V = { ee: [270, 2290, 3010], eh: [530, 1840, 2480], ah: [730, 1090, 2440], oh: [570, 840, 2410], oo: [300, 870, 2240], uh: [640, 1190, 2390] };
function say(out, w, dur, f0, f1, vowels, vol = .5, vib = 0) { vol *= 9;
  const c = out.context, src = c.createOscillator(), g = c.createGain(); src.type = "sawtooth";
  src.frequency.setValueAtTime(f0, w); src.frequency.exponentialRampToValueAtTime(f1, w + dur);
  if (vib) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 6; lg.gain.value = vib; l.connect(lg).connect(src.frequency); l.start(w); l.stop(w + dur + .05); }
  g.gain.setValueAtTime(0, w); g.gain.linearRampToValueAtTime(vol, w + .03); g.gain.setValueAtTime(vol, w + dur * .75); g.gain.linearRampToValueAtTime(0, w + dur);
  [0, 1, 2].forEach((k) => { const bp = c.createBiquadFilter(), fg = c.createGain(); bp.type = "bandpass"; bp.Q.value = [5, 7, 9][k]; fg.gain.value = [1, .7, .3][k];
    vowels.forEach((v, i) => { const at = w + dur * (vowels.length === 1 ? 0 : i / (vowels.length - 1)) * .8; i ? bp.frequency.linearRampToValueAtTime(V[v][k], at) : bp.frequency.setValueAtTime(V[v][k], at); });
    src.connect(bp).connect(fg).connect(g); });
  g.connect(out); src.start(w); src.stop(w + dur + .05);
}
const VOICE = {
  YAY: (o, w) => say(o, w, .55, 330, 560, ["eh", "ee"], .55),
  NO: (o, w) => say(o, w, .95, 300, 150, ["oh", "oo"], .55, 9),
  UHOH: (o, w) => { say(o, w, .22, 340, 330, ["uh"], .5); say(o, w + .28, .45, 250, 220, ["oh", "oo"], .5); },
  OOH: (o, w) => [0, 1, 2].forEach((i) => say(o, w + i * .02, 1.0, [210, 260, 320][i], [300, 360, 430][i], ["oo", "oh"], .22, 5)),
  HUH: (o, w) => say(o, w, .45, 200, 420, ["uh", "ah"], .5),
  WOO: (o, w) => say(o, w, .7, 300, 700, ["oo", "oo", "ee"], .5, 6),
  WOMP: (o, w) => { [[233, 220], [220, 207], [207, 196], [196, 160]].forEach(([a, b], i) => say(o, w + i * .36, i === 3 ? .9 : .32, a, b, ["oo", "ah"], .45, i === 3 ? 7 : 0)); },
};
const SFX = {
  START: (o, w) => {},
  LEAD: (o, w) => { tone(o, w, .07, NOTE("B5"), "square", .16); tone(o, w + .07, .28, NOTE("E6"), "square", .16); },
  "LAP 1": (o, w) => ["C6", "E6", "G6", "C7", "E7"].forEach((n, i) => tone(o, w + i * .04, .06, NOTE(n), pulse12, .12)),
  OVERTAKE: (o, w) => ["C6", "E6", "G6", "C7"].forEach((n, i) => tone(o, w + i * .045, .06, NOTE(n), pulse12, .13)),
  INCIDENT: (o, w) => { tone(o, w, .12, 330, "square", .14); tone(o, w + .16, .12, 330, "square", .14); },
  CONTACT: (o, w) => { noise(o, w, .25, .4, 0, 900); tone(o, w, .3, 180, "square", .12, 70); },
  PENALTY: (o, w) => tone(o, w, .35, 140, "sawtooth", .12, 120),
  OUT: (o, w) => tone(o, w, .5, 620, "square", .12, 110),
  PIT: (o, w) => { noise(o, w, .35, .25, 2500); tone(o, w, .3, 300, pulse25, .08, 900); },
  RAIN: (o, w) => noise(o, w, 1.4, .22, 0, 1800),
};
function buildSong() {
  const ev = [], add = (at, play, music = false, duck = 0) => ev.push({ at, play, music, duck });
  [0, 1, 2].forEach((b) => add(b * (LIGHTS / 4), (w, o) => tone(o, w, .12, 440, pulse25, .28)));
  add(3 * (LIGHTS / 4), (w, o) => tone(o, w, .32, 880, pulse25, .32));
  const end = DURATION - 2.2, bars = Math.ceil((end - LIGHTS) / (BEAT * 4));
  for (let b = 0; b < bars; b++) {
    const t0 = LIGHTS + b * BEAT * 4, k = b % 8, ch = CHORDS[k];
    let s = 0; if (b >= 4) MELODY[k].split(" ").forEach((tok) => { const [n, len] = tok.split(":"); if (n !== "R") { const f = NOTE(n); add(t0 + s * SIX, (w, o) => tone(o, w, +len * SIX * .92, f, pulse25, .15), true); } s += +len; });
    for (let i = 0; i < 16; i++) { const f = NOTE(ch[i % 4] + (i % 8 < 4 ? "4" : "5")); add(t0 + i * SIX, (w, o) => tone(o, w, SIX * .8, f, pulse12, .045), true); }
    for (let i = 0; i < 8; i++) { const f = NOTE(BASS[k]) * (i % 2 ? 2 : 1); add(t0 + i * 2 * SIX, (w, o) => tone(o, w, 2 * SIX * .85, f, "triangle", .4), true); }
    [0, 2].forEach((q) => add(t0 + q * BEAT, (w, o) => tone(o, w, .14, 150, "triangle", .9, 40), true));
    [1, 3].forEach((q) => add(t0 + q * BEAT, (w, o) => noise(o, w, .16, .3, 1200), true));
    for (let i = 0; i < 8; i++) add(t0 + i * 2 * SIX, (w, o) => noise(o, w, .04, .08, 7000), true);
  }
  segs.filter((s) => s.ev).forEach((s) => add(s.t0 + .05, (w, o) => (SFX[s.ev.kind] || SFX.OVERTAKE)(o, w)));
  segs.filter((s) => s.ev && s.ev.react && VOICE[s.ev.react.say]).forEach((s) => add(s.t0 + .35, (w, o) => VOICE[s.ev.react.say](o, w), false, s.ev.react.say === "WOMP" ? 1.6 : 1.0));
  segs.filter((s) => s.ev && s.ev.kind === "RAIN").forEach((s) => add(s.t0 + .1, (w, o) => { noise(o, w, 2.2, .5, 0, 160); tone(o, w, 1.6, 48, "triangle", .5, 32); }));   // thunder
  segs.filter((s) => s.ev && s.ev.kind === "CONTACT").forEach((s) => add(s.t0 + .05, (w, o) => tone(o, w, .25, 420, "sine", .5, 90)));                                   // bonk
  const fin = segs[segs.length - 1].t0;
  ["D5", "E5", "F#5", "A5"].forEach((n, i) => add(fin + i * 2 * SIX, (w, o) => tone(o, w, 2 * SIX * .9, NOTE(n), pulse25, .22)));
  add(fin + 8 * SIX, (w, o) => { ["D5", "F#5", "A5", "D6"].forEach((n) => tone(o, w, 1.8, NOTE(n), pulse25, .12)); tone(o, w, 1.8, NOTE("D3"), "triangle", .4); noise(o, w, 1.2, .18, 4000); });
  events = ev.sort((a, b) => a.at - b.at);
}
function newBus() { if (bus) { const old = bus; old.gain.setTargetAtTime(0, AC.currentTime, .02); setTimeout(() => old.disconnect(), 300); } bus = AC.createGain(); bus.connect(master); musicBus = AC.createGain(); musicBus.connect(bus); }
// dip the music under a reaction, like a DJ talking over a track
function duck(g, w, d) { g.setTargetAtTime(.3, w - .05, .03); g.setTargetAtTime(1, w + d, .12); }
function pumpAudio(t) { if (!soundOn || !AC || !playing) return; const h = t + .15;
  for (const e of events) { if (e.at < schedUpTo) continue; if (e.at >= h) break; const w = AC.currentTime + Math.max(0, e.at - t); e.play(w, e.music ? musicBus : bus); if (e.duck) duck(musicBus.gain, w, e.duck); }
  schedUpTo = h; }
function resync() { if (AC && soundOn) { newBus(); schedUpTo = T; } }
function setSound(on) { if (on && !AC) { AC = new (window.AudioContext || window.webkitAudioContext)(); voices(AC); master = chain(AC); } if (on) { AC.resume(); newBus(); schedUpTo = T; } else if (AC) newBus(); soundOn = on; $("sound").textContent = on ? "Sound on" : "Sound off"; $("sound").setAttribute("aria-pressed", on); }
async function renderSoundtrack(sr = 48000) { const ctx = new OfflineAudioContext(2, Math.ceil(DURATION * sr), sr); voices(ctx); const m = chain(ctx), mus = ctx.createGain(); mus.connect(m);
  events.forEach((e) => { e.play(e.at, e.music ? mus : m); if (e.duck) duck(mus.gain, e.at, e.duck); }); return ctx.startRendering(); }

/* ---------- playback ---------- */
let T = 0, playing = !matchMedia("(prefers-reduced-motion: reduce)").matches, last = performance.now();
function frame(now) { const dt = Math.min(.1, (now - last) / 1000); last = now; if (playing) { T += dt; if (T >= DURATION) { T = DURATION - 1e-3; setPlaying(false); } }
  renderAt(T); pumpAudio(T); if (document.activeElement !== $("scrub")) $("scrub").value = Math.round(T / DURATION * 1000); requestAnimationFrame(frame); }
function setPlaying(p) { if (p !== playing) resync(); playing = p; $("play").textContent = p ? "Pause" : "Play"; }
$("play").onclick = () => { if (T >= DURATION - .01) T = 0; setPlaying(!playing); };
$("restart").onclick = () => { T = 0; resync(); setPlaying(true); };
$("sound").onclick = () => { setSound(!soundOn); if (soundOn && !playing) { if (T >= DURATION - .01) T = 0; setPlaying(true); } };
$("scrub").oninput = (e) => { T = +e.target.value / 1000 * DURATION; setPlaying(false); resync(); };
buildTower(); buildStrip(); buildSong();
if (!playing) T = DURATION - 1e-3;
setPlaying(playing); requestAnimationFrame(frame);
window.statlabRecap = { renderAt, DURATION, renderSoundtrack, seek(x) { T = x; setPlaying(false); } };
