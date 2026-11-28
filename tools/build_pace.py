"""Builds pace.js (window.SEASON.PACE): race pace and tyre degradation for every race of the season, from OpenF1 laps.

    python3 tools/build_pace.py          # all rounds with results
    python3 tools/build_pace.py 21       # just one round (merged into the existing file)

Clean laps: not lap 1, not an in- or out-lap, not under a safety car / VSC / red flag, and within 4% of the driver's
median (drops traffic, damage and cool-down laps). Per race:
  - driver pace = median clean lap; team pace = its faster driver; gaps in % of the fastest team
  - degradation = slope of clean lap time against lap number inside each stint of 8+ clean laps (s/lap).
    Fuel burn makes every slope negative by a similar amount, so we also store each slope minus the race's
    field median ("rel"): positive = the tyres faded faster than the field's that day.
"""
import json, os, sys, time, statistics, urllib.request, urllib.parse, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA = {'User-Agent': 'statlab-app/1.0 (fan project)'}

def get(ep, **q):
    url = 'https://api.openf1.org/v1/%s?%s' % (ep, urllib.parse.urlencode(q))
    for i in range(6):
        try:
            time.sleep(0.7)
            return json.load(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90))
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return []
            print('  retry', e.code, ep, file=sys.stderr); time.sleep(4 + 4 * i)
        except Exception as e:
            print('  retry', e, file=sys.stderr); time.sleep(4 + 4 * i)
    raise SystemExit('failed: ' + url)

def slope(ys, xs):
    n = len(ys); mx = sum(xs) / n; my = sum(ys) / n
    den = sum((x - mx) ** 2 for x in xs)
    return sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / den if den else 0.0

def season():
    t = open(os.path.join(ROOT, 'data.js'), encoding='utf-8').read()
    return json.loads(t.split('window.SEASON = ', 1)[1].split(';\nwindow.NEWS', 1)[0])

def one_race(key, team_of):
    laps, stints, rc = get('laps', session_key=key), get('stints', session_key=key), get('race_control', session_key=key)
    drv = {d['driver_number']: d['name_acronym'] for d in get('drivers', session_key=key)}
    if not laps:
        return None
    # neutralised laps
    neut, open_from = set(), None
    for m in sorted(rc, key=lambda m: m.get('date') or ''):
        msg, lap = m.get('message', ''), m.get('lap_number')
        if lap is None:
            continue
        if ('SAFETY CAR DEPLOYED' in msg or msg.startswith('RED FLAG')) and open_from is None:
            open_from = lap
        elif ('IN THIS LAP' in msg or 'ENDING' in msg or msg.startswith('GREEN') or 'RESUMED' in msg) and open_from is not None:
            neut.update(range(open_from, lap + 2)); open_from = None
    if open_from is not None:
        neut.update(range(open_from, open_from + 4))
    # in/out laps from stints
    stint_of, edge = {}, set()
    for s in stints:
        n = s['driver_number']
        if s.get('lap_start') is None:
            continue
        end = s['lap_end'] if s.get('lap_end') is not None else 999
        for l in range(s['lap_start'], min(end, 200) + 1):
            stint_of[(n, l)] = (s['stint_number'], s.get('compound') or '')
        if s['stint_number'] > 1:
            edge.add((n, s['lap_start'])); edge.add((n, s['lap_start'] - 1))
    per = {}
    for l in laps:
        n, ln, t = l['driver_number'], l['lap_number'], l.get('lap_duration')
        if not t or ln <= 1 or l.get('is_pit_out_lap') or ln in neut or (n, ln) in edge:
            continue
        per.setdefault(n, []).append((ln, t))
    drivers, slopes = {}, []
    for n, ls in per.items():
        if len(ls) < 10 or n not in drv:
            continue
        med = statistics.median(t for _, t in ls)
        clean = [(ln, t) for ln, t in ls if t < med * 1.04]
        if len(clean) < 10:
            continue
        code = drv[n]
        drivers[code] = {'p': round(statistics.median(t for _, t in clean), 3), 'n': len(clean), 'st': []}
        by = {}
        for ln, t in clean:
            st = stint_of.get((n, ln))
            if st:
                by.setdefault(st, []).append((ln, t))
        for (num, comp), pts in sorted(by.items()):
            if len(pts) >= 8:
                k = slope([t for _, t in pts], [ln for ln, _ in pts])
                drivers[code]['st'].append({'c': comp, 'n': len(pts), 'from': pts[0][0], 'to': pts[-1][0], 's': round(k, 4)})
                slopes.append(k)
    if not drivers:
        return None
    field = statistics.median(slopes) if slopes else 0.0
    best = min(d['p'] for d in drivers.values())
    teams = {}
    for code, d in drivers.items():
        d['g'] = round(d['p'] - best, 3)
        for s in d['st']:
            s['rel'] = round(s['s'] - field, 4)
        rels = [s['rel'] for s in d['st']]
        d['deg'] = round(sum(s['rel'] * s['n'] for s in d['st']) / sum(s['n'] for s in d['st']), 4) if rels else None
        t = team_of.get(code)
        if t:
            teams.setdefault(t, []).append(d)
    tbest = min(min(x['p'] for x in v) for v in teams.values())
    tout = {}
    for t, v in teams.items():
        p = min(x['p'] for x in v)
        degs = [s for x in v for s in x['st']]
        tout[t] = {'p': p, 'g': round((p - tbest) / tbest * 100, 3),
                   'deg': round(sum(s['rel'] * s['n'] for s in degs) / sum(s['n'] for s in degs), 4) if degs else None,
                   'comp': {c: round(statistics.median([s['rel'] for s in degs if s['c'] == c]), 4) for c in {s['c'] for s in degs}}}
    return {'drivers': drivers, 'teams': tout, 'field': round(field, 4), 'neutral': sorted(neut)}

def main():
    S = season()
    team_of = {d['id']: d['team'] for d in S['DRIVERS']}
    path = os.path.join(ROOT, 'pace.js')
    out = {}
    if os.path.exists(path):
        out = json.loads(open(path, encoding='utf-8').read().split('window.SEASON.PACE = ', 1)[1].rstrip().rstrip(';'))
    want = set(map(int, sys.argv[1:])) or {r['round'] for r in S['RESULTS']}
    races = get('sessions', year=int(S['CALENDAR'][0]['date'][:4]), session_name='Race')
    for c in S['CALENDAR']:
        if c['round'] not in want:
            continue
        ses = next((s for s in races if abs((time.mktime(time.strptime(s['date_start'][:10], '%Y-%m-%d')) - time.mktime(time.strptime(c['date'], '%Y-%m-%d'))) / 86400) <= 1), None)
        if not ses:
            print(c['round'], 'no OpenF1 race session'); continue
        r = one_race(ses['session_key'], team_of)
        if r:
            out[str(c['round'])] = r
            print(c['round'], c['name'], len(r['drivers']), 'drivers, field deg', r['field'])
        else:
            print(c['round'], 'no lap data')
    with open(path, 'w', encoding='utf-8') as f:
        f.write('// Generated by tools/build_pace.py (OpenF1). Do not edit by hand.\n')
        f.write('window.SEASON = window.SEASON || {};\nwindow.SEASON.PACE = ' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n')

if __name__ == '__main__':
    main()
