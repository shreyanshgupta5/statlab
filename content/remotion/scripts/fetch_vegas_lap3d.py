"""Russell's 2024 Las Vegas pole lap for the 3D track video: position (x, y, z) + speed, gear, throttle, brake, rpm.
Resampled to 20 Hz on one clock. Writes src/track3d/lap.json.  Usage: python3 scripts/fetch_vegas_lap3d.py"""
import json, os, time, urllib.request, urllib.parse
from datetime import datetime, timedelta
API = "https://api.openf1.org/v1/"
def g(q):
    for i in range(6):
        try: return json.load(urllib.request.urlopen(API + q, timeout=90))
        except Exception as e: print("retry", e); time.sleep(4 + 4 * i)
    raise SystemExit("OpenF1 unavailable")
s = [x for x in g("sessions?year=2024&location=Las%20Vegas&session_name=Qualifying")][0]; k = s["session_key"]
laps = [l for l in g(f"laps?session_key={k}&driver_number=63") if l.get("lap_duration")]
lap = min(laps, key=lambda l: l["lap_duration"]); D = lap["lap_duration"]
P = lambda d: datetime.fromisoformat(d.replace("Z", "+00:00")); t0 = P(lap["date_start"]); t1 = t0 + timedelta(seconds=D)
F = lambda d: urllib.parse.quote((d).strftime("%Y-%m-%dT%H:%M:%S.%f"))
pad = timedelta(seconds=1.5)
car = sorted([((P(c["date"]) - t0).total_seconds(), c) for c in g(f"car_data?session_key={k}&driver_number=63&date>={F(t0 - pad)}&date<={F(t1 + pad)}")], key=lambda x: x[0])
loc = sorted([((P(c["date"]) - t0).total_seconds(), c) for c in g(f"location?session_key={k}&driver_number=63&date>={F(t0 - pad)}&date<={F(t1 + pad)}") if c["x"] or c["y"]], key=lambda x: x[0])
def lerp(rows, t, key):
    lo = max((r for r in rows if r[0] <= t), key=lambda r: r[0], default=rows[0]); hi = min((r for r in rows if r[0] >= t), key=lambda r: r[0], default=rows[-1])
    if hi[0] == lo[0]: return lo[1][key]
    a = (t - lo[0]) / (hi[0] - lo[0]); return lo[1][key] + (hi[1][key] - lo[1][key]) * a
def near(rows, t, key): return min(rows, key=lambda r: abs(r[0] - t))[1][key]
HZ = 20; out = []
for n in range(int(D * HZ) + 1):
    t = n / HZ
    out.append([round(t, 3), round(lerp(loc, t, "x"), 1), round(lerp(loc, t, "y"), 1), round(lerp(loc, t, "z"), 1),
                round(lerp(car, t, "speed")), near(car, t, "n_gear"), round(lerp(car, t, "throttle")), 1 if near(car, t, "brake") else 0, round(lerp(car, t, "rpm"))])
json.dump({"driver": "RUS", "name": "George Russell", "year": 2024, "session": "Qualifying", "lap": D, "hz": HZ, "session_key": k,
           "fields": ["t", "x", "y", "z", "speed", "gear", "throttle", "brake", "rpm"], "samples": out, "raw_counts": [len(car), len(loc)]},
          open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src", "track3d", "lap.json"), "w"), separators=(",", ":"))
zs = [o[3] for o in out]; sp = [o[4] for o in out]
print("lap", D, "samples", len(out), "raw car/loc", len(car), len(loc), "| z range", min(zs), max(zs), "| speed", min(sp), max(sp))
