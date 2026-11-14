"""2026-only evidence for 'Who wins Vegas?'. Reads predict/cache/ (fetch_2026.py) and writes predict/findings.json.
Usage: python3 explained/predict/analyse_2026.py"""
import json, os, glob, statistics as st
from collections import defaultdict
D = os.path.dirname(os.path.abspath(__file__)); C = os.path.join(D, "cache")
J = lambda n: json.load(open(os.path.join(C, n + ".json")))
med = lambda xs: st.median(xs) if xs else None
ses = sorted([s for s in J("sessions") if os.path.exists(os.path.join(C, f'{s["session_name"][0]}_{s["session_key"]}_laps.json'))
              and s["session_name"] in ("Race", "Qualifying")], key=lambda s: s["date_start"])
TEAM_SHORT = {"Mercedes": "MER", "Red Bull Racing": "RBR", "Ferrari": "FER", "McLaren": "MCL", "Aston Martin": "AMR", "Alpine": "ALP", "Williams": "WIL",
              "Racing Bulls": "RB", "Haas F1 Team": "HAA", "Kick Sauber": "SAU", "Audi": "AUD", "Cadillac": "CAD"}
LOWDF = ("Monza", "Baku", "Las Vegas")

def load(s):
    t = f'{s["session_name"][0]}_{s["session_key"]}'
    drv = {d["driver_number"]: d for d in J(t + "_drivers")}
    w = [x["track_temperature"] for x in J(t + "_weather") if x.get("track_temperature") is not None]
    if s["session_name"] == "Race" and len(w) > 10: w = w[4:]           # skip the grid-heat readings at the start
    return t, drv, (med(w) if w else None), J(t + "_laps"), J(t + "_stints"), J(t + "_session_result")

team_of = lambda drv, n: TEAM_SHORT.get((drv.get(n) or {}).get("team_name"), (drv.get(n) or {}).get("team_name") or "?")
code_of = lambda drv, n: (drv.get(n) or {}).get("name_acronym") or str(n)

quali, race, warm, speed, form_pts, qpos = [], [], defaultdict(list), [], defaultdict(list), defaultdict(list)
for s in ses:
    t, drv, temp, laps, stints, res = load(s)
    loc = s["location"]
    if s["session_name"] == "Qualifying":
        best = defaultdict(lambda: 1e9)
        for l in laps:
            if l.get("lap_duration"): best[team_of(drv, l["driver_number"])] = min(best[team_of(drv, l["driver_number"])], l["lap_duration"])
        pole = min(best.values()) if best else None
        if pole: quali.append({"loc": loc, "temp": temp, "gap": {k: 100 * (v / pole - 1) for k, v in best.items() if v < 1e8}})
        for r in res:
            if r.get("position"): qpos[code_of(drv, r["driver_number"])].append(r["position"])
        continue
    # race: clean-lap pace per team (no lap 1, no pit in/out laps, within 107% of the driver's own median)
    by = defaultdict(list)
    for l in laps:
        if l.get("lap_duration") and l["lap_number"] > 1 and not l.get("is_pit_out_lap"): by[l["driver_number"]].append(l)
    pitin = {(x["driver_number"], x["lap_end"]) for x in stints}
    tpace = defaultdict(list)
    for n, ls in by.items():
        m = med([l["lap_duration"] for l in ls])
        clean = [l["lap_duration"] for l in ls if l["lap_duration"] < 1.07 * m and (n, l["lap_number"]) not in pitin]
        if len(clean) > 10: tpace[team_of(drv, n)].append(med(clean))
    tp = {k: min(v) for k, v in tpace.items()}
    if tp:
        f = min(tp.values()); race.append({"loc": loc, "temp": temp, "gap": {k: 100 * (v / f - 1) for k, v in tp.items()}})
    # warm-up: first two flying laps of a stint vs laps 4-8 of the same stint (stints of 8+ laps, clean laps only)
    lapmap = {(l["driver_number"], l["lap_number"]): l for l in laps}
    for x in stints:
        n, a, z = x["driver_number"], x["lap_start"], x["lap_end"]
        if z - a + 1 < 8: continue
        m = med([l["lap_duration"] for l in by.get(n, [])]) or 0
        first = [lapmap.get((n, k)) for k in (a, a + 1, a + 2)]
        first = [l for l in first if l and l.get("lap_duration") and not l.get("is_pit_out_lap") and l["lap_number"] > 1][:2]
        ref = [lapmap.get((n, k)) for k in range(a + 3, a + 8)]
        ref = [l["lap_duration"] for l in ref if l and l.get("lap_duration")]
        if len(first) < 2 or len(ref) < 4 or not m: continue
        if max([l["lap_duration"] for l in first] + ref) > 1.07 * m: continue                         # safety car / traffic: skip
        warm[team_of(drv, n)].append({"d": st.mean([l["lap_duration"] for l in first]) - med(ref), "c": x.get("compound"), "temp": temp})
    # speed trap: each team's best two values per race, vs the fastest team
    sp = defaultdict(list)
    for l in laps:
        if l.get("st_speed"): sp[team_of(drv, l["driver_number"])].append(l["st_speed"])
    top = {k: st.mean(sorted(v)[-2:]) for k, v in sp.items() if len(v) > 5}
    if top:
        mx = max(top.values()); speed.append({"loc": loc, "lowdf": loc in LOWDF, "gap": {k: v - mx for k, v in top.items()}})
    for r in res:
        if r.get("points") is not None: form_pts[code_of(drv, r["driver_number"])].append((s["date_start"], r.get("points") or 0, team_of(drv, r["driver_number"])))

teams = sorted({k for q in quali for k in q["gap"]})
def cold_split(rows, n_cold=5):
    rows = [r for r in rows if r["temp"] is not None]; cold = sorted(rows, key=lambda r: r["temp"])[:n_cold]; cl = {r["loc"] for r in cold}
    out = {}
    for tm in teams:
        c = [r["gap"][tm] for r in rows if r["loc"] in cl and tm in r["gap"]]; w = [r["gap"][tm] for r in rows if r["loc"] not in cl and tm in r["gap"]]
        if c and w: out[tm] = {"cold": round(st.mean(c), 3), "rest": round(st.mean(w), 3), "delta": round(st.mean(c) - st.mean(w), 3)}
    return sorted(cl), {r["loc"]: round(r["temp"], 1) for r in cold}, out
qcold_locs, qcold_t, qcold = cold_split(quali)
rcold_locs, rcold_t, rcold = cold_split(race)
warm_t = {k: {"all": round(st.mean([x["d"] for x in v]), 3), "n": len(v),
              "hard": round(st.mean([x["d"] for x in v if x["c"] == "HARD"]), 3) if any(x["c"] == "HARD" for x in v) else None} for k, v in warm.items() if len(v) >= 6}
speed_t = {tm: {"all": round(st.mean([r["gap"][tm] for r in speed if tm in r["gap"]]), 1),
                "lowdf": round(st.mean([r["gap"][tm] for r in speed if r["lowdf"] and tm in r["gap"]]), 1) if any(r["lowdf"] and tm in r["gap"] for r in speed) else None} for tm in teams}
last5 = {}
for code, v in form_pts.items():
    v = sorted(v); last5[code] = {"pts": sum(p for _, p, _ in v[-5:]), "team": v[-1][2], "races": len(v)}
qavg = {k: round(st.mean(v), 2) for k, v in qpos.items() if len(v) >= 10}
out = {"races": [s["location"] for s in ses if s["session_name"] == "Race"], "temps": {r["loc"]: round(r["temp"], 1) for r in race if r["temp"]},
       "quali_cold": {"races": qcold_t, "teams": qcold}, "race_cold": {"races": rcold_t, "teams": rcold},
       "warmup": warm_t, "speed": speed_t, "last5": dict(sorted(last5.items(), key=lambda x: -x[1]["pts"])), "quali_avg": dict(sorted(qavg.items(), key=lambda x: x[1]))}
json.dump(out, open(os.path.join(D, "findings.json"), "w"), indent=1)
print("races:", len(out["races"]), out["races"])
print("\nTRACK TEMP (race, median from min 4):", sorted(out["temps"].items(), key=lambda x: x[1]))
print("\nQUALI gap to pole %  cold vs rest (negative delta = relatively better when cold). cold races:", qcold_t)
for k, v in sorted(qcold.items(), key=lambda x: x[1]["cold"]): print(f"  {k:4} cold {v['cold']:6.3f}  rest {v['rest']:6.3f}  delta {v['delta']:+.3f}")
print("\nRACE PACE gap %  cold vs rest. cold races:", rcold_t)
for k, v in sorted(rcold.items(), key=lambda x: x[1]["cold"]): print(f"  {k:4} cold {v['cold']:6.3f}  rest {v['rest']:6.3f}  delta {v['delta']:+.3f}")
print("\nWARM-UP penalty (s, first 2 flying laps vs laps 4-8; lower = faster warm-up)")
for k, v in sorted(warm_t.items(), key=lambda x: x[1]["all"]): print(f"  {k:4} all {v['all']:+.3f}  hard {v['hard']}  n={v['n']}")
print("\nSPEED TRAP km/h vs fastest (all / low-downforce)")
for k, v in sorted(speed_t.items(), key=lambda x: -(x[1]["lowdf"] or -99)): print(f"  {k:4} {v['all']:6.1f}  {v['lowdf']}")
print("\nLAST 5 RACES points:", list(out["last5"].items())[:10])
print("\nAVG QUALI POSITION:", list(out["quali_avg"].items())[:10])
