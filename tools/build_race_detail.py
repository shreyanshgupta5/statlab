"""Race-page detail for one round: lap-by-lap positions, tyre stints, pit stops and key moments (OpenF1).

    python3 tools/build_race_detail.py 21

Writes/updates racedetail.js: window.SEASON.RACE_DETAIL[round] =
  {laps, pos: {ID: [grid, P after lap 1, ...]}, stints: {ID: [[compound, firstLap, lastLap], ...]},
   pits: {ID: [lap, ...]}, events: [{lap, type, text, id?}], weather: {air, track, rain}}
"""
import json, os, sys, time, urllib.request, urllib.error
from datetime import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
API = 'https://api.openf1.org/v1/'

def get(path, tries=6):
    for i in range(tries):
        try:
            req = urllib.request.Request(API + path, headers={'User-Agent': 'statlab-data/1.0'})
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 404: return []
            if i < tries - 1: time.sleep(3 * (i + 1)); continue
            raise
        except Exception:
            if i == tries - 1: raise
            time.sleep(3 * (i + 1))

ts = lambda s: datetime.fromisoformat(s.replace('Z', '+00:00')).timestamp()

def main():
    rnd = int(sys.argv[1])
    S = json.loads(open(os.path.join(ROOT, 'data.js'), encoding='utf-8').read().split('window.SEASON = ', 1)[1].split(';\nwindow.NEWS', 1)[0])
    cal = next(c for c in S['CALENDAR'] if c['round'] == rnd)
    res = next(r for r in S['RESULTS'] if r['round'] == rnd)
    sess = [s for s in get(f"sessions?year={cal['date'][:4]}&session_name=Race") if s['date_start'][:10] == cal['date'][:10]][0]
    key = sess['session_key']
    acr = {d['driver_number']: d['name_acronym'] for d in get(f'drivers?session_key={key}')}
    laps = get(f'laps?session_key={key}'); time.sleep(0.5)
    stints = get(f'stints?session_key={key}'); time.sleep(0.5)
    pits = get(f'pit?session_key={key}'); time.sleep(0.5)
    rc = get(f'race_control?session_key={key}'); time.sleep(0.5)
    wx = get(f'weather?session_key={key}')
    total = cal.get('laps') or max(l['lap_number'] for l in laps)

    # time each car crossed the line at the end of every lap: next lap's start, or start + duration for the last one
    by = {}
    for l in laps: by.setdefault(l['driver_number'], {})[l['lap_number']] = l
    cross = {}
    for n, L in by.items():
        for k, l in L.items():
            nxt = L.get(k + 1)
            t = ts(nxt['date_start']) if nxt and nxt.get('date_start') else (ts(l['date_start']) + l['lap_duration'] if l.get('date_start') and l.get('lap_duration') else None)
            if t: cross.setdefault(k, []).append((t, n))
    grid = {x['id']: x['grid'] for x in res['race']}
    pos = {acr[n]: [grid.get(acr[n]) or None] for n in by}
    for k in range(1, total + 1):
        order = [n for t, n in sorted(cross.get(k, []))]
        for i, n in enumerate(order): pos[acr[n]].append(i + 1)
        for n in by:
            if n not in order and len(pos[acr[n]]) == k: pos[acr[n]].append(None)   # retired / not yet crossed
    final = {x['id']: x['pos'] for x in res['race'] if x['pos']}
    for id_, arr in pos.items():                    # official classification on the last lap (penalties applied)
        if id_ in final and len(arr) == total + 1: arr[-1] = final[id_]

    st = {}
    for s in sorted(stints, key=lambda s: (s['driver_number'], s['stint_number'])):
        if s['driver_number'] in acr:
            st.setdefault(acr[s['driver_number']], []).append([(s.get('compound') or 'UNKNOWN')[0], s.get('lap_start'), s.get('lap_end')])
    pit = {}
    for p in pits:
        if p.get('lap_number') and p['driver_number'] in acr: pit.setdefault(acr[p['driver_number']], []).append(p['lap_number'])

    ev = []
    sc_open = None
    for m in rc:
        t, lap = m['message'], m.get('lap_number')
        if t.startswith('SAFETY CAR DEPLOYED'): sc_open = ('SC', lap)
        elif t.startswith('VIRTUAL SAFETY CAR DEPLOYED'): sc_open = ('VSC', lap)
        elif (t.startswith('SAFETY CAR IN THIS LAP') or t.startswith('VIRTUAL SAFETY CAR ENDING')) and sc_open:
            ev.append({'lap': sc_open[1], 'to': lap, 'type': sc_open[0].lower(), 'text': ('Safety car' if sc_open[0] == 'SC' else 'Virtual safety car') + f' (laps {sc_open[1]}–{lap})'}); sc_open = None
        elif m.get('flag') == 'RED':
            ev.append({'lap': lap, 'type': 'red', 'text': 'Red flag'})
        elif 'PENALTY FOR CAR' in t and 'SERVED' not in t:
            n = int(t.split('CAR ')[1].split(' ')[0]); what = t.split('FIA STEWARDS: ')[1].split(' FOR CAR')[0].title().replace('Second', 'second')
            why = t.split(' - ')[1].split(' (')[0].capitalize() if ' - ' in t else ''
            what = what.replace('10 second Time Penalty', '10s time penalty').replace('5 second Time Penalty', '5s time penalty').replace('Drive Through Penalty', 'Drive-through')
            ev.append({'lap': lap, 'type': 'pen', 'id': acr.get(n), 'text': f"{what} ({why.lower().replace('collison', 'collision')})"})
    for x in res['race']:
        if not x['pos'] and x.get('status') != 'DNS':
            arr = [p for p in pos.get(x['id'], []) if p]
            last = max([k for k in by.get(next((n for n, a in acr.items() if a == x['id']), -1), {})] or [0])
            ev.append({'lap': last + 1 if last else 1, 'type': 'out', 'id': x['id'], 'text': 'Retired'})
    # big single-lap drops (4+ places) that weren't a pit stop or under the safety car
    under_sc = {k for e in ev if e['type'] in ('sc', 'vsc') for k in range(e['lap'], (e.get('to') or e['lap']) + 1)}
    for id_, arr in pos.items():
        for k in range(2, len(arr)):
            a0, a1 = arr[k - 1], arr[k]
            if a0 and a1 and a1 - a0 >= 4 and k not in under_sc and k not in pit.get(id_, []) and k - 1 not in pit.get(id_, []):
                ev.append({'lap': k, 'type': 'drop', 'id': id_, 'text': f'P{a0} → P{a1}'})
    ev.sort(key=lambda e: e['lap'] or 0)

    weather = {}
    if wx:
        a, b = wx[0], wx[-1]
        weather = {'air': [round(a['air_temperature']), round(b['air_temperature'])], 'track': [round(a['track_temperature']), round(b['track_temperature'])],
                   'rain': any(w.get('rainfall') for w in wx)}

    out = os.path.join(ROOT, 'racedetail.js')
    have = {}
    if os.path.exists(out):
        have = json.loads(open(out, encoding='utf-8').read().split('|| {}, ', 1)[1].rsplit(');', 1)[0])
    have[str(rnd)] = {'laps': total, 'pos': pos, 'stints': st, 'pits': pit, 'events': ev, 'weather': weather}
    with open(out, 'w', encoding='utf-8') as f:
        f.write('// Generated by tools/build_race_detail.py (OpenF1). Do not edit by hand.\n')
        f.write('window.SEASON.RACE_DETAIL = Object.assign(window.SEASON.RACE_DETAIL || {}, ' + json.dumps(have, separators=(',', ':')) + ');\n')
    print(f"R{rnd}: {len(pos)} drivers x {total} laps, {sum(len(v) for v in st.values())} stints, {sum(len(v) for v in pit.values())} stops, {len(ev)} events, weather {weather}")
    for e in ev: print('  ', e)

if __name__ == '__main__':
    main()
