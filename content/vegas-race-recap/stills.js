// Static storyboard frames for the Las Vegas race-story reel: one finished frame per scene (no animation).
// build.py inlines this into reel.html; ?scene=hook|grid|race&lap=N&ev=K|close|res picks the frame.
const D = __DATA__;
const $ = (id) => document.getElementById(id);
const DRV = D.drivers, col = (id) => (DRV[id] || {}).color || "#5E6470", last = (id) => (DRV[id] || {}).last || id;
const EVENTS = [
  { lap: 1,  k: "LAP 1",       c: "#F2F2F0", t: "OPENING-LAP CHAOS", b: "<b>50</b> on-track passes on lap 1 alone. <b>Sainz</b> P20 → P11.", hl: [] },
  { lap: 10, k: "LEAD BATTLE", c: "#E10600", t: "VERSTAPPEN vs RUSSELL", b: "The lead swaps <b>11 times</b> in the first 17 laps. Hadjar joins in on lap 8.", hl: ["VER", "RUS"] },
  { lap: 17, k: "PENALTY",     c: "#FFD12E", t: "HAMILTON +10s", b: "Left the track and gained an advantage at Turn 8, fighting Norris.", hl: ["HAM"] },
  { lap: 19, k: "SAFETY CAR",  c: "#FFD12E", t: "PÉREZ OUT", b: "Pérez and Câmara collide at Turn 14. Lindblad retires two laps later. The whole field pits.", hl: [] },
  { lap: 26, k: "SETBACK",     c: "#FF8A80", t: "HADJAR'S WING", b: "Broken front wing, an extra stop: <b>P3 → P18</b>. Finishes 14th.", hl: [] },
  { lap: 37, k: "LEAD BATTLE", c: "#E10600", t: "RUSSELL HITS BACK", b: "<b>10 more</b> lead changes between laps 28 and 38. Norris leads too, briefly.", hl: ["VER", "RUS"] },
  { lap: 42, k: "PENALTY",     c: "#FFD12E", t: "LECLERC +10s", b: "Collided with team-mate Hamilton on lap 38. Ferrari vs Ferrari, again.", hl: ["LEC"] },
  { lap: 45, k: "LEAD BATTLE", c: "#E10600", t: "ANTONELLI ATTACKS", b: "Passes Verstappen <b>5 times</b> in 9 laps. Max answers every single time.", hl: ["VER", "ANT"] },
  { lap: 48, k: "DRAMA",       c: "#FF8A80", t: "MERCEDES CLASH", b: "Russell goes off attacking Antonelli: <b>P3 → P9</b>.", hl: ["RUS", "ANT"] },
  { lap: 49, k: "LATE TWIST",  c: "#FF8A80", t: "ANTONELLI FADES", b: "Loses pace from P2: <b>Norris and Piastri</b> through for the podium.", hl: ["ANT", "NOR", "PIA"] },
];
const q = new URLSearchParams(location.search), scene = q.get("scene") || "hook";
document.querySelectorAll(".scene").forEach((s) => (s.style.opacity = s.id === scene ? 1 : 0));
const progAt = { hook: 0.04, grid: 0.12, race: 0.2, close: 0.8, res: 1 };

if (scene === "hook") { $("h_n").textContent = "31"; }

if (scene === "grid") {
  const rows = ["VER", "RUS", "NOR", "HAD", "LIN", "ANT"];
  $("g_rows").innerHTML = rows.map((id, i) => `<div class="grow" style="top:${460 + i * 134}px;--tc:${col(id)}">
      <span class="p">${i + 1}</span><span class="n">${last(id)}<small>${(DRV[id].team || "").toUpperCase()}${id === "VER" ? " · POLE" : ""}</small></span>
      ${id === "ANT" ? `<span class="pill" style="background:var(--sc);color:#111">FASTEST · −5 PLACES</span>` : `<span></span>`}</div>`).join("");
}

if (scene === "race") {
  const ei = q.has("ev") ? +q.get("ev") : 1, E = EVENTS[ei], lap = q.has("lap") ? +q.get("lap") : E.lap;
  progAt.race = 0.18 + 0.58 * (lap / D.laps);
  $("r_lap").textContent = lap;
  $("r_lc").textContent = D.leadByLap.filter(([l]) => l <= lap).reduce((a, [, n]) => a + n, 0);
  $("r_sc").style.opacity = lap >= 19 && lap <= 25 ? 1 : 0;
  const order = D.order[lap].slice(0, 10);
  $("tower").innerHTML = order.map((id, i) => `<div class="trow ${E.hl.includes(id) ? "hl" : ""}" style="top:${i * 75}px">
      <span class="p">${i + 1}</span><span class="c" style="background:${col(id)}"></span><span class="n">${last(id)}</span><span class="t">${(DRV[id].team || "").toUpperCase()}</span></div>`).join("");
  $("evc").style.setProperty("--ec", E.c);
  $("e_k").textContent = E.k; $("e_l").textContent = "LAP " + E.lap; $("e_t").textContent = E.t; $("e_b").innerHTML = E.b;
  const s = $("strip"), x = (l) => (l / D.laps) * 100;
  s.insertAdjacentHTML("beforeend", `<div class="scb" style="left:${x(18)}%;width:${x(7)}%"></div>` +
    EVENTS.map((e) => `<div class="mk" style="left:calc(${x(e.lap)}% - 3px)"></div>`).join("") +
    [0, 10, 20, 30, 40, 50].map((l) => `<div class="lbl" style="left:calc(${x(l)}% - 14px)">${l ? "L" + l : "GRID"}</div>`).join(""));
  $("cur").style.left = `calc(${x(lap)}% - 3px)`;
}

if (scene === "close") {
  const G = D.gap12, W = 952, H = 420, bw = W / G.length, MAX = 3, y = (g) => H - 40 - (Math.min(g, MAX) / MAX) * (H - 60);
  $("c_svg").innerHTML = `<rect x="${(18 / 50) * W}" y="0" width="${(7 / 50) * W}" height="${H - 40}" fill="rgba(255,209,46,.14)"/>
    <line x1="0" x2="${W}" y1="${y(1)}" y2="${y(1)}" stroke="#9AA0A6" stroke-dasharray="8 8" stroke-width="2"/>
    <text x="${W}" y="${y(1) - 10}" text-anchor="end" style="font:500 22px var(--mono);fill:#9AA0A6">1 SECOND</text>
    ${G.map((g, k) => `<rect x="${(k * bw + 2).toFixed(1)}" y="${y(g).toFixed(1)}" width="${(bw - 4).toFixed(1)}" height="${(H - 40 - y(g)).toFixed(1)}" rx="3" fill="${g < 1 ? "#F2F2F0" : "#4A4F58"}"/>`).join("")}
    ${[1, 10, 20, 30, 40, 50].map((l) => `<text x="${((l - 0.5) * bw).toFixed(1)}" y="${H - 6}" text-anchor="middle" style="font:500 20px var(--mono);fill:#9AA0A6">L${l}</text>`).join("")}
    <text x="${(21.5 * bw).toFixed(1)}" y="${H - 52}" text-anchor="middle" style="font:700 20px var(--mono);fill:#FFD12E">SC</text>`;
  $("c_n1").textContent = D.gap12.filter((g) => g != null && g < 1).length;
  $("c_n2").textContent = D.overtakes.lead; $("c_n3").textContent = D.overtakes.total;
}

if (scene === "res") {
  const top = D.result.filter((x) => x.pos).slice(0, 3);
  $("r_rows").innerHTML = top.map((x, i) => `<div class="rrow" style="top:${460 + i * 170}px;--tc:${col(x.id)}">
      <span class="p">${x.pos}</span><span class="n">${last(x.id)}<small>${(DRV[x.id].team || "").toUpperCase()} · FROM P${x.grid}</small></span>
      <span class="g">${i === 0 ? "WIN" : "+" + x.gap.toFixed(3)}<small>${i === 0 ? "+25 PTS" : "SECONDS"}</small></span></div>`).join("");
}
$("prog").style.width = (progAt[scene] * 100) + "%";
