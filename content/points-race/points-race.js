const DATA = __DATA__;
const N = DATA.rounds.length;
const LIVERY = { // generic team colours, no logos
  MER: { body: "#AEB6BF", dark: "#15171B", accent: "#27E0C2" },
  FER: { body: "#E8102E", dark: "#1A0A0C", accent: "#F2F2F0" },
  RBR: { body: "#2A3B85", dark: "#0E1330", accent: "#E8102E" },
  MCL: { body: "#FF8A1F", dark: "#16181C", accent: "#4FA3FF" },
};
const livery = (t) => LIVERY[t] || { body: DATA.teams[t].color, dark: "#15171B", accent: "#F2F2F0" };
const lineColour = (id) => { const t = DATA.drivers[id].team; return t === "MER" ? "#27E0C2" : t === "RBR" ? "#5B7FFF" : livery(t).body; };
const off = DATA.official;
const champOrder = Object.keys(off).sort((a, b) => off[b] - off[a]);
const champPos = (id) => champOrder.indexOf(id) + 1;
const PRESETS = [
  { name: "Battle for P2", ids: ["VER", "HAM", "RUS", "LEC"], hl: "P2", target: 2 },
  { name: "Title fight", ids: ["ANT", "VER", "HAM"], hl: "TITLE", target: 1 },
  { name: "Mercedes: Antonelli v Russell", ids: ["ANT", "RUS"] },
  { name: "Ferrari: Leclerc v Hamilton", ids: ["LEC", "HAM"] },
  { name: "McLaren: Norris v Piastri", ids: ["NOR", "PIA"] },
  { name: "Red Bull: Verstappen v Hadjar", ids: ["VER", "HAD"] },
];
let sel = PRESETS[0].ids.slice(), preset = 0;
const target = () => (PRESETS[preset] && PRESETS[preset].target) || 0;

/* ---------- timing: pure function of t, so a video export can render any frame ---------- */
const STEP = 1.25, INTRO = STEP, MOVE = 0.8, OUTRO = 4.5; // intro = one bar of music: the start-light countdown
const DURATION = INTRO + N * STEP + OUTRO;
const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
function roundAt(t) { // fractional round 0..N
  if (t < INTRO) return 0;
  const k = Math.floor((t - INTRO) / STEP), f = (t - INTRO - k * STEP) / MOVE;
  return Math.min(N, k + ease(Math.min(1, f)));
}
const ptsAt = (id, r) => { const i = Math.floor(r), f = r - i, v = (j) => (j <= 0 ? 0 : DATA.gp[id][Math.min(j, N) - 1]); return v(i) + (v(i + 1) - v(i)) * f; };
const champAt = (id, j) => (j <= 0 ? null : DATA.champ[id][Math.min(j, N) - 1]);  // championship position after round j
const resAt = (id, j) => (j <= 0 ? null : DATA.res[id][j - 1]);                      // that race's finish: number, "DNF" or null
const gainedAt = (id, j) => (j <= 0 ? 0 : DATA.gp[id][j - 1] - (j > 1 ? DATA.gp[id][j - 2] : 0));

/* ---------- moves in the championship: a selected driver climbs a place ---------- */
let moves = [];
function computeMoves() {
  moves = [];
  for (let j = 2; j <= N; j++) sel.forEach((id) => { const a = champAt(id, j - 1), b = champAt(id, j); if (b < a) moves.push({ j, id, to: b }); });
}

/* ---------- build the stage ---------- */
const NS = "http://www.w3.org/2000/svg";
const el = (tag, attrs = {}, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
const $ = (id) => document.getElementById(id);
let cars = {}, bump = null;
const TRACK_L = 96, TRACK_R = 984, LANE_L = 168, CAR_W = 104, CAR_H = 277, LEAD_Y = 600, SPAN = 550; // lanes leave a gutter on the left for gap labels
function lanesX(n) { const w = TRACK_R - LANE_L; return Array.from({ length: n }, (_, i) => LANE_L + w * (i + .5) / n); }
function build() {
  const g = $("cars"); g.textContent = ""; cars = {};
  const lanes = $("lanes"); lanes.textContent = "";
  const xs = lanesX(sel.length);
  xs.slice(0, -1).forEach((x, i) => el("rect", { x: (x + xs[i + 1]) / 2 - 5, y: -120, width: 10, height: 2160, fill: "url(#dash)" }, lanes));
  sel.forEach((id, i) => {
    const d = DATA.drivers[id], L = livery(d.team);
    const grp = el("g", {}, g);
    el("use", { href: "#car", x: -CAR_W / 2, y: -CAR_H / 2, width: CAR_W, height: CAR_H, style: `--body:${L.body};--dark:${L.dark};--accent:${L.accent}` }, grp);
    const pop = el("g", { opacity: 0 }, grp);
    const popBg = el("rect", { class: "pop-bg", y: -24, height: 48, rx: 8 }, pop);
    const popTx = el("text", { class: "t-pop pop-tx", x: 0, y: 10, "text-anchor": "middle" }, pop);
    const rankBg = el("rect", { x: -38, y: CAR_H / 2 + 6, width: 76, height: 36, rx: 8, fill: "#F2F2F0" }, grp);
    const rank = el("text", { class: "t-rank", x: 0, y: CAR_H / 2 + 32, "text-anchor": "middle", fill: "#0E0F12" }, grp);
    el("text", { class: "t-code", x: 0, y: CAR_H / 2 + 88, "text-anchor": "middle" }, grp).textContent = id;
    const pts = el("text", { class: "t-pts", x: 0, y: CAR_H / 2 + 146, "text-anchor": "middle" }, grp);
    cars[id] = { grp, pts, rank, rankBg, pop, popBg, popTx, x: xs[i], phase: i * 1.7, tilt: [-3, 2, -1.5, 2.5, -2][i % 5] };
  });
  const p = PRESETS[preset];
  const titleTxt = p ? p.name.toUpperCase() : "POINTS RACE";
  const ti = $("title"); ti.textContent = "";
  if (p && p.hl && titleTxt.includes(p.hl)) {
    const [a] = titleTxt.split(p.hl);
    ti.appendChild(document.createTextNode(a)); el("tspan", { class: "hl" }, ti).textContent = p.hl;
  } else ti.textContent = titleTxt;
  ti.style.fontSize = titleTxt.length > 16 ? Math.max(48, 92 * 16 / titleTxt.length) + "px" : "";
  $("deskTitle").textContent = p ? p.name : "Custom battle";
  buildBump(); computeMoves(); buildEnd(); lede(); if (typeof placeSwash === "function") placeSwash();
  if (typeof buildSong === "function") { buildSong(); resyncAudio(0); }
}

/* championship position by round: a small bump chart at the foot of the stage */
const BX0 = 150, BX1 = 900, BY0 = 1540, BY1 = 1800;
function buildBump() {
  const g = $("bump"); g.textContent = "";
  let lo = 99, hi = 0;
  sel.forEach((id) => DATA.champ[id].forEach((p) => { lo = Math.min(lo, p); hi = Math.max(hi, p); }));
  hi = Math.min(hi, lo + 9); // keep at most 10 rows
  const rows = hi - lo + 1;
  const bx = (j) => BX0 + (j - 1) / (N - 1) * (BX1 - BX0);
  const by = (p) => BY0 + (Math.min(p, hi) - lo) / Math.max(1, rows - 1) * (BY1 - BY0);
  el("rect", { x: 60, y: 1462, width: 960, height: 386, rx: 22, fill: "#0E0F12", opacity: .9 }, g);
  el("text", { class: "t-bump-h", x: 96, y: 1506 }, g).textContent = "CHAMPIONSHIP POSITION · ROUND BY ROUND";
  for (let p = lo; p <= hi; p++) {
    el("line", { x1: BX0, x2: BX1, y1: by(p), y2: by(p), stroke: "#22252B", "stroke-width": 2 }, g);
    el("text", { class: "t-bump", x: BX0 - 18, y: by(p) + 6, "text-anchor": "end", fill: target() === p ? "#FFD400" : "#6B717A" }, g).textContent = "P" + p;
  }
  if (target() >= lo && target() <= hi) el("rect", { x: BX0 - 6, y: by(target()) - 14, width: BX1 - BX0 + 12, height: 28, rx: 14, fill: "#FFD400", opacity: .1 }, g);
  if (target() >= lo && target() <= hi) el("path", { class: "deco-tele", d: roughLoop(BX0 - 22, by(target()), 34, 20, 3), fill: "none", stroke: "#FFD400", "stroke-width": 4, "stroke-linecap": "round" }, g);
  const clip = el("clipPath", { id: "bumpClip" }, g);
  const clipRect = el("rect", { x: BX0 - 14, y: BY0 - 30, width: 0, height: BY1 - BY0 + 60 }, clip);
  const lines = el("g", { "clip-path": "url(#bumpClip)" }, g);
  const seen = {};
  const heads = {};
  sel.forEach((id) => {
    const c = lineColour(id), team = DATA.drivers[id].team;
    const dash = seen[team] ? "10 8" : ""; seen[team] = true;
    const d = DATA.champ[id].map((p, i) => `${i ? "L" : "M"}${bx(i + 1).toFixed(1)},${by(p).toFixed(1)}`).join("");
    el("path", { d, fill: "none", stroke: c, "stroke-width": 5, "stroke-linejoin": "round", "stroke-linecap": "round", "stroke-dasharray": dash }, lines);
    const head = el("g", {}, g);
    el("circle", { r: 9, fill: c, stroke: "#0E0F12", "stroke-width": 3 }, head);
    el("text", { class: "t-bump-code", x: 16, y: 8, fill: c }, head).textContent = id;
    heads[id] = head;
  });
  [1, Math.ceil(N / 2), N].forEach((j) => el("text", { class: "t-bump", x: bx(j), y: BY1 + 34, "text-anchor": "middle" }, g).textContent = "R" + j);
  bump = { clipRect, heads, bx, by };
}
function lede() {
  const fin = sel.slice().sort((a, b) => off[b] - off[a]);
  const spread = off[fin[0]] - off[fin[fin.length - 1]];
  $("deskLede").textContent = `${fin.map((id) => `${DATA.drivers[id].last} P${champPos(id)} · ${off[id]}`).join(", ")} after ${N} rounds, sprints included. ${spread} point${spread === 1 ? "" : "s"} cover ${fin.length === 2 ? "the pair" : "all " + fin.length}.`;
}
function buildEnd() {
  const g = $("end"); g.textContent = "";
  el("rect", { x: 60, y: 1462, width: 960, height: 386, rx: 22, fill: "#0E0F12" }, g);
  el("text", { class: "t-end-h", x: 100, y: 1540 }, g).textContent = "OFFICIAL STANDINGS";
  el("text", { class: "t-end", x: 100, y: 1584 }, g).textContent = `After ${N} rounds · sprint points included`;
  const fin = sel.slice().sort((a, b) => off[b] - off[a]);
  const rowH = Math.min(60, 220 / fin.length);
  fin.forEach((id, i) => {
    const y = 1648 + i * rowH;
    el("rect", { x: 100, y: y - 34, width: 10, height: 42, fill: lineColour(id) }, g);
    el("text", { class: "t-end", x: 130, y, fill: champPos(id) === target() ? "#FFD400" : null }, g).textContent = `P${champPos(id)}`;
    el("text", { class: "t-end-b", x: 230, y: y + 2 }, g).textContent = DATA.drivers[id].last.toUpperCase();
    el("text", { class: "t-end-b", x: 980, y: y + 2, "text-anchor": "end" }, g).textContent = off[id];
  });
}

/* __AUDIO__ */

/* ---------- looks ---------- */
let look = "pit", winLook = "", roundLook = "";
const textW = (node) => { try { return node.getComputedTextLength(); } catch (e) { return node.textContent.length * 17; } };
function rnd(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }
function roughLine(x1, y1, x2, y2, seed) { // a marker stroke: slight wobble, overshoot at the end
  const r = rnd(seed), n = 6; let d = `M${x1},${y1}`;
  for (let i = 1; i <= n; i++) { const f = i / n; d += ` L${(x1 + (x2 - x1) * f + (r() - .5) * 6).toFixed(1)},${(y1 + (y2 - y1) * f + (r() - .5) * 5).toFixed(1)}`; }
  return d;
}
function roughLoop(cx, cy, rx, ry, seed) { // hand-drawn circle that doesn't quite close
  const r = rnd(seed), pts = []; for (let i = 0; i <= 26; i++) { const a = -2.6 + i / 26 * (Math.PI * 2 + .55); const k = 1 + (r() - .5) * .07; pts.push(`${(cx + Math.cos(a) * rx * k).toFixed(1)},${(cy + Math.sin(a) * ry * k).toFixed(1)}`); }
  return "M" + pts.join(" L");
}
function setLook(v) {
  look = v; roundLook = ""; $("svg").setAttribute("class", "look-" + v);
  try { localStorage.setItem("statlab-race-look", v); } catch (e) {}
  $("look").value = v; winLook = "";
  Object.values(cars).forEach((c) => (c.popTx.textContent = ""));  // re-measure tags in the new font
  $("toastTx").textContent = "";
  document.fonts && document.fonts.ready.then(() => { winLook = ""; Object.values(cars).forEach((c) => (c.popTx.textContent = "")); $("toastTx").textContent = ""; placeSwash(); });
  placeSwash();
}
function placeSwash() { // underline the highlighted word of the title
  const ti = $("title"), hl = ti.querySelector(".hl");
  try { const b = (hl || ti).getBBox(); $("titleSwash").setAttribute("d", roughLine(b.x - 6, b.y + b.height + 4, b.x + b.width + 10, b.y + b.height - 2, 5)); } catch (e) {}
}

/* ---------- draw one frame ---------- */
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
let gapStep = 0;
function drawGaps(lead, scale) {
  const step = [5, 10, 25, 50, 100].find((s) => s * scale >= 110) || 100;
  const g = $("gaps");
  if (step !== gapStep) { g.textContent = ""; gapStep = step; for (let k = 1; k <= 8; k++) { const l = el("g", {}, g); el("line", { x1: TRACK_L + 70, x2: TRACK_R - 10, y1: 0, y2: 0, stroke: "#3A3E46", "stroke-width": 2, "stroke-dasharray": "4 12" }, l); el("text", { class: "t-gap", x: TRACK_L + 62, y: 7, "text-anchor": "end" }, l).textContent = `−${k * step}`; } }
  [...g.children].forEach((l, k) => { const y = LEAD_Y + (k + 1) * step * scale; l.setAttribute("transform", `translate(0 ${y.toFixed(1)})`); l.setAttribute("opacity", y < 1440 ? 1 : 0); });
}
function renderAt(t) {
  const r = roundAt(t);
  const shown = t < INTRO ? 0 : Math.min(N, Math.floor((t - INTRO) / STEP) + 1); // the round the cars are moving to
  const since = t - INTRO - (shown - 1) * STEP;                                    // seconds into that round
  const landed = Math.max(0, shown && since >= MOVE * .6 ? shown : shown - 1);      // last round whose result is on screen
  const vals = sel.map((id) => [id, ptsAt(id, r)]);
  const lead = Math.max(...vals.map((v) => v[1]));
  const gap = Math.max(1, ...vals.map((v) => lead - v[1]));
  const scale = Math.min(16, SPAN / gap);
  drawGaps(lead, scale);
  vals.forEach(([id, p]) => {
    const c = cars[id], wob = reduce ? 0 : Math.sin(t * 2.1 + c.phase) * 3;
    const y = LEAD_Y + (lead - p) * scale;
    c.grp.setAttribute("transform", `translate(${(c.x + wob).toFixed(1)} ${y.toFixed(1)})`);
    c.pts.textContent = Math.round(p);
    const cp = champAt(id, landed);
    c.rank.textContent = cp ? "P" + cp : "—";
    c.rankBg.setAttribute("fill", cp && cp === target() ? "#FFD400" : cp === 1 ? "#F2F2F0" : "#F2F2F0");
    // race result tag above the car
    const res = resAt(id, shown), pop = c.pop;
    if (shown && res != null && since > .15 && since < STEP && t < INTRO + N * STEP) {
      const gained = gainedAt(id, shown);
      const txt = res === "DNF" ? "DNF" : `P${res}${gained ? " +" + gained : ""}`;
      pop.setAttribute("opacity", Math.min(1, (since - .15) / .15, (STEP - since) / .2).toFixed(2));
      pop.setAttribute("transform", `translate(0 ${(-CAR_H / 2 - 34 - Math.min(1, since / .6) * 16).toFixed(1)}) rotate(${look === "tele" || look === "pit" ? c.tilt : 0})`);
      pop.dataset.kind = res === "DNF" ? "dnf" : res === 1 ? "win" : res <= 3 ? "pod" : "other";
      if (c.popTx.textContent !== txt) { c.popTx.textContent = txt; const w = textW(c.popTx) + 30; c.popBg.setAttribute("x", -w / 2); c.popBg.setAttribute("width", w); }
    } else pop.setAttribute("opacity", 0);
  });
  $("scroll").setAttribute("transform", `translate(0 ${(reduce ? 0 : (t * 900) % 80).toFixed(1)})`);
  const info = shown ? DATA.rounds[shown - 1] : null;
  const rtx = info ? `${info.flag} R${String(shown).padStart(2, "0")}/${DATA.total} ${info.short}` : `R00/${DATA.total} START`;
  if ($("round").textContent !== rtx || roundLook !== look) { $("round").textContent = rtx; roundLook = look; const w = textW($("round")) + 40; $("roundBg").setAttribute("width", w); $("winner").setAttribute("transform", `translate(${(60 + w + 12).toFixed(0)} 312)`); winLook = ""; }
  // round winner chip
  const win = info && landed === shown ? info.win : landed ? DATA.rounds[landed - 1].win : null;
  const wg = $("winner");
  if (win) {
    const tx = `WIN ${win}`;
    if ($("winTx").textContent !== tx || winLook !== look) { $("winTx").textContent = tx; $("winBg").setAttribute("width", textW($("winTx")) + 44); winLook = look; }
    $("winBar").setAttribute("fill", lineColour(win));
    $("winTx").setAttribute("fill", sel.includes(win) ? "#FFD400" : "#F2F2F0");
    wg.setAttribute("opacity", 1);
  } else wg.setAttribute("opacity", 0);
  // championship move banner, once the result has landed
  const m = moves.filter((x) => x.j === shown).slice(0, 1);
  const toast = $("toast");
  if (m.length && since > .5 && since < STEP && t < INTRO + N * STEP) {
    const txt = m.map((x) => `${x.id} UP TO P${x.to}`).join(" · ");
    if ($("toastTx").textContent !== txt) { $("toastTx").textContent = txt; const w = textW($("toastTx")) + 36; $("toastBg").setAttribute("width", w); $("toastSwash").setAttribute("d", roughLine(16, 58, w - 10, 54, 11)); }
    toast.setAttribute("transform", `translate(${(72 + (+$("roundBg").getAttribute("width") || 0) + (+$("winBg").getAttribute("width") || 0) + 14).toFixed(0)} 312) rotate(${look === "tele" ? -3 : look === "pit" ? -1.2 : 0})`); toast.setAttribute("opacity", Math.min(1, (since - .5) / .12, (STEP - since) / .15).toFixed(2));
  } else toast.setAttribute("opacity", 0);
  // bump chart reveals up to the current fractional round
  if (bump) {
    const rr = Math.max(1, r);
    bump.clipRect.setAttribute("width", r < 1 ? 0 : (bump.bx(rr) - BX0 + 14).toFixed(1));
    sel.forEach((id) => {
      const i = Math.floor(rr), f = rr - i, p0 = DATA.champ[id][i - 1], p1 = DATA.champ[id][Math.min(i, N - 1)];
      const x = bump.bx(rr), y = bump.by(p0) + (bump.by(p1) - bump.by(p0)) * (i < N ? f : 0);
      bump.heads[id].setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
      bump.heads[id].setAttribute("opacity", r < 1 ? 0 : 1);
    });
  }
  // start lights, in time with the countdown beeps (beats 0-2 red, beat 3 green), gone shortly after GO
  const beat = Math.floor(t / (STEP / 4));
  $("lights").setAttribute("opacity", t < INTRO + .35 ? Math.min(1, (INTRO + .35 - t) / .25).toFixed(2) : 0);
  [0, 1, 2].forEach((i) => $("lt" + i).setAttribute("fill", beat >= 3 ? "#3DDC84" : beat >= i ? "#FF3B30" : "#2A1010"));
  const endT = t - (INTRO + N * STEP), e = Math.max(0, Math.min(1, endT / .5));
  $("end").setAttribute("opacity", e.toFixed(2));
  $("bump").setAttribute("opacity", (1 - e).toFixed(2));
  return shown;
}

/* ---------- playback ---------- */
let t = 0, playing = !reduce, speed = 1, last = performance.now(), lastShown = -1;
function frame(now) {
  const dt = Math.min(.1, (now - last) / 1000); last = now;
  if (playing) { t += dt * speed; if (t > DURATION) t = DURATION, setPlaying(false); }
  const shown = renderAt(t);
  window.__raceT = t; pumpAudio(t, playing, speed);
  const sc = $("scrub");
  if (document.activeElement !== sc) { const e = t - INTRO - N * STEP; sc.value = (e > 0 ? N + Math.min(1, e / OUTRO) : Math.max(0, (t - INTRO) / STEP)).toFixed(2); }
  $("scrubLabel").textContent = "R" + String(shown).padStart(2, "0");
  if (shown !== lastShown) {
    lastShown = shown;
    const info = shown ? DATA.rounds[shown - 1] : null;
    $("live").textContent = shown ? `Round ${shown}, ${info.name}, won by ${DATA.drivers[info.win].last}. ` + sel.map((id) => `${id} P${champAt(id, shown)} on ${DATA.gp[id][shown - 1]}`).join(", ") : "Start";
  }
  requestAnimationFrame(frame);
}
function setPlaying(p) { if (p !== playing) resyncAudio(t); playing = p; $("play").textContent = p ? "Pause" : "Play"; }
$("play").onclick = () => { if (t >= DURATION) t = 0; setPlaying(!playing); };
$("restart").onclick = () => { t = 0; resyncAudio(0); setPlaying(true); };
$("speed").onchange = (e) => { speed = +e.target.value; resyncAudio(t); };
$("sound").onclick = () => { setSound(!soundOn); if (soundOn && !playing) { if (t >= DURATION) t = 0; setPlaying(true); } };
$("scrub").oninput = (e) => { const v = +e.target.value; t = v > N ? INTRO + N * STEP + (v - N) * OUTRO : INTRO + v * STEP; setPlaying(false); resyncAudio(t); }; // past the last round: the finish card
const ps = $("preset");
PRESETS.forEach((p, i) => { const o = document.createElement("option"); o.value = i; o.textContent = p.name; ps.appendChild(o); });
const cu = document.createElement("option"); cu.value = -1; cu.textContent = "Custom"; ps.appendChild(cu);
ps.onchange = () => { preset = +ps.value; if (preset >= 0) sel = PRESETS[preset].ids.slice(); chips(); build(); t = 0; setPlaying(true); };
function chips() {
  const box = $("chips"); box.textContent = "";
  champOrder.forEach((id) => {
    const d = DATA.drivers[id], on = sel.includes(id);
    const b = document.createElement("button"); b.type = "button"; b.className = "chip"; b.setAttribute("aria-pressed", on);
    b.style.setProperty("--tc", lineColour(id)); b.innerHTML = `<i></i>${id}`;
    b.title = `${d.first} ${d.last} · P${champPos(id)} · ${off[id]} pts`;
    b.disabled = !on && sel.length >= 5;
    b.onclick = () => {
      if (on && sel.length <= 2) return;
      sel = on ? sel.filter((x) => x !== id) : [...sel, id];
      sel.sort((a, b2) => champOrder.indexOf(a) - champOrder.indexOf(b2));
      preset = -1; ps.value = -1; chips(); build(); t = 0; setPlaying(true);
    };
    box.appendChild(b);
  });
}
chips(); build();
$("look").onchange = (e) => setLook(e.target.value);
let saved = null; try { saved = localStorage.getItem("statlab-race-look"); } catch (e) {}
setLook(saved || "led");
if (reduce) t = DURATION; // reduced motion: open on the finished race, scrub to step through
setPlaying(playing);
requestAnimationFrame(frame);
window.statlabRace = { renderAt, DURATION, setLook, renderSoundtrack, seek(x) { t = x; setPlaying(false); }, setSelection(ids) { sel = ids; preset = -1; build(); } };
