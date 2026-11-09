/* Stat Lab — mobile app shell: hash router + views. */
(function () {
  const APP_VERSION = "v6"; // keep in step with VERSION in sw.js
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
  function helmet(id, { size = 96, look = 0, cls = "" } = {}) {
    const d = driver[id];
    const base = d && team[d.team] ? team[d.team].color : "#8D939B";
    const [h1, h2, h3, skin, iris, mood] = LOOK[id] || [base, "#F2F2F0", "#16181C", SKIN[id] || "#EFC29C", "#5A4632", "focus"];
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
    return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Stat Lab//F1 2026//EN", "BEGIN:VEVENT",
      `UID:statlab-2026-r${r.round}@statlab`, `DTSTAMP:${f(new Date())}`, `DTSTART:${f(start)}`, `DTEND:${f(end)}`,
      `SUMMARY:${r.name} (F1 R${r.round})`, `LOCATION:${r.place}`, "DESCRIPTION:Race start. Standings and duels in Stat Lab.",
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
  function viewSeason() {
    const leader = DS[0], second = DS[1];
    const ld = driver[leader.id];
    const remaining = S.CALENDAR.length - S.RESULTS.length;
    const maxPts = leader.points || 1;

    const standings = DS.map((s, i) => {
      const d = driver[s.id];
      return `<li class="reveal" style="--i:${Math.min(i, 12)};--tc:${tc(d.team)}"><a class="row ${isFollowed("drivers", d.id) ? "fav" : ""}" href="#/driver/${d.id}">
        <span class="pos mono">${String(s.rank).padStart(2, "0")}</span>
        <span class="bar" style="--w:${(s.points / maxPts) * 100}%"></span>
        <span class="who">${dName(d)}<small>${esc(team[d.team].name)}</small></span>
        <span class="pts mono">${s.points}</span>
      </a></li>`;
    }).join("");

    const teamMax = TS[0].points || 1;
    const teams = TS.map((t, i) => `<li class="reveal" style="--i:${i};--tc:${t.color}"><a class="trow ${isFollowed("teams", t.id) ? "fav" : ""}" href="#/team/${t.id}">
        <span class="pos mono">${i + 1}</span>
        <span class="tname">${esc(t.name)}</span>
        <span class="tbar"><i style="transform:scaleX(${t.points / teamMax})"></i></span>
        <span class="pts mono">${t.points}</span>
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
          <span class="forms">${formGuide(id)}</span></a>`;
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
        ${nFollow ? `<button class="done" type="button" data-edit-follow="close">Done</button>` : ""}
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
        <div class="b-names"><b class="${q.a >= q.b ? "lead" : ""}">${esc(a.last)}</b><span class="mono">${q.a}–${q.b}</span><b class="${q.b > q.a ? "lead" : ""}">${esc(b.last)}</b></div>
        <div class="split"><i style="flex:${q.a / tot}"></i><i style="flex:${q.b / tot}"></i></div>
      </a>`;
    }).join("");

    return `
      <section class="hero t-night reveal" style="--tc:${tc(ld.team)}">
        ${sticker(remaining * 25 < leader.points - second.points ? "CHAMPION!" : "LEADER")}
        <span class="kicker">Championship leader · after R${S.RESULTS.length}</span>
        <div class="hero-num mono" aria-hidden="true">${ld.num}</div>
        <h1 style="--len:${[...ld.last].length}"><span>${esc(ld.first)}</span>${esc(ld.last)}</h1>
        <div class="hero-row">
          <div class="hero-stats">
            <div><b class="mono">${leader.points}</b><span>pts</span></div>
            <div><b class="mono">${leader.wins}</b><span>wins</span></div>
            <div><b class="mono">+${leader.points - second.points}</b><span>gap to P2</span></div>
            <div><b class="mono">${remaining * 25}</b><span>pts left</span></div>
          </div>
          ${helmet(ld.id, { size: 104, look: -4 })}
        </div>
      </section>

      ${upcoming ? `<div class="next t-wet reveal">
        <a href="#/schedule"><span class="kicker">Next · Round ${upcoming.round}</span>
        <b>${upcoming.flag} ${esc(upcoming.name)}</b>
        <span class="mono countdown" data-date="${upcoming.date}" data-start="${upcoming.raceStart || ""}"></span>
        <span class="mono dim">Lights out ${esc(localStart(upcoming))} your time</span>
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
      <p class="foot">${esc(S.NOTE || "")}<br><span class="ver">App ${APP_VERSION} · data after R${S.RESULTS.length ? S.RESULTS[S.RESULTS.length - 1].round : 0}</span></p>
    `;
  }

  function viewSchedule() {
    const items = S.CALENDAR.map((r, i) => {
      const res = S.RESULTS.find((x) => x.round === r.round);
      const isNext = upcoming && r.round === upcoming.round;
      const winner = res && driver[res.race[0].id];
      const inner = `
        <span class="rnd mono">R${String(r.round).padStart(2, "0")}</span>
        <span class="rinfo"><b>${r.flag} ${esc(r.name)}</b><small>${esc(r.place)} · ${fmtDate(r.date)}</small></span>
        <span class="rres">${winner ? `${chip(winner)}<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>` : isNext ? `<span class="badge">Next</span>` : awaiting.includes(r) ? `<span class="mono dim">Results soon</span>` : `<span class="mono dim">${r.laps} laps</span>`}</span>`;
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
      return `<li class="reveal" style="--i:${Math.min(i, 12)};--tc:${tc(d.team)}"><a class="rrow" href="#/driver/${d.id}">
        <span class="pos mono">${x.pos || "DNF"}</span>
        <span class="who">${dName(d)}<small>${esc(team[d.team].name)}</small></span>
        <span class="mono gain ${x.dnf ? "" : delta > 0 ? "up" : delta < 0 ? "down" : ""}">${x.dnf ? "—" : delta > 0 ? "▲" + delta : delta < 0 ? "▼" + -delta : "·"}</span>
        <span class="pts mono">${x.points ? "+" + x.points : ""}</span>
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
      <div class="dstats"><div><b>${s.points}</b><small>PTS</small></div><div><b>${s.wins}</b><small>WINS</small></div></div><div class="forms">${formGuide(d.id)}</div></a>`; }).join("");
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

  function viewDuel(aId, bId) {
    const a = driver[aId] || driver[DS[0].id];
    const b = driver[bId] && bId !== a.id ? driver[bId] : driver[DS.find((s) => s.id !== a.id).id];
    const sa = DSmap[a.id], sb = DSmap[b.id];
    const q = qualiH2H(a.id, b.id), rc = raceH2H(a.id, b.id);
    const avg = (s) => (s.finishes.length ? (s.finishes.reduce((x, y) => x + y, 0) / s.finishes.length).toFixed(1) : "—");

    const options = (sel) =>
      DS.map((s) => {
        const d = driver[s.id];
        return `<option value="${d.id}" ${d.id === sel ? "selected" : ""}>${esc(d.first)} ${esc(d.last)}</option>`;
      }).join("");

    const metric = (label, va, vb, lowerBetter = false) => {
      const na = parseFloat(va), nb = parseFloat(vb);
      const aWin = !isNaN(na) && !isNaN(nb) && (lowerBetter ? na < nb : na > nb);
      const bWin = !isNaN(na) && !isNaN(nb) && (lowerBetter ? nb < na : nb > na);
      return `<li><b class="mono ${aWin ? "win" : ""}">${va}</b><span>${label}</span><b class="mono ${bWin ? "win" : ""}">${vb}</b></li>`;
    };

    // Cumulative points chart
    const W = 340, H = 170, P = 8;
    const lastCum = (s) => (s.history.length ? s.history[s.history.length - 1].cum : 0); // Stat Lab patch: chart is GP points
    const maxP = Math.max(lastCum(sa), lastCum(sb), 1);
    const n = S.RESULTS.length;
    // Stat Lab patch: place points by round number, so drivers who missed rounds line up correctly
    const pts = (s) => [{ round: 0, cum: 0 }, ...s.history].map((h) => `${P + (h.round / n) * (W - 2 * P)},${H - P - (h.cum / maxP) * (H - 2 * P)}`).join(" ");
    const grid = [0.25, 0.5, 0.75].map((f) => `<line x1="${P}" x2="${W - P}" y1="${H - P - f * (H - 2 * P)}" y2="${H - P - f * (H - 2 * P)}"/>`).join("");

    const ca = tc(a.team);
    let cb = tc(b.team);
    const sameTeam = a.team === b.team;

    return `
      <div class="page-title reveal"><span class="kicker">Head-to-head</span><h1>Duel</h1></div>
      ${duelTabs(a.id, b.id, "season")}
      <div class="pickers reveal">
        <label style="--tc:${ca}"><span class="sr">Driver A</span><select id="pa">${options(a.id)}</select></label>
        <span class="vs">VS</span>
        <label style="--tc:${cb}"><span class="sr">Driver B</span><select id="pb">${options(b.id)}</select></label>
      </div>
      <div class="duel-head reveal">
        <div style="--tc:${ca}">${helmet(a.id, { size: 72, look: 8 })}<b>${esc(a.last)}</b><small>${esc(team[a.team].name)}</small></div>
        <div style="--tc:${cb}" class="r-side">${helmet(b.id, { size: 72, look: -8 })}<b>${esc(b.last)}</b><small>${esc(team[b.team].name)}</small></div>
      </div>
      <div class="tug reveal" aria-label="Qualifying ${q.a} to ${q.b}">
        <span class="kicker">Qualifying</span>
        <div class="split big" style="--ca:${ca};--cb:${cb}"><i style="flex:${q.a || 0.001}"><b class="mono">${q.a}</b></i><i style="flex:${q.b || 0.001}"><b class="mono">${q.b}</b></i></div>
        <span class="kicker">Race</span>
        <div class="split big" style="--ca:${ca};--cb:${cb}"><i style="flex:${rc.a || 0.001}"><b class="mono">${rc.a}</b></i><i style="flex:${rc.b || 0.001}"><b class="mono">${rc.b}</b></i></div>
      </div>
      <ul class="metrics reveal">
        ${metric("Points", sa.points, sb.points)}
        ${metric("Wins", sa.wins, sb.wins)}
        ${metric("Podiums", sa.podiums, sb.podiums)}
        ${metric("Poles", sa.poles, sb.poles)}
        ${metric("Avg finish", avg(sa), avg(sb), true)}
        ${metric("Best finish", sa.best ? "P" + sa.best : "—", sb.best ? "P" + sb.best : "—")}
        ${metric("DNFs", sa.dnfs, sb.dnfs, true)}
        ${metric("Champ. pos", "P" + sa.rank, "P" + sb.rank)}
      </ul>
      ${sectionHead("Grand Prix points over the season", "Momentum")}
      <figure class="chart reveal">
        <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Cumulative points by round">
          <g class="grid">${grid}</g>
          <polyline points="${pts(sb)}" style="stroke:${cb}" ${sameTeam ? 'stroke-dasharray="5 4"' : ""}/>
          <polyline points="${pts(sa)}" style="stroke:${ca}"/>
        </svg>
        <figcaption><span style="--tc:${ca}">${esc(a.last)}</span><span style="--tc:${cb}" class="${sameTeam ? "dashed" : ""}">${esc(b.last)}</span><span class="mono dim">R1 → R${n}</span></figcaption>
      </figure>`;
  }

  /* ---------- Stat Lab addition: race-by-race qualifying duel with telemetry ---------- */
  const QS = ["q3", "q2", "q1"];
  const DUELS = S.DUELS || {};
  const telRounds = Object.keys(DUELS).map(Number).sort((x, y) => x - y);
  const lapOrDash = (s) => (s == null ? "–" : lapTime(s));
  const lastName = (id) => (driver[id] ? driver[id].last : id);

  function duelTabs(aId, bId, active, round) {
    const r = round || telRounds[telRounds.length - 1] || S.RESULTS[S.RESULTS.length - 1].round;
    return `<div class="seg reveal" role="group" aria-label="Duel view">
      <a href="#/duel/${aId}/${bId}" ${active === "season" ? 'aria-current="page"' : ""}>Season</a>
      <a href="#/duel/${aId}/${bId}/race/${r}" ${active === "race" ? 'aria-current="page"' : ""}>Race by race</a>
    </div>`;
  }

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
    const kv = (k) => `<div class="kv"><span>${k.toUpperCase()}</span><b class="mono">${lapOrDash(q[k])}</b></div>`;
    return `<div class="dcard" style="--tc:${color}">
      <div class="dcard-top"><span class="big">${d ? d.num : ""}</span><small>${side}</small></div>
      <b class="dname">${esc(d ? d.last : q.id)}</b>
      <small style="color:${color}">${esc(team[q.team] ? team[q.team].name : q.team).toUpperCase()}</small>
      <div class="dstats"><div><b>P${q.pos}</b><small>QUALI</small></div><div><b>${!rr ? "–" : rr.pos ? "P" + rr.pos : "DNF"}</b><small>RACE</small></div></div>
      ${kv("q1")}${kv("q2")}${kv("q3")}
      <div class="kv"><span>SEASON PTS</span><b class="mono">${st ? st.points : "–"}</b></div>
    </div>`;
  }

  function viewDuelRace(aId, bId, roundArg) {
    const done = S.RESULTS.map((r) => r.round);
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

    const chips = S.RESULTS.map((r) => {
      const ri = (S.RACE_INFO || {})[r.round] || {};
      return `<a class="tchip" href="#/duel/${qa.id}/${qb.id}/race/${r.round}" ${r.round === round ? 'aria-current="true"' : ""}>
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

    return `
      <div class="page-title reveal"><span class="kicker">Head-to-head</span><h1>Duel</h1></div>
      ${duelTabs(qa.id, qb.id, "race", round)}
      <div class="tchips">${chips}</div>
      <div class="ttitle"><b>${cal.flag} ${esc(cal.name)}</b><small>ROUND ${round} · ${esc(cal.place).toUpperCase()}</small></div>
      <div class="pickers reveal" data-round="${round}">
        <label style="--tc:${ca}"><span class="sr">Driver A</span><select id="pa">${opts(qa.id, qb.id)}</select></label>
        <span class="vs">VS</span>
        <label style="--tc:${cb}"><span class="sr">Driver B</span><select id="pb">${opts(qb.id, qa.id)}</select></label>
      </div>
      <div class="panel reveal" style="margin-top:12px">
        <small>${esc(lastName(lead.id)).toUpperCase()} FASTER IN ${sess.toUpperCase()} BY</small>
        <div class="gapbig" style="color:${leadCol}">${Math.abs(gap).toFixed(3)}s</div>
        <small>SEASON QUALI H2H · <span style="color:${ca}">${qa.id} ${h2h.a}</span> – <span style="color:${cb}">${h2h.b} ${qb.id}</span></small>
      </div>
      <div class="dcards reveal">${duelDriverCard(qa, round, ca, "DRIVER A")}${duelDriverCard(qb, round, cb, "DRIVER B")}</div>
      ${sectionHead("Qualifying", "Session by session")}
      <ul class="drows reveal"><li class="drow head" style="grid-template-columns:40px minmax(0,1fr) minmax(0,1fr) 84px"><span></span><span class="r">${qa.id}</span><span class="r">${qb.id}</span><span class="r">Gap</span></li>${sessRows}</ul>
      ${tele}`;
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
    else if (p0 === "driver") { html = viewDriver(p1); tab = "season"; }
    else if (p0 === "team") { html = viewTeam(p1); tab = "season"; }
    else if (p0 === "news") { html = p1 ? viewArticle(p1) : viewNews(); tab = "news"; }
    else if (p0 === "duel") { html = p3 === "race" ? viewDuelRace(p1, p2, Number(p4)) : viewDuel(p1, p2); tab = "duel"; }
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
      const rd = pa.closest(".pickers").dataset.round; // Stat Lab: stay on the race tab when switching drivers
      const go = () => { location.hash = `#/duel/${pa.value}/${pb.value}` + (rd ? `/race/${rd}` : ""); };
      pa.addEventListener("change", go);
      pb.addEventListener("change", go);
    }

    const strip = document.querySelector(".tchips"), cur = strip && strip.querySelector('[aria-current="true"]');
    if (strip && cur) strip.scrollLeft = cur.offsetLeft - (strip.clientWidth - cur.offsetWidth) / 2;

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
      const data = { title: "Stat Lab", text: sh.dataset.share, url: location.href };
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
  route();
})();

