/* Stat Lab — mobile app shell: hash router + views. */
(function () {
  const S = window.SEASON;
  const NEWS = window.NEWS || [];
  const app = document.getElementById("app");

  const team = Object.fromEntries(S.TEAMS.map((t) => [t.id, t]));
  const driver = Object.fromEntries(S.DRIVERS.map((d) => [d.id, d]));
  const raceByRound = Object.fromEntries(S.CALENDAR.map((r) => [r.round, r]));

  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmtDate = (iso, opts = { day: "numeric", month: "short" }) =>
    new Date(iso + "T12:00:00Z").toLocaleDateString("en-GB", { ...opts, timeZone: "UTC" });
  const lapTime = (s) => {
    const m = Math.floor(s / 60);
    return `${m}:${(s - m * 60).toFixed(3).padStart(6, "0")}`;
  };
  const tc = (teamId) => (team[teamId] ? team[teamId].color : "#9AA0A6");

  /* ---------- derived stats ---------- */
  function driverStats() {
    const st = Object.fromEntries(
      S.DRIVERS.map((d) => [d.id, { id: d.id, points: 0, wins: 0, podiums: 0, finishes: [], dnfs: 0, best: null, history: [], poles: 0 }])
    );
    S.RESULTS.forEach((res) => {
      st[res.quali[0].id].poles++;
      res.race.forEach((r) => {
        const s = st[r.id];
        s.points += r.points;
        if (r.pos === 1) s.wins++;
        if (r.pos && r.pos <= 3) s.podiums++;
        if (r.pos) s.finishes.push(r.pos);
        else s.dnfs++;
        if (r.pos && (s.best === null || r.pos < s.best)) s.best = r.pos;
        s.history.push({ round: res.round, pos: r.pos, cum: s.points });
      });
    });
    // Stat Lab patch: race points above are Grands Prix only; use official totals (incl. sprints) when provided.
    if (S.OFFICIAL_POINTS) Object.values(st).forEach((s) => { s.gpPoints = s.points; if (s.id in S.OFFICIAL_POINTS) s.points = S.OFFICIAL_POINTS[s.id]; });
    const list = Object.values(st).sort((a, b) => b.points - a.points || b.wins - a.wins);
    list.forEach((s, i) => (s.rank = i + 1));
    return list;
  }
  function teamStats(ds) {
    const map = {};
    S.TEAMS.forEach((t) => (map[t.id] = { ...t, points: 0, wins: 0 }));
    ds.forEach((s) => {
      const t = map[driver[s.id].team];
      t.points += s.points;
      t.wins += s.wins;
    });
    // Stat Lab patch: drivers who switched teams make summed totals wrong; use official team totals when provided.
    if (S.TEAM_POINTS) Object.values(map).forEach((t) => { if (t.id in S.TEAM_POINTS) t.points = S.TEAM_POINTS[t.id]; });
    return Object.values(map).sort((a, b) => b.points - a.points);
  }
  function qualiH2H(a, b) {
    let wa = 0, wb = 0, gaps = [];
    S.RESULTS.forEach((res) => {
      // Stat Lab patch: skip rounds where either driver has no qualifying time; compare finishing order in qualifying.
      const ia = res.quali.findIndex((q) => q.id === a), ib = res.quali.findIndex((q) => q.id === b);
      if (ia < 0 || ib < 0) return;
      if (ia < ib) wa++; else wb++;
      gaps.push(res.quali[ia].time - res.quali[ib].time);
    });
    const median = gaps.sort((x, y) => x - y)[Math.floor(gaps.length / 2)] || 0;
    return { a: wa, b: wb, median };
  }
  const DS = driverStats();
  const TS = teamStats(DS);
  const nextRace = S.CALENDAR.find((r) => !S.RESULTS.some((x) => x.round === r.round));

  /* ---------- small components ---------- */
  const chip = (d) =>
    `<span class="chip" style="--tc:${tc(d.team)}">${esc(d.id)}</span>`;
  const dName = (d) => `<span class="dn"><span class="dn-f">${esc(d.first)}</span> <b>${esc(d.last)}</b></span>`;
  const sectionHead = (kicker, title, extra = "") =>
    `<div class="sh"><span class="kicker">${esc(kicker)}</span><h2>${title}</h2>${extra}</div>`;

  /* ---------- views ---------- */
  function viewSeason() {
    const leader = DS[0], second = DS[1];
    const ld = driver[leader.id];
    const remaining = S.CALENDAR.length - S.RESULTS.length;
    const maxPts = leader.points || 1;

    const standings = DS.map((s, i) => {
      const d = driver[s.id];
      return `<li class="row reveal" style="--i:${Math.min(i, 12)};--tc:${tc(d.team)}">
        <span class="pos mono">${String(s.rank).padStart(2, "0")}</span>
        <span class="bar" style="--w:${(s.points / maxPts) * 100}%"></span>
        <span class="who">${dName(d)}<small>${esc(team[d.team].name)}</small></span>
        <span class="pts mono">${s.points}</span>
      </li>`;
    }).join("");

    const teamMax = TS[0].points || 1;
    const teams = TS.map((t, i) => `<li class="trow reveal" style="--i:${i};--tc:${t.color}">
        <span class="pos mono">${i + 1}</span>
        <span class="tname">${esc(t.name)}</span>
        <span class="tbar"><i style="transform:scaleX(${t.points / teamMax})"></i></span>
        <span class="pts mono">${t.points}</span>
      </li>`).join("");

    const battles = S.TEAMS.map((t) => {
      const [a, b] = S.DRIVERS.filter((d) => d.team === t.id);
      const q = qualiH2H(a.id, b.id);
      const tot = q.a + q.b || 1;
      return `<a class="battle reveal" href="#/duel/${a.id}/${b.id}" style="--tc:${t.color}">
        <div class="b-top"><span>${esc(t.name)}</span><span class="mono dim">Δ ${Math.abs(q.median).toFixed(3)}s</span></div>
        <div class="b-names"><b class="${q.a >= q.b ? "lead" : ""}">${esc(a.last)}</b><span class="mono">${q.a}–${q.b}</span><b class="${q.b > q.a ? "lead" : ""}">${esc(b.last)}</b></div>
        <div class="split"><i style="flex:${q.a / tot}"></i><i style="flex:${q.b / tot}"></i></div>
      </a>`;
    }).join("");

    return `
      <section class="hero reveal" style="--tc:${tc(ld.team)}">
        <span class="kicker">Championship leader · after R${S.RESULTS.length}</span>
        <div class="hero-num mono" aria-hidden="true">${ld.num}</div>
        <h1 style="--len:${[...ld.last].length}"><span>${esc(ld.first)}</span>${esc(ld.last)}</h1>
        <div class="hero-stats">
          <div><b class="mono">${leader.points}</b><span>pts</span></div>
          <div><b class="mono">${leader.wins}</b><span>wins</span></div>
          <div><b class="mono">+${leader.points - second.points}</b><span>gap to P2</span></div>
          <div><b class="mono">${remaining * 25}</b><span>pts left</span></div>
        </div>
      </section>

      ${nextRace ? `<a class="next reveal" href="#/schedule">
        <span class="kicker">Next · Round ${nextRace.round}</span>
        <b>${nextRace.flag} ${esc(nextRace.name)}</b>
        <span class="mono countdown" data-date="${nextRace.date}" data-start="${nextRace.raceStart || ""}"></span>
      </a>` : ""}

      ${sectionHead("Drivers", "Standings")}
      <ol class="standings">${standings}</ol>

      ${sectionHead("Constructors", "Team table")}
      <ol class="teams">${teams}</ol>

      ${sectionHead("Qualifying head-to-head", "Teammate battles", `<p class="note">Median gap shown. Tap a pair to open the duel.</p>`)}
      <div class="battles">${battles}</div>
      <p class="foot">${esc(S.NOTE || "")}</p>
    `;
  }

  function viewSchedule() {
    const items = S.CALENDAR.map((r, i) => {
      const res = S.RESULTS.find((x) => x.round === r.round);
      const isNext = nextRace && r.round === nextRace.round;
      const winner = res && driver[res.race[0].id];
      const inner = `
        <span class="rnd mono">R${String(r.round).padStart(2, "0")}</span>
        <span class="rinfo"><b>${r.flag} ${esc(r.name)}</b><small>${esc(r.place)} · ${fmtDate(r.date)}</small></span>
        <span class="rres">${winner ? `${chip(winner)}<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>` : isNext ? `<span class="badge">Next</span>` : `<span class="mono dim">${r.laps} laps</span>`}</span>`;
      return res
        ? `<li class="reveal" style="--i:${Math.min(i, 12)}"><a class="race done" href="#/race/${r.round}">${inner}</a></li>`
        : `<li class="reveal" style="--i:${Math.min(i, 12)}"><div class="race ${isNext ? "is-next" : "future"}">${inner}</div></li>`;
    }).join("");
    return `
      <div class="page-title reveal"><span class="kicker">${S.RESULTS.length} of ${S.CALENDAR.length} complete</span><h1>Schedule</h1></div>
      <div class="progress reveal"><i style="transform:scaleX(${S.RESULTS.length / S.CALENDAR.length})"></i></div>
      <ol class="calendar">${items}</ol>`;
  }

  function viewRace(round) {
    const r = raceByRound[round];
    const res = S.RESULTS.find((x) => x.round === round);
    if (!r || !res) return viewMissing("That round hasn't been run yet.");
    const podium = res.race.slice(0, 3).map((x) => driver[x.id]);
    const finishers = res.race.filter((x) => !x.dnf);
    const hasPace = finishers.some((x) => typeof x.pace === "number"); // Stat Lab patch: pace data is optional
    const best = hasPace ? Math.min(...finishers.map((x) => x.pace)) : 0;
    const worst = hasPace ? Math.max(...finishers.map((x) => x.pace)) : 0;

    const rows = res.race.map((x, i) => {
      const d = driver[x.id];
      const delta = x.grid - (x.pos || x.grid);
      return `<li class="rrow reveal" style="--i:${Math.min(i, 12)};--tc:${tc(d.team)}">
        <span class="pos mono">${x.pos || "DNF"}</span>
        <span class="who">${dName(d)}<small>${esc(team[d.team].name)}</small></span>
        <span class="mono gain ${x.dnf ? "" : delta > 0 ? "up" : delta < 0 ? "down" : ""}">${x.dnf ? "—" : delta > 0 ? "▲" + delta : delta < 0 ? "▼" + -delta : "·"}</span>
        <span class="pts mono">${x.points ? "+" + x.points : ""}</span>
      </li>`;
    }).join("");

    const paceRows = !hasPace ? "" : [...finishers].sort((a, b) => a.pace - b.pace).map((x) => {
      const d = driver[x.id];
      const gap = x.pace - best;
      const w = worst > best ? gap / (worst - best) : 0;
      return `<li style="--tc:${tc(d.team)}"><span class="mono">${d.id}</span><span class="pbar"><i style="transform:scaleX(${Math.max(0.02, w)})"></i></span><span class="mono dim">${gap === 0 ? lapTime(x.pace) : "+" + gap.toFixed(3)}</span></li>`;
    }).join("");

    const pole = res.quali[0];
    return `
      <a class="back" href="#/schedule"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>Schedule</a>
      <div class="page-title reveal"><span class="kicker">Round ${r.round} · ${fmtDate(r.date, { day: "numeric", month: "long" })}</span><h1>${r.flag} ${esc(r.name)}</h1><p class="dim">${esc(r.place)} · ${r.laps} laps</p></div>
      <div class="podium reveal">
        ${[1, 0, 2].map((k) => `<div class="pod p${k + 1}" style="--tc:${tc(podium[k].team)}"><span class="mono">P${k + 1}</span><b>${esc(podium[k].last)}</b><i></i></div>`).join("")}
      </div>
      <div class="facts reveal">
        <div><span class="kicker">Pole</span><b>${esc(driver[pole.id].last)}</b><span class="mono dim">${lapTime(pole.time)}</span></div>
        ${hasPace ? `<div><span class="kicker">Best race pace</span><b>${esc(driver[res.fastestPace].last)}</b><span class="mono dim">${lapTime(best)}</span></div>`
          : `<div><span class="kicker">Winner from</span><b>P${res.race[0].grid || "–"}</b><span class="mono dim">on the grid</span></div>`}
      </div>
      ${sectionHead("Classification", "Result")}
      <ol class="result">${rows}</ol>
      ${hasPace ? `${sectionHead("Average lap", "Race pace", `<p class="note">Gap to the fastest average lap.</p>`)}
      <ol class="pace">${paceRows}</ol>` : ""}`;
  }

  function viewNews() {
    if (!NEWS.length) return `<div class="empty"><h1>No stories yet</h1><p>Add items to news.js to fill this feed.</p></div>`;
    const [lead, ...rest] = NEWS;
    return `
      <div class="page-title reveal"><span class="kicker">Paddock notes</span><h1>News</h1></div>
      <a class="lead-story reveal" href="#/news/${lead.id}">
        <span class="tag">${esc(lead.tag)}</span>
        <h2>${esc(lead.title)}</h2>
        <p>${esc(lead.dek)}</p>
        <span class="mono dim">${fmtDate(lead.date, { day: "numeric", month: "long" })}</span>
      </a>
      <ul class="stories">${rest.map((n, i) => `<li class="reveal" style="--i:${i}"><a href="#/news/${n.id}">
        <span class="mono dim">${fmtDate(n.date)} · ${esc(n.tag)}</span>
        <b>${esc(n.title)}</b>
      </a></li>`).join("")}</ul>`;
  }

  function viewArticle(id) {
    const n = NEWS.find((x) => x.id === id);
    if (!n) return viewMissing("We couldn't find that story.");
    return `
      <a class="back" href="#/news"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>News</a>
      <article class="article reveal">
        <span class="tag">${esc(n.tag)}</span>
        <h1>${esc(n.title)}</h1>
        <p class="dek">${esc(n.dek)}</p>
        <span class="mono dim">${fmtDate(n.date, { day: "numeric", month: "long", year: "numeric" })}</span>
        ${n.body.map((p) => `<p>${esc(p)}</p>`).join("")}
        ${n.url ? `<a class="btn" href="${esc(n.url)}" target="_blank" rel="noopener">Read the full story ↗</a>` : ""}
      </article>`;
  }

  /* ---------- Duel: qualifying telemetry, every turn in one view ---------- */
  const QS = ["q3", "q2", "q1"];
  const DUELS = S.DUELS || {};
  const telRounds = Object.keys(DUELS).map(Number).sort((x, y) => x - y);
  const lastName = (id) => (driver[id] ? driver[id].last : id);
  const NEUTRAL = "#5E6470";
  const SPEED_EVEN = 1; // corner speeds within 1 km/h count as level
  const turnNo = (k) => k.replace(/^T/, "");

  /* Where each named turn sits on the lap. The data gives a minimum speed per turn but no position, so we take
     the slow points of the field-average speed trace and match them to the turns in order (closest speed wins). */
  const apexCache = {};
  function turnApexes(D) {
    if (apexCache[D.round]) return apexCache[D.round];
    const n = D.track.length, F = D.drivers;
    const avg = Array.from({ length: n }, (_, i) => F.reduce((s, d) => s + d.speed[i], 0) / F.length);
    const top = Math.max(...avg);
    const mins = [];
    for (let i = 1; i < n - 1; i++) {
      const w = avg.slice(Math.max(0, i - 2), i + 3);
      if (avg[i] === Math.min(...w) && avg[i] < top * 0.8 && !(mins.length && i - mins[mins.length - 1] <= 2)) mins.push(i);
    }
    const turns = D.corners.filter((k) => /^T\d/.test(k));
    const want = turns.map((k) => {
      const v = F.map((d) => d.corners[k]).filter((x) => x != null);
      return v.reduce((s, x) => s + x, 0) / (v.length || 1);
    });
    // order-preserving alignment of turns to minima (a turn can go unmatched at a high cost)
    const T = turns.length, M = mins.length, SKIP = 1e4;
    const dp = Array.from({ length: T + 1 }, () => Array(M + 1).fill(Infinity)), how = dp.map((r) => r.map(() => 0));
    for (let j = 0; j <= M; j++) dp[0][j] = 0;
    for (let i = 1; i <= T; i++) for (let j = 0; j <= M; j++) {
      const opts = [[dp[i - 1][j] + SKIP, 1]];
      if (j) opts.push([dp[i][j - 1], 2], [dp[i - 1][j - 1] + Math.abs(avg[mins[j - 1]] - want[i - 1]), 3]);
      [dp[i][j], how[i][j]] = opts.reduce((a, b) => (b[0] < a[0] ? b : a));
    }
    const apex = {};
    for (let i = T, j = M; i > 0;) {
      if (how[i][j] === 3) { apex[turns[i - 1]] = mins[j - 1]; i--; j--; } else if (how[i][j] === 2) j--; else i--;
    }
    return (apexCache[D.round] = turns.filter((k) => apex[k] != null).map((k) => ({ key: k, apex: apex[k] })));
  }

  // who carried more minimum speed through a turn: >0 driver A, <0 driver B
  const cornerEdge = (a, b, k) => (a.corners[k] != null && b.corners[k] != null ? +(a.corners[k] - b.corners[k]).toFixed(1) : null);
  const edgeColour = (d, ca, cb) => (d == null || Math.abs(d) < SPEED_EVEN ? NEUTRAL : d > 0 ? ca : cb);

  // track map: ~160 m mini-sectors coloured by who carried more speed, with every turn numbered
  function trackMap(D, a, b, turns, ca, cb) {
    const P = D.track;
    const W = Math.max(...P.map((p) => p[0])), H = Math.max(...P.map((p) => p[1]));
    const cx = P.reduce((s, p) => s + p[0], 0) / P.length, cy = P.reduce((s, p) => s + p[1], 0) / P.length;
    const SEG = 8; // 8 points x 20 m
    let segs = "", wa = 0, wb = 0;
    for (let i = 0; i < P.length - 1; i += SEG) {
      const j = Math.min(i + SEG, P.length - 1);
      let d = 0;
      for (let k = i; k <= j; k++) d += a.speed[k] - b.speed[k];
      d /= j - i + 1;
      if (Math.abs(d) >= 1.5) d > 0 ? wa++ : wb++;
      segs += `<polyline points="${P.slice(i, j + 1).map((p) => p[0] + "," + p[1]).join(" ")}" fill="none" stroke="${Math.abs(d) < 1.5 ? NEUTRAL : d > 0 ? ca : cb}" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
    const labels = turns.map((t) => {
      const [x, y] = P[t.apex], dx = x - cx, dy = y - cy, len = Math.hypot(dx, dy) || 1, txt = turnNo(t.key);
      const bw = Math.max(48, 20 + txt.length * 15);
      const lx = Math.min(W + 76 - bw / 2, Math.max(-76 + bw / 2, x + (dx / len) * (30 + bw / 2))), ly = y + (dy / len) * 50;
      return `<line x1="${x}" y1="${y}" x2="${lx}" y2="${ly}" stroke="${NEUTRAL}" stroke-width="2"/>
        <rect x="${lx - bw / 2}" y="${ly - 24}" width="${bw}" height="48" rx="24" fill="#17191E" stroke="${edgeColour(cornerEdge(a, b, t.key), ca, cb)}" stroke-width="4"/>
        <text x="${lx}" y="${ly + 8}" text-anchor="middle">${esc(txt)}</text>`;
    }).join("");
    const s0 = P[0], s1 = P[1], ang = (Math.atan2(s1[1] - s0[1], s1[0] - s0[0]) * 180) / Math.PI + 90;
    return { wa, wb, svg: `<svg class="tmap" viewBox="-80 -80 ${W + 160} ${H + 160}" role="img" aria-label="Track map coloured by who carried more speed, with turn numbers">
      <polyline points="${P.map((p) => p[0] + "," + p[1]).join(" ")}" fill="none" stroke="#2A2D33" stroke-width="34" stroke-linejoin="round"/>
      ${segs}
      <rect x="${s0[0] - 3}" y="${s0[1] - 22}" width="6" height="44" fill="#F2F2F0" transform="rotate(${ang.toFixed(0)} ${s0[0]} ${s0[1]})"/>
      ${labels}</svg>` };
  }

  // one chart for the whole lap: both speed traces, every turn marked with its number, sectors, and who is faster where
  function lapTelemetry(D, a, b, turns, ca, cb) {
    const n = a.speed.length, W = 340, H = 290, padL = 28, padR = 8, top = 62, plotH = 160, stripY = top + plotH + 10, vMin = 50, vMax = 360;
    const x = (i) => padL + (i / (n - 1)) * (W - padL - padR);
    const y = (v) => top + plotH - ((v - vMin) / (vMax - vMin)) * plotH;
    const path = (arr) => arr.map((v, i) => (i ? "L" : "M") + x(i).toFixed(1) + "," + y(v).toFixed(1)).join("");
    const grid = [100, 200, 300].map((v) => `<line x1="${padL}" x2="${W - padR}" y1="${y(v)}" y2="${y(v)}" stroke="#2A2D33"/><text x="${padL - 4}" y="${y(v) + 3}" text-anchor="end">${v}</text>`).join("");
    const secX = (D.sectors || []).map((m) => x(m / D.step));
    const secs = secX.map((sx) => `<line x1="${sx}" x2="${sx}" y1="${top}" y2="${stripY + 10}" stroke="#3A3E46"/>`).join("");
    const bounds = [padL, ...secX, W - padR];
    const secText = secX.length === 2 ? [0, 1, 2].map((k) => `<text x="${(bounds[k] + bounds[k + 1]) / 2}" y="${stripY + 24}" text-anchor="middle" class="sec">S${k + 1}</text>`).join("") : "";
    // turn pins: each takes the first of three rows where it doesn't touch the previous pin
    const rowEnd = [-99, -99, -99];
    const marks = turns.map((t) => {
      const tx = x(t.apex), txt = turnNo(t.key), w = Math.max(16, 6 + txt.length * 6.2);
      let row = rowEnd.findIndex((end) => tx - w / 2 > end + 2);
      if (row < 0) row = rowEnd.indexOf(Math.min(...rowEnd));
      rowEnd[row] = tx + w / 2;
      const ly = 12 + row * 18, col = edgeColour(cornerEdge(a, b, t.key), ca, cb);
      return `<line x1="${tx}" x2="${tx}" y1="${ly + 8}" y2="${y(Math.min(a.speed[t.apex], b.speed[t.apex])) - 3}" stroke="${col}" stroke-width="1" stroke-dasharray="2 2"/>
        <rect x="${tx - w / 2}" y="${ly - 8}" width="${w}" height="16" rx="8" fill="#17191E" stroke="${col}" stroke-width="1.5"/>
        <text x="${tx}" y="${ly + 3.5}" text-anchor="middle" class="tn">${esc(txt)}</text>`;
    }).join("");
    const cw = (W - padL - padR) / n;
    const strip = a.speed.map((v, i) => {
      const d = v - b.speed[i];
      return `<rect x="${x(i).toFixed(1)}" y="${stripY}" width="${(cw + 0.4).toFixed(1)}" height="10" fill="${Math.abs(d) < 2 ? "#2A2D33" : d > 0 ? ca : cb}"/>`;
    }).join("");
    const km = Array.from({ length: Math.floor(D.length / 1000) + 1 }, (_, k) => `<text x="${x((k * 1000) / D.step)}" y="${H - 4}" text-anchor="middle">${k} km</text>`).join("");
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Speed over the lap for ${a.driver} and ${b.driver}, with every turn marked">
      ${grid}${secs}${secText}
      <path d="${path(b.speed)}" fill="none" stroke="${cb}" stroke-width="1.8" stroke-linejoin="round"/>
      <path d="${path(a.speed)}" fill="none" stroke="${ca}" stroke-width="1.8" stroke-linejoin="round"/>
      ${marks}${strip}${km}</svg>`;
  }

  function viewDuel(aId, bId, roundArg) {
    const done = S.RESULTS.map((r) => r.round);
    const round = done.includes(roundArg) ? roundArg : telRounds[telRounds.length - 1] || done[done.length - 1];
    const cal = raceByRound[round], info = (S.RACE_INFO || {})[round] || {};
    const pool = ((S.QUALI_DETAIL || {})[round] || []).filter((q) => q.best != null);
    if (pool.length < 2) return viewMissing("No qualifying data for that round yet.");
    const find = (id) => pool.find((q) => q.id === id);
    const qa = find(aId) || pool[0];
    const qb = find(bId) && bId !== qa.id ? find(bId) : pool.find((q) => q.id !== qa.id);
    const ca = tc(qa.team), cb = qa.team === qb.team ? "#F2F2F0" : tc(qb.team);

    const D = DUELS[round];
    const a = D && D.drivers.find((x) => x.driver === qa.id), b = D && D.drivers.find((x) => x.driver === qb.id);
    const sess = QS.find((k) => qa[k] != null && qb[k] != null) || "q1";
    const lapA = a && b ? a.lap : qa[sess], lapB = a && b ? b.lap : qb[sess];
    const gap = +(lapB - lapA).toFixed(3); // >0: A faster
    const lead = gap >= 0 ? qa : qb, leadCol = gap >= 0 ? ca : cb;

    const chips = S.RESULTS.map((r) => {
      const ri = (S.RACE_INFO || {})[r.round] || {};
      return `<a class="tchip${DUELS[r.round] ? "" : " off"}" href="#/duel/${qa.id}/${qb.id}/${r.round}" ${r.round === round ? 'aria-current="true"' : ""}>
        <span class="mono">R${r.round}</span><b>${esc(ri.short || r.round)}</b></a>`;
    }).join("");
    const opts = (sel, other) => pool.map((q) => `<option value="${q.id}" ${q.id === sel ? "selected" : ""} ${q.id === other ? "disabled" : ""}>P${q.pos} ${esc(lastName(q.id))}</option>`).join("");
    const verdict = (extra = "") => `
      <div class="verdict reveal" style="--tc:${leadCol}">
        <small>${a && b ? esc(D.session || "Qualifying").toUpperCase() + " · FASTEST LAPS" : sess.toUpperCase() + " · BEST LAPS"}</small>
        <p class="v-line"><b>${esc(lastName(lead.id))}</b> faster by</p>
        <div class="gapbig">${Math.abs(gap).toFixed(3)}s</div>
        <small class="mono"><span style="color:${ca}">${qa.id} ${lapTime(lapA)}</span> · <span style="color:${cb}">${qb.id} ${lapTime(lapB)}</span></small>
        ${extra}
      </div>`;

    const head = `
      <div class="page-title reveal"><span class="kicker">Qualifying telemetry</span><h1>Duel</h1></div>
      <div class="tchips">${chips}</div>
      <div class="ttitle"><b>${cal.flag} ${esc(cal.name)}</b><small>ROUND ${round} · ${esc(cal.place).toUpperCase()}</small></div>
      <div class="pickers reveal" data-round="${round}">
        <label style="--tc:${ca}"><span class="sr">Driver A</span><select id="pa">${opts(qa.id, qb.id)}</select></label>
        <span class="vs">VS</span>
        <label style="--tc:${cb}"><span class="sr">Driver B</span><select id="pb">${opts(qb.id, qa.id)}</select></label>
      </div>`;

    if (!(a && b)) {
      const latest = telRounds[telRounds.length - 1];
      return `${head}${verdict()}
        <div class="panel reveal" style="margin-top:10px"><span class="kicker">Telemetry</span>
          <h2 style="margin-top:6px">Not in yet for ${esc(info.location || cal.place)}</h2>
          <p class="note" style="font-size:14px;color:var(--soft)">Telemetry is live for ${telRounds.length} track${telRounds.length === 1 ? "" : "s"} so far. Brighter chips above have it.</p>
          ${latest ? `<a class="btn" href="#/duel/${qa.id}/${qb.id}/${latest}">Open ${esc(((S.RACE_INFO || {})[latest] || {}).location || "")} →</a>` : ""}</div>`;
    }

    const turns = turnApexes(D);
    const map = trackMap(D, a, b, turns, ca, cb);
    const turnKeys = D.corners.filter((k) => /^T\d/.test(k));
    const edges = turnKeys.map((k) => cornerEdge(a, b, k)).filter((d) => d != null);
    const turnsA = edges.filter((d) => d >= SPEED_EVEN).length, turnsB = edges.filter((d) => d <= -SPEED_EVEN).length;
    const quicker = `<p class="v-sum">Carried more speed through
      <b style="color:${ca}">${turnsA}</b> turn${turnsA === 1 ? "" : "s"} for ${esc(lastName(qa.id))},
      <b style="color:${cb}">${turnsB}</b> for ${esc(lastName(qb.id))}${edges.length - turnsA - turnsB ? `, ${edges.length - turnsA - turnsB} level` : ""}.</p>`;

    // corner speeds: every turn at once (official-style minimum speeds), then the straight-line numbers
    const crow = (k, label) => {
      const d = cornerEdge(a, b, k);
      const col = edgeColour(d, ca, cb);
      return `<li class="drow" style="grid-template-columns:minmax(0,1fr) 46px 46px 70px">
        <b>${label}</b><span class="mono r" style="color:${d >= SPEED_EVEN ? ca : "inherit"}">${Math.round(a.corners[k])}</span><span class="mono r" style="color:${d <= -SPEED_EVEN ? cb : "inherit"}">${Math.round(b.corners[k])}</span>
        <span class="mono r" style="font-size:12px;color:${col}">${Math.abs(d) < SPEED_EVEN ? "LEVEL" : (d > 0 ? a.driver : b.driver) + " +" + Math.abs(d).toFixed(0)}</span></li>`;
    };
    const cornerRows = D.corners.filter((k) => cornerEdge(a, b, k) != null).map((k) => crow(k, /^T\d/.test(k) ? "Turn " + turnNo(k) : esc(k))).join("");
    const trapRow = a.trap && b.trap ? `<li class="drow" style="grid-template-columns:minmax(0,1fr) 46px 46px 70px"><b>Speed trap</b><span class="mono r">${a.trap}</span><span class="mono r">${b.trap}</span>
      <span class="mono r" style="font-size:12px;color:${Math.abs(a.trap - b.trap) < SPEED_EVEN ? "var(--muted)" : a.trap > b.trap ? ca : cb}">${a.trap === b.trap ? "LEVEL" : (a.trap > b.trap ? a.driver : b.driver) + " +" + Math.abs(a.trap - b.trap)}</span></li>` : "";

    const sd = a.s.map((v, i) => +(b.s[i] - v).toFixed(3));
    const sMax = Math.max(0.05, ...sd.map(Math.abs));
    const sectors = sd.map((d, i) => {
      const w = (Math.abs(d) / sMax) * 50;
      const style = d >= 0 ? `left:50%;width:${w}%;background:${ca}` : `right:50%;width:${w}%;background:${cb}`;
      return `<div class="sector"><b class="mono">S${i + 1}</b><span class="sbar"><i style="${style}"></i></span><span class="mono r" style="color:${d === 0 ? "var(--muted)" : d > 0 ? ca : cb}">${d === 0 ? "LEVEL" : (d > 0 ? a.driver : b.driver) + " " + Math.abs(d).toFixed(3)}</span></div>`;
    }).join("");
    const legend = (x, y) => `<div class="legend"><span style="--tc:${ca}">${x}</span><span style="--tc:${cb}">${y}</span></div>`;

    return `${head}${verdict(quicker)}

      ${sectionHead("Whole lap, every turn", "Telemetry")}
      <section class="tele reveal">
        <figure class="chart">${map.svg}
          ${legend(`${a.driver} faster · ${map.wa}`, `${b.driver} faster · ${map.wb}`)}
          <p class="note">Track split into ~160 m mini-sectors, coloured by who carried more speed. Numbers are turns.</p></figure>
        <figure class="chart">
          <span class="kicker">Speed, km/h</span>
          ${lapTelemetry(D, a, b, turns, ca, cb)}
          ${legend(a.driver, b.driver)}
          <p class="note">Numbered pins mark each turn, coloured by who had the higher minimum speed. The strip under the lines shows who is faster at each point.</p></figure>
        <div class="ctable">
          <span class="kicker">Corner speeds, minimum km/h</span>
          <ul class="drows"><li class="drow head" style="grid-template-columns:minmax(0,1fr) 46px 46px 70px"><span>Turn</span><span class="r">${a.driver}</span><span class="r">${b.driver}</span><span class="r">Edge</span></li>${cornerRows}${trapRow}</ul>
        </div>
      </section>

      ${sectionHead("Official timing", "Sectors")}
      <div class="panel reveal">${sectors}</div>
      <p class="note">Telemetry is sampled about 4 times a second, so slow-corner speeds are approximate. Lap and sector times are official.</p>`;
  }

  function viewMissing(msg) {
    return `<div class="empty reveal"><span class="kicker">404</span><h1>Off track</h1><p>${esc(msg)}</p><a class="btn" href="#/">Back to Season</a></div>`;
  }

  /* ---------- router ---------- */
  const tabs = [...document.querySelectorAll(".tabs a")];
  let timer;
  function route() {
    const parts = (location.hash.replace(/^#\/?/, "") || "").split("/").filter(Boolean);
    const [p0, p1, p2, p3, p4] = parts;
    let html, tab;
    if (!p0) { html = viewSeason(); tab = "season"; }
    else if (p0 === "schedule") { html = viewSchedule(); tab = "schedule"; }
    else if (p0 === "race") { html = viewRace(Number(p1)); tab = "schedule"; }
    else if (p0 === "news") { html = p1 ? viewArticle(p1) : viewNews(); tab = "news"; }
    else if (p0 === "duel") { html = viewDuel(p1, p2, Number(p3 === "race" ? p4 : p3)); tab = "duel"; } // old #/duel/A/B/race/N links still work
    else { html = viewMissing("That page doesn't exist."); tab = ""; }

    app.innerHTML = html;
    tabs.forEach((t) => {
      const on = t.dataset.tab === tab;
      t.classList.toggle("on", on);
      if (on) t.setAttribute("aria-current", "page"); else t.removeAttribute("aria-current");
    });
    window.scrollTo(0, 0);

    const pa = document.getElementById("pa"), pb = document.getElementById("pb");
    if (pa && pb) {
      const rd = pa.closest(".pickers").dataset.round; // stay on the same round when switching drivers
      const go = () => { location.hash = `#/duel/${pa.value}/${pb.value}/${rd}`; };
      pa.addEventListener("change", go);
      pb.addEventListener("change", go);
    }

    const strip = document.querySelector(".tchips"), cur = strip && strip.querySelector('[aria-current="true"]');
    if (strip && cur) {
      const centre = () => (strip.scrollLeft = cur.offsetLeft - (strip.clientWidth - cur.offsetWidth) / 2);
      centre();
      if (document.fonts) document.fonts.ready.then(centre); // chip widths change once the web font loads
    }

    clearInterval(timer);
    const cd = document.querySelector(".countdown");
    if (cd) {
      const target = new Date(cd.dataset.start || cd.dataset.date + "T14:00:00Z"); // Stat Lab patch: real race start when known
      const tick = () => {
        const ms = target - Date.now();
        if (ms <= 0) { cd.textContent = "Race weekend"; return; }
        const d = Math.floor(ms / 864e5), h = Math.floor((ms % 864e5) / 36e5), m = Math.floor((ms % 36e5) / 6e4);
        cd.textContent = `${d}d ${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
      };
      tick();
      timer = setInterval(tick, 30000);
    }
  }
  window.addEventListener("hashchange", route);
  route();
})();

