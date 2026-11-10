"""Fetch Russell's 2024 Las Vegas pole lap from OpenF1 and write vegas-lap.json:
a resampled trace (x, y, speed, throttle, brake) used by vegas-reel.html for the speed map.
Usage: python3 vegas-preview-carousel/build-lap.py"""
import json, urllib.request, urllib.parse, time, os
from datetime import datetime, timedelta
API = "https://api.openf1.org/v1/"
def g(q):
    for i in range(5):
        try:
            with urllib.request.urlopen(API + q.replace(" ", "%20"), timeout=60) as r: return json.load(r)
        except Exception as e:
            time.sleep(2 + 2 * i); err = e
    raise err
ses = [s for s in g("sessions?year=2024&country_name=United States&session_name=Qualifying") if "Vegas" in (s.get("location") or "") + (s.get("circuit_short_name") or "")]
k = ses[0]["session_key"]
laps = [l for l in g(f"laps?session_key={k}&driver_number=63") if l.get("lap_duration")]
lap = min(laps, key=lambda l: l["lap_duration"])
P = lambda s: datetime.fromisoformat(s.replace("Z", "+00:00"))
t0 = P(lap["date_start"]); t1 = t0 + timedelta(seconds=lap["lap_duration"])
F = lambda d: urllib.parse.quote(d.strftime("%Y-%m-%dT%H:%M:%S.%f"))
car = g(f"car_data?session_key={k}&driver_number=63&date>={F(t0)}&date<={F(t1)}")
loc = g(f"location?session_key={k}&driver_number=63&date>={F(t0)}&date<={F(t1)}")
car = [(( P(c["date"]) - t0).total_seconds(), c["speed"], c["throttle"], c["brake"]) for c in car]
loc = [((P(c["date"]) - t0).total_seconds(), c["x"], c["y"]) for c in loc if c["x"] or c["y"]]
def at(rows, t, i):
    lo = max(r for r in rows if r[0] <= t) if any(r[0] <= t for r in rows) else rows[0]
    hi = min((r for r in rows if r[0] >= t), default=rows[-1])
    if hi[0] == lo[0]: return lo[i]
    return lo[i] + (hi[i] - lo[i]) * (t - lo[0]) / (hi[0] - lo[0])
N = 260; D = lap["lap_duration"]; out = []
xs = [l[1] for l in loc]; ys = [l[2] for l in loc]
x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys); sc = 1000 / max(x1 - x0, y1 - y0)
for n in range(N + 1):
    t = D * n / N
    lo = max((r for r in car if r[0] <= t), key=lambda r: r[0], default=car[0])
    out.append([round((at(loc, t, 1) - x0) * sc), round((y1 - at(loc, t, 2)) * sc), round(at(car, t, 1)), lo[2], 1 if lo[3] else 0])
json.dump({"driver": "RUS", "year": 2024, "lap": lap["lap_duration"], "session_key": k, "fields": ["x", "y", "speed", "throttle", "brake"], "trace": out},
          open(os.path.join(os.path.dirname(__file__), "vegas-lap.json"), "w"), separators=(",", ":"))
sp = [o[2] for o in out]; print("lap", lap["lap_duration"], "samples", len(car), len(loc), "max", max(sp), "min", min(sp), "full", round(100 * sum(o[3] >= 99 for o in out) / len(out)), "brake", round(100 * sum(o[4] for o in out) / len(out)))
