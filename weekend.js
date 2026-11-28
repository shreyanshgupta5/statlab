// Race weekend tab (#/weekend): live analysis of the current Grand Prix weekend, session by session.
// Reads OpenF1 straight from the browser once each session's data is published (usually minutes after it ends),
// so the tab fills itself in as the weekend goes on: FP1 → FP2 → FP3 → Qualifying → Race (and sprint weekends).
// Finished sessions are cached in localStorage; practice.js (built by tools/build_practice.py) is the offline fallback.
// Routes: #/weekend (overview), #/weekend/<fp1|fp2|fp3|sq|sprint|q|race>, and #/weekend/m<meeting_key>/… for any past weekend.
window.WEEKEND_INIT = function ({ S, driver, team, helmet, esc, raceByRound, sectionHead }) {
  const API = "https://api.openf1.org/v1/";
  const CACHE = "onef1.wk.v1.";
  const memo = {};
  let refresh = null, mountedFor = "";

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
    if (meetingKey) list = await get("sessions", { meeting_key: meetingKey });
    else {
      const first = (race.sessions && race.sessions[0] ? race.sessions[0].start : race.date).slice(0, 10);
      const d0 = new Date(Date.parse(first) - 864e5).toISOString().slice(0, 10), d1 = new Date(Date.parse(race.date) + 864e5).toISOString().slice(0, 10);
      list = await get("sessions", { year: race.date.slice(0, 4), "date_start>": d0, "date_start<": d1 });
    }
    const v = list.filter((s) => SLUG[s.session_name]).sort((a, b) => a.date_start.localeCompare(b.date_start))
      .map((s) => ({ key: s.session_key, meeting: s.meeting_key, name: s.session_name, slug: SLUG[s.session_name], type: s.session_type, start: s.date_start, end: s.date_end, place: s.location, year: s.year }));
    memo[key] = { t: Date.now(), v };
    return v;
  }
  // fall back to the app calendar when OpenF1 can't be reached
  const calendarSessions = (race) => (race.sessions || []).map((s) => ({ key: null, name: s.name, slug: SLUG[s.name], type: /Practice/.test(s.name) ? "Practice" : s.name.includes("Qual") ? "Qualifying" : "Race", start: s.start, end: s.end }));

  // ---------- analysis ----------
  async function loadSession(s) {
    if (memo[s.key]) return memo[s.key];
    const done = Date.now() - Date.parse(s.end) > 90 * 60e3;
    const cached = done && store.get(s.key);
    if (cached) return (memo[s.key] = cached);
    const [drivers, laps, stints, rc, weather] = await Promise.all(["drivers", "laps", "stints", "race_control", "weather"].map((ep) => get(ep, { session_key: s.key })));
    const extra = s.type === "Practice" ? [] : await get("session_result", { session_key: s.key }).catch(() => []);
    const pits = s.type === "Race" ? await get("pit", { session_key: s.key }).catch(() => []) : [];
    if (!laps.length) return null;
    const a = analyse(s, drivers, laps, stints, rc, weather, extra, pits);
    if (done) store.set(s.key, a);
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
  const tcol = (a, id) => (driver[id] && team[driver[id].team] ? team[driver[id].team].color : (a && a.colours[id]) || "#5E6470");
  const nm = (a, id) => (driver[id] ? driver[id].last : (a && a.names[id]) || id);
  const face = (id, size) => (driver[id] ? helmet(id, { size, look: 3 }) : `<span class="wk-noface" style="width:${size}px;height:${size}px">${esc(id)}</span>`);
  const TY = { SOFT: "#E8102E", MEDIUM: "#F5C400", HARD: "#E8E8E6", INTERMEDIATE: "#2FB34A", WET: "#2F7BE0" };
  const tyreDot = (c) => c ? `<i class="wk-ty" style="--ty:${TY[c] || "#888"}" title="${esc(c)}">${esc(c[0])}</i>` : "";
  const block = (kicker, title, body, note) => `${sectionHead(kicker, title, note ? `<p class="note">${note}</p>` : "")}${body}`;

  function headlines(a, prev) {
    const h = [], r = a.rows;
    if (a.quali && a.quali[0]) {
      const p = a.quali[0], q2 = a.quali[1], t = (x) => x.q.filter(Boolean).slice(-1)[0];
      h.push(`<b>${esc(nm(a, p.id))} on pole</b> with ${lapT(t(p))}${q2 ? `, ${(t(q2) - t(p)).toFixed(3)}s clear of ${esc(nm(a, q2.id))}` : ""}.`);
    } else if (a.race && a.race[0]) {
      h.push(`<b>${esc(nm(a, a.race[0].id))} wins</b>${a.race[1] && a.race[1].gap != null ? ` by ${(+a.race[1].gap).toFixed(3)}s from ${esc(nm(a, a.race[1].id))}` : ""}.`);
    } else if (r[0]) {
      h.push(`<b>${esc(nm(a, r[0].id))} fastest</b> with ${lapT(r[0].best)}${r[1] ? `, ${(r[1].best - r[0].best).toFixed(3)}s ahead of ${esc(nm(a, r[1].id))}` : ""}.`);
    }
    const within = r.filter((x) => r[0] && x.best - r[0].best < 0.5).length;
    if (!a.race && within > 2) h.push(`<b>${within} drivers within half a second</b> of the top time.`);
    if (a.runs.length >= 4) { const R = a.runs; h.push(`<b>Best race pace: ${esc(nm(a, R[0].id))}</b>, ${(R[1].pace - R[0].pace).toFixed(3)}s per lap better than ${esc(nm(a, R[1].id))} over a long run.`); }
    const lost = r.slice(0, 10).filter((x) => x.lost != null && x.lost > 0.25).sort((x, y) => y.lost - x.lost)[0];
    if (lost && !a.race) h.push(`<b>${esc(nm(a, lost.id))} left ${lost.lost.toFixed(3)}s</b> on the table: their best sectors add up to ${lapT(lost.ideal)}.`);
    const fast = [...r].sort((x, y) => y.top - x.top)[0];
    if (fast && fast.top) h.push(`<b>Top speed: ${esc(nm(a, fast.id))}, ${fast.top} km/h</b> through the speed trap.`);
    if (prev && !a.race) {
      const pp = Object.fromEntries(prev.rows.map((x, i) => [x.id, i + 1])), up = r.map((x, i) => [x, (pp[x.id] || 0) - (i + 1)]).filter(([, d]) => d >= 5).sort((x, y) => y[1] - x[1])[0];
      if (up) h.push(`<b>${esc(nm(a, up[0].id))} jumped ${up[1]} places</b> from ${SHORT[prev.slug]} (P${pp[up[0].id]} to P${r.indexOf(up[0]) + 1}).`);
    }
    if (a.flags.length) { const red = a.flags.filter((f) => /^RED/.test(f.msg)).length, sc = a.flags.length - red;
      h.push(`<b>${[red ? `${red} red flag${red > 1 ? "s" : ""}` : "", sc ? `${sc} safety car${sc > 1 ? "s" : ""}` : ""].filter(Boolean).join(" and ")}</b> interrupted the session.`); }
    return h;
  }

  function sessionView(a, prev) {
    const r = a.rows, top = r[0] ? r[0].best : 0;
    const H = headlines(a, prev);
    const head = `<ol class="wk-heads reveal">${H.map((x) => `<li>${x}</li>`).join("")}</ol>`;
    let html = head;
    if (a.quali) {
      const t = (x) => x.q.filter(Boolean).slice(-1)[0], p1 = t(a.quali[0]);
      const stage = (x) => (x.q[2] ? "Q3" : x.q[1] ? "Q2" : "Q1");
      html += block("Qualifying · the grid", "Results", `<ul class="drows reveal">${a.quali.map((x, i) => `<li class="drow wk-row" style="--tc:${tcol(a, x.id)}">
        <span class="mono dim">${x.pos}</span>${face(x.id, 28)}<b>${esc(nm(a, x.id))}</b><span class="mono r">${i ? gapT(t(x) - p1) : lapT(p1)}</span><span class="mono dim r">${i >= 10 ? "out " + stage(x) : stage(x)}</span></li>`).join("")}</ul>`);
      // team-mate gaps
      const byTeam = {}; a.quali.forEach((x) => { const tm = driver[x.id] ? driver[x.id].team : x.id; (byTeam[tm] = byTeam[tm] || []).push(x); });
      const duels = Object.values(byTeam).filter((v) => v.length === 2).map(([x, y]) => { const lv = [x.q, y.q].map((q) => q.filter(Boolean).length), k = Math.min(...lv) - 1;
        return { x, y, gap: x.q[k] && y.q[k] ? y.q[k] - x.q[k] : null, k }; }).filter((d) => d.gap != null).sort((p, q) => Math.abs(q.gap) - Math.abs(p.gap));
      html += block("Same car, same session", "Team-mate gaps", `<ul class="drows reveal">${duels.map((d) => `<li class="drow wk-duel" style="--tc:${tcol(a, d.x.id)}"><b>${esc(nm(a, d.x.id))}</b><span class="dim">beat</span><b>${esc(nm(a, d.y.id))}</b><span class="mono r">${d.gap.toFixed(3)}s</span><span class="mono dim r">Q${d.k + 1}</span></li>`).join("")}</ul>`, "Compared in the last part of qualifying both drivers reached.");
    }
    if (a.race) {
      const w = a.race[0];
      html += block("Race · classification", "Results", `<ul class="drows reveal">${a.race.map((x) => `<li class="drow wk-row" style="--tc:${tcol(a, x.id)}">
        <span class="mono dim">${x.pos || "–"}</span>${face(x.id, 28)}<b>${esc(nm(a, x.id))}</b><span class="mono r">${x.dnf ? "DNF" : x.dns ? "DNS" : x.pos === 1 ? "WIN" : x.gap != null && !isNaN(+x.gap) ? "+" + (+x.gap).toFixed(3) : esc(String(x.gap || ""))}</span><span class="mono dim r">${x.pts ? "+" + x.pts : ""}</span></li>`).join("")}</ul>`);
      const L = a.raceLaps || 1, ids = a.race.map((x) => x.id);
      html += block("Tyres · every stint", "Strategy", `<ul class="wk-strat reveal">${ids.map((id) => `<li><b>${esc(nm(a, id).slice(0, 10))}</b><span class="wk-bar">${a.stints.filter((x) => x.id === id).map((x) => `<i style="left:${(x.a - 1) / L * 100}%;width:${(x.b - x.a + 1) / L * 100}%;--ty:${TY[x.c] || "#888"}"></i>`).join("")}</span></li>`).join("")}</ul>`, `Each bar is ${L} laps; colour = compound (red soft, yellow medium, white hard).`);
      if (a.pits.length) html += block("Pit crews", "Fastest stops", `<ul class="drows reveal">${a.pits.slice(0, 5).map((p, i) => `<li class="drow wk-row" style="--tc:${tcol(a, p.id)}"><span class="mono dim">${i + 1}</span>${face(p.id, 28)}<b>${esc(nm(a, p.id))}</b><span class="mono r">${p.t.toFixed(1)}s</span><span class="mono dim r">lap ${p.lap}</span></li>`).join("")}</ul>`, "Time in the pit lane, entry to exit.");
      void w;
    }
    if (!a.quali && !a.race) {
      html += block(`${SHORT[a.slug]} · best lap per driver`, "Timesheet", `<ul class="drows reveal">${r.map((x, i) => `<li class="drow wk-row" style="--tc:${tcol(a, x.id)}">
        <span class="mono dim">${i + 1}</span>${face(x.id, 28)}<b>${esc(nm(a, x.id))}</b><span class="mono r">${i ? gapT(x.best - top) : lapT(x.best)} ${tyreDot(x.tyre)}</span><span class="mono dim r">${x.laps} laps</span></li>`).join("")}</ul>`, "Practice times hide fuel loads and engine modes: read them as a hint, not an order. Tyre = compound on the best lap.");
    }
    // race pace (practice and sprint/race long runs)
    if (a.runs.length >= 3 && !a.race) {
      const R = a.runs.slice(0, 10), r0 = R[0].pace, span = (R[R.length - 1].pace - r0) || 1;
      html += block("Long runs · 8+ clean laps", "Race pace", `<ul class="wk-runs reveal">${R.map((x, i) => `<li style="--tc:${tcol(a, x.id)}"><b>${esc(nm(a, x.id))}</b>
        <span class="wk-pbar"><i style="width:${Math.max(6, 100 - (x.pace - r0) / span * 70)}%"></i></span><span class="mono r">${i ? "+" + (x.pace - r0).toFixed(3) : lapT(x.pace)}</span>
        <span class="mono dim r">${tyreDot(x.tyre)} ${x.deg >= 0 ? "+" : "−"}${Math.abs(x.deg).toFixed(2)}</span></li>`).join("")}</ul>`,
        "Median clean-lap time of each driver's quickest long run. Last column: tyre, and how much slower each lap got (s/lap): lower means kinder on tyres. Fuel burn hides some wear.");
    }
    // ideal laps
    const ideal = r.filter((x) => x.ideal).map((x) => ({ ...x })).sort((p, q) => p.ideal - q.ideal).slice(0, 10);
    if (ideal.length >= 3) {
      const sb = a.sBest, sessIdeal = sb.every(Boolean) ? sb[0].t + sb[1].t + sb[2].t : null;
      html += block("Best sectors added up", "Ideal laps", `${sessIdeal ? `<div class="wk-secs reveal">${sb.map((x, i) => `<div style="--tc:${tcol(a, x.id)}"><span class="kicker">Sector ${i + 1}</span><b class="mono">${x.t.toFixed(3)}</b><span>${esc(nm(a, x.id))}</span></div>`).join("")}<div><span class="kicker">Ideal lap</span><b class="mono">${lapT(sessIdeal)}</b><span>${top ? (top - sessIdeal).toFixed(3) + "s under the best" : ""}</span></div></div>` : ""}
        <ul class="drows reveal">${ideal.map((x, i) => `<li class="drow wk-row" style="--tc:${tcol(a, x.id)}"><span class="mono dim">${i + 1}</span>${face(x.id, 28)}<b>${esc(nm(a, x.id))}</b><span class="mono r">${lapT(x.ideal)}</span><span class="mono dim r">${x.lost > 0.001 ? "−" + x.lost.toFixed(3) : "done"}</span></li>`).join("")}</ul>`,
        "Each driver's best three sectors from any laps. Last column: time their best lap left on the table.");
    }
    // speed trap
    const sp = r.filter((x) => x.top).sort((p, q) => q.top - p.top);
    if (sp.length >= 5) {
      const mx = sp[0].top, mn = sp[sp.length - 1].top;
      html += block("Speed trap · km/h", "Top speed", `<ul class="wk-runs reveal">${sp.slice(0, 8).concat(sp.length > 10 ? [null] : [], sp.length > 10 ? sp.slice(-2) : []).map((x) => x ? `<li style="--tc:${tcol(a, x.id)}"><b>${esc(nm(a, x.id))}</b><span class="wk-pbar"><i style="width:${30 + (x.top - mn) / ((mx - mn) || 1) * 70}%"></i></span><span class="mono r">${x.top}</span><span class="mono dim r">${x.top === mx ? "max" : "−" + (mx - x.top)}</span></li>` : `<li class="wk-gap"><span class="dim">…</span></li>`).join("")}</ul>`,
        "Fastest reading through the speed trap all session. Low numbers can mean more downforce, not less power.");
    }
    // teams
    if (a.teams.length >= 5 && !a.race) {
      const t0 = a.teams[0].best;
      html += block("Best lap per team", "Team order", `<ul class="wk-runs reveal">${a.teams.map((t) => { const col = t.colour || tcol(a, t.id);
        return `<li style="--tc:${col}"><b>${esc(t.team.replace(/ F1 Team| Racing| Formula 1 Team/g, ""))}</b><span class="wk-pbar"><i style="width:${Math.max(6, 100 - (t.best - t0) * 25)}%"></i></span><span class="mono r">${t.best === t0 ? lapT(t0) : "+" + (t.best - t0).toFixed(3)}</span><span class="mono dim r">${esc(nm(a, t.id).slice(0, 3).toUpperCase())}</span></li>`; }).join("")}</ul>`);
    }
    // tyres used
    const tot = Object.values(a.fieldTyres).reduce((x, y) => x + y, 0);
    if (tot) html += block("Tyres · laps by compound", "Tyre use", `<div class="wk-tyres reveal">${Object.entries(a.fieldTyres).sort((p, q) => q[1] - p[1]).map(([c, n]) => `<span style="--ty:${TY[c] || "#888"};flex:${n}"><b>${esc(c.toLowerCase())}</b><em class="mono">${n}</em></span>`).join("")}</div>`,
      `${tot} laps in total across the field.`);
    // session facts
    const facts = [];
    if (a.weather) facts.push(["Track", `${Math.round(a.weather.track[0])}–${Math.round(a.weather.track[1])}°`, a.weather.rain ? "rain" : "dry"], ["Air", `${Math.round(a.weather.air[0])}–${Math.round(a.weather.air[1])}°`, "°C"]);
    facts.push(["Laps run", a.totalLaps, `${r.length} drivers`]);
    const del = r.filter((x) => x.deleted).sort((p, q) => q.deleted - p.deleted);
    facts.push(["Laps deleted", del.reduce((x, y) => x + y.deleted, 0), del[0] ? `most: ${nm(a, del[0].id)} (${del[0].deleted})` : "track limits"]);
    html += `<div class="facts four reveal" style="margin-top:22px">${facts.map(([k, v, s]) => `<div><span class="kicker">${k}</span><b class="mono">${v}</b><span class="mono dim">${esc(String(s))}</span></div>`).join("")}</div>`;
    if (a.flags.length) html += `<ul class="wk-flags reveal">${a.flags.map((f) => `<li><span class="mono">${f.lap ? "Lap " + f.lap : new Date(f.t).toISOString().slice(11, 16) + " GMT"}</span>${esc(f.msg.toLowerCase().replace(/^./, (c) => c.toUpperCase()))}</li>`).join("")}</ul>`;
    return html;
  }

  function progression(list) {
    const done = list.filter((a) => a && (a.rows.length));
    if (done.length < 2) return "";
    const order = (a) => (a.quali ? a.quali.map((x) => x.id) : a.race ? a.race.map((x) => x.id) : a.rows.map((x) => x.id));
    const pos = done.map((a) => Object.fromEntries(order(a).map((id, i) => [id, i + 1])));
    const last = done[done.length - 1], ids = order(last).slice(0, 22);
    const cols = `grid-template-columns:minmax(0,1fr) repeat(${done.length},38px)`;
    return block("Position in each session", "Weekend so far", `<div class="wk-prog reveal" style="--cols:${done.length}"><div class="wk-ph" style="${cols}"><span></span>${done.map((a) => `<span>${esc(SHORT[a.slug].replace("Qualifying", "Q").replace("Sprint Quali", "SQ"))}</span>`).join("")}</div>
      ${ids.map((id) => `<div class="wk-pr" style="--tc:${tcol(last, id)};${cols}"><b>${esc(nm(last, id))}</b>${pos.map((p) => { const v = p[id]; return `<span class="mono ${v === 1 ? "p1" : v && v <= 3 ? "p3" : v && v <= 10 ? "p10" : ""}">${v || "–"}</span>`; }).join("")}</div>`).join("")}</div>`,
      "Practice order is a rough guide: teams run different fuel loads and programmes.");
  }

  // ---------- views ----------
  function parse(parts) {
    let meeting = null, slug = null;
    parts.slice(1).forEach((p) => { if (/^m\d+$/.test(p)) meeting = +p.slice(1); else slug = p; });
    return { meeting, slug };
  }
  function view(parts) {
    const { meeting, slug } = parse(parts), race = currentRace();
    const title = meeting ? "Race weekend" : race.name;
    return `<div class="page-title reveal"><span class="kicker">${meeting ? "Past weekend" : `Round ${race.round} · ${esc(race.place || "")}`} · live from OpenF1</span><h1>${meeting ? "" : race.flag + " "}${esc(title)}</h1></div>
      <div id="wk-strip" class="wk-strip reveal"></div>
      <div id="wk-body" class="wk-body" data-slug="${esc(slug || "")}"><div class="wk-loading"><span class="dim">Loading the weekend…</span></div></div>`;
  }

  function strip(sessions, slug, base, loaded) {
    const now = Date.now();
    return `<a class="wk-chip ${!slug ? "on" : ""}" href="${base}" ${!slug ? 'aria-current="true"' : ""}><b>Overview</b><span class="mono">weekend</span></a>` + sessions.map((s) => {
      const st = Date.parse(s.start), en = Date.parse(s.end), live = st <= now && now < en, done = now >= en;
      const has = loaded[s.slug];
      const state = live ? "live" : done ? (has ? "done" : "wait") : "next";
      const when = live ? "LIVE" : done ? (has ? "✓" : "soon") : new Date(st).toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" });
      return `<a class="wk-chip ${state} ${slug === s.slug ? "on" : ""}" href="${base}/${s.slug}" ${slug === s.slug ? 'aria-current="true"' : ""}><b>${esc(SHORT[s.slug])}</b><span class="mono">${esc(when)}</span></a>`;
    }).join("");
  }

  async function mount(app, parts) {
    const { meeting, slug } = parse(parts), race = currentRace();
    const base = "#/weekend" + (meeting ? "/m" + meeting : "");
    const body = app.querySelector("#wk-body"), stripEl = app.querySelector("#wk-strip");
    if (!body) return;
    const token = (mountedFor = location.hash + Date.now());
    clearInterval(refresh);
    const fallback = () => {
      const P = (window.PRACTICE || {})[race.round];
      return P ? P.sessions.map((x) => ({ key: null, name: x.name, slug: SLUG[x.name], type: "Practice", start: x.start, rows: x.best.map(([id, t, n]) => ({ id, best: t, laps: n, s: [null, null, null], top: 0, deleted: 0 })),
        runs: x.longRuns.map(([id, tyre, pace, n]) => ({ id, tyre, pace, n, deg: 0 })), teams: [], fieldTyres: {}, tyreLaps: {}, flags: [], weather: null, totalLaps: x.best.reduce((a, b) => a + b[2], 0), sBest: [null, null, null], names: x.names || {}, colours: {} })) : [];
    };
    let sessions, analyses = [], offline = false;
    try {
      sessions = await sessionsFor(meeting, race);
      if (!sessions.length) throw new Error("no sessions");
    } catch (e) { sessions = calendarSessions(race); offline = true; }
    if (token !== mountedFor) return;
    const finished = sessions.filter((s) => Date.now() > Date.parse(s.end));
    const loaded = {};
    const draw = () => {
      if (token !== mountedFor || !document.body.contains(body)) return;
      stripEl.innerHTML = strip(sessions, slug, base, loaded);
      const sel = slug ? analyses.find((a) => a && a.slug === slug) : null;
      const latest = [...analyses].reverse().find(Boolean);
      const next = sessions.find((s) => Date.now() < Date.parse(s.end));
      const nextTxt = next ? (Date.now() >= Date.parse(next.start) ? `<b>${esc(SHORT[next.slug])} is running now.</b> Its analysis appears here a few minutes after the chequered flag.`
        : `<b>Next: ${esc(SHORT[next.slug])}</b>, ${new Date(next.start).toLocaleString(undefined, { weekday: "long", hour: "2-digit", minute: "2-digit" })} your time.`) : "";
      let html = "";
      if (slug) {
        const s = sessions.find((x) => x.slug === slug);
        if (sel) html = sessionView(sel, analyses[analyses.indexOf(sel) - 1]);
        else if (s && Date.now() < Date.parse(s.end)) html = `<div class="panel wk-wait"><p>${esc(SHORT[slug])} starts ${new Date(s.start).toLocaleString(undefined, { weekday: "long", hour: "2-digit", minute: "2-digit" })} your time. Its full analysis builds here once the session is over.</p></div>`;
        else html = `<div class="panel wk-wait"><p>${offline ? "Can't reach the timing data right now. Check your connection and pull to refresh." : "Timing data for this session usually lands within minutes of the chequered flag. This page checks again every 2 minutes."}</p></div>`;
      } else {
        html = (nextTxt ? `<p class="wk-next reveal">${nextTxt}</p>` : "") +
          (latest ? `${sectionHead(`Latest · ${SHORT[latest.slug]}`, "Headlines")}<ol class="wk-heads reveal">${headlines(latest, analyses[analyses.indexOf(latest) - 1]).map((x) => `<li>${x}</li>`).join("")}</ol>
            <a class="wk-more reveal" href="${base}/${latest.slug}">Full ${esc(SHORT[latest.slug])} analysis →</a>` : `<div class="panel wk-wait"><p>Nothing has run yet this weekend. Each session's analysis appears here as soon as its timing data is out.</p></div>`) +
          progression(analyses) +
          (!meeting ? `<a class="wk-more reveal" href="#/race/${race.round}">Track history, past winners and analysis →</a>` : "");
      }
      body.innerHTML = html;
      body.querySelectorAll(".reveal").forEach((e) => e.classList.add("in"));
    };
    draw();
    if (offline) { analyses = fallback(); analyses.forEach((a) => { loaded[a.slug] = true; }); draw(); return; }
    for (const s of finished) {
      try { const a = await loadSession(s); analyses.push(a); if (a) loaded[s.slug] = true; } catch (e) { analyses.push(null); }
      if (token !== mountedFor) return;
      draw();
    }
    // keep building: re-check every 2 minutes while this page is open
    refresh = setInterval(async () => {
      if (!document.body.contains(body) || token !== mountedFor) { clearInterval(refresh); return; }
      let changed = false;
      for (const s of sessions) {
        if (Date.now() < Date.parse(s.end) || loaded[s.slug]) continue;
        try { const a = await loadSession(s); if (a) { const i = sessions.indexOf(s); analyses[i] = a; loaded[s.slug] = true; changed = true; } } catch (e) { /* not out yet */ }
      }
      analyses = sessions.filter((s) => Date.now() > Date.parse(s.end)).map((s) => memo[s.key] || null);
      if (changed || true) draw();
    }, 120e3);
  }
  function stop() { clearInterval(refresh); mountedFor = ""; }
  return { view, mount, stop };
};
