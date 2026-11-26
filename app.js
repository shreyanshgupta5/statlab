/* ONE F1 (formerly Stat Lab) — mobile app shell: hash router + views. */
(function () {
  const APP_VERSION = "v70"; // keep in step with VERSION in sw.js
  const S = window.SEASON;
  const NEWS = window.NEWS || [];
  const PREVIEWS = window.PREVIEWS || {};
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
  const tc = (teamId) => team[teamId].color;

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
  function raceH2H(a, b) {
    let wa = 0, wb = 0;
    S.RESULTS.forEach((res) => {
      const ra = res.race.find((r) => r.id === a), rb = res.race.find((r) => r.id === b);
      if (!ra || !rb) return; // Stat Lab patch: skip rounds where either driver didn't race
      const pa = ra.pos || 99, pb = rb.pos || 99;
      if (pa < pb) wa++; else if (pb < pa) wb++;
    });
    return { a: wa, b: wb };
  }
  const DS = driverStats();
  const DSmap = Object.fromEntries(DS.map((s) => [s.id, s]));
  const TS = teamStats(DS);
  const nextRace = S.CALENDAR.find((r) => !S.RESULTS.some((x) => x.round === r.round));
  // the next race by the clock: results for a race that just finished can arrive later than the race
  const upcoming = S.CALENDAR.find((r) => new Date(r.raceStart || r.date + "T23:59:00Z") > Date.now());
  const awaiting = S.CALENDAR.filter((r) => !S.RESULTS.some((x) => x.round === r.round) && (!upcoming || r.round < upcoming.round));

  /* ---------- illustrated helmets: the same drawing as the reel covers ----------
     Team colours and a stripe identify the driver, never a real helmet design or sponsor. */
  const LOOK = {
    VER: ["#1B2A6B", "#E8102E", "#FFD400", "#F0C4A0", "#3E7CC4", "fierce"], HAD: ["#1B2A6B", "#FFD400", "#E8102E", "#E2B48E", "#4A3424", "focus"],
    HAM: ["#FFD400", "#E8002D", "#6A2C91", "#8D5A3B", "#5A3A22", "focus"], LEC: ["#E8002D", "#F2F2F0", "#1A1A1A", "#EFC29C", "#5E8A4A", "fierce"],
    RUS: ["#16181C", "#27F4D2", "#F2F2F0", "#F2CBAA", "#4B88C9", "focus"], ANT: ["#F2F2F0", "#27F4D2", "#16181C", "#E9BC93", "#6B4A2E", "happy"],
    NOR: ["#FF8000", "#16181C", "#47C7FC", "#F0C4A0", "#4B88C9", "happy"], PIA: ["#FF8000", "#1B2A6B", "#F2F2F0", "#F0C4A0", "#4B88C9", "focus"],
  };
  const SKIN = { ALB: "#D9A982", BOR: "#D8A47E", COL: "#E2B48E", PER: "#D29A72", LIN: "#C98F68", HAD: "#E2B48E", SAI: "#E2B48E", ALO: "#E2B48E", TSU: "#EBC3A0", HIR: "#EBC3A0" };
  let hid = 0;
  // a driver's cartoon portrait (portraits.js) wherever a helmet is drawn; the helmet stays as the fallback
  function helmet(id, opts = {}) {
    const P = (window.PORTRAITS || {})[id];
    if (!P || opts.colors) return helmetSVG(id, opts);
    const size = opts.size || 96, d = driver[id];
    const ring = d && team[d.team] ? team[d.team].color : "#8D939B";
    return `<span class="portrait ${opts.cls || ""}" style="width:${size}px;height:${Math.round(size * 480 / 440)}px;--pr:${ring}">
      <img src="${esc(P.src || P)}" alt="" loading="lazy" decoding="async" onerror="this.parentNode.classList.add('noimg');this.remove()">${helmetSVG(id, opts)}</span>`;
  }
  function helmetSVG(id, { size = 96, look = 0, cls = "", colors = null } = {}) {
    const d = driver[id];
    const base = d && team[d.team] ? team[d.team].color : "#8D939B";
    const [h1, h2, h3, skin, iris, mood] = colors || LOOK[id] || [base, "#F2F2F0", "#16181C", SKIN[id] || "#EFC29C", "#5A4632", "focus"];
    const K = "#0A0A0A", u = "h" + ++hid, cy = 348;
    const eye = (cx, side) => {
      const top = mood === "happy" ? 22 : 20, lid = mood === "happy" ? 4 : 14, ix = cx + look;
      const inner = cx - side * 30, outer = cx + side * 36, bIn = mood === "fierce" ? cy - 20 : mood === "focus" ? cy - 26 : cy - 36, bOut = mood === "happy" ? cy - 34 : cy - 36;
      const shape = `M${cx - 34} ${cy} Q${cx} ${cy - top} ${cx + 34} ${cy} Q${cx} ${cy + lid} ${cx - 34} ${cy} Z`;
      return `<path d="${shape}" fill="#FBF8F2"/><clipPath id="${u}e${side}"><path d="${shape}"/></clipPath>
        <g clip-path="url(#${u}e${side})"><circle cx="${ix}" cy="${cy}" r="14" fill="${iris}"/><circle cx="${ix}" cy="${cy}" r="6.5" fill="${K}"/><circle cx="${ix + 4}" cy="${cy - 5}" r="4" fill="#fff"/></g>
        <path d="M${cx - 36} ${cy + 1} Q${cx} ${cy - top - 2} ${cx + 36} ${cy + 1}" fill="none" stroke="${K}" stroke-width="5" stroke-linecap="round"/>
        <path d="M${inner} ${bIn} Q${(inner + outer) / 2} ${Math.min(bIn, bOut) - 8} ${outer} ${bOut}" fill="none" stroke="#3A2A1E" stroke-width="9" stroke-linecap="round"/>`;
    };
    const shell = "M300 130 C420 130 500 215 500 340 C500 430 480 500 440 545 C400 575 200 575 160 545 C120 500 100 430 100 340 C100 215 180 130 300 130 Z";
    return `<svg class="helmet ${cls}" viewBox="80 110 440 480" width="${size}" height="${Math.round(size * 480 / 440)}" aria-hidden="true">
      <defs><radialGradient id="${u}g" cx=".38" cy=".3" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".38"/></radialGradient>
      <linearGradient id="${u}v" x1="0" x2="1"><stop offset="0" stop-color="#1B1030"/><stop offset=".45" stop-color="#2B3F8F"/><stop offset=".75" stop-color="#9B3FB5"/><stop offset="1" stop-color="#F28B2E"/></linearGradient>
      <clipPath id="${u}c"><path d="${shell}"/></clipPath></defs>
      <path d="${shell}" fill="${h1}"/>
      <g clip-path="url(#${u}c)"><path d="M90 410 C170 330 430 330 510 410 L510 470 C430 380 170 380 90 470 Z" fill="${h2}"/><path d="M90 450 C170 380 430 380 510 450 L510 462 C430 392 170 392 90 462 Z" fill="${h3}"/>
        <path d="M276 120 C284 190 288 236 286 258 L314 258 C312 236 316 190 324 120 Z" fill="${h2}"/><path d="M200 505 H400 V528 H200 Z" fill="rgba(0,0,0,.55)"/><rect x="80" y="100" width="440" height="500" fill="url(#${u}g)"/></g>
      <path d="${shell}" fill="none" stroke="${K}" stroke-width="6"/>
      <path d="M170 296 H430 Q458 296 458 324 V362 Q458 392 428 394 C360 400 240 400 172 394 Q142 392 142 362 V324 Q142 296 170 296 Z" fill="#141518" stroke="${K}" stroke-width="6"/>
      <path d="M178 306 H422 Q446 306 446 328 V360 Q446 382 420 384 C356 389 244 389 180 384 Q154 382 154 360 V328 Q154 306 178 306 Z" fill="#E9E6E0"/>
      <path d="M196 316 H404 Q426 316 426 336 V358 Q426 374 404 376 C350 380 250 380 196 376 Q174 374 174 358 V336 Q174 316 196 316 Z" fill="${skin}"/>
      ${eye(250, -1)}${eye(350, 1)}
      <path d="M146 252 C200 226 400 226 454 252 L460 298 H140 Z" fill="url(#${u}v)" stroke="${K}" stroke-width="6" stroke-linejoin="round"/>
      <path d="M176 262 C240 246 300 244 360 248" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="7" stroke-linecap="round"/>
      <circle cx="122" cy="330" r="15" fill="#2A2C31" stroke="${K}" stroke-width="5"/><circle cx="478" cy="330" r="15" fill="#2A2C31" stroke="${K}" stroke-width="5"/></svg>`;
  }
  const sticker = (txt) => `<span class="sticker" aria-hidden="true"><svg viewBox="-125 -65 250 130"><path d="M120,0 L95,13 L111,32 L82,33 L86,58 L60,45 L44,66 L27,46 L5,63 L-8,42 L-33,58 L-40,36 L-67,46 L-66,23 L-95,28 L-87,7 L-118,0 L-90,-12 L-105,-31 L-78,-30 L-82,-56 L-56,-43 L-40,-63 L-22,-44 L0,-61 L13,-40 L38,-57 L44,-35 L70,-48 L71,-25 L98,-30 L90,-9 Z" fill="#FFD400" stroke="#0A0A08" stroke-width="6"/><text x="0" y="${txt.length > 6 ? 12 : 16}" text-anchor="middle" style="font-size:${txt.length > 6 ? 34 : 46}px">${esc(txt)}</text></svg></span>`;

  /* ---------- following (stored on this device only) ---------- */
  const FKEY = "statlab.follow.v1";
  const loadFollow = () => {
    try { const f = JSON.parse(localStorage.getItem(FKEY)); if (f && Array.isArray(f.drivers) && Array.isArray(f.teams)) return f; } catch (e) {}
    return { drivers: [], teams: [] };
  };
  let follow = loadFollow();
  let editingFollow = false; // the picker stays open until Done, so several picks can be made in a row
  const isFollowed = (kind, id) => follow[kind].includes(id);
  function toggleFollow(kind, id) {
    follow[kind] = isFollowed(kind, id) ? follow[kind].filter((x) => x !== id) : [...follow[kind], id];
    try { localStorage.setItem(FKEY, JSON.stringify(follow)); } catch (e) {}
  }
  const starBtn = (kind, id, label) => {
    const on = isFollowed(kind, id);
    return `<button class="star ${on ? "on" : ""}" type="button" data-follow="${kind}:${id}" aria-pressed="${on}">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/></svg>${on ? "Following" : "Follow"}<span class="sr"> ${esc(label)}</span></button>`;
  };

  /* ---------- per-driver season detail ---------- */
  function driverRounds(id) {
    return S.RESULTS.map((res) => {
      const qi = res.quali.findIndex((q) => q.id === id);
      const r = res.race.find((x) => x.id === id);
      if (qi < 0 && !r) return null;
      return { round: res.round, quali: qi < 0 ? null : qi + 1, grid: r ? r.grid : null, pos: r ? r.pos : null, dnf: r ? !!r.dnf || !r.pos : false, points: r ? r.points : 0, raced: !!r };
    }).filter(Boolean);
  }
  const formChip = (x, link) => {
    const cls = !x.raced ? "ns" : x.dnf ? "dnf" : x.pos <= 3 ? "pod" : x.pos <= 10 ? "pts" : "out";
    const txt = !x.raced ? "–" : x.dnf ? "DNF" : x.pos;
    return link ? `<a class="form ${cls}" href="#/race/${x.round}" title="Round ${x.round}">${txt}</a>` : `<span class="form ${cls}" title="Round ${x.round}">${txt}</span>`;
  };
  // link = false inside cards that are already links (no nested anchors)
  const formGuide = (id, n = 5, link = false) => driverRounds(id).filter((x) => x.raced).slice(-n).map((x) => formChip(x, link)).join("");
  const teammates = (d) => S.DRIVERS.filter((x) => x.team === d.team && x.id !== d.id && DSmap[x.id] && (DSmap[x.id].history.length || DSmap[x.id].points));

  /* ---------- add the next race to a calendar ---------- */
  function icsFor(r) {
    const start = new Date(r.raceStart || r.date + "T14:00:00Z");
    const end = new Date(start.getTime() + 2 * 36e5);
    const f = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//ONE F1//F1 2026//EN", "BEGIN:VEVENT",
      `UID:statlab-2026-r${r.round}@statlab`, `DTSTAMP:${f(new Date())}`, `DTSTART:${f(start)}`, `DTEND:${f(end)}`,
      `SUMMARY:${r.name} (F1 R${r.round})`, `LOCATION:${r.place}`, "DESCRIPTION:Race start. Previews, standings and duels in ONE F1.",
      "BEGIN:VALARM", "TRIGGER:-PT30M", "ACTION:DISPLAY", "DESCRIPTION:Lights out in 30 minutes", "END:VALARM",
      "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  }
  const localStart = (r) => r.raceStart ? new Date(r.raceStart).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : fmtDate(r.date);

  /* ---------- small components ---------- */
  const chip = (d) =>
    `<span class="chip" style="--tc:${tc(d.team)}">${esc(d.id)}</span>`;
  const dName = (d) => `<span class="dn"><span class="dn-f">${esc(d.first)}</span> <b>${esc(d.last)}</b></span>`;
  const sectionHead = (kicker, title, extra = "") =>
    `<div class="sh"><span class="kicker">${esc(kicker)}</span><h2>${title}</h2>${extra}</div>`;

  /* ---------- views ---------- */
  // home: the most recent completed session (race, sprint or qualifying), newest first
  // "today", "yesterday", "3 days ago", "2 weeks ago" from a session's start time
  const ago = (at) => { const d = Math.floor((Date.now() - at) / 86400000);
    return d <= 0 ? "today" : d === 1 ? "yesterday" : d < 14 ? `${d} days ago` : `${Math.floor(d / 7)} weeks ago`; };
  function latestCand() {
    const cands = [];
    S.RESULTS.forEach((r) => {
      const c = raceByRound[r.round]; const at = Date.parse(c.raceStart || c.date + "T14:00:00Z");
      cands.push({ kind: "race", round: r.round, at, res: r });
      ((S.SPRINTS || {})[r.round]) && cands.push({ kind: "sprint", round: r.round, at: at - 86400000, rows: S.SPRINTS[r.round] });
    });
    Object.keys(S.QUALI_DETAIL || {}).map(Number).filter((rd) => !S.RESULTS.some((x) => x.round === rd)).forEach((rd) => {
      const c = raceByRound[rd]; cands.push({ kind: "quali", round: rd, at: Date.parse(c.raceStart || c.date + "T14:00:00Z") - 86400000 });
    });
    return cands.sort((a, b) => b.at - a.at)[0];
  }
  function latestSession() {
    const toSec = (t) => { if (t == null || t === "") return null; if (typeof t === "number") return t; const [m, x] = String(t).split(":"); return x == null ? +m : +m * 60 + +x; };
    const L = latestCand();
    if (!L) return "";
    const c = raceByRound[L.round], info = (S.RACE_INFO || {})[L.round] || {};
    const label = { race: "Race", sprint: "Sprint", quali: "Qualifying" }[L.kind];
    const nm = (id) => esc(lastName(id));
    const row = (pos, id, right, sub, cls = "") => `<li class="ls-row ${cls}" style="--tc:${tc((driver[id] || {}).team) || "#5E6470"}">
        <span class="ls-pos num">${pos}</span><span class="ls-who"><b>${nm(id)}</b><small>${esc((team[(driver[id] || {}).team] || {}).name || "")}</small></span>
        <span class="ls-val"><b class="num">${right}</b>${sub ? `<small>${sub}</small>` : ""}</span></li>`;
    let rows = "", facts = [], href = `#/race/${L.round}`;
    if (L.kind === "race" || L.kind === "sprint") {
      const list = L.kind === "race" ? L.res.race : L.rows;
      const fin = list.filter((x) => x.pos).sort((a, b) => a.pos - b.pos);
      rows = fin.slice(0, 3).map((x, k) => row(k + 1, x.id, k === 0 ? "WIN" : x.gap != null ? "+" + x.gap.toFixed(3) + "s" : "", "", k === 0 ? "win" : "")).join("");
      if (L.kind === "race") {
        const pole = L.res.quali[0]; if (pole) facts.push(["Pole", nm(pole.id)]);
        const gain = fin.filter((x) => x.grid).map((x) => ({ x, g: x.grid - x.pos })).sort((a, b) => b.g - a.g)[0];
        if (gain && gain.g > 0) facts.push(["Biggest climb", `${nm(gain.x.id)} <b class="num">+${gain.g}</b>`]);
        const fl = list.filter((x) => x.best).sort((a, b) => toSec(a.best) - toSec(b.best))[0];
        if (fl) facts.push(["Fastest lap", `${nm(fl.id)} <b class="num">${esc(fl.best)}</b>`]);
        const out = list.filter((x) => !x.pos).map((x) => `${nm(x.id)}${x.status === "DNS" ? " (DNS)" : ""}`);
        if (out.length) facts.push(["Out", out.join(", ")]);
      }
    } else {
      const qd = S.QUALI_DETAIL[L.round].filter((x) => x.best != null).sort((a, b) => (a.pos ?? 99) - (b.pos ?? 99));
      const lap = (x) => x.q3 ?? x.q2 ?? x.q1;
      rows = qd.slice(0, 3).map((x, k) => row(k + 1, x.id, k === 0 ? lapTime(lap(x)) : "+" + (lap(x) - lap(qd[0])).toFixed(3), k === 0 ? "pole lap" : "", k === 0 ? "win" : "")).join("");
      const g = (S.GRID || {})[L.round];
      if (g && g[0] && g[0] !== qd[0].id) facts.push(["Starts on pole", `${nm(g[0])} (${nm(qd[0].id)} has a grid penalty)`]);
      const out1 = qd.filter((x) => x.q2 == null).map((x) => nm(x.id));
      if (out1.length) facts.push(["Out in Q1", out1.join(", ")]);
    }
    const ld = DS[0], gap2 = DS[1] ? ld.points - DS[1].points : 0;
    return `<a class="latest reveal" href="${href}">
        <span class="ls-head"><span class="ls-latest">Latest session · ${ago(L.at)}</span>
          <span class="kicker"><b class="pill">${label}</b> · Round ${L.round} · ${fmtDate(L.kind === "race" ? c.date : new Date(L.at).toISOString().slice(0, 10), { weekday: "short", day: "numeric", month: "short" })}</span>
          <h1>${c.flag} ${esc(info.location || c.place)}</h1><span class="ls-go" aria-hidden="true">→</span></span>
        <ol class="ls-rows">${rows}</ol>
      </a>`;
  }

  /* ---------- stories: the circle row on the home page, Instagram-style ---------- */
  const SKEY = "onef1.stories.seen.v1";
  let seenStories = {}; try { seenStories = JSON.parse(localStorage.getItem(SKEY)) || {}; } catch (e) {}
  const markSeen = (id) => { seenStories[id] = Date.now(); try { localStorage.setItem(SKEY, JSON.stringify(seenStories)); } catch (e) {} };
  function buildStories() {
    const out = [], nm = (id) => lastName(id);
    // 1. the session that just finished: always first
    const L = latestCand();
    if (L) {
      const c = raceByRound[L.round], info = (S.RACE_INFO || {})[L.round] || {}, place = info.location || c.place;
      const kind = { race: "Race", sprint: "Sprint", quali: "Qualifying" }[L.kind];
      const slides = [];
      if (L.kind === "quali") {
        const q = S.QUALI_DETAIL[L.round].filter((x) => x.best != null).sort((a, b) => (a.pos ?? 99) - (b.pos ?? 99));
        const lap = (x) => x.q3 ?? x.q2 ?? x.q1;
        slides.push({ kicker: `Qualifying · Round ${L.round} · ${place}`, title: `${nm(q[0].id)} on pole`, helmet: q[0].id, stat: lapTime(lap(q[0])), statLabel: "pole lap" });
        slides.push({ kicker: "Front of the grid", rows: q.slice(0, 3).map((x, k) => [k + 1, x.id, k ? "+" + (lap(x) - lap(q[0])).toFixed(3) + "s" : lapTime(lap(x))]), link: `#/race/${L.round}`, linkText: "See the grid" });
      } else {
        const list = (L.kind === "race" ? L.res.race : L.rows).filter((x) => x.pos).sort((a, b) => a.pos - b.pos);
        const w = list[0];
        slides.push({ kicker: `${kind} · Round ${L.round} · ${place}`, title: `${nm(w.id)} wins`, helmet: w.id, stat: list[1] && list[1].gap != null ? list[1].gap.toFixed(3) + "s" : "", statLabel: list[1] && list[1].gap != null ? `winning margin over ${nm(list[1].id)}` : "" });
        slides.push({ kicker: "The podium", rows: list.slice(0, 3).map((x, k) => [k + 1, x.id, k ? (x.gap != null ? "+" + x.gap.toFixed(3) + "s" : "") : "WIN"]) });
        if (L.kind === "race") {
          const gain = list.filter((x) => x.grid).map((x) => [x.grid - x.pos, x]).sort((a, b) => b[0] - a[0])[0];
          if (gain && gain[0] > 2) slides.push({ kicker: "Climber of the day", title: `${nm(gain[1].id)}: P${gain[1].grid} to P${gain[1].pos}`, helmet: gain[1].id, stat: "+" + gain[0], statLabel: "places gained from the grid", link: `#/race/${L.round}`, linkText: "Open race analysis" });
          else slides[slides.length - 1].link = `#/race/${L.round}`;
        }
      }
      const top = slides[0].helmet, placeShort = (c.name || place).replace(/ Grand Prix$/, "");
      out.push({ id: `session-${L.kind}-${L.round}`, at: L.at, label: L.kind === "quali" ? `${nm(top)} on pole in ${placeShort}` : `${nm(top)} wins ${placeShort}`, cover: { helmet: top, hook: L.kind === "quali" ? "POLE" : "WIN" }, color: "#E10600", slides });
    }
    // 2. hand-written burning stories
    (window.STORIES || []).forEach((st) => out.push({ ...st, at: Date.parse(st.date + "T12:00:00Z") }));
    // 3. the title fight
    const ld = DS[0], p2 = DS[1];
    if (ld && p2) out.push({ id: `standings-${S.RESULTS.length}`, at: L ? L.at : Date.now(), label: `${nm(ld.id)} leads by ${ld.points - p2.points}`, cover: { helmet: ld.id, hook: "+" + (ld.points - p2.points) }, color: "#F5B700",
      slides: [{ kicker: `Championship · after ${S.RESULTS.length} rounds`, title: `${nm(ld.id)} leads by ${ld.points - p2.points}`, helmet: ld.id, stat: String(ld.points), statLabel: "points" },
               { kicker: "Top three", rows: DS.slice(0, 3).map((x, k) => [k + 1, x.id, x.points + " pts"]), text: `${S.CALENDAR.length - S.RESULTS.length} race${S.CALENDAR.length - S.RESULTS.length === 1 ? "" : "s"} left.`, link: "#/", linkText: "Full standings" }] });
    // 4. the next race weekend
    if (upcoming) {
      const fp = (upcoming.sessions || [])[0];
      const msLeft = Date.parse(upcoming.raceStart || upcoming.date) - Date.now(), dleft = Math.floor(msLeft / 864e5), nShort = upcoming.name.replace(/ Grand Prix$/, "");
      out.push({ id: `next-${upcoming.round}`, at: Date.now() - 3600000, label: dleft >= 1 ? `${nShort} in ${dleft} day${dleft === 1 ? "" : "s"}` : msLeft > 0 ? `${nShort}: race day` : `${nShort} is on`, cover: { text: upcoming.flag, hook: dleft >= 1 ? dleft + "D" : msLeft > 0 ? "TODAY" : "LIVE" }, color: "#3B6FD8",
        slides: [{ kicker: `Next · Round ${upcoming.round}`, title: upcoming.name, text: `${fp ? `${fp.name.replace("Practice ", "FP")} starts ${new Date(fp.start).toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" })}. ` : ""}Lights out ${localStart(upcoming)} your time.`, countdown: upcoming.raceStart || "", link: `#/race/${upcoming.round}`, linkText: "Weekend preview" }] });
    }
    // 5. the latest news, one story each
    // v69: a news story wears the face of the first driver its headline names (else the first team's colour)
    const newsWho = (n) => { const t = " " + n.title + " "; let best = null;
      Object.values(driver).forEach((d) => { const i = t.search(new RegExp(`[^A-Za-z]${d.last}[^A-Za-z]`)); if (i >= 0 && (!best || i < best[0])) best = [i, d.id]; });
      return best && best[1]; };
    const newsTeam = (n) => { const tm = Object.values(team).map((x) => [n.title.indexOf(x.name.split(" ")[0]), x]).filter((x) => x[0] >= 0).sort((a, b) => a[0] - b[0])[0]; return tm && tm[1]; };
    const raceIn = (n) => S.CALENDAR.find((c) => n.title.includes(c.name.replace(/ Grand Prix$/, "")));
    (NEWS || []).slice(0, 6).forEach((n) => { const who = newsWho(n), tm = !who && newsTeam(n);
      out.push({ id: `news-${n.id}`, at: Date.parse(n.date + "T12:00:00Z"), label: n.short || n.title,
        cover: n.image ? { img: n.image } : who ? { helmet: who } : tm ? { text: tm.id, bg: tm.color } : raceIn(n) ? { text: raceIn(n).flag, hook: "NEWS" } : { text: n.tag.slice(0, 2).toUpperCase() }, color: who ? tc(driver[who].team) : tm ? tm.color : "#B9BDC4",
        slides: [{ kicker: `${n.tag} · ${fmtDate(n.date)}`, title: n.title, helmet: n.image ? null : who, small: true, text: n.dek, img: n.image, link: `#/news/${n.id}`, linkText: "Read the story" }] }); });
    // unseen first (keeping order), seen after
    return [...out.filter((x) => !seenStories[x.id]), ...out.filter((x) => seenStories[x.id])];
  }
  let STORY_LIST = [];
  // v67: covers drawn from data. {chart:"gap", race, text} = the lap-by-lap P1–P2 gap behind the hook;
  // {helmet, hook} = driver on a team-colour background with a short number on top.
  function gapChart(race, o = {}) {
    const g = ((S.RACE_DETAIL || {})[race] || {}).gap12 || [];
    if (!g.length) return "";
    const W = o.w || 100, H = o.h || 40, top = o.max || 1.5, bw = W / g.length;
    const bars = g.map((v, i) => { const h = Math.max(1, Math.min(v, top) / top * H), hot = v < 1;
      return `<rect x="${(i * bw + bw * .15).toFixed(2)}" y="${(H - h).toFixed(2)}" width="${(bw * .7).toFixed(2)}" height="${h.toFixed(2)}" class="${hot ? "hot" : ""}${o.mark === i + 1 ? " mk" : ""}"/>`; }).join("");
    const one = (H - H / top).toFixed(2), mx = o.mark ? ((o.mark - .5) * bw).toFixed(2) : 0;
    const mk = o.mark ? `<line class="mkl" x1="${mx}" x2="${mx}" y1="0" y2="${H}"/>` : "";
    return `<svg class="gapc" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">${mk}${bars}${o.line ? `<line x1="0" x2="${W}" y1="${one}" y2="${one}"/>` : ""}</svg>`;
  }
  const storyCover = (st, size) => {
    const c = st.cover;
    if (c.chart === "gap") return `<span class="sc-art">${gapChart(c.race, { w: 60, h: 60, max: 1.2 })}</span><span class="sc-t">${esc(c.text || "")}</span>`;
    if (c.helmet) return `<span class="sc-team" style="--tm:${tc((driver[c.helmet] || {}).team) || "#5E6470"}"></span>${helmet(c.helmet, { size, look: 2 })}${c.hook ? `<span class="sc-hook num${c.hook.length > 4 ? " sm" : ""}">${esc(c.hook)}</span>` : ""}`;
    return (c.bg ? `<span class="sc-team" style="--tm:${esc(c.bg)}"></span>` : "") + (c.img ? `<img src="${esc(c.img)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<span class="sc-t">${esc(c.text)}</span>`) + (c.hook ? `<span class="sc-hook num${c.hook.length > 4 ? " sm" : ""}">${esc(c.hook)}</span>` : "");
  };
  function storiesRow() {
    STORY_LIST = buildStories();
    if (!STORY_LIST.length) return "";
    return `<div class="story-row" role="list" aria-label="Stories">${STORY_LIST.map((st, i) => {
      const seen = !!seenStories[st.id], fresh = !seen && Date.now() - st.at < 36 * 3600000;
      return `<button class="story-c ${seen ? "seen" : ""}" type="button" role="listitem" data-story="${i}" style="--sc:${st.color}" aria-label="${esc(st.label)} story${seen ? "" : ", new"}">
        <span class="ring"><span class="disc">${storyCover(st, 64)}</span></span>${fresh ? `<span class="new">NEW</span>` : ""}<span class="lbl">${esc(st.label)}</span></button>`; }).join("")}</div>`;
  }
  const SLIDE_MS = 5500;
  let SV = null;   // the open viewer: {si, k, t0, paused, pauseAt, raf}
  function openStory(si) {
    closeStory(true);
    const v = document.createElement("div"); v.id = "storyv"; v.setAttribute("role", "dialog"); v.setAttribute("aria-label", "Story");
    document.body.appendChild(v); document.documentElement.classList.add("story-open");
    SV = { si, k: 0, t0: performance.now(), paused: false, el: v };
    drawStory(); tickStory();
    let down = null, held = false, holdT = null;
    v.addEventListener("pointerdown", (e) => { if (e.target.closest("a,button")) return; down = { x: e.clientX, y: e.clientY }; held = false; holdT = setTimeout(() => { held = true; pauseStory(true); }, 220); });
    v.addEventListener("pointerup", (e) => {
      clearTimeout(holdT); if (!down) return;
      const dy = e.clientY - down.y, dx = e.clientX - down.x; down = null;
      if (held) { pauseStory(false); return; }
      if (dy > 80 && Math.abs(dy) > Math.abs(dx)) { closeStory(); return; }
      if (Math.abs(dx) > 60) { dx < 0 ? stepStory(99) : stepStory(-99); return; }
      e.clientX < innerWidth * 0.3 ? stepStory(-1) : stepStory(1);
    });
    v.addEventListener("click", (e) => { if (e.target.closest("[data-sclose]")) closeStory(); else if (e.target.closest("a")) closeStory(true); });
  }
  function drawStory() {
    const st = STORY_LIST[SV.si], sl = st.slides[SV.k]; markSeen(st.id);
    const row = (r) => `<li style="--tc:${tc((driver[r[1]] || {}).team) || "#5E6470"}"><span class="num">${r[0]}</span>${helmet(r[1], { size: 44, look: 2 })}<b>${esc(lastName(r[1]))}</b><em class="num">${esc(r[2])}</em></li>`;
    SV.el.style.setProperty("--sc", st.color);
    SV.el.innerHTML = `<div class="sv-bars">${st.slides.map((_, j) => `<i class="${j < SV.k ? "done" : ""}"><b></b></i>`).join("")}</div>
      <div class="sv-head"><span class="sv-cov">${storyCover(st, 34)}</span><b>${esc(st.label)}</b><span class="mono dim">${ago(st.at)}</span>
        <button type="button" class="sv-x" data-sclose aria-label="Close"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
      ${sl.img ? `<div class="sv-img" style="background-image:url('${esc(sl.img)}')"></div>` : ""}
      <div class="sv-slide${sl.img ? " has-img" : ""}" key="${SV.si}-${SV.k}">
        <span class="kicker">${esc(sl.kicker || "")}</span>
        ${sl.helmet ? `<div class="sv-helm">${helmet(sl.helmet, { size: sl.small ? 96 : 150, look: 3 })}</div>` : ""}
        ${sl.title ? `<h2${sl.title.length > 48 ? ' class="long"' : ""}>${esc(sl.title)}</h2>` : ""}
        ${sl.stat ? `<div class="sv-stat num">${esc(sl.stat)}</div>${sl.statLabel ? `<p class="sv-sl">${esc(sl.statLabel)}</p>` : ""}` : ""}
        ${sl.countdown ? `<div class="sv-stat num countdown" data-start="${esc(sl.countdown)}"></div>` : ""}
        ${sl.chart && sl.chart.type === "gap" ? `<figure class="sv-chart">${gapChart(sl.chart.race, { w: 300, h: 120, max: 1.5, line: true, mark: sl.chart.mark })}<figcaption class="mono"><span>Lap 1</span><span>${esc(sl.chart.caption || "P1–P2 gap · dashes = 1s · grey = over 1s")}</span><span>Lap ${((S.RACE_DETAIL || {})[sl.chart.race] || {}).laps || ""}</span></figcaption></figure>` : ""}
        ${sl.rows ? `<ol class="sv-rows">${sl.rows.map(row).join("")}</ol>` : ""}
        ${sl.text ? `<p class="sv-text">${esc(sl.text)}</p>` : ""}
        ${sl.link ? `<a class="sv-link" href="${esc(sl.link)}">${esc(sl.linkText || "Open")} →</a>` : ""}
      </div>`;
    SV.t0 = performance.now(); SV.pauseAt = null;
    const cd = SV.el.querySelector(".sv-stat.countdown");
    if (cd) { const ms = new Date(cd.dataset.start) - Date.now(); cd.textContent = ms <= 0 ? "Race weekend" : `${Math.floor(ms / 864e5)}d ${String(Math.floor((ms % 864e5) / 36e5)).padStart(2, "0")}h ${String(Math.floor((ms % 36e5) / 6e4)).padStart(2, "0")}m`; }
  }
  function tickStory() {
    if (!SV) return;
    const bar = SV.el.querySelectorAll(".sv-bars i")[SV.k];
    const p = SV.paused ? (SV.pauseAt - SV.t0) / SLIDE_MS : (performance.now() - SV.t0) / SLIDE_MS;
    if (bar) bar.firstChild.style.transform = `scaleX(${Math.min(1, p)})`;
    if (!SV.paused && p >= 1) stepStory(1);
    if (SV) SV.raf = requestAnimationFrame(tickStory);
  }
  function pauseStory(on) {
    if (!SV) return;
    if (on && !SV.paused) { SV.paused = true; SV.pauseAt = performance.now(); SV.el.classList.add("held"); }
    else if (!on && SV.paused) { SV.t0 += performance.now() - SV.pauseAt; SV.paused = false; SV.el.classList.remove("held"); }
  }
  function stepStory(d) {
    if (!SV) return;
    const st = STORY_LIST[SV.si];
    if (d === 99 || (d === 1 && SV.k + 1 >= st.slides.length)) { if (SV.si + 1 < STORY_LIST.length) { SV.si++; SV.k = 0; drawStory(); } else closeStory(); return; }
    if (d === -99 || (d === -1 && SV.k === 0)) { if (SV.si > 0) { SV.si--; SV.k = 0; drawStory(); } else { SV.t0 = performance.now(); } return; }
    SV.k += d; drawStory();
  }
  function closeStory(silent) {
    if (!SV) return;
    cancelAnimationFrame(SV.raf); const el = SV.el; SV = null;
    document.documentElement.classList.remove("story-open");
    el.classList.add("gone"); setTimeout(() => el.remove(), 250);
    if (!silent && (location.hash === "" || location.hash === "#/")) { const y = scrollY; route(); scrollTo(0, y); }
  }
  addEventListener("keydown", (e) => { if (!SV) return; if (e.key === "Escape") closeStory(); else if (e.key === "ArrowRight") stepStory(1); else if (e.key === "ArrowLeft") stepStory(-1); });
  addEventListener("hashchange", () => closeStory(true));

  function viewSeason() {
    const leader = DS[0], second = DS[1];
    const ld = driver[leader.id];
    const remaining = S.CALENDAR.length - S.RESULTS.length;
    const maxPts = leader.points || 1;

    const standings = DS.map((s, i) => {
      const d = driver[s.id];
      return `<li class="reveal" style="--i:${Math.min(i, 12)};--tc:${tc(d.team)}"><a class="row ${isFollowed("drivers", d.id) ? "fav" : ""}" href="#/driver/${d.id}">
        <span class="pos mono">${String(s.rank).padStart(2, "0")}</span>
        <span class="who">${dName(d)}<small>${esc(team[d.team].name)}</small></span>
        <span class="pts num">${s.points}${i ? `<small>−${leader.points - s.points}</small>` : `<small>leader</small>`}</span>
      </a></li>`;
    }).join("");

    const teamMax = TS[0].points || 1;
    const teams = TS.map((t, i) => `<li class="reveal" style="--i:${i};--tc:${t.color}"><a class="trow ${isFollowed("teams", t.id) ? "fav" : ""}" href="#/team/${t.id}">
        <span class="pos mono">${i + 1}</span>
        <span class="tname">${esc(t.name)}</span>
        <span class="tbar"><i style="transform:scaleX(${t.points / teamMax})"></i></span>
        <span class="pts num">${t.points}</span>
      </a></li>`).join("");

    // Following: your drivers and teams first, like a "My teams" feed
    const lastRound = S.RESULTS.length ? S.RESULTS[S.RESULTS.length - 1].round : null;
    const favCards = [
      ...follow.drivers.filter((id) => driver[id] && DSmap[id]).map((id) => {
        const d = driver[id], s = DSmap[id], ahead = DS[s.rank - 2];
        const last = driverRounds(id).filter((x) => x.raced).slice(-1)[0];
        return `<a class="fav-card has-helmet" href="#/driver/${id}" style="--tc:${tc(d.team)}">${helmet(id, { size: 56, look: 3 })}
          <span class="mono dim">P${s.rank} · ${s.points} PTS</span><b>${esc(d.last)}</b>
          <span class="note">${last ? `R${last.round} ${((S.RACE_INFO || {})[last.round] || {}).short || ""}: ${last.dnf ? "DNF" : "P" + last.pos}${last.points ? " · +" + last.points : ""}` : "No race yet"}${ahead ? ` · ${ahead.points - s.points} to P${s.rank - 1}` : " · leads"}</span>
          <span class="form-lbl">Last 5 races <i>oldest → latest</i></span><span class="forms">${formGuide(id)}</span></a>`;
      }),
      ...follow.teams.filter((id) => team[id]).map((id) => {
        const t = TS.find((x) => x.id === id), rank = TS.indexOf(t) + 1;
        return `<a class="fav-card" href="#/team/${id}" style="--tc:${t.color}">
          <span class="mono dim">P${rank} · ${t.points} PTS</span><b>${esc(t.name)}</b>
          <span class="note">${S.DRIVERS.filter((x) => x.team === id && DSmap[x.id] && DSmap[x.id].history.length).slice(0, 2).map((x) => esc(x.last)).join(" · ")}</span></a>`;
      }),
    ].join("");
    // picker: every driver on the grid and every team; tap toggles, selections stay until tapped again
    const pickBtn = (kind, id, label, color) => {
      const on = isFollowed(kind, id);
      return `<button class="pick ${on ? "on" : ""}" type="button" data-follow="${kind}:${id}" aria-pressed="${on}" style="--tc:${color}">${on ? "★ " : ""}${esc(label)}</button>`;
    };
    const driverPicks = DS.filter((s) => s.points > 0 || s.history.length).map((s) => pickBtn("drivers", s.id, driver[s.id].last, tc(driver[s.id].team))).join("");
    const teamPicks = TS.map((t) => pickBtn("teams", t.id, t.name, t.color)).join("");
    const nFollow = follow.drivers.length + follow.teams.length;
    const showPicker = editingFollow || !nFollow;
    const picker = `<section class="onboard reveal">
        ${nFollow ? "" : `<span class="kicker">Make it yours</span><h2>Who do you follow?</h2>`}
        <p class="note">${nFollow ? "Tap to follow or unfollow. Your picks stay saved on this device." : "Pick as many drivers and teams as you like. Tap again to unfollow."}</p>
        <span class="kicker sub">Drivers</span><div class="picks">${driverPicks}</div>
        <span class="kicker sub">Teams</span><div class="picks">${teamPicks}</div>
        ${nFollow ? `<button class="follow-done" type="button" data-edit-follow="close">Done</button>` : ""}
      </section>`;
    const editBtn = nFollow ? `<button class="edit" type="button" data-edit-follow="${showPicker ? "close" : "open"}">${showPicker ? "Done" : "Edit"}</button>` : "";
    const following = `${nFollow ? `<div class="sh sh-row"><div><span class="kicker">Your grid</span><h2>Following</h2></div>${editBtn}</div>` : ""}
      ${showPicker ? picker : ""}
      ${favCards ? `<div class="favs reveal">${favCards}</div>` : ""}`;

    const battles = S.TEAMS.map((t) => {
      const [a, b] = S.DRIVERS.filter((d) => d.team === t.id);
      const q = qualiH2H(a.id, b.id);
      const tot = q.a + q.b || 1;
      return `<a class="battle reveal" href="#/duel/${a.id}/${b.id}" style="--tc:${t.color}">
        <div class="b-top"><span>${esc(t.name)}</span><span class="mono dim">Δ ${Math.abs(q.median).toFixed(3)}s</span></div>
        <div class="b-names"><b class="${q.a >= q.b ? "lead" : ""}">${esc(a.last)}</b><span class="score num"><i class="${q.a >= q.b ? "lead" : ""}">${q.a}</i><em>–</em><i class="${q.b > q.a ? "lead" : ""}">${q.b}</i></span><b class="${q.b > q.a ? "lead" : ""}">${esc(b.last)}</b></div>
        <div class="split"><i style="flex:${q.a / tot}"></i><i style="flex:${q.b / tot}"></i></div>
      </a>`;
    }).join("");

    return `<div class="season">
      ${storiesRow()}
      ${latestSession()}

      ${upcoming ? `<div class="next t-wet reveal">
        <a href="#/race/${upcoming.round}"><span class="kicker">Next · Round ${upcoming.round} · tap for preview</span>
        <b>${upcoming.flag} ${esc(upcoming.name)}</b>
        <span class="mono countdown" data-date="${upcoming.date}" data-start="${upcoming.raceStart || ""}"></span>
        <span class="mono dim">Lights out ${esc(localStart(upcoming))} your time</span>
        ${(S.GRID || {})[upcoming.round] ? `<span class="note">Pole: ${esc(lastName(S.GRID[upcoming.round][0]))} · starting grid is in</span>` : ""}
        ${awaiting.length ? `<span class="note">Results for ${awaiting.map((r) => esc(((S.RACE_INFO || {})[r.round] || {}).short || r.name)).join(", ")} are on the way.</span>` : ""}</a>
        <button class="cal" type="button" data-ics="${upcoming.round}"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M12 13v5M9.5 15.5h5"/></svg>Add to calendar</button>
      </div>` : ""}

      ${following}

      ${sectionHead("Drivers", "Standings")}
      <ol class="standings">${standings}</ol>

      ${sectionHead("Constructors", "Team table")}
      <ol class="teams">${teams}</ol>

      ${sectionHead("Qualifying head-to-head", "Teammate battles", `<p class="note">Median gap shown. Tap a pair to open the duel.</p>`)}
      <div class="battles">${battles}</div>
      <p class="foot">${esc(S.NOTE || "")}<br><span class="ver">App ${APP_VERSION} · data after R${S.RESULTS.length ? S.RESULTS[S.RESULTS.length - 1].round : 0}</span><br><a class="w-link" href="#/welcome/install">Add ONE F1 to your phone →</a></p>
    </div>`;
  }

  /* ---------- race page insights (racedetail.js, tools/build_race_detail.py) ---------- */
  const TYRE = { S: ["Soft", "#E8002D"], M: ["Medium", "#FFD12E"], H: ["Hard", "#F2F2F0"], I: ["Inter", "#43B02A"], W: ["Wet", "#0067AD"], U: ["?", "#5E6470"] };
  function raceInsights(round, res) {
    const D = (S.RACE_DETAIL || {})[round];
    const nm = (id) => esc(lastName(id));
    const col = (id) => tc((driver[id] || {}).team) || "#5E6470";
    const fin = res.race.filter((x) => x.pos).sort((a, b) => a.pos - b.pos);
    const moves = fin.filter((x) => x.grid).map((x) => ({ x, g: x.grid - x.pos }));
    const up = [...moves].sort((a, b) => b.g - a.g).filter((m) => m.g > 0).slice(0, 3);
    const down = [...moves].sort((a, b) => a.g - b.g).filter((m) => m.g < 0).slice(0, 3);
    const out = res.race.filter((x) => !x.pos);
    const ev = D ? D.events : [];
    const evFor = (id, type) => ev.find((e) => e.id === id && (!type || e.type === type));
    const W1 = fin[0], W2 = fin[1];

    // 5. winners and losers
    const wl = (arr, cls) => arr.map((m) => `<li style="--tc:${col(m.x.id)}"><b>${nm(m.x.id)}</b><span class="mono dim">P${m.x.grid} → P${m.x.pos}</span><span class="num ${cls}">${m.g > 0 ? "+" : "−"}${Math.abs(m.g)}</span></li>`).join("");
    const winlose = `${sectionHead("Grid to flag", "Winners and losers")}<div class="wl reveal">
        <div><span class="kicker">Gained most</span><ul>${wl(up, "up") || `<li class="dim">–</li>`}</ul></div>
        <div><span class="kicker">Lost most</span><ul>${wl(down, "down") || `<li class="dim">–</li>`}</ul></div></div>
      ${out.length ? `<p class="note">Did not finish: ${out.map((x) => `${nm(x.id)}${x.status === "DNS" ? " (did not start)" : ""}`).join(", ")}.</p>` : ""}`;
    if (!D) return { pre: "", post: winlose };

    const N = D.laps, W = 340, L = 30, R = 44;
    const xs = (lap) => L + ((lap) / N) * (W - L - R);
    const scBands = (top, h) => ev.filter((e) => e.type === "sc" || e.type === "vsc").map((e) => `<rect x="${xs(e.lap - 1).toFixed(1)}" y="${top}" width="${(xs(e.to || e.lap) - xs(e.lap - 1)).toFixed(1)}" height="${h}" class="scband"/>`).join("");
    const lapTicks = (y) => [0, ...[10, 20, 30, 40, 50, 60, 70].filter((k) => k < N), N].map((k) => `<text x="${xs(k).toFixed(1)}" y="${y}" text-anchor="middle">${k === 0 ? "Grid" : "L" + k}</text>`).join("");

    // 2. key moments
    const icon = { sc: "SC", vsc: "VSC", red: "RED", pen: "PEN", out: "OUT", drop: "▼" };
    const evText = (e) => e.type === "drop" && e.lap === N && evFor(e.id, "pen") ? `${e.text} after time penalty` : e.text;
    const tl = `<svg viewBox="0 0 ${W} 46" class="tl" role="img" aria-label="Key moments by lap">
        <line x1="${xs(0)}" x2="${xs(N)}" y1="18" y2="18" class="axis"/>${scBands(10, 16)}
        ${ev.filter((e) => e.type !== "sc" && e.type !== "vsc").map((e) => `<circle cx="${xs(e.lap).toFixed(1)}" cy="18" r="4.5" class="ev ${e.type}"/>`).join("")}
        ${lapTicks(42)}</svg>`;
    const moments = `${sectionHead("Lap by lap", "Key moments")}<div class="panel reveal">${tl}
        <ul class="moments">${ev.map((e) => `<li><span class="num lap">L${e.lap}</span><span class="tag ${e.type}">${icon[e.type]}</span><span>${e.id ? `<b>${nm(e.id)}</b> ` : ""}${esc(evText(e))}</span></li>`).join("")}</ul></div>`;

    // 3. position chart: top 6, the biggest climber and faller in colour; everyone else grey
    const H = 230, T = 8, B = 24, maxP = Object.keys(D.pos).length;
    const ys = (p) => T + ((p - 1) / (maxP - 1)) * (H - T - B);
    const focus = [...new Set([...fin.slice(0, 6).map((x) => x.id), up[0] && up[0].x.id, down[0] && down[0].x.id].filter(Boolean))];
    const path = (id) => { let d = "", pen = false; D.pos[id].forEach((p, k) => { if (p == null) { pen = false; return; } d += `${pen ? "L" : "M"}${xs(k).toFixed(1)},${ys(p).toFixed(1)}`; pen = true; }); return d; };
    const others = Object.keys(D.pos).filter((id) => !focus.includes(id)).map((id) => `<path d="${path(id)}" class="ghost"/>`).join("");
    const used = [];
    const lbl = focus.map((id) => { const arr = D.pos[id]; let p = arr[arr.length - 1]; if (p == null) return "";
      let yy = ys(p) + 3; while (used.some((u) => Math.abs(u - yy) < 9)) yy += 9; used.push(yy);
      return `<text x="${W - R + 4}" y="${yy.toFixed(1)}" style="fill:${col(id)}" class="end">${id}</text>`; }).join("");
    const lines2 = focus.map((id) => `<path d="${path(id)}" style="stroke:${col(id)}" class="focus"/>`).join("");
    const yt = [1, 5, 10, 15, 20].filter((p) => p <= maxP).map((p) => `<text x="${L - 6}" y="${(ys(p) + 3).toFixed(1)}" text-anchor="end">P${p}</text><line x1="${L}" x2="${W - R}" y1="${ys(p).toFixed(1)}" y2="${ys(p).toFixed(1)}" class="gl"/>`).join("");
    const chart = `${sectionHead("Who was where", "Positions")}<figure class="chart poschart reveal"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Position of each driver lap by lap">
        ${scBands(T, H - T - B)}${yt}${others}${lines2}${lbl}${lapTicks(H - 6)}</svg>
        <p class="note">Top six, the biggest climber and the biggest faller in colour${ev.some((e) => e.type === "sc") ? "; shaded = safety car" : ""}.</p></figure>`;

    // 4. strategy
    const order = [...fin, ...out.filter((x) => x.status !== "DNS")];
    const used3 = new Set();
    const strat = order.map((x) => { const st = D.stints[x.id] || [];
      const segs = st.map(([c, a, b]) => { used3.add(c); const t = TYRE[c] || TYRE.U, a0 = (a || 1) - 1, b0 = b || a0 + 1;
        return `<i style="left:${(a0 / N) * 100}%;width:${((b0 - a0) / N) * 100}%;background:${t[1]}" title="${t[0]} laps ${a}–${b}"></i>`; }).join("");
      return `<li><span class="num p">${x.pos || "–"}</span><b style="--tc:${col(x.id)}">${x.id}</b><span class="bar">${segs}</span><span class="num n">${(D.pits[x.id] || []).length}</span></li>`; }).join("");
    const strategy = `${sectionHead("Tyres", "Strategy")}<div class="panel reveal"><ul class="strat"><li class="head"><span></span><span></span><span class="mono dim">Lap 1 → ${N}</span><span class="mono dim">Stops</span></li>${strat}</ul>
        <div class="legend">${[...used3].map((c) => `<span style="--tc:${(TYRE[c] || TYRE.U)[1]}">${(TYRE[c] || TYRE.U)[0]}</span>`).join("")}</div></div>`;

    // race in numbers: how close was it, how much passing
    const O = D.overtakes || {}, G = (D.gap12 || []).filter((g) => g != null);
    const within1 = G.filter((g) => g < 1).length;
    const atLine = D.pos ? (() => { let ch = 0, prev = null, who = new Set();
      for (let k = 1; k <= N; k++) { const ldr = Object.keys(D.pos).find((id) => D.pos[id][k] === 1); if (!ldr) continue; who.add(ldr); if (prev && ldr !== prev) ch++; prev = ldr; }
      return { ch, who: [...who] }; })() : { ch: 0, who: [] };
    const margin = W2 && W2.gap != null ? W2.gap : null;
    const tile = (v, k, sub) => `<div class="tile"><b class="num">${v}</b><span class="kicker">${k}</span>${sub ? `<small>${sub}</small>` : ""}</div>`;
    const gx = (k) => L + ((k - 0.5) / N) * (W - L - R), bw = Math.max(1.5, (W - L - R) / N - 1.2);
    // season average for comparison: every other race, resampled onto this race's laps by race distance
    const otherRaces = Object.entries(S.RACE_DETAIL || {}).filter(([r]) => +r !== +round).map(([, x]) => x);
    const resample = (arr, n) => Array.from({ length: n }, (_, k) => { const v = arr[Math.min(arr.length - 1, Math.floor(((k + 0.5) / n) * arr.length))]; return v; });
    const meanAt = (key) => Array.from({ length: N }, (_, k) => { const v = otherRaces.map((x) => resample(key(x) || [], N)[k]).filter((v) => v != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; });
    const avgOf = (a) => { const v = a.filter((x) => x != null); return v.length ? v.reduce((p, q) => p + q, 0) / v.length : null; };
    const fmtS = (v) => (v == null ? "–" : v < 10 ? v.toFixed(2) + "s" : v.toFixed(1) + "s");

    // gap P1 -> P2: square-root scale so the sub-second laps (where it matters) get room; capped at 8 s
    const GH = 140, GT = 10, GMAX = 8, gy = (g) => GT + GH - (Math.sqrt(Math.min(g, GMAX)) / Math.sqrt(GMAX)) * GH;
    const sGap = meanAt((x) => (x.gap12 || []).map((g, k) => (k < 1 ? null : g)));   // lap 1 is a standing start, leave it out
    const seasonGapLaps = otherRaces.map((x) => (x.gap12 || []).filter((g) => g != null)), seasonWithin = seasonGapLaps.reduce((a, g) => a + g.filter((v) => v < 1).length, 0), seasonLaps = seasonGapLaps.reduce((a, g) => a + g.length, 0);
    const seasonMedGap = (() => { const all = seasonGapLaps.flat().sort((a, b) => a - b); return all.length ? all[Math.floor(all.length / 2)] : null; })();
    const thisMed = (() => { const g = [...G].sort((a, b) => a - b); return g.length ? g[Math.floor(g.length / 2)] : null; })();
    const gapBars = (D.gap12 || []).map((g, k) => g == null ? "" : `<rect x="${(gx(k + 1) - bw / 2).toFixed(1)}" y="${gy(g).toFixed(1)}" width="${bw.toFixed(1)}" height="${(GT + GH - gy(g)).toFixed(1)}" class="${g < 1 ? "close" : "far"}"/>`).join("");
    const gTicks = [0.25, 0.5, 1, 2, 4, 8].map((v) => `<line x1="${L}" x2="${W - R}" y1="${gy(v).toFixed(1)}" y2="${gy(v).toFixed(1)}" class="${v === 1 ? "ref" : "gl"}"/><text x="${L - 4}" y="${(gy(v) + 3).toFixed(1)}" text-anchor="end">${v === 8 ? "8s+" : v + "s"}</text>`).join("");
    const avgPath = (vals, y) => vals.map((v, k) => (v == null ? "" : `${k && vals[k - 1] != null ? "L" : "M"}${gx(k + 1).toFixed(1)},${y(v).toFixed(1)}`)).join("");
    const gapSvg = `<svg viewBox="0 0 ${W} ${GT + GH + 26}" class="mini" role="img" aria-label="Gap between first and second at the end of each lap, with the season average">
        ${scBands(GT, GH)}${gTicks}${gapBars}${otherRaces.length ? `<path d="${avgPath(sGap, gy)}" class="avg"/>` : ""}${lapTicks(GT + GH + 20)}</svg>`;
    const gapCmp = `<div class="cmp"><div><span class="kicker">This race</span><b class="num">${fmtS(thisMed)}</b><small>typical gap · ${within1}/${G.length} laps within 1s (${G.length ? Math.round((100 * within1) / G.length) : 0}%)</small></div>
        <div><span class="kicker">Season average</span><b class="num">${fmtS(seasonMedGap)}</b><small>typical gap · ${seasonLaps ? Math.round((100 * seasonWithin) / seasonLaps) : 0}% of laps within 1s · ${otherRaces.length} races</small></div></div>`;

    // overtakes per lap: lap 1 is off the scale most races, so the axis fits laps 2+ and lap 1 gets its number on top
    const pl = O.perLap || [], OH = 110, OT = 14;
    const sOv = meanAt((x) => ((x.overtakes || {}).perLap || []).map((c, k) => (k === 0 ? null : c)));
    const omax = Math.max(4, Math.ceil(Math.max(...pl.slice(1), ...sOv.filter((v) => v != null)) * 1.15));
    const oy = (c) => OT + OH - (Math.min(c, omax) / omax) * OH;
    const oStep = omax > 12 ? 5 : omax > 6 ? 2 : 1;
    const oTicks = Array.from({ length: Math.floor(omax / oStep) + 1 }, (_, i) => i * oStep).map((v) => `<line x1="${L}" x2="${W - R}" y1="${oy(v).toFixed(1)}" y2="${oy(v).toFixed(1)}" class="gl"/><text x="${L - 4}" y="${(oy(v) + 3).toFixed(1)}" text-anchor="end">${v}</text>`).join("");
    const seasonOv = otherRaces.map((x) => (x.overtakes || {}).total).filter((v) => v != null), seasonL1 = otherRaces.map((x) => (x.overtakes || {}).lap1).filter((v) => v != null);
    const sAvgTotal = avgOf(seasonOv), sAvgL1 = avgOf(seasonL1), sPerLap = avgOf(otherRaces.map((x) => { const p = (x.overtakes || {}).perLap || []; return p.length > 1 ? p.slice(1).reduce((a, b) => a + b, 0) / (p.length - 1) : null; }));
    const thisPerLap = pl.length > 1 ? pl.slice(1).reduce((a, b) => a + b, 0) / (pl.length - 1) : null;
    const ovSvg = pl.length ? `<svg viewBox="0 0 ${W} ${OT + OH + 26}" class="mini" role="img" aria-label="On-track overtakes per lap, with the season average">
        ${scBands(OT, OH)}${oTicks}${pl.map((c, k) => c ? `<rect x="${(gx(k + 1) - bw / 2).toFixed(1)}" y="${oy(c).toFixed(1)}" width="${bw.toFixed(1)}" height="${(OT + OH - oy(c)).toFixed(1)}" class="${c > omax ? "ov clip" : "ov"}"/>${c > omax ? `<text x="${gx(k + 1).toFixed(1)}" y="${OT - 3}" text-anchor="middle" class="over">${c}</text>` : ""}` : "").join("")}
        ${otherRaces.length ? `<path d="${avgPath(sOv, oy)}" class="avg"/>` : ""}${lapTicks(OT + OH + 20)}</svg>` : "";
    const ovCmp = `<div class="cmp"><div><span class="kicker">This race</span><b class="num">${O.total ?? "–"}</b><small>${O.lap1 ?? 0} on lap 1 · ${thisPerLap != null ? thisPerLap.toFixed(1) : "–"} per lap after</small></div>
        <div><span class="kicker">Season average</span><b class="num">${sAvgTotal != null ? Math.round(sAvgTotal) : "–"}</b><small>${sAvgL1 != null ? Math.round(sAvgL1) : 0} on lap 1 · ${sPerLap != null ? sPerLap.toFixed(1) : "–"} per lap after</small></div></div>`;
    // teammates share a colour: the second one of a team gets a lighter shade
    const shade = {}; atLine.who.forEach((id) => { const t = (driver[id] || {}).team; shade[id] = Object.keys(shade).some((o) => (driver[o] || {}).team === t) ? `color-mix(in srgb, ${col(id)} 45%, #F2F2F0)` : col(id); });
    const ledLaps = (id) => Array.from({ length: N }, (_, k) => D.pos[id][k + 1] === 1).filter(Boolean).length;
    const ldrStrip = `<div class="ldr">${Array.from({ length: N }, (_, k) => { const id = Object.keys(D.pos).find((x) => D.pos[x][k + 1] === 1); return `<i style="background:${id ? shade[id] : "var(--line)"}" title="L${k + 1} ${id || ""}"></i>`; }).join("")}</div>
        <div class="legend">${atLine.who.map((id) => `<span style="--tc:${shade[id]}">${id} · ${ledLaps(id)} lap${ledLaps(id) === 1 ? "" : "s"}</span>`).join("")}</div>`;
    const numbers = `${sectionHead("At a glance", "Race in numbers")}
      <div class="tiles reveal">
        ${tile(margin != null ? margin.toFixed(3) + "s" : "–", "Winning margin", W2 ? "to " + nm(W2.id) : "")}
        ${tile(`${within1}<i>/${G.length}</i>`, "Laps top two within 1s")}
        ${tile(O.lead ?? "–", "Lead changes on track", `${(O.leaders || []).length} different leaders`)}
        ${tile(atLine.ch, "Leader changes at the line", `${atLine.who.length} led a lap`)}
        ${tile(O.total ?? "–", "On-track overtakes", O.lap1 != null ? `${O.lap1} on lap 1` : "")}
        ${tile(O.top && O.top[0] ? O.top[0][1] : "–", "Most overtakes", O.top && O.top[0] ? nm(O.top[0][0]) : "")}
      </div>`;
    const gapSec = `${sectionHead("P1 to P2 at the line", "Gap to the leader")}<figure class="chart reveal">${gapSvg}
        <div class="legend"><span style="--tc:#F2F2F0">within 1s</span><span style="--tc:#4A4F58">over 1s</span>${otherRaces.length ? `<span class="dash">season average</span>` : ""}</div>${gapCmp}
        <p class="note">Seconds between first and second at the end of each lap. Scale is stretched at the bottom so close laps stand out.</p></figure>`;
    const whoSec = `${sectionHead("Leader by lap", "Who led")}<div class="panel reveal">${ldrStrip}</div>`;
    const ovSec = `${ovSvg ? `${sectionHead("Passing", "Overtakes per lap")}<figure class="chart reveal">${ovSvg}
        <div class="legend"><span style="--tc:#C9CDD2">this race</span>${otherRaces.length ? `<span class="dash">season average</span>` : ""}</div>${ovCmp}<p class="note">On-track passes only: pit-stop swaps, safety-car laps and cars about to retire are left out (OpenF1 overtakes, ${O.raw} raw position changes).${O.top && O.top.length ? ` Most: ${O.top.slice(0, 3).map(([id, c]) => `${nm(id)} ${c}`).join(", ")}.` : ""}</p></figure>` : ""}`;
    return { pre: "", post: moments + strategy + winlose + gapSec + ovSec + numbers + whoSec + chart };
  }

  function viewRace(round) {
    const r = raceByRound[round];
    const res = S.RESULTS.find((x) => x.round === round);
    if (r && !res) return viewPreview(round);
    if (!r || !res) return viewMissing("We couldn't find that round.");
    const podium = res.race.slice(0, 3).map((x) => driver[x.id]);
    const finishers = res.race.filter((x) => !x.dnf);
    const hasPace = finishers.some((x) => typeof x.pace === "number"); // Stat Lab patch: pace data is optional
    const best = hasPace ? Math.min(...finishers.map((x) => x.pace)) : 0;
    const worst = hasPace ? Math.max(...finishers.map((x) => x.pace)) : 0;

    const rows = res.race.map((x, i) => {
      const d = driver[x.id];
      const delta = x.grid - (x.pos || x.grid);
      return `<li class="reveal${i >= 10 ? " more" : ""}" style="--i:${Math.min(i, 12)};--tc:${tc(d.team)}"><a class="rrow" href="#/driver/${d.id}">
        <span class="pos mono">${x.pos || esc(x.status || "DNF")}</span>
        <span class="who">${dName(d)}<small>${esc(team[d.team].name)}</small></span>
        <span class="mono gain ${x.dnf ? "" : delta > 0 ? "up" : delta < 0 ? "down" : ""}">${x.dnf ? "—" : delta > 0 ? "▲" + delta : delta < 0 ? "▼" + -delta : "·"}</span>
        <span class="gap num">${!x.pos ? "" : x.pos === 1 ? "WIN" : x.gap != null ? "+" + x.gap.toFixed(3) + "s" : x.gapText ? esc(x.gapText.replace("LAPS", "laps").replace("LAP", "lap")) : ""}</span>
      </a></li>`;
    }).join("");

    const paceRows = !hasPace ? "" : [...finishers].sort((a, b) => a.pace - b.pace).map((x) => {
      const d = driver[x.id];
      const gap = x.pace - best;
      const w = worst > best ? gap / (worst - best) : 0;
      return `<li style="--tc:${tc(d.team)}"><span class="mono">${d.id}</span><span class="pbar"><i style="transform:scaleX(${Math.max(0.02, w)})"></i></span><span class="mono dim">${gap === 0 ? lapTime(x.pace) : "+" + gap.toFixed(3)}</span></li>`;
    }).join("");

    const pole = res.quali[0];
    return `
      <a class="back" href="#/"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>Season</a>
      <div class="page-title reveal"><span class="kicker">Round ${r.round} · ${fmtDate(r.date, { day: "numeric", month: "long" })}</span><h1>${r.flag} ${esc(r.name)}</h1><p class="dim">${esc(r.place)} · ${r.laps} laps</p></div>
      <div class="facts reveal">
        <div><span class="kicker">Pole</span><b>${esc(driver[pole.id].last)}</b><span class="mono dim">${lapTime(pole.time)}</span></div>
        ${hasPace ? `<div><span class="kicker">Best race pace</span><b>${esc(driver[res.fastestPace].last)}</b><span class="mono dim">${lapTime(best)}</span></div>`
          : `<div><span class="kicker">Winner from</span><b>P${res.race[0].grid || "–"}</b><span class="mono dim">on the grid</span></div>`}
      </div>
      ${sectionHead("Classification", "Result")}
      <ol class="result collapsed">${rows}</ol>
      ${res.race.length > 10 ? `<button class="expand" type="button" data-expand="result">Show all ${res.race.length} <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>` : ""}
      ${raceInsights(round, res).post}
      ${hasPace ? `${sectionHead("Average lap", "Race pace", `<p class="note">Gap to the fastest average lap.</p>`)}
      <ol class="pace">${paceRows}</ol>` : ""}`;
  }

  function positionChart(rounds, color) {
    const W = 340, H = 150, L = 26, R = 8, T = 10, B = 22, n = S.CALENDAR.length, maxP = 22;
    const x = (r) => L + ((r - 1) / (n - 1)) * (W - L - R), y = (p) => T + ((p - 1) / (maxP - 1)) * (H - T - B);
    const grid = [1, 5, 10, 15, 20].map((p) => `<line x1="${L}" x2="${W - R}" y1="${y(p)}" y2="${y(p)}"/><text x="${L - 6}" y="${y(p) + 3}" text-anchor="end">P${p}</text>`).join("");
    const fin = rounds.filter((r) => r.raced && !r.dnf);
    const line = fin.map((r) => `${x(r.round).toFixed(1)},${y(r.pos).toFixed(1)}`).join(" ");
    const q = rounds.filter((r) => r.quali).map((r) => `<circle cx="${x(r.round).toFixed(1)}" cy="${y(r.quali).toFixed(1)}" r="3" fill="none" stroke="var(--muted)" stroke-width="1.5"/>`).join("");
    const dots = fin.map((r) => `<circle cx="${x(r.round).toFixed(1)}" cy="${y(r.pos).toFixed(1)}" r="${r.pos <= 3 ? 4.5 : 3.5}" fill="${r.pos <= 3 ? "#FFD400" : color}"/>`).join("");
    const dnfs = rounds.filter((r) => r.raced && r.dnf).map((r) => `<text x="${x(r.round)}" y="${H - B + 14}" text-anchor="middle" style="fill:var(--down)">✕</text>`).join("");
    const ticks = [1, 6, 12, 18, n].map((r) => `<text x="${x(r)}" y="${H - 4}" text-anchor="middle">R${r}</text>`).join("");
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Finishing position by round"><g class="grid">${grid}</g>${q}<polyline points="${line}" style="stroke:${color}"/>${dots}${dnfs}${ticks}</svg>`;
  }

  function viewDriver(id) {
    const d = driver[id], s = DSmap[id];
    if (!d || !s) return viewMissing("We couldn't find that driver.");
    const t = team[d.team], col = t.color;
    const rounds = driverRounds(id);
    const raced = rounds.filter((r) => r.raced);
    const avg = s.finishes.length ? (s.finishes.reduce((a, b) => a + b, 0) / s.finishes.length).toFixed(1) : "–";
    const avgQ = rounds.filter((r) => r.quali).length ? (rounds.filter((r) => r.quali).reduce((a, r) => a + r.quali, 0) / rounds.filter((r) => r.quali).length).toFixed(1) : "–";
    const gained = raced.filter((r) => !r.dnf && r.grid).reduce((a, r) => a + (r.grid - r.pos), 0);
    const mates = teammates(d);
    const h2h = mates.map((m) => {
      const q = qualiH2H(d.id, m.id), rc = raceH2H(d.id, m.id);
      return `<a class="battle" href="#/duel/${d.id}/${m.id}" style="--tc:${col}">
        <div class="b-top"><span>vs ${esc(m.last)}</span><span class="mono dim">open duel →</span></div>
        <div class="b-names"><b class="${q.a >= q.b ? "lead" : ""}">Quali</b><span class="mono">${q.a}–${q.b}</span><b class="${rc.a >= rc.b ? "lead" : ""}">Race</b><span class="mono">${rc.a}–${rc.b}</span></div></a>`;
    }).join("");
    const rows = [...rounds].reverse().map((r) => {
      const c = raceByRound[r.round];
      return `<li><a class="drow" href="#/race/${r.round}" style="grid-template-columns:44px minmax(0,1fr) 44px 52px 40px">
        <span class="mono dim">R${String(r.round).padStart(2, "0")}</span><b>${c.flag} ${esc(((S.RACE_INFO || {})[r.round] || {}).location || c.place)}</b>
        <span class="mono r">${r.quali ? "Q" + r.quali : "–"}</span><span class="mono r">${!r.raced ? "–" : r.dnf ? "DNF" : "P" + r.pos}</span><span class="mono r">${r.points ? "+" + r.points : ""}</span></a></li>`;
    }).join("");
    const stat = (v, k) => `<div><b class="mono">${v}</b><span>${k}</span></div>`;
    return `
      <a class="back" href="#/"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>Standings</a>
      <section class="hero t-team reveal" style="--tc:${col}">
        ${s.rank <= 3 ? sticker("P" + s.rank + "!") : ""}
        <span class="kicker">${esc(t.name)} · P${s.rank} in the championship</span>
        <div class="hero-num mono" aria-hidden="true">${d.num}</div>
        <h1 style="--len:${[...d.last].length}"><span>${esc(d.first)}</span>${esc(d.last)}</h1>
        <div class="hero-row"><div class="hero-stats">${stat(s.points, "pts")}${stat(s.wins, "wins")}${stat(s.podiums, "podiums")}${stat(s.poles, "poles")}</div>${helmet(d.id, { size: 104, look: -4 })}</div>
        <div class="actions">${starBtn("drivers", d.id, d.last)}<button class="ghost" type="button" data-share="${esc(d.first + " " + d.last)}: P${s.rank}, ${s.points} pts in 2026">Share</button></div>
      </section>
      ${sectionHead("Last five races", "Form", `<div class="forms big">${formGuide(id, 5, true) || '<span class="note">No races yet</span>'}</div>`)}
      <div class="facts reveal">
        <div><span class="kicker">Avg finish</span><b>${avg}</b><span class="mono dim">${s.dnfs} DNF${s.dnfs === 1 ? "" : "s"}</span></div>
        <div><span class="kicker">Avg quali</span><b>${avgQ}</b><span class="mono dim">places gained ${gained >= 0 ? "+" : ""}${gained}</span></div>
      </div>
      ${sectionHead("Finishing position by round", "Season", `<p class="note">Dots: race finish (yellow = podium). Rings: qualifying.</p>`)}
      <figure class="chart reveal">${positionChart(rounds, col)}</figure>
      ${h2h ? `${sectionHead("Teammate", "Head-to-head")}<div class="battles reveal">${h2h}</div>` : ""}
      ${sectionHead("Round by round", "Results")}
      <ul class="drows reveal"><li class="drow head" style="grid-template-columns:44px minmax(0,1fr) 44px 52px 40px"><span>Rnd</span><span>Grand Prix</span><span class="r">Quali</span><span class="r">Race</span><span class="r">Pts</span></li>${rows}</ul>
      <p class="foot">${esc(S.NOTE || "")}</p>`;
  }

  function viewTeam(id) {
    const t = TS.find((x) => x.id === id);
    if (!t) return viewMissing("We couldn't find that team.");
    const rank = TS.indexOf(t) + 1;
    const ds = S.DRIVERS.filter((d) => d.team === id && DSmap[d.id] && (DSmap[d.id].history.length || DSmap[d.id].points)).sort((a, b) => DSmap[b.id].points - DSmap[a.id].points);
    const perRound = S.RESULTS.map((res) => ({ round: res.round, pts: res.race.filter((r) => driver[r.id] && driver[r.id].team === id).reduce((a, r) => a + r.points, 0) }));
    const maxR = Math.max(43, ...perRound.map((r) => r.pts));
    const W = 340, H = 130, L = 8, B = 18, bw = (W - 2 * L) / S.CALENDAR.length;
    const bars = perRound.map((r) => { const h = (r.pts / maxR) * (H - B - 8); return `<rect x="${(L + (r.round - 1) * bw + 2).toFixed(1)}" y="${(H - B - h).toFixed(1)}" width="${(bw - 4).toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="${t.color}"/>`; }).join("");
    const ticks = [1, 6, 12, 18, S.CALENDAR.length].map((r) => `<text x="${L + (r - 0.5) * bw}" y="${H - 4}" text-anchor="middle">R${r}</text>`).join("");
    const cards = ds.map((d) => { const s = DSmap[d.id]; return `<a class="dcard" href="#/driver/${d.id}" style="--tc:${t.color}">
      <div class="dcard-top">${helmet(d.id, { size: 58, look: 3 })}<small>P${s.rank}</small></div><b class="dname">${esc(d.last)}</b>
      <div class="dstats"><div><b>${s.points}</b><small>PTS</small></div><div><b>${s.wins}</b><small>WINS</small></div></div><span class="form-lbl">Last 5 races</span><div class="forms">${formGuide(d.id)}</div></a>`; }).join("");
    const best = perRound.reduce((a, r) => (r.pts > a.pts ? r : a), { pts: -1 });
    return `
      <a class="back" href="#/"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>Standings</a>
      <section class="hero t-team reveal" style="--tc:${t.color}">
        <span class="kicker">Constructors · P${rank}</span>
        <h1 style="--len:${[...t.name].length}">${esc(t.name)}</h1>
        <div class="hero-stats"><div><b class="mono">${t.points}</b><span>pts</span></div><div><b class="mono">${t.wins}</b><span>wins</span></div>
          <div><b class="mono">${rank > 1 ? "−" + (TS[rank - 2].points - t.points) : "+" + (t.points - (TS[1] ? TS[1].points : 0))}</b><span>${rank > 1 ? "to P" + (rank - 1) : "lead"}</span></div></div>
        <div class="actions">${starBtn("teams", t.id, t.name)}</div>
      </section>
      ${sectionHead("Line-up", "Drivers")}
      <div class="dcards reveal">${cards}</div>
      ${sectionHead("Grand Prix points per round", "Haul", best.pts > 0 ? `<p class="note">Best weekend: R${best.round} ${((S.RACE_INFO || {})[best.round] || {}).short || ""}, ${best.pts} pts.</p>` : "")}
      <figure class="chart reveal"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Team points per round">${bars}${ticks}</svg></figure>
      ${ds.length >= 2 ? `<a class="btn" href="#/duel/${ds[0].id}/${ds[1].id}">Compare ${esc(ds[0].last)} v ${esc(ds[1].last)} →</a>` : ""}
      <p class="foot">${esc(S.NOTE || "")}</p>`;
  }

  function previewTrack(T) {
    const W = Math.max(...T.map((p) => p[0])), H = Math.max(...T.map((p) => p[1]));
    const pts = T.map((p) => p.join(",")).join(" ");
    const [x0, y0] = T[0], [x1, y1] = T[3] || T[1];
    const ang = (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI;
    return `<svg viewBox="-20 -20 ${W + 40} ${H + 40}" role="img" aria-label="Track layout">
      <polyline points="${pts}" fill="none" stroke="#2A2D33" stroke-width="16" stroke-linejoin="round" stroke-linecap="round"/>
      <polyline points="${pts}" fill="none" stroke="var(--fg)" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/>
      <g transform="translate(${x0} ${y0}) rotate(${ang.toFixed(0)})"><rect x="-3" y="-13" width="6" height="26" fill="#F2F2F0"/><path d="M14 0 l-9 -7 v14 z" fill="#F2F2F0"/></g></svg>`;
  }

  // qualifying + starting grid for a round whose race hasn't run yet (tools/add_quali.py)
  const fmtLap = (t) => (t == null ? "no time" : `${Math.floor(t / 60)}:${(t % 60).toFixed(3).padStart(6, "0")}`);
  function gridBlock(round) {
    const qd = (S.QUALI_DETAIL || {})[round], g = (S.GRID || {})[round];
    if (!qd || !qd.length || S.RESULTS.some((x) => x.round === +round)) return "";
    const order = g && g.length ? g : qd.slice().sort((x, y) => x.pos - y.pos).map((x) => x.id);
    const fastest = qd.filter((x) => x.best != null).sort((x, y) => x.pos - y.pos)[0];
    const rows = order.map((id, i) => { const q = qd.find((x) => x.id === id) || { pos: null, best: null, team: (driver[id] || {}).team };
      const moved = q.pos ? `<span class="mono ${q.pos < i + 1 && q.best != null ? "dn" : "dim"}">Q${q.pos}${q.pos < i + 1 && q.best != null ? " ↓" : ""}</span>` : `<span></span>`;
      const decide = q.q3 ?? q.q2 ?? q.q1, sess = q.q3 != null ? "Q3" : q.q2 != null ? "Q2" : q.q1 != null ? "Q1" : "";
      const gap = decide != null ? `${fmtLap(decide)} <small class="dim">${sess}</small>` : "no time";
      return `<li><a class="drow grid ${isFollowed("drivers", id) ? "fav" : ""}" href="#/driver/${id}" style="--tc:${tc(q.team) || "#5E6470"}">
        <span class="pos mono">${i + 1}</span><b>${esc(lastName(id))}</b>${moved}<span class="mono r">${gap}</span></a></li>`; }).join("");
    const pens = order.filter((id, i) => { const q = qd.find((x) => x.id === id); return q && q.pos && q.pos < i + 1 && q.best != null; });
    const note = fastest && order[0] !== fastest.id
      ? `<p class="note">${esc(lastName(fastest.id))} was fastest (${fmtLap(fastest.best)}) but ${esc(lastName(order[0]))} starts on pole after grid penalties.</p>`
      : fastest ? `<p class="note">Pole: ${esc(lastName(fastest.id))}, ${fmtLap(fastest.best)}.</p>` : "";
    return `${sectionHead("Qualifying", "Starting grid", note)}
      <ul class="drows reveal"><li class="drow head grid"><span>Grid</span><span>Driver</span><span>Quali</span><span class="r">Lap</span></li>${rows}</ul>
      ${pens.length ? `<p class="note">↓ starts behind where they qualified (grid penalty or back-of-grid start): ${pens.map((id) => esc(lastName(id))).join(", ")}.</p>` : ""}`;
  }

  // full weekend schedule in the viewer's own time zone, grouped by day; finished sessions dimmed, the next one marked
  function weekendSchedule(r) {
    const ss = r.sessions || [];
    if (!ss.length) return "";
    const now = Date.now();
    const nextIdx = ss.findIndex((x) => new Date(x.end || x.start).getTime() > now);
    const kind = (n) => /race/i.test(n) ? "race" : /sprint/i.test(n) ? "sprint" : /quali/i.test(n) ? "quali" : "prac";
    const short = (n) => n.replace("Practice ", "FP").replace("Sprint Qualifying", "Sprint Quali");
    const days = [];
    ss.forEach((x, i) => {
      const d = new Date(x.start), key = d.toDateString();
      let day = days.find((g) => g.key === key);
      if (!day) days.push(day = { key, wd: d.toLocaleDateString(undefined, { weekday: "long" }), dn: d.getDate(), mo: d.toLocaleDateString(undefined, { month: "long" }), rows: [] });
      const t0 = d.getTime(), t1 = new Date(x.end || x.start).getTime();
      const state = t1 < now ? "done" : t0 <= now ? "live" : i === nextIdx ? "next" : "";
      const tag = state === "done" ? "Done" : state === "live" ? "Live" : state === "next" ? "Next" : "";
      day.rows.push(`<li class="ws-row ${state ? "is-" + state : ""} k-${kind(x.name)}"><span class="ws-name">${esc(short(x.name))}</span>
        <span class="ws-tag mono">${tag}</span><span class="ws-time mono">${d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</span></li>`);
    });
    const tz = (Intl.DateTimeFormat().resolvedOptions().timeZone || "").replace(/_/g, " ");
    return `${sectionHead("Weekend schedule", "Every session", `<p class="note">Times in your time zone${tz ? " (" + esc(tz) + ")" : ""}.</p>`)}
      <div class="ws reveal">${days.map((g) => `<div class="ws-day"><div class="ws-date"><b>${g.dn}</b><span><em>${esc(g.wd)}</em><small>${esc(g.mo)}</small></span></div><ul>${g.rows.join("")}</ul></div>`).join("")}</div>`;
  }

  function viewPreview(round) {
    const r = raceByRound[round], P = PREVIEWS[round];
    const hist = P ? P.history : [];
    const codeName = (c, fallback) => (driver[c] ? driver[c].last : fallback || c);
    const codeCol = (c) => (driver[c] && team[driver[c].team] ? team[driver[c].team].color : "#5E6470");
    const poleWins = hist.filter((h) => h.pole === h.winner).length;
    const avgGrid = hist.length ? (hist.reduce((a, h) => a + h.grid, 0) / hist.length).toFixed(1) : null;
    const best = P && P.drivers.length ? P.drivers[0] : null;
    const fastest = hist.filter((h) => h.fastest).sort((a, b) => a.fastest.time.localeCompare(b.fastest.time))[0];
    const span = P && P.editions > hist.length ? `last ${hist.length} of ${P.editions} editions` : `all ${hist.length} edition${hist.length === 1 ? "" : "s"}`;

    const kings = P ? P.drivers.slice(0, 8).map((d, i) => `<li><a class="drow king ${isFollowed("drivers", d.id) ? "fav" : ""}" href="#/driver/${d.id}" style="--tc:${codeCol(d.id)}">
        ${i < 3 ? helmet(d.id, { size: 40, look: 3 }) : `<span class="pos mono">${i + 1}</span>`}
        <b>${esc(codeName(d.id))}</b><span class="mono r w">${d.wins}</span><span class="mono r">${d.podiums}</span><span class="mono r">${d.poles}</span><span class="mono r">${d.avg ?? "–"}</span></a></li>`).join("") : "";

    const past = hist.map((h) => `<li class="drow past" style="--tc:${codeCol(h.winner)}">
        <span class="yr">${h.year}</span>
        <span class="who"><b>${esc(codeName(h.winner, h.winnerName))}</b><small>${esc(h.team)} · from P${h.grid}</small></span>
        <span class="mono r dim">Pole ${esc(h.pole || "–")}</span></li>`).join("");

    const mine = P ? follow.drivers.map((id) => P.drivers.find((d) => d.id === id)).filter(Boolean) : [];
    const fact = (k, v, sub) => `<div><span class="kicker">${k}</span><b class="mono">${v}</b>${sub ? `<span class="mono dim">${sub}</span>` : ""}</div>`;

    return `
      <a class="back" href="#/"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>Season</a>
      <div class="page-title reveal"><span class="kicker">Round ${r.round} · Race preview</span><h1>${r.flag} ${esc(r.name)}</h1><p class="dim">${esc(P ? P.circuit : r.place)}${P ? " · " + esc(P.locality) : ""}</p></div>
      <div class="next t-wet reveal">
        <span class="kicker">Lights out</span>
        <span class="mono countdown" data-date="${r.date}" data-start="${r.raceStart || ""}"></span>
        <span class="mono dim">${esc(localStart(r))} your time</span>
        <button class="cal" type="button" data-ics="${r.round}"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M12 13v5M9.5 15.5h5"/></svg>Add to calendar</button>
      </div>
      ${weekendSchedule(r)}
      ${P && P.track ? `${sectionHead("Circuit", "Track layout")}<figure class="chart track reveal">${previewTrack(P.track)}<figcaption><span class="mono dim">Start/finish and direction of travel marked</span></figcaption></figure>` : ""}
      <div class="facts four reveal">
        ${fact("Length", P && P.lengthKm ? P.lengthKm.toFixed(3) : "–", "km")}
        ${fact("Laps", r.laps || "–", P && P.lengthKm && r.laps ? (P.lengthKm * r.laps).toFixed(1) + " km race" : "")}
        ${fact("First GP", P && P.firstYear ? P.firstYear : "–", P ? P.editions + " held" : "")}
        ${fact("Pole → win", hist.length ? `${poleWins}/${hist.length}` : "–", avgGrid ? `winners start P${avgGrid} avg` : "")}
      </div>
      ${fastest ? `<p class="note">Fastest race lap across ${P.editions > hist.length ? "the " : ""}${esc(span)}: ${esc(codeName(fastest.fastest.code, fastest.fastest.name))} ${esc(fastest.fastest.time)} (${fastest.year}).</p>` : ""}
      ${mine.length ? `${sectionHead("Your drivers here", "Following")}<div class="favs reveal">${mine.map((d) => `<a class="fav-card has-helmet" href="#/driver/${d.id}" style="--tc:${codeCol(d.id)}">${helmet(d.id, { size: 56, look: 3 })}<span class="mono dim">${d.starts} START${d.starts === 1 ? "" : "S"} HERE</span><b>${esc(codeName(d.id))}</b><span class="note">${d.wins} win${d.wins === 1 ? "" : "s"} · ${d.podiums} podium${d.podiums === 1 ? "" : "s"} · best ${d.best ? "P" + d.best : "–"} · avg ${d.avg ?? "–"}</span></a>`).join("")}</div>` : ""}
      ${kings ? `${sectionHead(`Current grid · ${span}`, "Best on this track", best ? `<p class="note">${esc(codeName(best.id))} leads with ${best.wins} win${best.wins === 1 ? "" : "s"} and ${best.podiums} podium${best.podiums === 1 ? "" : "s"}.</p>` : "")}
        <ul class="drows reveal"><li class="drow head king"><span></span><span>Driver</span><span class="r">Wins</span><span class="r">Pod</span><span class="r">Poles</span><span class="r">Avg</span></li>${kings}</ul>` : ""}
      ${gridBlock(round)}
      ${past ? `${sectionHead("Winners", "Past results")}<ul class="drows reveal">${past}</ul>` : ""}
      ${!P ? `<div class="panel reveal" style="margin-top:20px"><p class="note">Track history for this round isn't loaded yet.</p></div>` : ""}
      <p class="foot">Data: Jolpica (results history) and OpenF1 (track layout, qualifying, grid) · unofficial fan project.</p>`;
  }

  // link-preview image: loaded from the publisher (never copied), credited to the source; hidden if it fails to load
  const newsImg = (n, cls) => n.image ? `<figure class="${cls}"><img src="${esc(n.image)}" alt="" loading="lazy" referrerpolicy="no-referrer"
      onerror="this.closest('figure').remove()"><figcaption>Image: ${esc(n.tag)}</figcaption></figure>` : "";
  function viewNews() {
    if (!NEWS.length) return `<div class="empty"><h1>No stories yet</h1><p>Add items to news.js to fill this feed.</p></div>`;
    const [lead, ...rest] = NEWS;
    return `
      <div class="page-title reveal"><span class="kicker">Paddock notes</span><h1>News</h1></div>
      <a class="lead-story reveal${lead.image ? " has-img" : ""}" href="#/news/${lead.id}">
        ${newsImg(lead, "lead-img")}
        <span class="tag">${esc(lead.tag)}</span>
        <h2>${esc(lead.title)}</h2>
        <p>${esc(lead.dek)}</p>
        <span class="mono dim">${fmtDate(lead.date, { day: "numeric", month: "long" })}</span>
      </a>
      <ul class="stories">${rest.map((n, i) => `<li class="reveal" style="--i:${i}"><a class="${n.image ? "has-img" : ""}" href="#/news/${n.id}">
        <span class="st-text"><span class="mono dim">${fmtDate(n.date)} · ${esc(n.tag)}</span>
        <b>${esc(n.title)}</b></span>${newsImg(n, "st-img")}
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

  /* ---------- Stat Lab addition: race-by-race qualifying duel with telemetry ---------- */
  const QS = ["q3", "q2", "q1"];
  const DUELS = S.DUELS || {};
  const telRounds = Object.keys(DUELS).map(Number).sort((x, y) => x - y);
  const lapOrDash = (s) => (s == null ? "–" : lapTime(s));
  const lastName = (id) => (driver[id] ? driver[id].last : id);

  function trackMapSvg(D, a, b, ca, cb) {
    const T = D.track;
    const W = Math.max(...T.map((p) => p[0])), H = Math.max(...T.map((p) => p[1])) + 40;
    const SEG = 8; // 8 points x 20 m = about 160 m mini-sectors
    let segs = "", wa = 0, wb = 0;
    for (let i = 0; i < T.length - 1; i += SEG) {
      const j = Math.min(i + SEG, T.length - 1);
      let d = 0;
      for (let k = i; k <= j; k++) d += a.speed[k] - b.speed[k];
      d /= j - i + 1;
      const col = Math.abs(d) < 1.5 ? "#5E6470" : d > 0 ? ca : cb;
      if (Math.abs(d) >= 1.5) d > 0 ? wa++ : wb++;
      segs += `<polyline points="${T.slice(i, j + 1).map((p) => p[0] + "," + (p[1] + 20)).join(" ")}" fill="none" stroke="${col}" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
    const s0 = T[0], s1 = T[1];
    const ang = (Math.atan2(s1[1] - s0[1], s1[0] - s0[0]) * 180) / Math.PI + 90;
    return { wa, wb, svg: `<svg viewBox="-30 -10 ${W + 60} ${H + 20}" role="img" aria-label="Track map coloured by who was faster in each mini-sector">
      <polyline points="${T.map((p) => p[0] + "," + (p[1] + 20)).join(" ")}" fill="none" stroke="#2A2D33" stroke-width="40" stroke-linejoin="round"/>
      ${segs}
      <rect x="${s0[0] - 4}" y="${s0[1] - 6}" width="8" height="52" fill="#F2F2F0" transform="rotate(${ang.toFixed(0)} ${s0[0]} ${s0[1] + 20})"/></svg>` };
  }

  function speedSvg(D, a, b, ca, cb) {
    const W = 340, H = 210, padL = 28, padR = 6, top = 10, plotH = 150, stripY = 172, vMin = 50, vMax = 360;
    const x = (i) => padL + (i / (a.speed.length - 1)) * (W - padL - padR);
    const y = (v) => top + plotH - ((v - vMin) / (vMax - vMin)) * plotH;
    const path = (arr) => arr.map((v, i) => (i ? "L" : "M") + x(i).toFixed(1) + "," + y(v).toFixed(1)).join("");
    const sx = (d) => padL + (d / D.length) * (W - padL - padR);
    const grid = [100, 200, 300].map((v) => `<line x1="${padL}" x2="${W - padR}" y1="${y(v)}" y2="${y(v)}" stroke="#2A2D33"/><text x="${padL - 4}" y="${y(v) + 3}" text-anchor="end">${v}</text>`).join("");
    const SEC = D.sectors && D.sectors.length === 2 ? D.sectors : [];
    const secs = SEC.map((d) => `<line x1="${sx(d)}" x2="${sx(d)}" y1="${top}" y2="${stripY + 12}" stroke="#5E6470" stroke-dasharray="3 3"/>`).join("");
    const labels = [0, SEC[0], SEC[1], D.length];
    const secText = (SEC.length ? [0, 1, 2] : []).map((i) => `<text x="${(sx(labels[i]) + sx(labels[i + 1])) / 2}" y="${top + 10}" text-anchor="middle">S${i + 1}</text>`).join("");
    const cw = (W - padL - padR) / a.speed.length;
    const strip = a.speed.map((v, i) => {
      const d = v - b.speed[i];
      return `<rect x="${x(i).toFixed(1)}" y="${stripY}" width="${(cw + 0.4).toFixed(1)}" height="12" fill="${Math.abs(d) < 2 ? "#2A2D33" : d > 0 ? ca : cb}"/>`;
    }).join("");
    const km = Array.from({ length: Math.floor(D.length / 1000) + 1 }, (_, i) => i * 1000).map((d) => `<text x="${sx(d)}" y="${H - 6}" text-anchor="middle">${d / 1000}km</text>`).join("");
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Speed against distance for ${a.driver} and ${b.driver}">
      ${grid}${secs}${secText}
      <path d="${path(b.speed)}" fill="none" stroke="${cb}" stroke-width="1.8" stroke-linejoin="round"/>
      <path d="${path(a.speed)}" fill="none" stroke="${ca}" stroke-width="1.8" stroke-linejoin="round"/>
      ${strip}${km}</svg>`;
  }

  function duelDriverCard(q, round, color, side) {
    const d = driver[q.id];
    const res = S.RESULTS.find((x) => x.round === round);
    const rr = res && res.race.find((x) => x.id === q.id);
    const st = DSmap[q.id];
    const gridPos = !rr && (S.GRID || {})[round] ? S.GRID[round].indexOf(q.id) + 1 : 0;
    const kv = (k) => `<div class="kv"><span>${k.toUpperCase()}</span><b class="mono">${lapOrDash(q[k])}</b></div>`;
    return `<div class="dcard" style="--tc:${color}">
      <div class="dcard-top"><span class="big">${d ? d.num : ""}</span><small>${side}</small></div>
      <b class="dname">${esc(d ? d.last : q.id)}</b>
      <small style="color:${color}">${esc(team[q.team] ? team[q.team].name : q.team).toUpperCase()}</small>
      <div class="dstats"><div><b class="num">P${q.pos}</b><small>QUALI</small></div><div><b class="num">${gridPos ? "P" + gridPos : !rr ? "–" : rr.pos ? "P" + rr.pos : "DNF"}</b><small>${gridPos ? "GRID" : "RACE"}</small></div></div>
      ${kv("q1")}${kv("q2")}${kv("q3")}
      <div class="kv"><span>SEASON PTS</span><b class="mono">${st ? st.points : "–"}</b></div>
    </div>`;
  }

  function viewDuelRace(aId, bId, roundArg) {
    // finished rounds plus any round whose qualifying is in (tools/add_quali.py) before the race has run
    const done = [...new Set([...S.RESULTS.map((r) => r.round), ...Object.keys(S.QUALI_DETAIL || {}).map(Number)])].sort((x, y) => x - y);
    const round = done.includes(roundArg) ? roundArg : telRounds[telRounds.length - 1] || done[done.length - 1];
    const cal = raceByRound[round], info = (S.RACE_INFO || {})[round] || {};
    const pool = ((S.QUALI_DETAIL || {})[round] || []).filter((q) => q.best != null);
    const find = (id) => pool.find((q) => q.id === id);
    let qa = find(aId) || pool[0];
    let qb = find(bId) && bId !== qa.id ? find(bId) : pool.find((q) => q.id !== qa.id);
    const ca = tc(qa.team) || "#F2F2F0";
    const cb = qa.team === qb.team ? "#F2F2F0" : tc(qb.team);

    const sess = QS.find((k) => qa[k] != null && qb[k] != null) || "q1";
    const gap = +(qb[sess] - qa[sess]).toFixed(3);
    const lead = gap > 0 ? qa : qb, leadCol = gap > 0 ? ca : cb;
    const h2h = qualiH2H(qa.id, qb.id);

    const chips = done.map((rd) => ({ round: rd })).map((r) => {
      const ri = (S.RACE_INFO || {})[r.round] || {};
      // each race opens on that race's front row: the P1 and P2 qualifiers
      const front = ((S.QUALI_DETAIL || {})[r.round] || []).filter((q) => q.best != null).sort((x, y) => x.pos - y.pos);
      const p1 = front[0] ? front[0].id : qa.id, p2 = front[1] ? front[1].id : qb.id;
      return `<a class="tchip" href="#/duel/${p1}/${p2}/race/${r.round}" ${r.round === round ? 'aria-current="true"' : ""}>
        <span class="mono">R${r.round}</span><b>${esc(ri.short || r.round)}</b>${DUELS[r.round] ? "<i></i>" : ""}</a>`;
    }).join("");

    const opts = (sel, other) => pool.map((q) => `<option value="${q.id}" ${q.id === sel ? "selected" : ""} ${q.id === other ? "disabled" : ""}>P${q.pos} ${esc(lastName(q.id))}</option>`).join("");

    const sessRows = ["q1", "q2", "q3"].map((k) => {
      const A = qa[k], B = qb[k];
      const d = A != null && B != null ? +(B - A).toFixed(3) : null;
      const col = d == null || d === 0 ? "var(--muted)" : d > 0 ? ca : cb;
      return `<li class="drow" style="grid-template-columns:40px minmax(0,1fr) minmax(0,1fr) 84px">
        <b class="mono">${k.toUpperCase()}</b><span class="mono r">${lapOrDash(A)}</span><span class="mono r">${lapOrDash(B)}</span>
        <span class="mono r" style="color:${col}; font-size:12px">${d == null ? "–" : d === 0 ? "LEVEL" : (d > 0 ? qa.id : qb.id) + " " + Math.abs(d).toFixed(3)}</span></li>`;
    }).join("");

    let tele = "";
    const D = DUELS[round];
    const a = D && D.drivers.find((x) => x.driver === qa.id), b = D && D.drivers.find((x) => x.driver === qb.id);
    if (a && b) {
      const map = D.track ? trackMapSvg(D, a, b, ca, cb) : null;
      const sd = a.s.map((v, i) => +(b.s[i] - v).toFixed(3));
      const maxS = Math.max(0.05, ...sd.map(Math.abs));
      const sectors = sd.map((d, i) => {
        const w = (Math.abs(d) / maxS) * 50;
        const style = d >= 0 ? `left:50%;width:${w}%;background:${ca}` : `right:50%;width:${w}%;background:${cb}`;
        return `<div class="sector"><b class="mono">S${i + 1}</b><span class="sbar"><i style="${style}"></i></span><span class="mono r">${d === 0 ? "LEVEL" : (d > 0 ? a.driver : b.driver) + " " + Math.abs(d).toFixed(3)}</span></div>`;
      }).join("");
      const corners = D.corners.filter((k) => a.corners[k] != null && b.corners[k] != null).map((k) => {
        const d = +(a.corners[k] - b.corners[k]).toFixed(1);
        const who = Math.abs(d) < 1 ? null : d > 0 ? a.driver : b.driver;
        return `<li class="drow" style="grid-template-columns:minmax(0,1fr) 54px 54px 76px">
          <b>${/^C\d+$/.test(k) ? "Corner " + k.slice(1) : esc(k)}</b><span class="mono r">${Math.round(a.corners[k])}</span><span class="mono r">${Math.round(b.corners[k])}</span>
          <span class="mono r" style="font-size:12px;color:${!who ? "var(--muted)" : d > 0 ? ca : cb}">${!who ? "LEVEL" : who + " +" + Math.abs(d).toFixed(0)}</span></li>`;
      }).join("");
      const legend = (x, y) => `<div class="legend"><span style="--tc:${ca}">${x}</span><span style="--tc:${cb}">${y}</span></div>`;
      tele = `
        ${map ? `${sectionHead("Who's faster where", "Track map")}<figure class="chart reveal">${map.svg}${legend(`${a.driver} faster · ${map.wa}`, `${b.driver} faster · ${map.wb}`)}<p class="note">Mini-sectors of about 160 m, coloured by who carried more speed.</p></figure>` : ""}
        ${sectionHead("Official timing", "Sectors")}<div class="panel reveal">${sectors}</div>
        ${sectionHead("km/h", "Speed trace")}<figure class="chart reveal">${speedSvg(D, a, b, ca, cb)}${legend(a.driver, b.driver)}<p class="note">Strip below the chart: who is faster at each point.</p></figure>
        ${sectionHead("Minimum km/h", "Corner speeds")}<ul class="drows reveal"><li class="drow head" style="grid-template-columns:minmax(0,1fr) 54px 54px 76px"><span>Corner</span><span class="r">${a.driver}</span><span class="r">${b.driver}</span><span class="r">Edge</span></li>${corners}</ul>
        <p class="note">Telemetry is sampled about 4 times a second, so slow-corner speeds are approximate. Sector and lap times are official.</p>`;
    } else {
      const latest = telRounds[telRounds.length - 1];
      tele = `<div class="panel reveal" style="margin-top:28px"><span class="kicker">Telemetry</span><h2 style="margin-top:6px">Coming soon for ${esc(info.location || cal.place)}</h2>
        <p class="note" style="font-size:14px;color:var(--soft)">Track map, speed trace and corner speeds are live for ${telRounds.length} track${telRounds.length === 1 ? "" : "s"} so far. Lap times above are official for every round.</p>
        ${latest ? `<a class="btn" href="#/duel/${qa.id}/${qb.id}/race/${latest}">Open ${esc(((S.RACE_INFO || {})[latest] || {}).location || "")} →</a>` : ""}</div>`;
    }

    return `<div class="season duel">
      <div class="page-title reveal"><span class="kicker">Head-to-head</span><h1>Duel</h1></div>
      <div class="tchips">${chips}</div>
      <div class="ttitle"><b>${cal.flag} ${esc(cal.name)}</b><small>ROUND ${round} · ${esc(cal.place).toUpperCase()}</small></div>
      <div class="pickers reveal" data-round="${round}">
        <label style="--tc:${ca}"><span class="sr">Driver A</span><select id="pa">${opts(qa.id, qb.id)}</select></label>
        <span class="vs">VS</span>
        <label style="--tc:${cb}"><span class="sr">Driver B</span><select id="pb">${opts(qb.id, qa.id)}</select></label>
      </div>
      <div class="panel reveal" style="margin-top:12px">
        <small>${esc(lastName(lead.id)).toUpperCase()} FASTER IN ${sess.toUpperCase()} BY</small>
        <div class="gapbig num" style="color:${leadCol}">${Math.abs(gap).toFixed(3)}<small>s</small></div>
        <div class="h2h"><span class="kicker">Season quali H2H</span><span class="h2h-score"><em style="color:${ca}">${qa.id}</em><b class="num">${h2h.a}<i>–</i>${h2h.b}</b><em style="color:${cb}">${qb.id}</em></span></div>
      </div>
      <div class="dcards reveal">${duelDriverCard(qa, round, ca, "DRIVER A")}${duelDriverCard(qb, round, cb, "DRIVER B")}</div>
      ${sectionHead("Qualifying", "Session by session")}
      <ul class="drows reveal"><li class="drow head" style="grid-template-columns:40px minmax(0,1fr) minmax(0,1fr) 84px"><span></span><span class="r">${qa.id}</span><span class="r">${qb.id}</span><span class="r">Gap</span></li>${sessRows}</ul>
      ${tele}
    </div>`;
  }

  /* ---------- Lab: car development and season analysis (lab.js, tools/build_lab.py) ---------- */
  function viewLab(sel) {
    const LB = S.LAB;
    if (!LB) return viewMissing("Season analysis isn't loaded yet.");
    const R = LB.rounds, T = LB.teams, ids = Object.keys(T).filter((t) => team[t]);
    const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
    const seasonPace = (t) => avg(R.map((r) => T[t].pace[r]).filter((v) => v != null));
    const order = [...ids].sort((a, b) => seasonPace(a) - seasonPace(b));
    const cur = team[sel] ? sel : order[0];
    const col = (t) => team[t].color, nmT = (t) => esc(team[t].name);
    const shortT = (t) => esc(team[t].name.replace("Racing Bulls", "RB").replace("Red Bull", "Red Bull").replace("Aston Martin", "Aston").replace("Cadillac", "Cadillac"));
    const W = 340, L = 30, Rr = 10;
    const xr = (r, H) => L + ((r - R[0]) / (R[R.length - 1] - R[0])) * (W - L - Rr);
    const roll = (t, k) => R.map((r, i) => { const w = R.slice(Math.max(0, i - 1), i + 2).map((x) => T[t][k][x]).filter((v) => v != null); return w.length ? avg(w) : null; });
    const pathOf = (vals, x, y) => vals.map((v, i) => (v == null ? "" : `${i && vals[i - 1] != null ? "L" : "M"}${x(R[i]).toFixed(1)},${y(v).toFixed(1)}`)).join("");
    const rTicks = (y) => [R[0], 6, 11, 16, R[R.length - 1]].filter((r) => R.includes(r)).map((r) => `<text x="${xr(r).toFixed(1)}" y="${y}" text-anchor="middle">R${r}</text>`).join("");
    const chips = order.map((t) => `<a class="lchip ${t === cur ? "on" : ""}" href="#/lab/${t}" style="--tc:${col(t)}">${shortT(t)}</a>`).join("");

    // 1. development race: gap to the fastest car, 3-round rolling average
    const H1 = 210, T1 = 10, B1 = 22, maxP = Math.min(5, Math.max(...ids.map((t) => Math.max(...roll(t, "pace").filter((v) => v != null)))));
    const y1 = (v) => T1 + (Math.min(v, maxP) / maxP) * (H1 - T1 - B1);
    const g1 = [0, 1, 2, 3, 4, 5].filter((v) => v <= maxP).map((v) => `<line x1="${L}" x2="${W - Rr}" y1="${y1(v)}" y2="${y1(v)}" class="gl"/><text x="${L - 5}" y="${y1(v) + 3}" text-anchor="end">${v ? "+" + v + "%" : "0"}</text>`).join("");
    const lines1 = [...ids.filter((t) => t !== cur), cur].map((t) => `<path d="${pathOf(roll(t, "pace"), xr, y1)}" class="${t === cur ? "on" : "off"}" style="stroke:${col(t)}"/>`).join("");
    const dots1 = R.map((r) => T[cur].pace[r] != null ? `<circle cx="${xr(r).toFixed(1)}" cy="${y1(T[cur].pace[r]).toFixed(1)}" r="2.6" fill="${col(cur)}"/>` : "").join("");
    const gains = ids.map((t) => ({ t, d: T[t].phase.early.pace - T[t].phase.late.pace })).sort((a, b) => b.d - a.d);
    const gainRow = (g) => `<li style="--tc:${col(g.t)}"><b>${nmT(g.t)}</b><span class="mono dim">${T[g.t].phase.early.pace.toFixed(2)}% → ${T[g.t].phase.late.pace.toFixed(2)}%</span><span class="num ${g.d > 0 ? "up" : "down"}">${g.d > 0 ? "−" : "+"}${Math.abs(g.d).toFixed(2)}%</span></li>`;

    // 2. pecking order heatmap
    const cw = (W - 64) / R.length;
    const heat = order.map((t, i) => `<g transform="translate(0 ${i * 18})"><rect x="0" y="3" width="3" height="11" fill="${col(t)}"/><text x="7" y="12" class="${t === cur ? "on" : ""}">${shortT(t)}</text>${R.map((r, k) => { const rk = T[t].rank[r];
      const shade = Math.round(235 - ((rk - 1) / 10) * 190);
      return rk ? `<rect x="${(64 + k * cw).toFixed(1)}" y="1" width="${(cw - 1.5).toFixed(1)}" height="15" rx="2" fill="rgb(${shade},${shade},${Math.min(255, shade + 4)})"${t === cur ? ` class="sel" style="stroke:${col(t)}"` : ""}/>${t === cur && cw > 11 ? `<text x="${(64 + k * cw + cw / 2 - 0.7).toFixed(1)}" y="12.5" text-anchor="middle" class="rk" style="fill:${shade < 140 ? "#F2F2F0" : "#0E0F12"}">${rk}</text>` : ""}` : ""; }).join("")}</g>`).join("");

    // 4. where the selected car found time
    const E = T[cur].phase.early, Lp = T[cur].phase.late;
    const found = [["Overall pace", E.pace, Lp.pace, "%", true], ["Top speed", E.trap, Lp.trap, " km/h", false], ["Slow corners", E.slow, Lp.slow, " km/h", false], ["Quick corners", E.fast, Lp.fast, " km/h", false]]
      .map(([k, a, b, u, lowerBetter]) => { if (a == null || b == null) return ""; const d = b - a, better = lowerBetter ? d < 0 : d > 0, fmt = (v) => (u === "%" ? (v === 0 ? "0" : "+" + v.toFixed(2) + "%") : (v > 0 ? "+" : "") + v.toFixed(1) + u);
        return `<li><span>${k}</span><span class="mono dim">${fmt(a)} → ${fmt(b)}</span><b class="num ${Math.abs(d) < 0.05 ? "" : better ? "up" : "down"}">${Math.abs(d) < 0.05 ? "same" : better ? "better" : "worse"}</b></li>`; }).join("");

    // 5. Saturday vs Sunday
    const ss = [...ids].filter((t) => T[t].grid && T[t].finish).sort((a, b) => (T[b].grid - T[b].finish) - (T[a].grid - T[a].finish));
    const sx = (v) => 70 + ((v - 1) / 21) * (W - 90);
    const satsun = ss.map((t, i) => `<g transform="translate(0 ${i * 20 + 8})"><text x="0" y="4" class="${t === cur ? "on" : ""}">${shortT(t)}</text>
      <line x1="${sx(T[t].grid)}" x2="${sx(T[t].finish)}" y1="0" y2="0" stroke="${col(t)}" stroke-width="3" opacity="${t === cur ? 1 : 0.6}"/>
      <circle cx="${sx(T[t].grid)}" cy="0" r="4" fill="var(--card)" stroke="${col(t)}" stroke-width="2"/><circle cx="${sx(T[t].finish)}" cy="0" r="4.5" fill="${col(t)}"/>
      <text x="${W - 4}" y="4" text-anchor="end" class="d">${(T[t].grid - T[t].finish) >= 0 ? "+" : ""}${(T[t].grid - T[t].finish).toFixed(1)}</text></g>`).join("");

    // 6. reliability
    const rel = [...ids].sort((a, b) => T[b].dnf - T[a].dnf), dmax = Math.max(1, ...ids.map((t) => T[t].dnf));
    const relRows = rel.map((t) => `<li class="${t === cur ? "on" : ""}" style="--tc:${col(t)}"><span>${shortT(t)}</span><span class="bar"><i style="width:${(T[t].dnf / dmax) * 100}%"></i></span><b class="num">${T[t].dnf}</b></li>`).join("");

    // 7. points race (Grand Prix points, cumulative)
    const cum = (t) => { let c = 0; return R.map((r) => (c += T[t].points[r] || 0)); };
    const pmax = Math.max(...ids.map((t) => cum(t).slice(-1)[0])), H7 = 200, y7 = (v) => 10 + (1 - v / pmax) * (H7 - 32);
    const lines7 = [...ids.filter((t) => t !== cur), cur].map((t) => `<path d="${pathOf(cum(t), xr, y7)}" class="${t === cur ? "on" : "off"}" style="stroke:${col(t)}"/>`).join("");
    const g7 = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round((pmax * f) / 50) * 50).map((v) => `<line x1="${L}" x2="${W - Rr}" y1="${y7(v)}" y2="${y7(v)}" class="gl"/><text x="${L - 5}" y="${y7(v) + 3}" text-anchor="end">${v}</text>`).join("");

    const early = `R${LB.early[0]}–${LB.early[1]}`, late = `R${LB.late[0]}–${LB.late[1]}`;
    return `<div class="season lab">
      <div class="page-title reveal"><span class="kicker">2026 · ${R.length} rounds analysed</span><h1>Lab</h1><p class="dim">How the cars developed, from every qualifying lap of the season.</p></div>
      <div class="lchips">${chips}</div>

      ${sectionHead("Qualifying pace", "The development race", `<p class="note">Gap to the fastest car each Saturday (3-race average). Lower is faster.</p>`)}
      <figure class="chart lchart reveal"><svg viewBox="0 0 ${W} ${H1}" role="img" aria-label="Gap to the fastest car by round">${g1}${lines1}${dots1}${rTicks(H1 - 4)}</svg></figure>
      <div class="panel reveal"><span class="kicker">Biggest gains · ${early} vs ${late}</span><ul class="lrank">${gains.slice(0, 3).map(gainRow).join("")}</ul>
        <span class="kicker" style="margin-top:12px;display:block">Went backwards</span><ul class="lrank">${gains.slice(-2).reverse().map(gainRow).join("")}</ul></div>

      ${sectionHead("Every Saturday", "Pecking order", `<p class="note">Each team's rank in qualifying pace, round by round. Brighter = higher.</p>`)}
      <figure class="chart lchart heat reveal"><svg viewBox="0 0 ${W} ${order.length * 18 + 16}" role="img" aria-label="Rank by round">${heat}
        <g transform="translate(0 ${order.length * 18 + 12})">${[R[0], 6, 11, 16, R[R.length - 1]].map((r) => `<text x="${(64 + (r - R[0]) * cw + cw / 2).toFixed(1)}" y="0" text-anchor="middle">R${r}</text>`).join("")}</g></svg></figure>

      ${sectionHead(team[cur].name, "Where they found time", `<p class="note">${early} vs ${late}, against the best car each weekend.</p>`)}
      <div class="panel reveal" style="--tc:${col(cur)}"><ul class="found">${found}</ul></div>

      ${sectionHead("Sunday vs Saturday", "Race-day gains", `<p class="note">Average grid slot (○) to average finish (●). Bigger gains = better race pace, strategy or starts.</p>`)}
      <figure class="chart lchart reveal"><svg viewBox="0 0 ${W} ${ss.length * 20 + 14}" role="img" aria-label="Average grid against average finish">${satsun}</svg></figure>

      ${sectionHead("Reliability", "Retirements", `<p class="note">Cars that did not finish, both drivers combined.</p>`)}
      <div class="panel reveal"><ul class="rel">${relRows}</ul></div>

      ${sectionHead("Constructors", "Points race", `<p class="note">Grand Prix points, round by round (sprints not included).</p>`)}
      <figure class="chart lchart reveal"><svg viewBox="0 0 ${W} ${H7}" role="img" aria-label="Cumulative points by round">${g7}${lines7}${rTicks(H7 - 4)}</svg></figure>

      ${sectionHead("Telemetry", "Head-to-head")}
      <a class="panel lduel reveal" href="#/duel"><b>Duel</b><span class="note">Pick any two drivers and compare their qualifying laps: track map, speed trace, sectors and corner speeds, every round.</span><span class="mono">Open →</span></a>
      <p class="foot">Data: OpenF1 qualifying telemetry and results · speed-trap and corner speeds are from each car's grid-setting lap · unofficial fan project.</p>
    </div>`;
  }

  function viewMissing(msg) {
    return `<div class="empty reveal"><span class="kicker">404</span><h1>Off track</h1><p>${esc(msg)}</p><a class="btn" href="#/">Back to Season</a></div>`;
  }

  /* ---------- Play: games, levels, friend challenges (play.js) ---------- */
  const PLAY = window.PLAY_INIT ? window.PLAY_INIT({ S, driver, team, helmet, esc, raceByRound, driverStats }) : null;

  /* ---------- router ---------- */
  const tabs = [...document.querySelectorAll(".tabs a")];
  let timer;
  function route() {
    const parts = (location.hash.replace(/^#\/?/, "") || "").split("/").filter(Boolean);
    const [p0, p1, p2, p3, p4] = parts;
    let html, tab;
    if (!p0) { html = viewSeason(); tab = "season"; }
    else if (p0 === "schedule") { html = viewSeason(); tab = "season"; } // old links
    else if (p0 === "race") { html = viewRace(Number(p1)); tab = "season"; }
    else if (p0 === "driver") { html = viewDriver(p1); tab = "season"; }
    else if (p0 === "team") { html = viewTeam(p1); tab = "season"; }
    else if (p0 === "news") { html = p1 ? viewArticle(p1) : viewNews(); tab = "news"; }
    else if (p0 === "play" && PLAY) { html = PLAY.view(parts); tab = "play"; }
    else if (p0 === "welcome") { html = viewSeason(); tab = "season"; setTimeout(() => openWelcome(p1 === "install" ? 2 : 0)); }
    else if (p0 === "lab") { html = viewLab(p1); tab = "lab"; }
    else if (p0 === "duel") { html = viewDuelRace(p1, p2, p3 === "race" ? Number(p4) : undefined); tab = "lab"; }
    else { html = viewMissing("That page doesn't exist."); tab = ""; }

    if (PLAY) PLAY.stop();
    app.innerHTML = html;
    if (PLAY && p0 === "play") PLAY.mount(app);
    tabs.forEach((t) => {
      const on = t.dataset.tab === tab;
      t.classList.toggle("on", on);
      if (on) t.setAttribute("aria-current", "page"); else t.removeAttribute("aria-current");
    });
    window.scrollTo(0, 0);

    const pa = document.getElementById("pa"), pb = document.getElementById("pb");
    if (pa && pb) {
      const rd = pa.closest(".pickers").dataset.round; // Stat Lab: stay on the race tab when switching drivers
      const go = () => { location.hash = `#/duel/${pa.value}/${pb.value}` + (rd ? `/race/${rd}` : ""); };
      pa.addEventListener("change", go);
      pb.addEventListener("change", go);
    }

    // centre the selected race chip; again once fonts have loaded, since chip widths change with the font on first open
    const centreChips = () => document.querySelectorAll(".tchips").forEach((strip) => {
      const cur = strip.querySelector('[aria-current="true"]');
      if (cur) strip.scrollLeft += cur.getBoundingClientRect().left - strip.getBoundingClientRect().left - (strip.clientWidth - cur.offsetWidth) / 2;
    });
    centreChips(); requestAnimationFrame(centreChips); if (document.fonts) document.fonts.ready.then(centreChips);

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
  // glass tab bar: see-through while scrolling down, frosted again on scrolling up, at the top, or at rest
  (() => {
    let lastY = scrollY, rest;
    const root = document.documentElement;
    addEventListener("scroll", () => {
      const y = scrollY;
      if (y > lastY + 2 && y > 40) root.classList.add("nav-clear");
      else if (y < lastY - 2 || y <= 40) root.classList.remove("nav-clear");
      lastY = y;
      clearTimeout(rest); rest = setTimeout(() => root.classList.remove("nav-clear"), 1200);
    }, { passive: true });
  })();

  // navigating between pages: a short cross-fade (View Transitions where supported, a fade-in otherwise)
  window.addEventListener("hashchange", () => {
    if (document.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches) { document.startViewTransition(route); return; }
    route(); app.classList.remove("enter"); void app.offsetWidth; app.classList.add("enter");
  });

  // tap the tab you're already on to jump back to the top (the hash doesn't change, so route() won't run)
  tabs.forEach((t) => t.addEventListener("click", (e) => {
    const here = location.hash && location.hash !== "#" ? location.hash : "#/";
    if (t.getAttribute("href") !== here) return;
    e.preventDefault();
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: smooth ? "smooth" : "auto" });
  }));

  // one listener for follow stars, share and calendar buttons
  app.addEventListener("click", (e) => {
    const pl = PLAY && PLAY.onClick(e);
    if (pl === "rerender") { const y = window.scrollY; route(); window.scrollTo(0, y); return; }
    if (pl) return;
    const sto = e.target.closest("[data-story]");
    if (sto) { openStory(+sto.dataset.story); return; }
    const ex = e.target.closest("[data-expand]");
    if (ex) { const ol = ex.previousElementSibling, open = ol.classList.toggle("collapsed") === false;
      ex.innerHTML = open ? `Show top 10 <svg viewBox="0 0 24 24" aria-hidden="true" style="transform:rotate(180deg)"><path d="M6 9l6 6 6-6"/></svg>` : `Show all ${ol.children.length} <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>`;
      if (!open) ol.scrollIntoView({ block: "start", behavior: "smooth" }); return; }
    const f = e.target.closest("[data-follow]");
    if (f) {
      const [kind, id] = f.dataset.follow.split(":");
      if (f.classList.contains("pick")) editingFollow = true; // keep the picker open after a pick
      toggleFollow(kind, id);
      const y = window.scrollY; route(); window.scrollTo(0, y);
      return;
    }
    const ed = e.target.closest("[data-edit-follow]");
    if (ed) {
      editingFollow = ed.dataset.editFollow === "open";
      const y = window.scrollY; route(); window.scrollTo(0, y);
      return;
    }
    const sh = e.target.closest("[data-share]");
    if (sh) {
      const data = { title: "ONE F1", text: sh.dataset.share, url: location.href };
      if (navigator.share) navigator.share(data).catch(() => {});
      else if (navigator.clipboard) navigator.clipboard.writeText(location.href).then(() => { sh.textContent = "Link copied"; }).catch(() => {});
      return;
    }
    const ic = e.target.closest("[data-ics]");
    if (ic) {
      const r = raceByRound[Number(ic.dataset.ics)];
      const url = URL.createObjectURL(new Blob([icsFor(r)], { type: "text/calendar" }));
      const a = Object.assign(document.createElement("a"), { href: url, download: `statlab-r${r.round}.ics` });
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  });
  app.addEventListener("submit", (e) => {
    const pl = PLAY && PLAY.onSubmit(e);
    if (pl === "rerender") route();
  });

  /* ---------- first-run welcome: what's here, pick who you follow, add to your phone ---------- */
  const WKEY = "onef1.welcomed.v1";
  let installEvt = null;
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvt = e; if (document.getElementById("welcome")) drawWelcome(); });
  window.addEventListener("appinstalled", () => { installEvt = null; });
  const ua = navigator.userAgent, isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/.test(ua), standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  let wStep = 0, wOS = isIOS ? "ios" : isAndroid ? "android" : "desktop";
  const ico = {
    race: '<path d="M4 20V4m0 1h11l-2 4 2 4H4"/>',
    lab: '<path d="M9 3h6M10 3v6l-5.5 9.5A1.6 1.6 0 0 0 5.9 21h12.2a1.6 1.6 0 0 0 1.4-2.5L14 9V3M7.5 15h9"/>',
    play: '<path d="M6 12h4m-2-2v4M15 11h.01M18 13h.01M8 6h8a5 5 0 0 1 5 5v1a5 5 0 0 1-5 5l-2-2h-4l-2 2a5 5 0 0 1-5-5v-1a5 5 0 0 1 5-5z"/>',
    share: '<path d="M12 3v12M8 7l4-4 4 4M6 11H5v10h14V11h-1"/>',
    plus: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8v8M8 12h8"/>',
    dots: '<circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    install: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19h14"/>',
    arrow: '<path d="M5 12h13M13 6l6 6-6 6"/>',
    left: '<path d="M19 12H6M11 6l-6 6 6 6"/>',
  };
  const svgI = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ico[k]}</svg>`;
  const logoSvg = () => (document.querySelector(".top .wm") || { outerHTML: "" }).outerHTML;
  function drawWelcome() {
    const w = document.getElementById("welcome"); if (!w) return;
    // progress = the start lights: one more lit per step
    const lights = `<div class="w-lights" aria-label="Step ${wStep + 1} of 3">${[0, 1, 2].map((i) => `<i class="${i <= wStep ? "on" : ""}"></i>`).join("")}</div>`;
    const top = `<div class="w-top"><span class="w-mark">${logoSvg()}</span>${lights}</div>`;
    let body = "", foot = "";
    if (wStep === 0) {
      // features as a live timing tower
      const row = (p, color, name, what, tag) => `<li style="--tc:${color}"><span class="w-p">P${p}</span><span class="w-nm"><b>${name}</b><small>${what}</small></span><span class="w-tag">${tag}</span></li>`;
      body = `<span class="w-kick">Formation lap · 3 steps</span>
        <h1 class="w-h">Lights out on<br>your <em>F1</em> season.</h1>
        <p class="w-sub">Every race decoded, every car's development tracked, and games to settle it with your friends.</p>
        <ol class="w-tower">${row(1, "#E10600", "Race analysis", "Gaps, strategy, key moments", "LIVE DATA")}${row(2, "#27F4D2", "The Lab", "How every car developed", "21 RNDS")}${row(3, "#FF8000", "Play", "Reaction, trivia, challenges", "VS FRIENDS")}</ol>`;
      foot = `<button class="w-go" type="button" data-w="next"><span>Start the formation lap</span>${svgI("arrow")}</button><button class="w-skip" type="button" data-w="done">Skip to the app</button>`;
    } else if (wStep === 1) {
      // drivers on a staggered starting grid, helmets and all
      const drv = DS.filter((x) => x.points > 0 || x.history.length);
      const slot = (x, i) => { const id = x.id, on = isFollowed("drivers", id);
        return `<button class="w-slot ${on ? "on" : ""} ${i % 2 ? "r" : "l"}" type="button" data-wf="drivers:${id}" aria-pressed="${on}" style="--tc:${tc(driver[id].team)}">
          <span class="w-gp">${i + 1}</span>${helmet(id, { size: 40, look: i % 2 ? -3 : 3 })}<b>${esc(driver[id].last)}</b>${on ? `<span class="w-star">★</span>` : ""}</button>`; };
      const n = follow.drivers.length + follow.teams.length;
      body = `<span class="w-kick">Step 2 · Build your grid</span><h1 class="w-h">Who are you<br><em>racing</em> with?</h1>
        <p class="w-sub">Tap your drivers and teams. They lead your home screen, with their form and gaps.</p>
        <div class="w-grid">${drv.map(slot).join("")}</div>
        <span class="w-kick w-sec">Teams</span><div class="w-teams">${TS.map((t) => { const on = isFollowed("teams", t.id);
          return `<button class="w-team ${on ? "on" : ""}" type="button" data-wf="teams:${t.id}" aria-pressed="${on}" style="--tc:${t.color}">${esc(t.name)}</button>`; }).join("")}</div>`;
      foot = `<div class="w-row"><button class="w-back" type="button" data-w="back">${svgI("left")}</button><button class="w-go" type="button" data-w="next"><span>${n ? `Lock in ${n} pick${n === 1 ? "" : "s"}` : "Next"}</span>${svgI("arrow")}</button></div>`;
    } else {
      const tabs = [["ios", "iPhone"], ["android", "Android"], ["desktop", "Computer"]].map(([k, l]) => `<button type="button" class="${wOS === k ? "on" : ""}" data-wos="${k}">${l}</button>`).join("");
      // install steps as pit boards
      const board = (n, icon, html) => `<li><span class="w-board"><small>L</small>${n}</span><span class="w-s">${html}</span>${icon ? `<span class="w-glyph">${svgI(icon)}</span>` : ""}</li>`;
      const guides = {
        ios: `<ol class="w-pit">${board(1, "share", "In <b>Safari</b>, tap <b>Share</b>")}${board(2, "plus", "Choose <b>Add to Home Screen</b>")}${board(3, "check", "Tap <b>Add</b>. Done.")}</ol>
          <p class="w-note">Chrome on iPhone: <b>Share</b> sits next to the address bar.</p>`,
        android: `${installEvt && wOS === "android" ? `<button class="w-go w-inst" type="button" data-w="install"><span>Install ONE F1</span>${svgI("install")}</button><p class="w-note">One tap, no app store. Or by hand:</p>` : ""}
          <ol class="w-pit">${board(1, "dots", "In <b>Chrome</b>, open the <b>⋮</b> menu")}${board(2, "install", "Tap <b>Install app</b> or <b>Add to Home screen</b>")}${board(3, "check", "Tap <b>Install</b>. Done.")}</ol>`,
        desktop: `${installEvt && wOS === "desktop" ? `<button class="w-go w-inst" type="button" data-w="install"><span>Install ONE F1</span>${svgI("install")}</button>` : ""}
          <ol class="w-pit">${board(1, "install", "Click the <b>install</b> icon in the address bar")}${board(2, "check", "Click <b>Install</b>. It opens in its own window.")}</ol>
          <p class="w-note">Best on your phone: open <b>${esc(location.host + location.pathname)}</b> there.</p>`,
      };
      body = standalone
        ? `<span class="w-kick">Step 3 · Box, box</span><h1 class="w-h">You're already<br><em>in the car.</em></h1><p class="w-sub">ONE F1 is on your home screen and updates itself after every session.</p>`
        : `<span class="w-kick">Step 3 · Box, box</span><h1 class="w-h">Pit it onto<br>your <em>phone.</em></h1>
          <p class="w-sub">Its own icon, full screen, works offline. No app store, nothing to pay.</p>
          <div class="w-tabs" role="tablist">${tabs}</div>${guides[wOS]}`;
      foot = `<div class="w-row"><button class="w-back" type="button" data-w="back">${svgI("left")}</button><button class="w-go" type="button" data-w="done"><span>Lights out</span>${svgI("arrow")}</button></div>`;
    }
    w.innerHTML = `<div class="w-card">${top}<div class="w-body">${body}</div><div class="w-foot">${foot}</div></div>`;
    w.querySelector(".w-body").scrollTop = 0;
  }
  function openWelcome(step = 0) {
    if (document.getElementById("welcome")) return;
    wStep = step; const w = document.createElement("div"); w.id = "welcome"; w.setAttribute("role", "dialog"); w.setAttribute("aria-label", "Welcome to ONE F1");
    document.body.appendChild(w); document.documentElement.classList.add("welcoming"); drawWelcome();
    w.addEventListener("click", async (e) => {
      const b = e.target.closest("[data-w],[data-wf],[data-wos]"); if (!b) return;
      if (b.dataset.wf) { const [k, id] = b.dataset.wf.split(":"); toggleFollow(k, id); const sc = w.querySelector(".w-body").scrollTop; drawWelcome(); w.querySelector(".w-body").scrollTop = sc; return; }
      if (b.dataset.wos) { wOS = b.dataset.wos; drawWelcome(); return; }
      const a = b.dataset.w;
      if (a === "next") { wStep++; drawWelcome(); }
      else if (a === "back") { wStep--; drawWelcome(); }
      else if (a === "install" && installEvt) { installEvt.prompt(); const r = await installEvt.userChoice.catch(() => ({})); installEvt = null; if (r && r.outcome === "accepted") closeWelcome(); else drawWelcome(); }
      else if (a === "done") closeWelcome();
    });
  }
  function closeWelcome() {
    try { localStorage.setItem(WKEY, "1"); } catch (e) {}
    const w = document.getElementById("welcome"); if (!w) return;
    w.classList.add("gone"); document.documentElement.classList.remove("welcoming");
    setTimeout(() => w.remove(), 350);
    if (location.hash.startsWith("#/welcome")) location.hash = "#/"; else route();
  }
  let welcomed = false; try { welcomed = localStorage.getItem(WKEY) === "1"; } catch (e) {}
  if (!welcomed && !location.hash.startsWith("#/play/") ) openWelcome(0);

  route();
})();

