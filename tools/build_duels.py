"""Builds duels.js: qualifying telemetry for the Duel tab, for every finished round not already in data.js.

For each round's qualifying session (OpenF1):
  - every driver's grid-setting lap (Q3 for the top 10, Q2/Q1 for the rest): lap time, sectors, speed every STEP metres, speed-trap max
  - the track outline from the pole lap (location data), resampled to the same STEP
  - sector boundaries (as distance) from the pole lap's sector times
  - corners found from the pole lap's speed trace (clear speed minima), each driver's minimum speed through them

    python3 tools/build_duels.py            # all missing rounds
    python3 tools/build_duels.py 1 2 3      # just these rounds

Output matches the DUELS format the app already uses for round 19 (data.js); track maps are scaled to 1000 units like round 19.
in lap order, not official turn numbers.
"""
import json, math, os, sys, time, urllib.request, urllib.error
from datetime import datetime, timedelta

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STEP = 20  # metres between samples, same as round 19
API = 'https://api.openf1.org/v1/'


def get(path, tries=6):
    for i in range(tries):
        try:
            with urllib.request.urlopen(API + path, timeout=60) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503, 504) and i < tries - 1:
                time.sleep(3 * (i + 1)); continue
            raise
        except Exception:
            if i == tries - 1:
                raise
            time.sleep(3 * (i + 1))


def ts(s):
    return datetime.fromisoformat(s.replace('Z', '+00:00'))


def resample(xs, ys, n_out, x_max):
    """Linear interpolation of ys(xs) at n_out evenly spaced points over 0..x_max."""
    out, j = [], 0
    for k in range(n_out):
        x = x_max * k / (n_out - 1)
        while j < len(xs) - 2 and xs[j + 1] < x:
            j += 1
        x0, x1 = xs[j], xs[j + 1]
        t = 0 if x1 == x0 else min(1, max(0, (x - x0) / (x1 - x0)))
        out.append(ys[j] + (ys[j + 1] - ys[j]) * t)
    return out


def lap_trace(key, num, lap):
    """Speed against distance for one lap, plus the time->distance mapping."""
    start = ts(lap['date_start']); end = start + timedelta(seconds=lap['lap_duration'])
    f = lambda d: d.strftime('%Y-%m-%dT%H:%M:%S.%f')
    rows = get(f"car_data?session_key={key}&driver_number={num}&date>={f(start - timedelta(seconds=.3))}&date<={f(end + timedelta(seconds=.3))}")
    rows = [r for r in rows if r.get('speed') is not None]
    if len(rows) < 40:
        return None
    t = [(ts(r['date']) - start).total_seconds() for r in rows]
    v = [r['speed'] for r in rows]
    # clip to the lap and integrate distance (km/h -> m/s)
    pts = [(ti, vi) for ti, vi in zip(t, v) if -0.3 <= ti <= lap['lap_duration'] + 0.3]
    t = [p[0] for p in pts]; v = [p[1] for p in pts]
    d = [0.0]
    for i in range(1, len(t)):
        d.append(d[-1] + (v[i] + v[i - 1]) / 2 / 3.6 * (t[i] - t[i - 1]))
    return t, v, d


def corners_from(speed, min_gap=4):
    """Indices of clear speed minima (corners) in the pole lap trace."""
    idx = []
    n = len(speed)
    for i in range(2, n - 2):
        win = speed[max(0, i - min_gap): i + min_gap + 1]
        if speed[i] == min(win) and speed[i] < 270:
            # needs a real braking zone: something at least 20 km/h faster within 25 samples before it
            before = speed[max(0, i - 25): i]
            if before and max(before) - speed[i] >= 20 and (not idx or i - idx[-1] > min_gap):
                idx.append(i)
    return idx


def build_round(rnd, race_date, name, quali_sessions):
    rd = datetime.fromisoformat(race_date)
    sess = [s for s in quali_sessions if timedelta(0) <= rd - ts(s['date_start']).replace(tzinfo=None) <= timedelta(days=3)]
    if not sess:
        print(f'R{rnd}: no qualifying session found'); return None
    key = sess[0]['session_key']
    drivers = {d['driver_number']: d for d in get(f'drivers?session_key={key}')}
    laps = [l for l in get(f'laps?session_key={key}') if l.get('lap_duration') and l.get('date_start')]
    # each driver's lap is the one that set their official grid time: their time from the last part of
    # qualifying they reached (Q3 for the top 10, Q2 for P11-15, Q1 for the rest), not simply their fastest lap
    official = {}
    for r in get(f'session_result?session_key={key}'):
        times = [x for x in (r.get('duration') or []) if x]
        if times:
            official[r['driver_number']] = (r.get('position') or 99, times[-1])
    best = {}
    for l in laps:
        n = l['driver_number']
        if n in official:
            if abs(l['lap_duration'] - official[n][1]) > 0.01:
                continue
        elif n in best and l['lap_duration'] >= best[n]['lap_duration']:
            continue
        best[n] = l
    order = sorted(best.values(), key=lambda l: (official.get(l['driver_number'], (99, 0))[0], l['lap_duration']))
    pole = order[0]  # the pole lap: its trace sets the track map, length, sectors and corners
    pt = lap_trace(key, pole['driver_number'], pole)
    if not pt:
        print(f'R{rnd}: no car data'); return None
    length = round(pt[2][-1] / 10) * 10
    n = length // STEP + 1
    out_drivers, traces = [], {}
    for l in order:
        num = l['driver_number']; d = drivers.get(num)
        if not d:
            continue
        tr = pt if l is pole else lap_trace(key, num, l)
        if not tr:
            continue
        t, v, dist = tr
        scale = length / dist[-1] if dist[-1] else 1  # each driver's own lap mapped onto the same length
        speed = [round(x) for x in resample([x * scale for x in dist], v, n, length)]
        s = [l.get('duration_sector_1'), l.get('duration_sector_2'), l.get('duration_sector_3')]
        traces[d['name_acronym']] = speed
        out_drivers.append({'driver': d['name_acronym'], 'team': d.get('team_name'), 'lap': round(l['lap_duration'], 3),
                            's': [round(x, 3) if x else None for x in s], 'trap': max(v), 'speed': speed})
        time.sleep(0.4)
    # sector boundaries along the pole lap
    t, v, dist = pt
    sec = []
    acc = 0
    for x in (pole.get('duration_sector_1'), pole.get('duration_sector_2')):
        if not x:
            sec = []; break
        acc += x
        i = next((k for k, tt in enumerate(t) if tt >= acc), len(t) - 1)
        sec.append(round(dist[i] * length / dist[-1]))
    # track outline from the pole lap
    start = ts(pole['date_start']); end = start + timedelta(seconds=pole['lap_duration'])
    f = lambda d: d.strftime('%Y-%m-%dT%H:%M:%S.%f')
    loc = get(f"location?session_key={key}&driver_number={pole['driver_number']}&date>={f(start)}&date<={f(end)}")
    xy = [(p['x'], p['y']) for p in loc if p.get('x') is not None and (p['x'] or p['y'])]
    track = None
    if len(xy) > 50:
        cum = [0.0]
        for i in range(1, len(xy)):
            cum.append(cum[-1] + math.hypot(xy[i][0] - xy[i - 1][0], xy[i][1] - xy[i - 1][1]))
        X = resample(cum, [p[0] for p in xy], n, cum[-1]); Y = resample(cum, [p[1] for p in xy], n, cum[-1])
        mx, my = min(X), max(Y); k = 1000 / max(max(X) - mx, my - min(Y))  # same scale as round 19
        track = [[round((x - mx) * k), round((my - y) * k)] for x, y in zip(X, Y)]
    # corners from the pole trace; each driver's minimum within +-4 samples
    cidx = corners_from(traces[out_drivers[0]['driver']])
    names = [f'C{i + 1}' for i in range(len(cidx))]
    for d in out_drivers:
        sp = d['speed']
        d['corners'] = {nm: float(min(sp[max(0, i - 4): i + 5])) for nm, i in zip(names, cidx)}
    team_ids = {'Mercedes': 'MER', 'Ferrari': 'FER', 'Red Bull Racing': 'RBR', 'McLaren': 'MCL', 'Racing Bulls': 'RB', 'Alpine': 'ALP',
                'Haas F1 Team': 'HAA', 'Audi': 'AUD', 'Williams': 'WIL', 'Aston Martin': 'AMR', 'Cadillac': 'CAD'}
    for d in out_drivers:
        d['team'] = team_ids.get(d['team'], d['team'])
    print(f'R{rnd} {name}: {len(out_drivers)} drivers, {length} m, {len(names)} corners, track {"yes" if track else "no"}')
    return {'round': rnd, 'name': name, 'session': 'Qualifying', 'step': STEP, 'length': length,
            'sectors': sec if len(sec) == 2 else [], 'track': track, 'corners': names, 'drivers': out_drivers}


def main():
    data = open(os.path.join(ROOT, 'data.js'), encoding='utf-8').read()
    S = json.loads(data.split('window.SEASON = ', 1)[1].split(';\nwindow.NEWS', 1)[0])
    out_path = os.path.join(ROOT, 'duels.js')
    have = {}
    if os.path.exists(out_path):
        t = open(out_path, encoding='utf-8').read()
        have = json.loads(t.split('|| {}, ', 1)[1].rsplit(');', 1)[0])
    done = [r['round'] for r in S['RESULTS']]
    want = [int(a) for a in sys.argv[1:]] or [r for r in done if str(r) not in S.get('DUELS', {}) and str(r) not in have]
    quali = get('sessions?year=2026&session_name=Qualifying')
    cal = {c['round']: c for c in S['CALENDAR']}
    for rnd in want:
        try:
            d = build_round(rnd, cal[rnd]['date'], cal[rnd]['name'], quali)
        except Exception as e:  # keep going; a later run can retry this round
            print(f'R{rnd}: failed ({e})'); d = None
        if d:
            have[str(rnd)] = d
            with open(out_path, 'w', encoding='utf-8') as f:
                f.write('// Generated by tools/build_duels.py (OpenF1 qualifying telemetry). Do not edit by hand.\n')
                f.write('window.SEASON.DUELS = Object.assign(window.SEASON.DUELS || {}, ' + json.dumps(have, separators=(',', ':')) + ');\n')


if __name__ == '__main__':
    main()
