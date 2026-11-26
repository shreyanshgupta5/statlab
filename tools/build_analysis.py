"""Builds analysis.js (window.ANALYSIS): race-weekend analysis for upcoming rounds from past editions at the same track.

    python3 tools/build_analysis.py 22 23

For each past edition since 2023 (OpenF1 coverage) it records: winner and where they started, pole, how many stops the
field made, safety-car / VSC periods, whether the winner pitted under a safety car, track and air temperature, places
gained by finishers and retirements. Jolpica adds the 2021+ results (grid, finish, status) for the overtaking numbers.
NOTES holds hand-checked context (tyre rules) per round and year. Run it again after a new edition to refresh.
"""
import json, os, sys, time, statistics, collections, urllib.request, urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA = {'User-Agent': 'statlab-app/1.0 (fan project)'}

# hand-checked context per round: tyre rules and the like (shown with the edition)
NOTES = {
    22: {
        2023: 'Pirelli capped every set at 18 laps after finding sidewall damage, so the race became a three-stop sprint.',
        2025: 'Pirelli capped every set at 25 laps, making two stops the minimum in a 57-lap race.',
        2026: 'Race previews report a 27-lap cap per set this year: two stops again.',
    },
}

def get(url):
    for i in range(5):
        try:
            return json.load(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60))
        except Exception as e:
            print('  retry', url[:80], e, file=sys.stderr); time.sleep(3 + 3 * i)
    raise SystemExit('failed: ' + url)

def openf1(ep, **q):
    time.sleep(0.4)
    return get('https://api.openf1.org/v1/%s?%s' % (ep, urllib.parse.urlencode(q)))

def load_js(name, var):
    text = open(os.path.join(ROOT, name), encoding='utf-8').read()
    return json.loads(text.split(var + ' = ', 1)[1].rstrip().rstrip(';').split(';\nwindow.', 1)[0])

def edition(country, locality, year, circuit_id):
    keys = {country.lower(), *[x.lower() for x in locality.split('|')]}
    races = [s for s in openf1('sessions', year=year, session_name='Race')
             if keys & {str(s.get(f, '')).lower() for f in ('country_name', 'location', 'circuit_short_name')}
             or any(k in str(s.get('location', '')).lower() or k in str(s.get('country_name', '')).lower() for k in keys)]
    if not races:
        return None
    k = races[0]['session_key']
    dr = {d['driver_number']: d['name_acronym'] for d in openf1('drivers', session_key=k)}
    pits, stints, rc, w = (openf1(ep, session_key=k) for ep in ('pit', 'stints', 'race_control', 'weather'))
    # safety-car periods: [deployed lap, in-this-lap lap]; VSC laps separately
    sc, vsc, open_sc = [], [], None
    for r in rc:
        m, lap = r.get('message', ''), r.get('lap_number')
        if m.startswith('SAFETY CAR DEPLOYED') and open_sc is None:
            open_sc = lap
        elif 'SAFETY CAR IN THIS LAP' in m and open_sc is not None:
            sc.append([open_sc, lap]); open_sc = None
        elif m.startswith('VIRTUAL SAFETY CAR DEPLOYED') and lap not in vsc:
            vsc.append(lap)
    # stops = number of stints minus one (pit-lane records double-count drive-throughs and red flags)
    # one-lap 'stints' logged while cars sit in the pit lane under a safety car / red flag are not real stops
    per = collections.defaultdict(set)
    for s in stints:
        if s.get('lap_end') is not None and s.get('lap_start') is not None and s['lap_end'] > s['lap_start']:
            per[dr.get(s['driver_number'])].add(s['stint_number'])
    res = get('https://api.jolpi.ca/ergast/f1/%d/circuits/%s/results/?limit=40' % (year, circuit_id))['MRData']['RaceTable']['Races'][0]['Results']
    finished = [x for x in res if x['status'] in ('Finished', 'Lapped') or x['status'].startswith('+')]
    stops = collections.Counter(len(per[x['Driver']['code']]) - 1 for x in finished if per.get(x['Driver']['code']))
    win = res[0]; wcode = win['Driver']['code']
    raw = sorted({p['lap_number'] for p in pits if dr.get(p['driver_number']) == wcode})
    wpits = [l for i, l in enumerate(raw) if i == 0 or l != raw[i - 1] + 1]   # back-to-back laps = one stop
    under_sc = [l for l in wpits if any(a <= l <= b for a, b in sc)]
    pole = next((x['Driver']['code'] for x in res if x['grid'] == '1'), None)
    return {
        'year': year, 'laps': int(win['laps']), 'winner': wcode, 'winnerGrid': int(win['grid']), 'pole': pole,
        'podium': [[x['Driver']['code'], int(x['grid'])] for x in res[:3]],
        'stops': stops.most_common(1)[0][0] if stops else None, 'stopsSpread': dict(sorted(stops.items())),
        'winnerPits': wpits, 'winnerPitUnderSC': under_sc,
        'sc': sc, 'vsc': vsc,
        'trackTemp': round(statistics.mean(x['track_temperature'] for x in w), 1) if w else None,
        'airTemp': round(statistics.mean(x['air_temperature'] for x in w), 1) if w else None,
        'gained': sum(max(0, int(x['grid']) - int(x['position'])) for x in finished if int(x['grid']) > 0),
        'finishers': len(finished), 'dnf': len(res) - len(finished),
        'names': {x['Driver']['code']: x['Driver']['familyName'] for x in res},
        'bestGain': max(([int(x['grid']) - int(x['position']), x['Driver']['code'], int(x['grid']), int(x['position'])] for x in finished if int(x['grid']) > 0), default=None),
    }

def main():
    previews = load_js('previews.js', 'window.PREVIEWS')
    out = {}
    path = os.path.join(ROOT, 'analysis.js')
    if os.path.exists(path):
        out = load_js('analysis.js', 'window.ANALYSIS')
    for rnd in map(int, sys.argv[1:]):
        P = previews[str(rnd)]
        eds = []
        for h in sorted(P['history'], key=lambda h: h['year'], reverse=True):
            if h['year'] < 2023:
                continue
            e = edition(P['country'], P['locality'] + '|' + P['circuit'], h['year'], P['circuitId'])
            if e:
                e['note'] = NOTES.get(rnd, {}).get(h['year'])
                eds.append(e); print(rnd, h['year'], 'ok')
        out[str(rnd)] = {'editions': eds, 'note': NOTES.get(rnd, {}).get(2026)}
    with open(path, 'w', encoding='utf-8') as f:
        f.write('// Generated by tools/build_analysis.py (OpenF1 + Jolpica). Do not edit by hand.\n')
        f.write('window.ANALYSIS = ' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n')
    print('wrote analysis.js for rounds', ', '.join(sys.argv[1:]))

if __name__ == '__main__':
    main()
