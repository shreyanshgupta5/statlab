# Caches OpenF1 race laps (lap times, speed-trap speeds, lap start times) for every 2026 race.
import json, os, time, urllib.request
H = {'User-Agent': 'statlab-data/1.0'}
get = lambda p: json.load(urllib.request.urlopen(urllib.request.Request('https://api.openf1.org/v1/' + p, headers=H), timeout=90))
races = [s for s in get('sessions?year=2026&session_name=Race') if s['date_start'] < '2026-11-23']
for s in races:
    f = f"cache/laps_{s['session_key']}.json"
    if os.path.exists(f): continue
    for i in range(4):
        try:
            json.dump({'session': s, 'laps': get(f"laps?session_key={s['session_key']}"), 'drivers': get(f"drivers?session_key={s['session_key']}")}, open(f, 'w')); print('ok', s['location']); break
        except Exception as e: print('retry', s['location'], e); time.sleep(5 * (i + 1))
    time.sleep(1)
