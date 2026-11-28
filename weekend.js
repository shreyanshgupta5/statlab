// Race weekend tab (#/weekend): live analysis of the current Grand Prix weekend, session by session.
// Reads OpenF1 straight from the browser once each session's data is published (usually minutes after it ends),
// so the tab fills itself in as the weekend goes on: FP1 → FP2 → FP3 → Qualifying → Race (and sprint weekends).
// Finished sessions are cached in localStorage; practice.js (built by tools/build_practice.py) is the offline fallback.
// One page: key numbers, then race / qualifying as they happen, then every practice session side by side.
// Routes: #/weekend, and #/weekend/m<meeting_key> for any past weekend (handy for testing).
window.WEEKEND_INIT = function ({ S, driver, team, helmet, esc, raceByRound, sectionHead }) {
  const API = "https://api.openf1.org/v1/";
  const CACHE = "onef1.wk.v1.";   // v84: every finished session is kept, with fetchedAt; used whenever OpenF1 is locked
  const memo = {};
  let refresh = null, mountedFor = "", locked = false;

  const SLUG = { "Practice 1": "fp1", "Practice 2": "fp2", "Practice 3": "fp3", "Sprint Qualifying": "sq", "Sprint Shootout": "sq", Sprint: "sprint", Qualifying: "q", Race: "race" };
  const SHORT = { fp1: "FP1", fp2: "FP2", fp3: "FP3", sq: "Sprint Quali", sprint: "Sprint", q: "Qualifying", race: "Race" };
  const lapT = (t) => (t == null ? "–" : `${Math.floor(t / 60)}:${(t % 60).toFixed(3).padStart(6, "0")}`);
  const gapT = (g) => (g == null ? "–" : (g >= 0 ? "+" : "−") + Math.abs(g).toFixed(3));
  const median = (a) => { const b = [...a].sort((x, y) => x - y), m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
  const slope = (ys) => { const n = ys.length, xs = ys.map((_, i) => i), mx = (n - 1) / 2, my = ys.reduce((a, b) => a + b, 0) / n;
    const num = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0), den = xs.reduce((a, x) => a + (x - mx) ** 2, 0); return den ? num / den : 0; };
  const store = { get(k) { try { return JSON.parse(localStorage.getItem(CACHE + k)); } catch (e) { return null; } },
                  set(k, v) { try { localStorage.setItem(CACHE + k, JSON.stringify(v)); } catch (e) { /* full or blocked: fine */ } } };

  // OpenF1's free API rate-limits bursts: one request at a time, ~0.4s apart, backing off on 429
  let queue = Promise.resolve();
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  function get(ep, q) {
    const url = API + ep + "?" + new URLSearchParams(q).toString().replace(/%3E/g, ">").replace(/%3C/g, "<");
    const job = queue.then(async () => {
      for (let i = 0; i < 5; i++) {
        const r = await fetch(url);
        await wait(650);
        if (r.status === 429) { await wait(1500 * (i + 1)); continue; }
        if (r.status === 404) return [];
        if (!r.ok) throw new Error(ep + " " + r.status);
        const d = await r.json();
        return Array.isArray(d) ? d : [];
      }
      throw new Error(ep + " rate limited");
    });
    queue = job.catch(() => {});
    return job;
  }

  // ---------- which weekend ----------
  function currentRace() {
    const now = Date.now(), C = S.CALENDAR;
    const live = C.find((c) => { const s = c.sessions && c.sessions[0], end = Date.parse(c.raceStart || c.date) + 36 * 3600e3;
      return s && Date.parse(s.start) - 4 * 864e5 < now && now < end; });
    return live || C.find((c) => Date.parse(c.raceStart || c.date + "T23:59:00Z") > now) || C[C.length - 1];
  }
  async function sessionsFor(meetingKey, race) {
    const key = "meet." + (meetingKey || race.round + "." + race.date);
    if (memo[key] && Date.now() - memo[key].t < 120e3) return memo[key].v;
    let list;
    try {
      if (meetingKey) list = await get("sessions", { meeting_key: meetingKey });
      else {
        const first = (race.sessions && race.sessions[0] ? race.sessions[0].start : race.date).slice(0, 10);
        const d0 = new Date(Date.parse(first) - 864e5).toISOString().slice(0, 10), d1 = new Date(Date.parse(race.date) + 864e5).toISOString().slice(0, 10);
        list = await get("sessions", { year: race.date.slice(0, 4), "date_start>": d0, "date_start<": d1 });
      }
    } catch (e) {
      // OpenF1 locks its free API while a session is live: fall back to the list saved on this phone
      const saved = store.get(key); if (saved && saved.length) { locked = true; return saved; }
      throw e;
    }
    const v = list.filter((s) => SLUG[s.session_name]).sort((a, b) => a.date_start.localeCompare(b.date_start))
      .map((s) => ({ key: s.session_key, meeting: s.meeting_key, name: s.session_name, slug: SLUG[s.session_name], type: s.session_type, start: s.date_start, end: s.date_end, place: s.location, year: s.year }));
    memo[key] = { t: Date.now(), v };
    if (v.length) store.set(key, v);
    return v;
  }
  // fall back to the app calendar when OpenF1 can't be reached
  const calendarSessions = (race) => (race.sessions || []).map((s) => ({ key: null, name: s.name, slug: SLUG[s.name], type: /Practice/.test(s.name) ? "Practice" : s.name.includes("Qual") ? "Qualifying" : "Race", start: s.start, end: s.end }));

  // ---------- analysis ----------
  async function loadSession(s) {
    if (memo[s.key]) return memo[s.key];
    // saved copy: final once it was fetched 90+ min after the flag (older saves carry no fetchedAt and were always final)
    const cached = store.get(s.key), end = Date.parse(s.end);
    if (cached && (!cached.fetchedAt || cached.fetchedAt - end > 90 * 60e3)) return (memo[s.key] = cached);
    let a;
    try {
      const [drivers, laps, stints, rc, weather] = await Promise.all(["drivers", "laps", "stints", "race_control", "weather"].map((ep) => get(ep, { session_key: s.key })));
      const extra = s.type === "Practice" ? [] : await get("session_result", { session_key: s.key }).catch(() => []);
      const pits = s.type === "Race" ? await get("pit", { session_key: s.key }).catch(() => []) : [];
      if (!laps.length) return cached || null;
      a = analyse(s, drivers, laps, stints, rc, weather, extra, pits);
    } catch (e) {
      if (cached) { locked = true; return (memo[s.key] = cached); }   // live-session lock or no signal: use what we have
      throw e;
    }
    a.fetchedAt = Date.now();
    store.set(s.key, a);
    return (memo[s.key] = a);
  }

  function analyse(s, drivers, laps, stints, rc, weather, result, pits) {
    const D = {}; drivers.forEach((d) => { D[d.driver_number] = { code: d.name_acronym, name: d.last_name || d.broadcast_name, colour: d.team_colour ? "#" + d.team_colour : null, team: d.team_name }; });
    const code = (n) => (D[n] ? D[n].code : String(n));
    const compoundAt = (n, lap) => { const st = stints.find((x) => x.driver_number === n && x.lap_start <= lap && (x.lap_end == null || lap <= x.lap_end)); return st ? st.compound : ""; };
    const per = {};
    laps.forEach((l) => {
      const p = per[l.driver_number] = per[l.driver_number] || { n: l.driver_number, laps: 0, best: null, bestLap: null, s: [null, null, null], top: 0, times: [] };
      p.laps++;
      if (l.st_speed) p.top = Math.max(p.top, l.st_speed);
      if (l.is_pit_out_lap) return;
      [l.duration_sector_1, l.duration_sector_2, l.duration_sector_3].forEach((v, i) => { if (v && (p.s[i] == null || v < p.s[i])) p.s[i] = v; });
      if (l.lap_duration) { p.times.push([l.lap_number, l.lap_duration]); if (p.best == null || l.lap_duration < p.best) { p.best = l.lap_duration; p.bestLap = l.lap_number; } }
    });
    // deleted laps (track limits) from race control
    const deleted = {}, flags = [];
    rc.forEach((m) => {
      const msg = m.message || "";
      const dm = msg.match(/CAR (\d+) \(\w+\).*DELETED/);
      if (dm) deleted[+dm[1]] = (deleted[+dm[1]] || 0) + 1;
      if (/^RED FLAG/.test(msg) || /SAFETY CAR DEPLOYED/.test(msg) || /^VIRTUAL SAFETY CAR DEPLOYED/.test(msg)) flags.push({ t: m.date, lap: m.lap_number, msg });
    });
    const rows = Object.values(per).filter((p) => p.best).map((p) => {
      const ideal = p.s.every((x) => x) ? p.s[0] + p.s[1] + p.s[2] : null;
      return { id: code(p.n), n: p.n, best: p.best, laps: p.laps, tyre: compoundAt(p.n, p.bestLap), ideal, lost: ideal ? p.best - ideal : null, s: p.s, top: p.top, deleted: deleted[p.n] || 0 };
    }).sort((a, b) => a.best - b.best);
    const sBest = [0, 1, 2].map((i) => { const r = rows.filter((x) => x.s[i]).sort((a, b) => a.s[i] - b.s[i])[0]; return r ? { id: r.id, t: r.s[i] } : null; });
    // long runs: 8+ clean laps within 4% of the stint's best; pace = median, deg = slope (s/lap)
    const runs = [];
    stints.forEach((st) => {
      if (st.lap_end == null || st.lap_end - st.lap_start < 7) return;
      const ts = (per[st.driver_number] ? per[st.driver_number].times : []).filter(([n]) => n > st.lap_start && n <= st.lap_end).map(([, t]) => t);
      if (ts.length < 6) return;
      const b = Math.min(...ts), good = ts.filter((t) => t < b * 1.04);
      if (good.length >= 8) runs.push({ id: code(st.driver_number), tyre: st.compound || "", pace: median(good), n: good.length, deg: slope(good), age: st.tyre_age_at_start || 0 });
    });
    const bestRun = {}; runs.sort((a, b) => a.pace - b.pace).forEach((r) => { if (!bestRun[r.id]) bestRun[r.id] = r; });
    // tyres: laps per compound
    const tyreLaps = {}, fieldTyres = {};
    stints.forEach((st) => { if (st.lap_end == null) return; const c = st.compound || "?", k = code(st.driver_number), n = st.lap_end - st.lap_start + 1;
      (tyreLaps[k] = tyreLaps[k] || {})[c] = (tyreLaps[k][c] || 0) + n; fieldTyres[c] = (fieldTyres[c] || 0) + n; });
    // teams: best lap per team
    const teams = {}; rows.forEach((r) => { const t = (D[r.n] && D[r.n].team) || "?"; if (!teams[t] || r.best < teams[t].best) teams[t] = { team: t, best: r.best, id: r.id, colour: D[r.n] && D[r.n].colour }; });
    weather = weather.filter((w) => w.track_temperature > 5 && w.air_temperature > 0);
    const tw = weather.length ? { track: [Math.min(...weather.map((w) => w.track_temperature)), Math.max(...weather.map((w) => w.track_temperature))],
      air: [Math.min(...weather.map((w) => w.air_temperature)), Math.max(...weather.map((w) => w.air_temperature))], rain: weather.some((w) => w.rainfall) } : null;
    const out = { key: s.key, name: s.name, slug: s.slug, type: s.type, start: s.start, rows, sBest, runs: Object.values(bestRun), tyreLaps, fieldTyres,
      teams: Object.values(teams).sort((a, b) => a.best - b.best), weather: tw, flags, totalLaps: rows.reduce((a, r) => a + r.laps, 0),
      names: Object.fromEntries(Object.values(D).map((d) => [d.code, d.name])), colours: Object.fromEntries(Object.values(D).map((d) => [d.code, d.colour])) };
    if (s.type === "Qualifying" && result.length) {
      out.quali = result.filter((r) => r.position).sort((a, b) => a.position - b.position).map((r) => ({ id: code(r.driver_number), pos: r.position, q: Array.isArray(r.duration) ? r.duration : [r.duration], dnf: r.dnf || r.dns }));
    }
    if (s.type === "Race" && result.length) {
      const grid = {}; // first known position per driver = the grid (from lap 1 order when nothing better)
      out.race = result.filter((r) => r.position || r.dnf).sort((a, b) => (a.position || 99) - (b.position || 99)).map((r) => ({ id: code(r.driver_number), pos: r.position, gap: r.gap_to_leader, laps: r.number_of_laps, dnf: r.dnf, dns: r.dns, pts: r.points || 0 }));
      out.stints = stints.filter((st) => st.lap_end != null).map((st) => ({ id: code(st.driver_number), c: st.compound || "", a: st.lap_start, b: st.lap_end }));
      out.pits = pits.filter((p) => p.pit_duration).map((p) => ({ id: code(p.driver_number), lap: p.lap_number, t: p.pit_duration })).sort((a, b) => a.t - b.t);
      out.raceLaps = Math.max(...out.race.map((r) => r.laps || 0));
      void grid;
    }
    return out;
  }

  // ---------- rendering helpers ----------
  const tcol = (a, id) => (driver[id] && team[driver[id].team] ? team[driver[id].team].color : (a && a.colours && a.colours[id]) || "#5E6470");
  const nm = (a, id) => (driver[id] ? driver[id].last : (a && a.names && a.names[id]) || id);
  const face = (id, size) => (driver[id] ? helmet(id, { size, look: 3 }) : `<span class="wk-noface" style="width:${size}px;height:${size}px">${esc(id)}</span>`);
  const TY = { SOFT: "#E8102E", MEDIUM: "#F5C400", HARD: "#E8E8E6", INTERMEDIATE: "#2FB34A", WET: "#2F7BE0" };
  const tyreDot = (c) => c ? `<i class="wk-ty" style="--ty:${TY[c] || "#888"}" title="${esc(c)}">${esc(c[0])}</i>` : "";
  const block = (id, kicker, title, body, note) => `<section id="${id}" class="wk-sec">${sectionHead(kicker, title, note ? `<p class="note">${note}</p>` : "")}${body}</section>`;
  const tile = (k, v, who, sub, col) => `<div class="wk-tile" style="--tc:${col || "var(--red)"}"><span class="kicker">${k}</span><b class="mono">${v}</b><span class="wk-who">${who || ""}</span>${sub ? `<span class="mono dim">${sub}</span>` : ""}</div>`;
  const SH = (slug) => ({ fp1: "FP1", fp2: "FP2", fp3: "FP3", sq: "SQ", sprint: "SPR", q: "Q", race: "RACE" }[slug] || slug);
  // a merged lookup of names / colours over every loaded session (reserve drivers appear in one session only)
  const meta = (list) => ({ names: Object.assign({}, ...list.map((a) => a.names || {})), colours: Object.assign({}, ...list.map((a) => a.colours || {})) });

  // ---------- key numbers (no prose: one number per tile) ----------
  function keyTiles(P, Q, R, M) {
    const t = [];
    if (R && R.race && R.race[0]) { const w = R.race[0], s = R.race[1];
      t.push(tile(R.slug === "sprint" ? "Sprint winner" : "Winner", esc(nm(M, w.id).toUpperCase()), "", s && s.gap != null ? `by ${(+s.gap).toFixed(3)}s` : "", tcol(M, w.id))); }
    if (Q && Q.quali && Q.quali[0]) { const lt = (x) => x.q.filter(Boolean).slice(-1)[0], p = Q.quali[0], q2 = Q.quali[1];
      t.push(tile(Q.slug === "sq" ? "Sprint pole" : "Pole", lapT(lt(p)), esc(nm(M, p.id)), q2 ? `+${(lt(q2) - lt(p)).toFixed(3)} ${esc(nm(M, q2.id))}` : "", tcol(M, p.id))); }
    if (P.length) {
      const all = P.flatMap((a) => a.rows.map((r) => ({ ...r, s: a.slug })));
      const best = {}; all.forEach((r) => { if (!best[r.id] || r.best < best[r.id].best) best[r.id] = r; });
      const order = Object.values(best).sort((a, b) => a.best - b.best), f = order[0], g = order[1];
      if (f) t.push(tile("Fastest practice lap", lapT(f.best), esc(nm(M, f.id)), SH(f.s), tcol(M, f.id)));
      if (g) t.push(tile("Gap to P2", "+" + (g.best - f.best).toFixed(3), esc(nm(M, g.id)), SH(g.s), tcol(M, g.id)));
      t.push(tile("Within 0.5s", order.filter((x) => x.best - f.best < 0.5).length, "drivers", "of the fastest lap"));
      const runs = P.flatMap((a) => a.runs.map((r) => ({ ...r, s: a.slug }))).sort((a, b) => a.pace - b.pace);
      if (runs[0]) t.push(tile("Best long run", lapT(runs[0].pace), esc(nm(M, runs[0].id)), `${SH(runs[0].s)} · ${runs[0].n} laps · ${(runs[0].tyre || "").toLowerCase()}`, tcol(M, runs[0].id)));
      const sp = all.filter((r) => r.top).sort((a, b) => b.top - a.top)[0];
      if (sp) t.push(tile("Top speed", sp.top + "", esc(nm(M, sp.id)), `km/h · ${SH(sp.s)}`, tcol(M, sp.id)));
      t.push(tile("Practice laps", P.reduce((a, x) => a + x.totalLaps, 0), `${P.length} session${P.length > 1 ? "s" : ""}`, ""));
      const red = P.reduce((a, x) => a + x.flags.filter((f2) => /^RED/.test(f2.msg)).length, 0);
      t.push(tile("Red flags", red, "", P.map((a) => `${SH(a.slug)} ${a.flags.filter((f2) => /^RED/.test(f2.msg)).length}`).join(" · ")));
    }
    return t.length ? `<div class="wk-tiles reveal">${t.join("")}</div>` : "";
  }

  // ---------- practice: every session side by side ----------
  function practiceBlock(P, M) {
    if (!P.length) return "";
    const n = P.length, cols = `grid-template-columns:minmax(0,1fr) repeat(${n},${n > 2 ? 50 : 62}px) 64px`;
    const pos = P.map((a) => Object.fromEntries(a.rows.map((r, i) => [r.id, { p: i + 1, g: r.best - a.rows[0].best, r }])));
    const best = {}; P.forEach((a) => a.rows.forEach((r) => { if (!best[r.id] || r.best < best[r.id].best) best[r.id] = { best: r.best, s: a.slug }; }));
    const ids = Object.keys(best).sort((a, b) => best[a].best - best[b].best), b0 = best[ids[0]].best;
    const head = (extra) => `<div class="wk-th" style="${cols}"><span>Driver</span>${P.map((a) => `<span>${SH(a.slug)}</span>`).join("")}<span>${extra}</span></div>`;
    let html = "";
    // 1. timesheet
    html += block("wk-practice", `Practice · ${P.map((a) => SH(a.slug)).join(" + ")}`, "Timesheet", `<div class="wk-table reveal">${head("Best")}${ids.map((id) => `<div class="wk-tr" style="${cols};--tc:${tcol(M, id)}">
      <b>${esc(nm(M, id))}</b>${pos.map((p) => { const c = p[id]; return c ? `<span class="wk-c ${c.p === 1 ? "p1" : c.p <= 3 ? "p3" : ""}"><em>${c.p}</em><small>${c.p === 1 ? lapT(c.r.best).slice(2) : "+" + c.g.toFixed(3)}</small></span>` : `<span class="wk-c dim">–</span>`; }).join("")}
      <span class="wk-c"><em class="mono">${best[id].best === b0 ? lapT(b0) : "+" + (best[id].best - b0).toFixed(3)}</em><small>${SH(best[id].s)}</small></span></div>`).join("")}</div>`,
      "Position and gap to the fastest in each session; last column: each driver's best lap of the weekend. Fuel and engine modes vary in practice.");
    // 2. race pace
    const runs = {}; P.forEach((a) => a.runs.forEach((r) => { if (!runs[r.id] || r.pace < runs[r.id].pace) runs[r.id] = { ...r, s: a.slug }; }));
    const R = Object.values(runs).sort((a, b) => a.pace - b.pace);
    if (R.length >= 3) { const r0 = R[0].pace, span = (R[Math.min(R.length, 12) - 1].pace - r0) || 1;
      html += block("wk-pace", "Long runs · 8+ clean laps", "Race pace", `<div class="wk-table reveal"><div class="wk-th wk-pace-row"><span>Driver</span><span></span><span>Pace</span><span>Deg</span><span>Run</span></div>
        ${R.slice(0, 14).map((x, i) => `<div class="wk-tr wk-pace-row" style="--tc:${tcol(M, x.id)}"><b>${esc(nm(M, x.id))}</b><span class="wk-pbar"><i style="width:${Math.max(6, 100 - Math.min(1, (x.pace - r0) / span) * 75)}%"></i></span>
        <span class="mono r">${i ? "+" + (x.pace - r0).toFixed(3) : lapT(x.pace)}</span><span class="mono r ${x.deg > 0.15 ? "hot" : ""}">${x.deg >= 0 ? "+" : "−"}${Math.abs(x.deg).toFixed(2)}</span><span class="mono dim r">${tyreDot(x.tyre)}${x.n}·${SH(x.s)}</span></div>`).join("")}</div>`,
        "Median clean lap of each driver's quickest long run across practice. Deg = seconds lost per lap over the run (fuel burn hides some). Run = tyre, laps, session."); }
    // 4. speed trap per session
    const top = {}; P.forEach((a, k) => a.rows.forEach((r) => { (top[r.id] = top[r.id] || Array(n).fill(null))[k] = r.top || null; }));
    const TS = Object.entries(top).map(([id, v]) => ({ id, v, mx: Math.max(...v.filter(Boolean)) })).filter((x) => isFinite(x.mx)).sort((a, b) => b.mx - a.mx);
    if (TS.length >= 5) { const colsS = `grid-template-columns:minmax(0,1fr) repeat(${n},50px) 54px`, smax = P.map((_, k) => Math.max(...TS.map((x) => x.v[k] || 0)));
      html += block("wk-speed", "Speed trap · km/h", "Top speed", `<div class="wk-table reveal"><div class="wk-th" style="${colsS}"><span>Driver</span>${P.map((a) => `<span>${SH(a.slug)}</span>`).join("")}<span>Max</span></div>
        ${TS.map((x) => `<div class="wk-tr" style="${colsS};--tc:${tcol(M, x.id)}"><b>${esc(nm(M, x.id))}</b>${x.v.map((v, k) => `<span class="mono r ${v && v === smax[k] ? "hot" : "dim"}">${v || "–"}</span>`).join("")}<span class="mono r">${x.mx}</span></div>`).join("")}</div>`,
        "Highest speed-trap reading per session. Low numbers can mean a high-downforce wing, not a weak engine."); }
    // 5. team order per session
    const teams = {}; P.forEach((a, k) => a.teams.forEach((t) => { (teams[t.team] = teams[t.team] || { team: t.team, id: t.id, colour: t.colour, v: Array(n).fill(null) }).v[k] = t.best - a.teams[0].best; }));
    const TO = Object.values(teams).sort((a, b) => (a.v[n - 1] ?? 9) - (b.v[n - 1] ?? 9));
    if (TO.length >= 5) { const colsT = `grid-template-columns:minmax(0,1fr) repeat(${n},62px)`;
      html += block("wk-teams", "Best lap per team", "Team order", `<div class="wk-table reveal"><div class="wk-th" style="${colsT}"><span>Team</span>${P.map((a) => `<span>${SH(a.slug)}</span>`).join("")}</div>
        ${TO.map((t) => `<div class="wk-tr" style="${colsT};--tc:${t.colour || tcol(M, t.id)}"><b>${esc(t.team.replace(/ F1 Team| Racing| Formula 1 Team| Team/g, ""))}</b>${t.v.map((v) => `<span class="mono r ${v === 0 ? "hot" : ""}">${v == null ? "–" : v === 0 ? "P1" : "+" + v.toFixed(3)}</span>`).join("")}</div>`).join("")}</div>`,
        "Gap from each team's best lap to the fastest team, session by session (sorted by the latest)."); }
    // 6. tyres + conditions per session
    html += block("wk-cond", "Per session", "Tyres & conditions", `<div class="wk-table reveal"><div class="wk-th wk-cond-row"><span>Session</span><span>Laps</span><span>Track</span><span>Air</span><span>Del.</span><span>Red</span></div>
      ${P.map((a) => `<div class="wk-tr wk-cond-row"><b>${SH(a.slug)}</b><span class="mono r">${a.totalLaps}</span><span class="mono r">${a.weather ? Math.round(a.weather.track[0]) + "–" + Math.round(a.weather.track[1]) + "°" : "–"}</span><span class="mono r">${a.weather ? Math.round(a.weather.air[0]) + "–" + Math.round(a.weather.air[1]) + "°" : "–"}</span><span class="mono r">${a.rows.reduce((x, r) => x + (r.deleted || 0), 0)}</span><span class="mono r">${a.flags.filter((f) => /^RED/.test(f.msg)).length}</span></div>
        <div class="wk-tyrebar">${Object.entries(a.fieldTyres).sort((x, y) => y[1] - x[1]).map(([c, k]) => `<span style="--ty:${TY[c] || "#888"};flex:${k}">${esc(c[0])} ${k}</span>`).join("")}</div>`).join("")}</div>`,
      "Laps run, temperature ranges (°C), laps deleted for track limits, red flags, and laps on each compound (S/M/H).");
    return html;
  }

  // ---------- qualifying (or sprint qualifying) ----------
  function qualiBlock(Q, M) {
    if (!Q || !Q.quali) return "";
    const lt = (x) => x.q.filter(Boolean).slice(-1)[0], p1 = lt(Q.quali[0]), id = Q.slug === "sq" ? "wk-sq" : "wk-q";
    const stage = (x) => (x.q[2] ? 3 : x.q[1] ? 2 : 1);
    const cols = "grid-template-columns:20px minmax(0,1fr) 54px 54px 54px 54px";
    let html = block(id, Q.slug === "sq" ? "Sprint qualifying" : "Qualifying · the grid", "Results", `<div class="wk-table reveal"><div class="wk-th n1" style="${cols}"><span>#</span><span>Driver</span><span>Q1</span><span>Q2</span><span>Q3</span><span>Gap</span></div>
      ${Q.quali.map((x, i) => `<div class="wk-tr ${i === 9 || i === 15 ? "cut" : ""}" style="${cols};--tc:${tcol(M, x.id)}"><span class="mono dim">${x.pos}</span><b title="${esc(nm(M, x.id))}">${esc(x.id)}</b>${[0, 1, 2].map((k) => `<span class="mono r ${k < stage(x) - 1 ? "dim" : ""}">${x.q[k] ? lapT(x.q[k]).slice(2) : "–"}</span>`).join("")}<span class="mono r">${i ? "+" + (lt(x) - p1).toFixed(3) : "POLE"}</span></div>`).join("")}</div>`,
      "Lap times in each part (minutes dropped); lines mark the Q3 and Q2 cut. Gap to pole uses each driver's last part.");
    const byTeam = {}; Q.quali.forEach((x) => { const tm = driver[x.id] ? driver[x.id].team : x.id; (byTeam[tm] = byTeam[tm] || []).push(x); });
    const duels = Object.values(byTeam).filter((v) => v.length === 2).map(([x, y]) => { const k = Math.min(x.q.filter(Boolean).length, y.q.filter(Boolean).length) - 1;
      return { x, y, gap: x.q[k] && y.q[k] ? y.q[k] - x.q[k] : null, k }; }).filter((d) => d.gap != null).sort((p, q) => q.gap - p.gap);
    if (duels.length) html += block(id + "-tm", "Same car", "Team-mate gaps", `<div class="wk-table reveal">${duels.map((d) => `<div class="wk-tr wk-duel" style="--tc:${tcol(M, d.x.id)}"><b>${esc(nm(M, d.x.id))}</b><span class="wk-pbar"><i style="width:${Math.min(100, 8 + d.gap * 150)}%"></i></span><span class="mono r">${d.gap.toFixed(3)}</span><span class="dim r">${esc(nm(M, d.y.id))}</span><span class="mono dim r">Q${d.k + 1}</span></div>`).join("")}</div>`,
      "Faster driver, gap, slower driver, compared in the last part both reached.");
    return html;
  }

  // ---------- race (or sprint) ----------
  function raceBlock(R, Q, M) {
    if (!R || !R.race) return "";
    const id = R.slug === "sprint" ? "wk-sprint" : "wk-race", grid = Q && Q.quali ? Object.fromEntries(Q.quali.map((x) => [x.id, x.pos])) : {};
    const cols = "grid-template-columns:22px minmax(0,1fr) 34px 76px 34px";
    let html = block(id, R.slug === "sprint" ? "Sprint" : "Race · classification", "Results", `<div class="wk-table reveal"><div class="wk-th n1" style="${cols}"><span>#</span><span>Driver</span><span>Grid</span><span>Gap</span><span>Pts</span></div>
      ${R.race.map((x) => { const g = grid[x.id], d = g && x.pos ? g - x.pos : null;
        return `<div class="wk-tr" style="${cols};--tc:${tcol(M, x.id)}"><span class="mono dim">${x.pos || "–"}</span><b>${esc(nm(M, x.id))}</b><span class="mono r ${d > 0 ? "up" : d < 0 ? "down" : "dim"}">${g ? (d ? (d > 0 ? "▲" : "▼") + Math.abs(d) : "=") : ""}</span>
        <span class="mono r">${x.dnf ? "DNF" : x.dns ? "DNS" : x.pos === 1 ? "WIN" : x.gap != null && !isNaN(+x.gap) ? "+" + (+x.gap).toFixed(3) : esc(String(x.gap || ""))}</span><span class="mono r">${x.pts || ""}</span></div>`; }).join("")}</div>`,
      Q ? "Grid column: places gained or lost from the qualifying position." : "");
    const L = R.raceLaps || 1;
    html += block(id + "-strat", "Every stint", "Strategy", `<div class="wk-strat reveal">${R.race.map((x) => `<div><b>${esc(nm(M, x.id))}</b><span class="wk-bar">${R.stints.filter((s) => s.id === x.id).map((s) => `<i style="left:${(s.a - 1) / L * 100}%;width:${(s.b - s.a + 1) / L * 100}%;--ty:${TY[s.c] || "#888"}"></i>`).join("")}</span><span class="mono dim r">${Math.max(0, R.stints.filter((s) => s.id === x.id).length - 1)}</span></div>`).join("")}</div>`,
      `${L} laps; colour = compound (red soft, yellow medium, white hard); number = stops.`);
    if (R.pits.length) html += block(id + "-pits", "Pit lane time", "Fastest stops", `<div class="wk-table reveal">${R.pits.slice(0, 6).map((p, i) => `<div class="wk-tr wk-il-row" style="--tc:${tcol(M, p.id)}"><span class="mono dim">${i + 1}</span><b>${esc(nm(M, p.id))}</b><span class="mono r">${p.t.toFixed(1)}s</span><span class="mono dim r">lap ${p.lap}</span><span></span></div>`).join("")}</div>`);
    const fl = R.rows[0];
    if (fl) html += `<div class="wk-tiles reveal" style="margin-top:12px">${tile("Fastest lap", lapT(fl.best), esc(nm(M, fl.id)), "", tcol(M, fl.id))}${tile("Top speed", Math.max(...R.rows.map((r) => r.top || 0)), "km/h", "")}${tile("Safety cars", R.flags.filter((f) => /SAFETY/.test(f.msg)).length, "incl. VSC", "")}${tile("Red flags", R.flags.filter((f) => /^RED/.test(f.msg)).length, "", "")}</div>`;
    return html;
  }

  // ---------- view + mount ----------
  function parse(parts) { let meeting = null; parts.slice(1).forEach((p) => { if (/^m\d+$/.test(p)) meeting = +p.slice(1); }); return { meeting }; }
  function view(parts) {
    const { meeting } = parse(parts), race = currentRace();
    return `<div class="page-title reveal"><span class="kicker">${meeting ? "Past weekend" : `Round ${race.round} · ${esc(race.place || "")}`} · OpenF1 timing</span><h1>${meeting ? "Race weekend" : race.flag + " " + esc(race.name)}</h1></div>
      <div id="wk-strip" class="wk-strip reveal"></div><div id="wk-body" class="wk-body"><div class="wk-loading"><span class="dim">Loading the weekend…</span></div></div>`;
  }
  function strip(sessions, loaded) {
    const now = Date.now();
    return sessions.map((s) => {
      const st = Date.parse(s.start), en = Date.parse(s.end), live = st <= now && now < en, done = now >= en, has = loaded[s.slug];
      const state = live ? "live" : done ? (has ? "done" : "wait") : "next";
      const when = live ? "LIVE" : done ? (has ? "✓ data" : "soon") : new Date(st).toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" });
      const target = { fp1: "wk-practice", fp2: "wk-practice", fp3: "wk-practice", sq: "wk-sq", sprint: "wk-sprint", q: "wk-q", race: "wk-race" }[s.slug];
      return `<button type="button" class="wk-chip ${state}" data-jump="${target}"><b>${esc(SH(s.slug) === "Q" ? "QUALI" : SH(s.slug))}</b><span class="mono">${esc(when)}</span></button>`;
    }).join("");
  }

  async function mount(app, parts) {
    const { meeting } = parse(parts), race = currentRace();
    const body = app.querySelector("#wk-body"), stripEl = app.querySelector("#wk-strip");
    if (!body) return;
    const token = (mountedFor = location.hash + Date.now());
    clearInterval(refresh);
    stripEl.addEventListener("click", (e) => { const b = e.target.closest("[data-jump]"); const t = b && document.getElementById(b.dataset.jump); if (t) scrollTo({ top: t.getBoundingClientRect().top + scrollY - 70, behavior: "smooth" }); });
    let sessions, offline = false;
    try { sessions = await sessionsFor(meeting, race); if (!sessions.length) throw new Error("none"); }
    catch (e) { sessions = calendarSessions(race); offline = true; }
    if (token !== mountedFor) return;
    const got = {}, loaded = {};
    if (offline) {
      const P = (window.PRACTICE || {})[race.round];
      (P ? P.sessions : []).forEach((x) => { const slug = SLUG[x.name]; loaded[slug] = true;
        got[slug] = { slug, type: "Practice", rows: x.best.map(([id, t, n]) => ({ id, best: t, laps: n, s: [null, null, null], top: 0, deleted: 0 })),
          runs: x.longRuns.map(([id, tyre, pace, n]) => ({ id, tyre, pace, n, deg: 0 })), teams: [], fieldTyres: {}, flags: Array.from({ length: x.redFlags || 0 }, () => ({ msg: "RED FLAG" })), weather: null, totalLaps: x.best.reduce((a, b) => a + b[2], 0), sBest: [null, null, null], names: x.names || {}, colours: {} }; });
    }
    const draw = () => {
      if (token !== mountedFor || !document.body.contains(body)) return;
      stripEl.innerHTML = strip(sessions, loaded);
      const list = sessions.map((s) => got[s.slug]).filter(Boolean), M = meta(list);
      const P = list.filter((a) => a.type === "Practice");
      const Q = got.q || null, SQ = got.sq || null, R = got.race || null, SP = got.sprint || null;
      const next = sessions.find((s) => Date.now() < Date.parse(s.end));
      const nextTile = next ? `<div class="wk-next reveal"><span class="kicker">${Date.now() >= Date.parse(next.start) ? "Running now" : "Next session"}</span><b>${esc(SHORT[next.slug])}</b>
        <span class="mono">${new Date(next.start).toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" })}</span><span class="mono dim">${Date.now() >= Date.parse(next.start) ? "data a few min after the flag" : "your time"}</span></div>` : "";
      const anyDone = list.length;
      const lockNote = locked || offline ? `<p class="wk-lock reveal">Live timing is locked while a session runs. Showing the data saved on this phone; it refreshes by itself after the flag.</p>` : "";
      body.innerHTML = nextTile + lockNote + (anyDone ? keyTiles(P, Q || SQ, R || SP, M) + raceBlock(R, Q, M) + qualiBlock(Q, M) + raceBlock(SP, SQ, M) + qualiBlock(SQ, M) + practiceBlock(P, M)
        : `<div class="panel wk-wait"><p>${offline ? "Can't reach the timing data right now (it is locked during live sessions). Trying again every 2 minutes." : "Nothing has run yet. Each session's numbers appear here a few minutes after it ends."}</p></div>`)
        + (!meeting ? `<a class="wk-more reveal" href="#/race/${race.round}">Track history and past races →</a>` : "");
      body.querySelectorAll(".reveal").forEach((e) => e.classList.add("in"));
    };
    draw();
    if (offline) { refresh = setInterval(() => { if (document.body.contains(body) && token === mountedFor) mount(app, parts); else clearInterval(refresh); }, 120e3); return; }
    const fetchDone = async () => {
      let changed = false;
      for (const s of sessions) {
        if (Date.now() < Date.parse(s.end) || loaded[s.slug]) continue;
        try { const a = await loadSession(s); if (a) { got[s.slug] = a; loaded[s.slug] = true; changed = true; } } catch (e) { /* not published yet */ }
        if (token !== mountedFor) return;
        if (changed) draw();
      }
      draw();
    };
    await fetchDone();
    refresh = setInterval(() => { if (!document.body.contains(body) || token !== mountedFor) { clearInterval(refresh); return; } fetchDone(); }, 120e3);
  }
  function stop() { clearInterval(refresh); mountedFor = ""; }

  // ---------- home page: the latest finished session of the current weekend, live ----------
  const agoTxt = (t) => { const m = Math.round((Date.now() - t) / 60e3); return m < 60 ? `${m} min ago` : m < 48 * 60 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`; };
  async function homeLast(el, notBefore) {
    if (!el) return;
    const race = currentRace();
    let sessions; try { sessions = await sessionsFor(null, race); } catch (e) { return; }
    const last = sessions.filter((x) => Date.now() > Date.parse(x.end)).pop();
    if (!last || Date.parse(last.end) <= (notBefore || 0)) return;
    let a; try { a = await loadSession(last); } catch (e) { return; }
    if (!a || !document.body.contains(el)) return;
    const M = { names: a.names, colours: a.colours };
    const teamName = (id) => (driver[id] && team[driver[id].team] ? team[driver[id].team].name : "");
    const row = (pos, id, val, sub, win) => `<li class="ls-row ${win ? "win" : ""}" style="--tc:${tcol(M, id)}"><span class="ls-pos num">${pos}</span>
      <span class="ls-who"><b>${esc(nm(M, id))}</b><small>${esc(teamName(id))}</small></span><span class="ls-val"><b class="num">${val}</b>${sub ? `<small>${sub}</small>` : ""}</span></li>`;
    let rows = "", facts = [];
    if (a.race) {
      rows = a.race.slice(0, 3).map((x, i) => row(i + 1, x.id, i ? (x.gap != null && !isNaN(+x.gap) ? "+" + (+x.gap).toFixed(3) + "s" : esc(String(x.gap || ""))) : "WIN", "", !i)).join("");
    } else if (a.quali) {
      const lt = (x) => x.q.filter(Boolean).slice(-1)[0], p = lt(a.quali[0]);
      rows = a.quali.slice(0, 3).map((x, i) => row(i + 1, x.id, i ? "+" + (lt(x) - p).toFixed(3) : lapT(p), i ? "" : "pole lap", !i)).join("");
    } else {
      const r = a.rows, t0 = r[0] ? r[0].best : 0;
      rows = r.slice(0, 3).map((x, i) => row(i + 1, x.id, i ? "+" + (x.best - t0).toFixed(3) : lapT(x.best), `${x.laps} laps`, !i)).join("");
      if (a.runs[0]) facts.push(`Best long run: ${esc(nm(M, a.runs[0].id))} ${lapT(a.runs[0].pace)}`);
    }
    const red = a.flags.filter((f) => /^RED/.test(f.msg)).length; if (red) facts.push(`${red} red flag${red > 1 ? "s" : ""}`);
    el.innerHTML = `<a class="latest" href="#/weekend">
      <span class="ls-head"><span class="ls-latest">Latest session · ${agoTxt(Date.parse(last.end))}</span>
        <span class="kicker"><b class="pill">${esc(SHORT[last.slug])}</b> · Round ${race.round} · ${new Date(last.start).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}</span>
        <h1>${race.flag} ${esc(last.place || race.place || "")}</h1><span class="ls-go" aria-hidden="true">→</span></span>
      <ol class="ls-rows">${rows}</ol>${facts.length ? `<p class="ls-note mono">${facts.join(" · ")}</p>` : ""}</a>`;
  }
  return { view, mount, stop, homeLast };
};
