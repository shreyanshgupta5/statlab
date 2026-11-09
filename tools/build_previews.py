"""Builds previews.js (window.PREVIEWS): race preview data for every Grand Prix not yet in data.js.

For each upcoming round:
  - circuit history at the same venue, last 10 editions (Jolpica): winner, pole, podium, grid of the winner, fastest lap
  - each current driver's record there: starts, wins, podiums, poles, average finish, best result
  - track outline from one clean lap of last year's race (OpenF1 location data), scaled to the app's track-map format

    python3 tools/build_previews.py
"""
import json, os, time, urllib.request
from datetime import datetime, timedelta

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
YEAR = 2026
# official circuit lengths (km); Jolpica and OpenF1 don't publish them
LENGTH_KM = {'vegas': 6.201, 'losail': 5.419, 'yas_marina': 5.281, 'interlagos': 4.309, 'rodriguez': 4.304}


def get(url, tries=4):
    for i in range(tries):
        try:
            with urllib.request.urlopen(url, timeout=40) as r:
                return json.load(r)
        except Exception as e:  # Jolpica rate limit (429) or a slow OpenF1 response
            if i == tries - 1:
                raise
            time.sleep(2 * (i + 1))


def jolpica(path):
    time.sleep(0.35)  # stay under Jolpica's burst limit
    return get('https://api.jolpi.ca/ergast/f1/' + path)['MRData']


def lap_seconds(t):
    if not t:
        return None
    m, s = t.split(':') if ':' in t else ('0', t)
    return int(m) * 60 + float(s)


def track_outline(race_date):
    """One clean lap of last year's race at this circuit, as [[x, y], ...] in a 300-unit-wide box."""
    sessions = get(f'https://api.openf1.org/v1/sessions?year={race_date[:4]}&session_name=Race')
    s = next((x for x in sessions if x['date_start'][:10] == race_date), None)
    if not s:
        return None
    key = s['session_key']
    laps = get(f'https://api.openf1.org/v1/laps?session_key={key}&driver_number=1') or get(f'https://api.openf1.org/v1/laps?session_key={key}')
    clean = [l for l in laps if l.get('lap_duration') and not l.get('is_pit_out_lap') and l['lap_number'] > 3]
    if not clean:
        return None
    lap = min(clean, key=lambda l: l['lap_duration'])
    start = datetime.fromisoformat(lap['date_start'])
    end = start + timedelta(seconds=lap['lap_duration'])
    fmt = lambda d: d.strftime('%Y-%m-%dT%H:%M:%S')
    pts = get(f"https://api.openf1.org/v1/location?session_key={key}&driver_number={lap['driver_number']}&date>={fmt(start)}&date<{fmt(end)}")
    xy = [(p['x'], p['y']) for p in pts if p['x'] or p['y']]
    if len(xy) < 50:
        return None
    xs, ys = [p[0] for p in xy], [p[1] for p in xy]
    w, h = max(xs) - min(xs), max(ys) - min(ys)
    k = 300 / max(w, h)
    out = [[round((x - min(xs)) * k), round((max(ys) - y) * k)] for x, y in xy]  # flip y: screen down is positive
    # thin to about 160 points
    step = max(1, len(out) // 160)
    out = out[::step]
    return out + [out[0]]


def main():
    data = open(os.path.join(ROOT, 'data.js'), encoding='utf-8').read()
    S = json.loads(data.split('window.SEASON = ', 1)[1].split(';\nwindow.NEWS', 1)[0])
    done = {r['round'] for r in S['RESULTS']}
    grid_ids = {d['id'] for d in S['DRIVERS']}
    races = jolpica(f'{YEAR}/races.json?limit=40')['RaceTable']['Races']
    previews = {}
    for race in races:
        rnd = int(race['round'])
        if rnd in done:
            continue
        circ = race['Circuit']
        cid = circ['circuitId']
        all_seasons = [r['season'] for r in jolpica(f'circuits/{cid}/races.json?limit=100')['RaceTable']['Races'] if int(r['season']) < YEAR]
        seasons = all_seasons[-10:]
        history, rec = [], {}
        for yr in seasons:
            res = jolpica(f'{yr}/circuits/{cid}/results.json')['RaceTable']['Races']
            qual = jolpica(f'{yr}/circuits/{cid}/qualifying.json')['RaceTable']['Races']
            if not res:
                continue
            rr = res[0]['Results']
            pole = qual[0]['QualifyingResults'][0]['Driver']['code'] if qual else next((x['Driver']['code'] for x in rr if x['grid'] == '1'), None)
            fl = min((x for x in rr if x.get('FastestLap', {}).get('Time')), key=lambda x: lap_seconds(x['FastestLap']['Time']['time']), default=None)
            history.append({'year': int(yr), 'date': res[0]['date'],
                            'winner': rr[0]['Driver']['code'], 'winnerName': rr[0]['Driver']['familyName'], 'team': rr[0]['Constructor']['name'],
                            'grid': int(rr[0]['grid']), 'pole': pole,
                            'podium': [x['Driver']['code'] for x in rr[:3]],
                            'fastest': {'code': fl['Driver']['code'], 'name': fl['Driver']['familyName'], 'time': fl['FastestLap']['Time']['time']} if fl else None})
            for x in rr:
                c = x['Driver']['code']
                if c not in grid_ids:
                    continue
                d = rec.setdefault(c, {'starts': 0, 'wins': 0, 'podiums': 0, 'poles': 0, 'finishes': [], 'best': None})
                d['starts'] += 1
                pos = int(x['position']) if x['positionText'].isdigit() else None
                if pos:
                    d['finishes'].append(pos)
                    d['best'] = pos if d['best'] is None else min(d['best'], pos)
                    d['wins'] += pos == 1
                    d['podiums'] += pos <= 3
            if pole in rec:
                rec[pole]['poles'] += 1
        drivers = []
        for c, d in rec.items():
            f = d.pop('finishes')
            d['avg'] = round(sum(f) / len(f), 1) if f else None
            d['finished'] = len(f)
            drivers.append({'id': c, **d})
        drivers.sort(key=lambda d: (-d['wins'], -d['podiums'], d['avg'] or 99))
        last = history[-1] if history else None
        previews[rnd] = {
            'circuit': circ['circuitName'], 'circuitId': cid, 'locality': circ['Location']['locality'], 'country': circ['Location']['country'],
            'lengthKm': LENGTH_KM.get(cid), 'firstYear': int(all_seasons[0]) if all_seasons else None, 'editions': len(all_seasons),
            'history': list(reversed(history)), 'drivers': drivers,
            'track': track_outline(last['date']) if last else None,
        }
        print(rnd, cid, len(history), 'editions,', len(drivers), 'current drivers, track', 'yes' if previews[rnd]['track'] else 'no')
    with open(os.path.join(ROOT, 'previews.js'), 'w', encoding='utf-8') as f:
        f.write('// Generated by tools/build_previews.py (Jolpica + OpenF1). Do not edit by hand.\n')
        f.write('window.PREVIEWS = ' + json.dumps(previews, ensure_ascii=False, separators=(',', ':')) + ';\n')


if __name__ == '__main__':
    main()
