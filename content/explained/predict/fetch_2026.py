"""Download the 2026 season from OpenF1 (every race and qualifying already run): sessions, drivers, results,
weather, laps and stints. Cached under predict/cache/ so re-runs are instant.  Usage: python3 explained/predict/fetch_2026.py"""
import json, os, time, urllib.request, urllib.error, datetime
API = "https://api.openf1.org/v1/"
C = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cache"); os.makedirs(C, exist_ok=True)
def g(q, name):
    p = os.path.join(C, name + ".json")
    if os.path.exists(p): return json.load(open(p))
    for i in range(6):
        try:
            d = json.load(urllib.request.urlopen(API + q, timeout=90)); json.dump(d, open(p, "w")); time.sleep(0.35); return d
        except urllib.error.HTTPError as e:
            if e.code == 404: json.dump([], open(p, "w")); return []               # no data for this session (e.g. cancelled): note it and move on
            print("  retry", name, e.code); time.sleep(4 + 4 * i)
        except Exception as e:
            print("  retry", name, str(e)[:60]); time.sleep(4 + 4 * i)
    return []
now = datetime.datetime.now(datetime.timezone.utc)
ses = [s for s in g("sessions?year=2026", "sessions") if s["session_name"] in ("Race", "Qualifying") and datetime.datetime.fromisoformat(s["date_end"]) < now]
print(len(ses), "sessions")
for s in ses:
    k = s["session_key"]; tag = f'{s["session_name"][0]}_{k}'
    for what in ("drivers", "session_result", "weather", "stints", "laps"):
        d = g(f"{what}?session_key={k}", f"{tag}_{what}")
    print(s["date_start"][:10], s["session_name"], s["location"], "laps", len(d))
