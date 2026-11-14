"""Chances of winning Las Vegas 2026, from 2026 race results only (OpenF1 cache).
Score = weighted points per race:  4 coldest dry races 45% · Monza + Baku (low downforce) 30% · last 5 races 20% · whole season 5%.
Chance = a driver's score squared, as a share of the whole grid (squaring rewards being clearly ahead, the way wins work).
Usage: python3 explained/predict/model_2026.py  -> chances.json"""
import json, os, statistics as st
from collections import defaultdict
D = os.path.dirname(os.path.abspath(__file__)); C = os.path.join(D, "cache"); J = lambda n: json.load(open(os.path.join(C, n + ".json")))
races = []
for s in sorted([s for s in J("sessions") if s["session_name"] == "Race"], key=lambda s: s["date_start"]):
    k = s["session_key"]; f = os.path.join(C, f"R_{k}_session_result.json")
    if not os.path.exists(f) or not J(f"R_{k}_session_result"): continue
    drv = {d["driver_number"]: d["name_acronym"] for d in J(f"R_{k}_drivers")}; w = J(f"R_{k}_weather")
    tt = [x["track_temperature"] for x in w if x.get("track_temperature") is not None][4:]
    races.append({"loc": s["location"], "temp": st.median(tt), "wet": sum(1 for x in w if x.get("rainfall")) > 5,
                  "pts": {drv.get(r["driver_number"], str(r["driver_number"])): (r.get("points") or 0) for r in J(f"R_{k}_session_result")}})
cold = sorted([r for r in races if not r["wet"]], key=lambda r: r["temp"])[:4]
lowdf = [r for r in races if r["loc"] in ("Monza", "Baku")]
last5 = races[-5:]
W = [("cold", cold, 0.45), ("lowdf", lowdf, 0.30), ("form", last5, 0.20), ("season", races, 0.05)]
drivers = {d for r in races for d in r["pts"]}
ppr = lambda d, rs: sum(r["pts"].get(d, 0) for r in rs) / len(rs)
score = {d: sum(w * ppr(d, rs) for _, rs, w in W) for d in drivers}
tot = sum(v * v for v in score.values())
chance = {d: 100 * v * v / tot for d, v in score.items()}
top = sorted(chance.items(), key=lambda x: -x[1])
out = {"weights": {n: w for n, _, w in W}, "cold_races": [r["loc"] for r in cold], "lowdf_races": [r["loc"] for r in lowdf], "last5": [r["loc"] for r in last5],
       "drivers": [{"code": d, "chance": round(c, 1), "score": round(score[d], 2), "parts": {n: round(ppr(d, rs), 1) for n, rs, _ in W}} for d, c in top[:6]],
       "others": round(sum(c for _, c in top[6:]), 1)}
json.dump(out, open(os.path.join(D, "chances.json"), "w"), indent=1)
print("cold:", out["cold_races"], "| low-df:", out["lowdf_races"], "| last 5:", out["last5"])
for x in out["drivers"]: print(f'{x["code"]}: {x["chance"]:5.1f}%  score {x["score"]:5.2f}  pts/race {x["parts"]}')
print("others", out["others"])
