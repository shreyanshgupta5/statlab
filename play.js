/* ONE F1 · Play: mini-games built on the season's data, XP and levels with unlocks, and friend challenges.
   No server: progress is kept on this device (localStorage) and friends play through challenge links.
   A challenge link carries a seed and a score, so the friend gets the same lights / questions / tracks.
   app.js calls window.PLAY_INIT(ctx) and routes #/play/... here. */
window.PLAY_INIT = function (ctx) {
  const { S, driver, team, helmet, esc, raceByRound, driverStats } = ctx;
  const KEY = "onef1.play.v1";

  /* ---------- profile ---------- */
  const blank = () => ({ name: "", livery: "rookie", xp: 0, games: {}, badges: [], rivals: {}, days: [], played: [], preds: {}, board: [] });
  let P = (() => { try { const p = JSON.parse(localStorage.getItem(KEY)); if (p && typeof p.xp === "number") return Object.assign(blank(), p); } catch (e) {} return blank(); })();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(P)); } catch (e) {} };

  const LEVELS = [
    { xp: 0, name: "Karting" }, { xp: 100, name: "Formula 4" }, { xp: 250, name: "Formula 3" }, { xp: 450, name: "Formula 2" },
    { xp: 700, name: "Reserve driver" }, { xp: 1000, name: "Rookie" }, { xp: 1400, name: "Points scorer" },
    { xp: 1900, name: "Podium finisher" }, { xp: 2500, name: "Race winner" }, { xp: 3200, name: "World Champion" },
  ];
  const levelOf = (xp) => { let l = 1; LEVELS.forEach((L, i) => { if (xp >= L.xp) l = i + 1; }); return l; };

  // helmet liveries for the player's avatar: shell, stripe, trim, (skin, iris, mood stay the player's)
  const LIVERIES = {
    rookie: { name: "Rookie red", lvl: 1, c: ["#DC2C2C", "#F2F2F0", "#16181C"] },
    papaya: { name: "Papaya stripe", lvl: 2, c: ["#16181C", "#FF8000", "#F2F2F0"] },
    vegas: { name: "Neon Vegas", lvl: 4, c: ["#1B1030", "#FF3EA5", "#FFD400"] },
    ice: { name: "Ice blue", lvl: 6, c: ["#F2F2F0", "#7FD3FF", "#1B2A6B"] },
    carbon: { name: "Carbon gold", lvl: 7, c: ["#1A1A1A", "#FFD400", "#3A3A3A"] },
    midnight: { name: "Midnight purple", lvl: 8, c: ["#3A1B6B", "#B98CFF", "#F2F2F0"] },
    chrome: { name: "Chrome", lvl: 9, c: ["#C9CDD2", "#F2F2F0", "#5E6470"] },
    champ: { name: "Champion #1", lvl: 10, c: ["#FFD400", "#DC2C2C", "#16181C"] },
  };
  const avatar = (size, liv = P.livery) => { const L = (LIVERIES[liv] || LIVERIES.rookie).c; return helmet("__me", { size, look: 4, colors: [L[0], L[1], L[2], "#EFC29C", "#5A4632", "focus"] }); };

  const GAMES = {
    lights: { name: "Lights Out", lvl: 1, tag: "Reaction", blurb: "Five red lights. Go when they go out. F1 drivers react in about 0.2 s.", unit: "ms", lower: true },
    hilo: { name: "Higher or Lower", lvl: 1, tag: "Season stats", blurb: "Two closely matched drivers, one stat. Average finishes, teammate battles, single races. 10 questions.", unit: "/10" },
    tracks: { name: "Guess the Track", lvl: 3, tag: "Circuits", blurb: "A circuit draws itself in. Name it before it's finished. Faster = more points.", unit: "pts" },
    podium: { name: "Podium Predictor", lvl: 5, tag: "Every race", blurb: "Call the top 3 before the next race. Scored when the results land.", unit: "" },
  };
  const BADGES = {
    first: ["🏁", "Lights out", "Play your first game"],
    quick: ["⚡", "Lightning", "React in under 200 ms"],
    perfect: ["💯", "Perfect 10", "10/10 in Higher or Lower"],
    nerd: ["🗺️", "Track nerd", "Name all 8 circuits"],
    rival: ["🥊", "Rival slayer", "Beat a friend's challenge"],
    streak: ["🔥", "On a roll", "Play 3 days in a row"],
    oracle: ["🔮", "Oracle", "Call a podium spot exactly"],
    pro: ["🎓", "Pro mode", "8+/10 in Pro Higher or Lower"],
  };

  const today = () => new Date().toISOString().slice(0, 10);
  const streak = () => { let n = 0; const set = new Set(P.days); for (let d = new Date(); set.has(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() - 1)) n++; return n; };
  /* Reaction leaderboard (top 5). Kept on this phone: your own runs plus every friend's time that arrived in a challenge link.
     One row per driver name, their best time. A shared online board needs a backend; boardAdd/boardTop are the only two places to swap. */
  function boardAdd(name, ms) {
    if (!name || !(ms >= 100 && ms < 999)) return;
    const row = P.board.find((r) => r.name === name);
    if (row) { if (ms < row.ms) { row.ms = ms; row.at = Date.now(); } } else P.board.push({ name, ms, at: Date.now() });
    P.board = P.board.sort((a, b) => a.ms - b.ms || a.at - b.at).slice(0, 30);
  }
  const boardTop = () => P.board.slice().sort((a, b) => a.ms - b.ms || a.at - b.at).slice(0, 5);
  function boardHtml(title = true) {
    const top = boardTop(), medal = ["🥇", "🥈", "🥉", "4", "5"];
    const rows = top.map((r, i) => `<li class="${r.name === P.name ? "me" : ""}"><span class="pl-bpos">${medal[i]}</span><b>${esc(r.name)}${r.name === P.name ? " <small>YOU</small>" : ""}</b><span class="led">${r.ms} ms</span></li>`).join("");
    const empty = Array.from({ length: 5 - top.length }, (_, k) => `<li class="open"><span class="pl-bpos">${medal[top.length + k]}</span><b>Open spot</b><span class="led">– ms</span></li>`).join("");
    return `${title ? `<div class="sh"><span class="kicker">LIGHTS OUT · TOP 5</span><h2>Fastest reactions</h2></div>` : ""}<ol class="pl-board">${rows}${empty}</ol>
      <p class="note">${top.length < 2 ? "Challenge friends on Lights Out: their times land here when you open their link." : "You and the friends you've traded challenges with. Best time each."}</p>`;
  }

  // gives XP + badges, remembers the day; returns what happened for the result screen
  function award(xp, badges = []) {
    const before = levelOf(P.xp), got = [];
    let daily = 0;
    if (!P.days.includes(today())) { P.days = [...P.days.slice(-60), today()]; daily = 15; }
    P.xp += xp + daily;
    ["first", ...badges, ...(streak() >= 3 ? ["streak"] : [])].forEach((b) => { if (!P.badges.includes(b)) { P.badges.push(b); got.push(b); } });
    save();
    return { xp, daily, badges: got, levelUp: levelOf(P.xp) > before ? levelOf(P.xp) : 0 };
  }

  /* ---------- seeded randomness, so a challenge replays the same game ---------- */
  const rng = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const newSeed = () => Math.floor(Math.random() * 1e9);
  const shuffle = (arr, r) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // challenge code in the link: seed-score-name[-mode]
  const encodeC = (g, seed, score, mode) => `#/play/${g}/c/${seed}-${score}-${encodeURIComponent(P.name || "A friend")}${mode ? "-" + mode : ""}`;
  const decodeC = (code) => { const m = /^(\d+)-(\d+)-([^-]+)(?:-(\w+))?$/.exec(code || ""); return m ? { seed: +m[1], score: +m[2], name: decodeURIComponent(m[3]).slice(0, 16), mode: m[4] || "" } : null; };

  /* ---------- data for the games ---------- */
  const stats = driverStats();
  const byId = Object.fromEntries(stats.map((s) => [s.id, s]));
  const regulars = stats.filter((s) => s.history.length >= 5).map((s) => s.id);
  const lastName = (id) => (driver[id] ? driver[id].last : id);
  const col = (id) => (driver[id] && team[driver[id].team] ? team[driver[id].team].color : "#8D939B");
  const raceShort = (round) => (S.RACE_INFO && S.RACE_INFO[round] ? S.RACE_INFO[round].location : raceByRound[round].name.replace(" Grand Prix", ""));

  /* Higher or Lower questions. Difficulty comes from two things:
     1. close matchups: the two drivers are picked next to each other in that stat's ranking, never at random;
     2. deeper stats: average finish, places gained, Q3 appearances, teammate qualifying battles, single races.
     Pro picks direct neighbours only and asks single-race and lap-time questions most of the time. */
  function hiloQuestions(seed, pro) {
    const r = rng(seed), qs = [], seen = new Set(), reach = pro ? 1 : 3;
    const racesOf = (id) => S.RESULTS.map((res) => res.race.find((x) => x.id === id)).filter(Boolean);
    const sum = (arr) => arr.reduce((t, v) => t + v, 0);
    const poles = {}; S.RESULTS.forEach((res) => { poles[res.quali[0].id] = (poles[res.quali[0].id] || 0) + 1; });
    const QD = S.QUALI_DETAIL || {};
    const q3 = {}, beatMate = {};
    Object.values(QD).forEach((rows) => rows.forEach((x) => {
      if (x.q3 != null) q3[x.id] = (q3[x.id] || 0) + 1;
      const mate = rows.find((y) => y.team === x.team && y.id !== x.id);
      if (mate && x.pos < mate.pos) beatMate[x.id] = (beatMate[x.id] || 0) + 1;
    }));
    const half = Math.floor(S.RESULTS.length / 2), last5 = S.RESULTS.slice(-5);
    const ptsIn = (list, id) => sum(list.map((res) => (res.race.find((x) => x.id === id) || {}).points || 0));
    const avgFinish = (id) => { const f = racesOf(id).filter((x) => x.pos).map((x) => x.pos); return f.length >= 5 ? sum(f) / f.length : null; };
    const avgGrid = (id) => { const g = racesOf(id).filter((x) => x.grid).map((x) => x.grid); return g.length >= 5 ? sum(g) / g.length : null; };
    // every stat returns "bigger wins"; show() turns it back into what the player reads
    const season = [
      { label: "More points this season", val: (id) => byId[id].points },
      { label: "More podiums this season", val: (id) => byId[id].podiums, skip0: true },
      { label: "More pole positions", val: (id) => poles[id] || 0, skip0: true },
      { label: "More points in the last 5 races", val: (id) => ptsIn(last5, id) },
      { label: `More points in the first ${half} races`, val: (id) => ptsIn(S.RESULTS.slice(0, half), id) },
      { label: `More points since round ${half + 1}`, val: (id) => ptsIn(S.RESULTS.slice(half), id) },
      { label: "Better average race finish", val: (id) => { const v = avgFinish(id); return v == null ? null : -v; }, show: (v) => "P" + (-v).toFixed(2) },
      { label: "Better average grid slot", val: (id) => { const v = avgGrid(id); return v == null ? null : -v; }, show: (v) => "P" + (-v).toFixed(2) },
      { label: "More places gained on Sundays", val: (id) => sum(racesOf(id).filter((x) => x.pos && x.grid).map((x) => x.grid - x.pos)), show: (v) => (v > 0 ? "+" : "") + v },
      { label: "More races in the points", val: (id) => racesOf(id).filter((x) => x.points > 0).length },
      { label: "More retirements this season", val: (id) => racesOf(id).filter((x) => x.dnf).length, skip0: true },
      { label: "More Q3 appearances", val: (id) => q3[id] || 0 },
      { label: "Out-qualified their teammate more often", val: (id) => beatMate[id] || 0 },
    ];
    // one race: neighbours in the finishing order, on the grid, on places gained, or on lap time
    const single = () => {
      const res = S.RESULTS[Math.floor(r() * S.RESULTS.length)], where = raceShort(res.round), k = r();
      const row = (id) => res.race.find((y) => y.id === id);
      if (k < 0.35) return { label: `Finished higher in ${where}`, val: (id) => { const x = row(id); return x && x.pos ? -x.pos : null; }, show: (v) => "P" + -v };
      if (k < 0.6) return { label: `Qualified higher in ${where}`, val: (id) => { const i = res.quali.findIndex((y) => y.id === id); return i >= 0 ? -(i + 1) : null; }, show: (v) => "P" + -v };
      if (k < 0.8) return { label: `Gained more places in ${where}`, val: (id) => { const x = row(id); return x && x.pos && x.grid ? x.grid - x.pos : null; }, show: (v) => (v > 0 ? "+" : "") + v };
      return { label: `Faster qualifying lap in ${where}`, val: (id) => { const x = res.quali.find((y) => y.id === id); return x && x.time ? -x.time : null; }, show: (v) => { const t = -v, m = Math.floor(t / 60); return `${m}:${(t - m * 60).toFixed(3).padStart(6, "0")}`; } };
    };
    let guard = 0;
    while (qs.length < 10 && guard++ < 2000) {
      const t = r() < (pro ? 0.7 : 0.35) ? single() : season[Math.floor(r() * season.length)];
      const ranked = regulars.map((id) => ({ id, v: t.val(id) })).filter((x) => x.v != null).sort((x, y) => y.v - x.v);
      if (ranked.length < 4) continue;
      const i = Math.floor(r() * (ranked.length - 1)), j = Math.min(ranked.length - 1, i + 1 + Math.floor(r() * reach));
      const x = ranked[i], y = ranked[j];
      if (x.v === y.v || (t.skip0 && y.v === 0 && x.v === 0)) continue;
      if (t.skip0 && x.v === 0) continue;
      const key = t.label + [x.id, y.id].sort().join();
      if (seen.has(key) || qs.filter((q) => q.label === t.label).length >= 2) continue;   // at most two questions on the same stat
      seen.add(key);
      const [A, B] = r() < 0.5 ? [x, y] : [y, x];
      qs.push({ label: t.label, a: A.id, b: B.id, va: A.v, vb: B.v, show: t.show || ((v) => String(v)) });
    }
    return qs;
  }

  const TRACKS = Object.values(S.DUELS || {}).filter((d) => d.track && d.track.length > 20);
  function trackRounds(seed) {
    const r = rng(seed), pick = shuffle(TRACKS, r).slice(0, Math.min(8, TRACKS.length));
    return pick.map((d) => {
      const others = shuffle(TRACKS.filter((x) => x.round !== d.round), r).slice(0, 3);
      return { d, options: shuffle([d, ...others], r).map((x) => x.round) };
    });
  }
  function trackSvg(T, cls = "") {
    const xs = T.map((p) => p[0]), ys = T.map((p) => p[1]), x0 = Math.min(...xs), y0 = Math.min(...ys), w = Math.max(...xs) - x0, h = Math.max(...ys) - y0, pad = 40;
    const pts = T.map((p) => `${p[0]},${p[1]}`).join(" ");
    return `<svg class="tsvg ${cls}" viewBox="${x0 - pad} ${y0 - pad} ${w + 2 * pad} ${h + 2 * pad}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <polyline points="${pts}" fill="none" stroke="#2A1530" stroke-width="34" stroke-linejoin="round" stroke-linecap="round"/>
      <polyline class="draw" points="${pts}" pathLength="1" fill="none" stroke="#FF3EA5" stroke-width="12" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
  }

  /* ---------- podium predictor ---------- */
  const nextRace = () => S.CALENDAR.find((r) => !S.RESULTS.some((x) => x.round === r.round) && new Date(r.raceStart || r.date + "T23:59:00Z") > Date.now());
  const lockTime = (r) => new Date(r.raceStart || r.date + "T12:00:00Z");
  const grid = () => { const last = S.RESULTS[S.RESULTS.length - 1]; return last ? last.race.map((x) => x.id).filter((id) => driver[id]) : regulars; };
  function scorePredictions() {   // runs on every Play visit; scores any prediction whose race now has results
    const out = [];
    Object.entries(P.preds).forEach(([round, pr]) => {
      if (pr.scored) return;
      const res = S.RESULTS.find((x) => x.round === +round); if (!res) return;
      const podium = res.race.filter((x) => x.pos && x.pos <= 3).sort((a, b) => a.pos - b.pos).map((x) => x.id);
      let xp = 0, exact = 0; pr.picks.forEach((id, i) => { if (podium[i] === id) { xp += 25; exact++; } else if (podium.includes(id)) xp += 10; });
      pr.scored = true; pr.xp = xp; pr.podium = podium;
      out.push({ round: +round, xp, exact, ...award(xp, exact ? ["oracle"] : []) });
    });
    if (out.length) save();
    return out;
  }

  /* ---------- views ---------- */
  const lv = () => levelOf(P.xp);
  const lockedNote = (L) => `Unlocks at level ${L} · ${LEVELS[L - 1].name}`;

  function namePrompt(next) {
    return `<section class="play reveal"><span class="kicker">ONE F1 · PLAY</span><h1>Pick your<br><em>driver name</em></h1>
      <p class="pl-sub">It's shown to friends you challenge. It stays on this phone.</p>
      <div class="pl-card pl-namebox">${avatar(110)}
        <form data-pl-name="${esc(next)}"><input name="n" maxlength="14" autocomplete="nickname" placeholder="e.g. Shrey" value="${esc(P.name)}" required>
        <button class="btn" type="submit">Let's race</button></form></div></section>`;
  }

  function hub() {
    if (!P.name) return namePrompt("#/play");
    const scored = scorePredictions();
    const L = lv(), cur = LEVELS[L - 1], nxt = LEVELS[L], into = P.xp - cur.xp, need = nxt ? nxt.xp - cur.xp : 1;
    const pct = nxt ? Math.round((100 * into) / need) : 100;
    const nr = nextRace();
    const games = Object.entries(GAMES).map(([id, g], i) => {
      const open = L >= g.lvl, best = P.games[id] && P.games[id].best;
      const bestTxt = best == null ? "" : id === "lights" ? `Best ${best} ms` : id === "podium" ? "" : `Best ${best}${g.unit}`;
      const extra = id === "podium" && nr ? (P.preds[nr.round] ? `Picked for ${raceShort(nr.round)}` : `Next: ${raceShort(nr.round)}`) : bestTxt;
      return open
        ? `<a class="pl-game reveal" style="--i:${i}" href="#/play/${id}"><span class="pl-gtag">${g.tag}</span><b>${g.name}</b><span class="pl-gblurb">${g.blurb}</span>${extra ? `<span class="pl-gbest">${esc(extra)}</span>` : ""}<span class="pl-go">PLAY ›</span></a>`
        : `<div class="pl-game locked reveal" style="--i:${i}"><span class="pl-gtag">${g.tag}</span><b>${g.name}</b><span class="pl-gblurb">${g.blurb}</span><span class="pl-lock">🔒 ${lockedNote(g.lvl)}</span></div>`;
    }).join("");
    const road = LEVELS.map((x, i) => {
      const n = i + 1, rewards = [...Object.values(GAMES).filter((g) => g.lvl === n).map((g) => "🎮 " + g.name), ...Object.values(LIVERIES).filter((v) => v.lvl === n).map((v) => "⛑️ " + v.name)];
      if (n === 6) rewards.push("🎓 Pro mode");
      return `<li class="${L >= n ? "got" : ""} ${L === n ? "now" : ""}"><span class="pl-ln">${n}</span><b>${x.name}</b><span class="pl-lx">${x.xp} XP</span>${rewards.map((t) => `<span class="pl-rw">${esc(t)}</span>`).join("")}</li>`;
    }).join("");
    const liv = Object.entries(LIVERIES).map(([id, v]) => {
      const open = L >= v.lvl;
      return `<button type="button" class="pl-liv ${P.livery === id ? "on" : ""}" ${open ? `data-pl-livery="${id}"` : "disabled"} aria-pressed="${P.livery === id}">${avatar(54, id)}<span>${open ? esc(v.name) : "🔒 L" + v.lvl}</span></button>`;
    }).join("");
    const rivals = Object.entries(P.rivals).sort((a, b) => b[1].w + b[1].l - (a[1].w + a[1].l));
    const scoredHtml = scored.map((s) => `<div class="pl-card pl-scored reveal"><span class="kicker">PODIUM PREDICTOR · ${esc(raceShort(s.round))}</span><b>+${s.xp} XP</b> ${s.exact ? `· ${s.exact} spot${s.exact > 1 ? "s" : ""} called exactly 🔮` : ""}</div>`).join("");
    return `<section class="play">
      <div class="pl-hero reveal">
        <div class="pl-me">${avatar(96)}<div><span class="kicker">LEVEL ${L} · ${esc(cur.name.toUpperCase())}</span><h1>${esc(P.name)}</h1>
          <button type="button" class="pl-edit" data-pl-rename>Change name</button></div></div>
        <div class="pl-xp"><div class="pl-bar"><i style="width:${pct}%"></i></div>
          <div class="pl-xprow"><span><b>${P.xp}</b> XP</span><span>${nxt ? `${nxt.xp - P.xp} XP to <b>${esc(nxt.name)}</b>` : "Max level"}</span></div></div>
        <div class="pl-chips"><span>🔥 ${streak()} day streak</span><span>🏅 ${P.badges.length}/${Object.keys(BADGES).length} badges</span><span>🥊 ${rivals.reduce((s, r) => s + r[1].w, 0)} rival wins</span></div>
      </div>
      ${scoredHtml}
      <div class="sh"><span class="kicker">PICK A GAME</span><h2>Games</h2></div>
      <div class="pl-games">${games}</div>
      ${boardHtml()}
      <div class="pl-card pl-how reveal"><b>Play with friends</b><span>Finish any game and tap <em>Challenge a friend</em>. They get the same lights or questions. Beat their score to win the head-to-head.</span></div>
      ${rivals.length ? `<div class="sh"><span class="kicker">HEAD TO HEAD</span><h2>Rivals</h2></div><ul class="pl-rivals">${rivals.map(([n, r]) => `<li><b>${esc(n)}</b><span class="w">${r.w}W</span><span class="l">${r.l}L</span>${r.d ? `<span>${r.d}D</span>` : ""}</li>`).join("")}</ul>` : ""}
      <div class="sh"><span class="kicker">YOUR GARAGE</span><h2>Helmet</h2></div>
      <div class="pl-livs">${liv}</div>
      <div class="sh"><span class="kicker">LEVEL UP TO UNLOCK</span><h2>The road to champion</h2></div>
      <ol class="pl-road">${road}</ol>
      <div class="sh"><span class="kicker">COLLECT THEM ALL</span><h2>Badges</h2></div>
      <div class="pl-badges">${Object.entries(BADGES).map(([id, [ic, n, how]]) => `<div class="pl-badge ${P.badges.includes(id) ? "got" : ""}"><span>${ic}</span><b>${n}</b><small>${how}</small></div>`).join("")}</div>
      <div class="pl-card pl-how"><b>How to earn XP</b><span>Every game pays XP for how well you do. +15 for your first game each day. +25 for beating a friend's challenge. Podium Predictor pays +25 per exact spot and +10 for a driver on the podium in the wrong spot.</span></div>
      <p class="foot">Progress is saved on this phone only. Challenge links include your driver name.</p>
    </section>`;
  }

  function intro(g, ch) {
    const G = GAMES[g];
    if (!P.name) return namePrompt(location.hash);
    if (lv() < G.lvl && !ch) return `<section class="play"><div class="empty"><span class="kicker">LOCKED</span><h1>${G.name}</h1><p>${lockedNote(G.lvl)}. Play the other games to earn XP.</p><a class="btn" href="#/play">Back to Play</a></div></section>`;
    const scoreTxt = ch ? (g === "lights" ? `${ch.score} ms` : `${ch.score}${G.unit}`) : "";
    if (ch && g === "lights") { boardAdd(ch.name, ch.score); save(); }
    const proOpen = g === "hilo" && lv() >= 6 && !ch;
    return `<section class="play pl-stage" data-pl-game="${g}" ${ch ? `data-pl-ch="${ch.seed}-${ch.score}-${encodeURIComponent(ch.name)}${ch.mode ? "-" + ch.mode : ""}"` : ""}>
      <a class="pl-back" href="#/play">‹ Play</a>
      <div class="pl-intro reveal"><span class="kicker">${esc(G.tag.toUpperCase())}</span><h1>${G.name}</h1>
        ${ch ? `<div class="pl-card pl-chal"><span>🥊 Challenge from</span><b>${esc(ch.name)}</b><span>Score to beat: <b class="led">${esc(scoreTxt)}</b>${ch.mode === "pro" ? " · Pro mode" : ""}</span><small>Same ${g === "lights" ? "lights" : g === "tracks" ? "circuits" : "questions"} they had. Beat it to win.</small></div>` : ""}
        <p class="pl-sub">${G.blurb}</p>
        <button class="btn pl-start" type="button" data-pl-start="${ch && ch.mode === "pro" ? "pro" : ""}">${ch ? "Accept challenge" : "Start"}</button>
        ${g === "lights" ? boardHtml() : ""}
        ${proOpen ? `<button class="btn pl-start pl-pro" type="button" data-pl-start="pro">Pro mode 🎓</button>` : g === "hilo" && !ch ? `<p class="note">🎓 Pro mode (race-by-race questions) ${lockedNote(6).toLowerCase()}.</p>` : ""}
      </div></section>`;
  }

  function podiumView() {
    if (!P.name) return namePrompt("#/play/podium");
    if (lv() < GAMES.podium.lvl) return intro("podium");
    scorePredictions();
    const nr = nextRace();
    const past = Object.entries(P.preds).filter(([, p]) => p.scored).sort((a, b) => b[0] - a[0]);
    const pastHtml = past.length ? `<div class="sh"><span class="kicker">YOUR CALLS</span><h2>Results</h2></div>${past.map(([rd, p]) => `<div class="pl-card pl-pastpred"><b>${esc(raceShort(rd))}</b><div>${p.picks.map((id, i) => `<span class="${p.podium[i] === id ? "hit" : p.podium.includes(id) ? "near" : ""}">P${i + 1} ${esc(lastName(id))}</span>`).join("")}</div><span class="led">+${p.xp} XP</span></div>`).join("")}` : "";
    if (!nr) return `<section class="play"><a class="pl-back" href="#/play">‹ Play</a><h1>Podium Predictor</h1><p class="pl-sub">No race left to predict this season.</p>${pastHtml}</section>`;
    const mine = P.preds[nr.round], locked = Date.now() >= lockTime(nr);
    const sel = (mine && mine.picks) || [];
    const opts = grid();
    const slot = (i) => `<label class="pl-slot"><span class="led">P${i + 1}</span><select data-pl-pick="${i}" ${locked ? "disabled" : ""}><option value="">Pick a driver</option>${opts.map((id) => `<option value="${id}" ${sel[i] === id ? "selected" : ""}>${esc(lastName(id))}</option>`).join("")}</select></label>`;
    return `<section class="play"><a class="pl-back" href="#/play">‹ Play</a>
      <span class="kicker">${esc(raceByRound[nr.round].name.toUpperCase())}</span><h1>Call the<br><em>podium</em></h1>
      <p class="pl-sub">${locked ? "Picks are locked. Scored when the results land." : `Locks at the start of the race · ${lockTime(nr).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`}</p>
      <div class="pl-card pl-pods" data-pl-round="${nr.round}">${[0, 1, 2].map(slot).join("")}
        ${locked ? "" : `<button class="btn" type="button" data-pl-savepred>${mine ? "Update picks" : "Lock in picks"}</button>`}
        ${mine ? `<button class="pl-edit" type="button" data-pl-sharepred>Share my picks</button>` : ""}</div>
      <div class="pl-card pl-how"><b>Scoring</b><span>+25 XP for each driver in the exact spot. +10 XP for a driver who makes the podium in a different spot.</span></div>
      ${pastHtml}</section>`;
  }

  function view(parts) {
    const [, g, c, code] = parts;
    if (!g) return hub();
    if (g === "podium") return podiumView();
    if (!GAMES[g]) return hub();
    return intro(g, c === "c" ? decodeC(code) : null);
  }

  /* ---------- running a game (after the view is in the page) ---------- */
  let stop = () => {};
  function mount(root) {
    stop(); stop = () => {};
    const stage = root.querySelector("[data-pl-game]");
    if (!stage) return;
    stage.addEventListener("click", (e) => {
      const again = e.target.closest("[data-pl-again]");
      if (again) delete stage.dataset.plCh;                       // a rematch is a fresh game, not the friend's seed again
      const b = again || e.target.closest("[data-pl-start]"); if (!b) return;
      const ch = stage.dataset.plCh ? decodeC(stage.dataset.plCh) : null;
      const mode = again ? again.dataset.plAgain : b.dataset.plStart;
      const seed = ch ? ch.seed : newSeed();
      ({ lights: runLights, hilo: runHilo, tracks: runTracks })[stage.dataset.plGame](stage, seed, ch, mode);
    });
  }
  const buzz = (p) => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };

  function finish(stage, g, seed, score, xp, badges, ch, mode, detail) {
    const G = GAMES[g], better = (a, b) => (G.lower ? a < b : a > b);
    const gs = P.games[g] || (P.games[g] = { plays: 0, best: null });
    gs.plays++;
    const pb = gs.best == null || better(score, gs.best); if (pb) gs.best = score;
    if (g === "lights") { boardAdd(P.name, score); if (ch) boardAdd(ch.name, ch.score); }
    let verdict = "";
    if (ch) {
      const key = `${g}:${ch.seed}:${ch.name}`, fresh = !P.played.includes(key);
      const win = better(score, ch.score), draw = score === ch.score;
      if (fresh) {
        P.played = [...P.played.slice(-200), key];
        const r = P.rivals[ch.name] || (P.rivals[ch.name] = { w: 0, l: 0, d: 0 });
        if (win) { r.w++; xp += 25; badges.push("rival"); } else if (draw) r.d++; else { r.l++; xp += 5; }
      }
      verdict = `<div class="pl-verdict ${win ? "win" : draw ? "draw" : "lose"}"><b>${win ? "You win! 🏆" : draw ? "Dead heat" : `${esc(ch.name)} wins`}</b><span>${esc(P.name)} ${fmt(g, score)} · ${esc(ch.name)} ${fmt(g, ch.score)}</span>${fresh ? "" : "<small>Already played, so no XP for this rematch.</small>"}</div>`;
    }
    const a = award(xp, badges);
    const link = location.origin + location.pathname + encodeC(g, seed, score, mode);
    stage.innerHTML = `<a class="pl-back" href="#/play">‹ Play</a><div class="pl-result reveal">
      <span class="kicker">${esc(G.name.toUpperCase())}${mode === "pro" ? " · PRO" : ""}</span>
      <div class="pl-score led">${fmt(g, score)}</div>${detail || ""}${pb && !ch ? `<span class="pl-pb">New personal best</span>` : ""}
      ${verdict}
      <div class="pl-gain"><span>+${a.xp} XP</span>${a.daily ? `<span>+${a.daily} daily</span>` : ""}${a.badges.map((b) => `<span>${BADGES[b][0]} ${BADGES[b][1]}</span>`).join("")}</div>
      ${a.levelUp ? `<div class="pl-levelup">${avatar(80)}<div><span class="kicker">LEVEL UP</span><b>Level ${a.levelUp} · ${esc(LEVELS[a.levelUp - 1].name)}</b>${unlocksAt(a.levelUp)}</div></div>` : ""}
      ${g === "lights" ? `<div class="pl-boardwrap">${boardHtml()}</div>` : ""}
      <button class="btn" type="button" data-pl-share="${esc(link)}" data-pl-text="${esc(shareText(g, score, ch))}">${ch ? "Send it back" : "Challenge a friend"}</button>
      <button class="btn pl-ghost" type="button" data-pl-again="${mode || ""}">Play again</button>
    </div>`;
  }
  const fmt = (g, s) => (g === "lights" ? `${s} ms` : g === "hilo" ? `${s}/10` : `${s} pts`);
  const shareText = (g, s, ch) => g === "lights" ? `I reacted in ${s} ms to the F1 start lights 🚦 Can you beat me?` : g === "hilo" ? `I got ${s}/10 on F1 Higher or Lower${ch ? ` (vs ${ch.name})` : ""}. Same questions, your turn 👇` : `I scored ${s} pts naming F1 circuits 🗺️ Beat that 👇`;
  const unlocksAt = (n) => { const u = [...Object.values(GAMES).filter((g) => g.lvl === n).map((g) => g.name), ...Object.values(LIVERIES).filter((v) => v.lvl === n).map((v) => v.name + " helmet"), ...(n === 6 ? ["Pro mode"] : [])]; return u.length ? `<span>Unlocked: ${esc(u.join(", "))}</span>` : ""; };

  /* Lights Out: lights on one per second, out after a seeded random hold; best of 3 */
  function runLights(stage, seed, ch, mode) {
    const r = rng(seed), holds = [0, 1, 2].map(() => 0.4 + r() * 2.6), times = [];
    let attempt = 0, phase = "idle", outAt = 0, timers = [];
    stage.innerHTML = `<a class="pl-back" href="#/play">‹ Play</a><div class="pl-lights">
      <div class="pl-gantry">${[0, 1, 2, 3, 4].map(() => `<div class="pl-lamp"><i></i><i></i></div>`).join("")}</div>
      <div class="pl-pad" role="button" tabindex="0"><b class="pl-msg">Tap to start attempt 1 of 3</b><span class="pl-sub2">Tap when the lights go out</span></div>
      <div class="pl-tries">${[0, 1, 2].map(() => `<span>–</span>`).join("")}</div></div>`;
    const lamps = [...stage.querySelectorAll(".pl-lamp")], pad = stage.querySelector(".pl-pad"), msg = stage.querySelector(".pl-msg"), sub = stage.querySelector(".pl-sub2"), tries = [...stage.querySelectorAll(".pl-tries span")];
    const clear = () => { timers.forEach(clearTimeout); timers = []; };
    stop = clear;
    const go = () => {
      phase = "lights"; msg.textContent = "Wait for it…"; sub.textContent = "Don't jump the start"; lamps.forEach((l) => l.classList.remove("on"));
      lamps.forEach((l, i) => timers.push(setTimeout(() => { l.classList.add("on"); buzz(15); }, 600 + i * 1000)));
      timers.push(setTimeout(() => { lamps.forEach((l) => l.classList.remove("on")); phase = "out"; outAt = performance.now(); }, 600 + 4000 + holds[attempt] * 1000));
    };
    const record = (ms, jump) => {
      times.push(jump ? null : ms);
      tries[attempt].textContent = jump ? "JUMP" : ms + " ms"; tries[attempt].className = jump ? "bad" : ms < 200 ? "great" : "";
      attempt++;
      if (attempt < 3) { phase = "idle"; msg.textContent = jump ? "Jump start! ❌" : `${ms} ms`; sub.textContent = `Tap for attempt ${attempt + 1} of 3`; return; }
      phase = "done";
      const ok = times.filter((t) => t != null), best = ok.length ? Math.min(...ok) : 999;
      const xp = ok.length ? 10 + (best < 200 ? 30 : best < 250 ? 20 : best < 300 ? 10 : 0) : 2;
      setTimeout(() => finish(stage, "lights", seed, best, xp, best < 200 ? ["quick"] : [], ch, mode, `<p class="pl-sub">Best of three · ${times.map((t) => (t == null ? "jump" : t + " ms")).join(" · ")}<br>${best < 200 ? "F1-driver reflexes." : best < 300 ? "Solid getaway." : best === 999 ? "Three jump starts. Stewards are watching." : "Bogged down off the line."}</p>`), 700);
    };
    const tap = (e) => {
      e.preventDefault();
      if (phase === "idle") go();
      else if (phase === "lights") { clear(); lamps.forEach((l) => l.classList.remove("on")); buzz([60, 40, 60]); record(0, true); }
      else if (phase === "out") { const ms = Math.round(performance.now() - outAt); buzz(30); if (ms < 100) record(0, true); else record(ms, false); }
    };
    pad.addEventListener("pointerdown", tap);
    pad.addEventListener("keydown", (e) => { if (e.key === " " || e.key === "Enter") tap(e); });
  }

  /* Higher or Lower: 10 seeded questions from season stats; Pro adds race-by-race questions */
  function runHilo(stage, seed, ch, mode) {
    const pro = mode === "pro", qs = hiloQuestions(seed, pro);
    let i = 0, score = 0;
    const card = (id, v, q, side) => `<button type="button" class="pl-pick" data-side="${side}" style="--tc:${col(id)}">${helmet(id, { size: 74, look: side === "a" ? 5 : -5 })}<b>${esc(lastName(id))}</b><span class="pl-val led" data-v="${esc(q.show(v))}">?</span></button>`;
    const show = () => {
      const q = qs[i];
      stage.innerHTML = `<a class="pl-back" href="#/play">‹ Play</a><div class="pl-hilo">
        <div class="pl-prog"><span class="led">Q${i + 1}/10</span><span class="led">${score} ✓</span></div>
        <div class="pl-progbar"><i style="width:${i * 10}%"></i></div>
        <h2 class="pl-q">${esc(q.label)}</h2><div class="pl-vs">${card(q.a, q.va, q, "a")}<span class="pl-vsx">VS</span>${card(q.b, q.vb, q, "b")}</div></div>`;
      stage.querySelectorAll(".pl-pick").forEach((b) => b.addEventListener("click", () => answer(b.dataset.side), { once: true }));
    };
    let busy = false;
    const answer = (side) => {
      if (busy) return; busy = true;
      const q = qs[i], right = (q.va > q.vb) === (side === "a");
      if (right) score++;
      buzz(right ? 25 : [50, 30, 50]);
      stage.querySelectorAll(".pl-pick").forEach((b) => {
        b.disabled = true; const v = b.querySelector(".pl-val"); v.textContent = v.dataset.v;
        const win = (b.dataset.side === "a") === (q.va > q.vb); b.classList.add(win ? "hi" : "lo"); if (b.dataset.side === side) b.classList.add(right ? "right" : "wrong");
      });
      stage.querySelector(".pl-q").insertAdjacentHTML("afterend", `<div class="pl-flash ${right ? "ok" : "no"}">${right ? "Correct" : "Not this time"}</div>`);
      const t = setTimeout(() => { busy = false; i++; if (i < qs.length) show(); else finish(stage, "hilo", seed, score, score * 5 + (score === 10 ? 20 : 0) + (pro ? score * 2 : 0), [...(score === 10 ? ["perfect"] : []), ...(pro && score >= 8 ? ["pro"] : [])], ch, mode); }, 1300);
      stop = () => clearTimeout(t);
    };
    show();
  }

  /* Guess the Track: the outline draws in over 6 s; answer early for more points */
  function runTracks(stage, seed, ch, mode) {
    const rounds = trackRounds(seed), DRAW = 6000;
    let i = 0, score = 0, correct = 0, t0 = 0, raf = 0, done = false;
    const name = (rd) => { const c = raceByRound[rd]; return `${c.flag} ${raceShort(rd)}`; };
    const show = () => {
      const R = rounds[i]; done = false;
      stage.innerHTML = `<a class="pl-back" href="#/play">‹ Play</a><div class="pl-tracks">
        <div class="pl-prog"><span class="led">TRACK ${i + 1}/${rounds.length}</span><span class="led">${score} PTS</span></div>
        <div class="pl-tmap">${trackSvg(R.d.track)}<span class="pl-pts led">10</span></div>
        <div class="pl-opts">${R.options.map((rd) => `<button type="button" class="pl-opt" data-rd="${rd}">${esc(name(rd))}</button>`).join("")}</div></div>`;
      const line = stage.querySelector(".draw"), pts = stage.querySelector(".pl-pts");
      t0 = performance.now();
      const tick = () => {
        const p = Math.min(1, (performance.now() - t0) / DRAW);
        line.style.strokeDasharray = "1 1"; line.style.strokeDashoffset = String(1 - p);
        pts.textContent = String(Math.max(2, Math.round(10 - 8 * p)));
        if (!done) raf = requestAnimationFrame(tick);
      };
      tick();
      stage.querySelectorAll(".pl-opt").forEach((b) => b.addEventListener("click", () => pick(+b.dataset.rd, b)));
    };
    stop = () => cancelAnimationFrame(raf);
    const pick = (rd, btn) => {
      if (done) return; done = true; cancelAnimationFrame(raf);
      const R = rounds[i], right = rd === R.d.round, got = right ? Math.max(2, Math.round(10 - 8 * Math.min(1, (performance.now() - t0) / DRAW))) : 0;
      score += got; if (right) correct++;
      buzz(right ? 25 : [50, 30, 50]);
      const line = stage.querySelector(".draw"); line.style.strokeDashoffset = "0";
      stage.querySelectorAll(".pl-opt").forEach((b) => { b.disabled = true; if (+b.dataset.rd === R.d.round) b.classList.add("right"); else if (b === btn) b.classList.add("wrong"); });
      stage.querySelector(".pl-pts").textContent = right ? "+" + got : "0";
      const t = setTimeout(() => { i++; if (i < rounds.length) show(); else finish(stage, "tracks", seed, score, score + (correct === rounds.length ? 20 : 0), correct === rounds.length ? ["nerd"] : [], ch, mode, `<p class="pl-sub">${correct}/${rounds.length} circuits named</p>`); }, 1200);
      stop = () => clearTimeout(t);
    };
    show();
  }

  /* ---------- page-level clicks and forms (delegated from app.js) ---------- */
  function onClick(e) {
    const sh = e.target.closest("[data-pl-share]");
    if (sh) {
      const data = { title: "ONE F1 challenge", text: sh.dataset.plText, url: sh.dataset.plShare };
      if (navigator.share) navigator.share(data).catch(() => {});
      else if (navigator.clipboard) navigator.clipboard.writeText(`${data.text} ${data.url}`).then(() => { sh.textContent = "Link copied"; }).catch(() => {});
      return true;
    }
    const lvb = e.target.closest("[data-pl-livery]");
    if (lvb) { P.livery = lvb.dataset.plLivery; save(); return "rerender"; }
    if (e.target.closest("[data-pl-rename]")) { P.name = ""; save(); return "rerender"; }
    if (e.target.closest("[data-pl-savepred]")) {
      const box = e.target.closest("[data-pl-round]"), picks = [...box.querySelectorAll("[data-pl-pick]")].map((s) => s.value);
      if (picks.some((x) => !x) || new Set(picks).size < 3) { alert("Pick three different drivers."); return true; }
      P.preds[box.dataset.plRound] = { picks, at: Date.now() }; save(); return "rerender";
    }
    const sp = e.target.closest("[data-pl-sharepred]");
    if (sp) {
      const nr = nextRace(), p = nr && P.preds[nr.round]; if (!p) return true;
      const text = `My ${raceByRound[nr.round].name} podium: 🥇 ${lastName(p.picks[0])} 🥈 ${lastName(p.picks[1])} 🥉 ${lastName(p.picks[2])}. Yours? Call it on ONE F1 👇`;
      const url = location.origin + location.pathname + "#/play/podium";
      if (navigator.share) navigator.share({ title: "ONE F1", text, url }).catch(() => {});
      else if (navigator.clipboard) navigator.clipboard.writeText(`${text} ${url}`).then(() => { sp.textContent = "Copied"; }).catch(() => {});
      return true;
    }
    return false;
  }
  function onSubmit(e) {
    const f = e.target.closest("[data-pl-name]"); if (!f) return false;
    e.preventDefault();
    const n = f.n.value.trim().replace(/[<>-]/g, "").slice(0, 14); if (!n) return true;
    P.name = n; save();
    const next = f.dataset.plName; if (location.hash === next) return "rerender";
    location.hash = next; return true;
  }

  return { view, mount, onClick, onSubmit, stop: () => stop() };
};
