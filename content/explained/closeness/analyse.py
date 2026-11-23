"""Why are some races close? One row per 2026 race, and how each factor lines up with closeness.

Closeness (what we want to explain)
  within1   share of green-flag laps with P1 and P2 within 1 s (from racedetail gap12)
  passes    on-track overtakes per lap after lap 1 (filtered OpenF1 overtakes)
Factors (candidate causes)
  tow       km/h gained at the speed trap when <1 s behind another car vs >2.5 s (slipstream + Overtake Mode)
  deg       tyre degradation: median lap-time slope within clean stints, s/lap (fuel burn makes it negative)
  track     track temperature at the start, C
  spread    qualifying gap between the fastest and the 4th-fastest team, %
  flat      share of the pole lap above 290 km/h (how much of the lap is long straights)
  sc        laps under safety car / VSC
Run: python3 fetch_laps.py && python3 analyse.py   (reads the app's data.js, racedetail.js, duels.js, lab.js)
"""
import json, glob, statistics as st
from datetime import datetime

APP = '/home/user/app/'
S = json.loads(open(APP + 'data.js').read().split('window.SEASON = ', 1)[1].split(';\nwindow.NEWS = ', 1)[0])
RD = json.loads(open(APP + 'racedetail.js').read().split('|| {}, ', 1)[1].rsplit(');', 1)[0])
DU = json.loads(open(APP + 'duels.js').read().split('|| {}, ', 1)[1].rsplit(');', 1)[0])
LAB = json.loads(open(APP + 'lab.js').read().split('LAB = ', 1)[1].rstrip().rstrip(';'))
cal = {c['date'][:10]: c for c in S['CALENDAR']}
ts = lambda s: datetime.fromisoformat(s).timestamp()

def slope(xs, ys):
    mx, my = st.mean(xs), st.mean(ys)
    d = sum((x - mx) ** 2 for x in xs)
    return sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / d if d else 0

rows = []
for f in sorted(glob.glob('cache/laps_*.json')):
    J = json.load(open(f)); s = J['session']; c = cal.get(s['date_start'][:10])
    if not c or str(c['round']) not in RD: continue
    rnd = c['round']; D = RD[str(rnd)]; N = D['laps']
    acr = {d['driver_number']: d['name_acronym'] for d in J['drivers']}
    sc = {k for e in D['events'] if e['type'] in ('sc', 'vsc', 'red') for k in range(e['lap'], (e.get('to') or e['lap']) + 1)}
    pits = {(i, l) for i, ls in D['pits'].items() for l in ls}
    # closeness
    g = [x for k, x in enumerate(D['gap12'], 1) if x is not None and k > 1 and k not in sc]
    within1 = sum(1 for x in g if x < 1) / len(g) if g else None
    pl = D['overtakes']['perLap']; passes = st.mean(pl[1:]) if len(pl) > 1 else None
    # tow: speed-trap speed vs gap to the car ahead at the start of that lap
    L = [l for l in J['laps'] if l.get('date_start')]
    by_lap = {}
    for l in L: by_lap.setdefault(l['lap_number'], []).append(l)
    near, far = [], []
    for k, ls in by_lap.items():
        if k <= 1 or k in sc: continue
        ls.sort(key=lambda l: ts(l['date_start']))
        for a, b in zip(ls, ls[1:]):
            i = acr.get(b['driver_number'])
            if not b.get('st_speed') or (i, k) in pits or (i, k - 1) in pits or b.get('is_pit_out_lap'): continue
            gap = ts(b['date_start']) - ts(a['date_start'])
            (near if gap < 1.0 else far if gap > 2.5 else []).append(b['st_speed'])
    tow = st.median(near) - st.median(far) if len(near) > 20 and len(far) > 20 else None
    # degradation: lap-time slope in clean stints of 8+ laps
    lt = {}
    for l in J['laps']:
        if l.get('lap_duration'): lt[(acr.get(l['driver_number']), l['lap_number'])] = l['lap_duration']
    slopes = []
    for i, stints in D['stints'].items():
        for comp, a, b in stints:
            if not a or not b: continue
            pts = [(k, lt[(i, k)]) for k in range(a + 2, b) if (i, k) in lt and k not in sc and k - 1 not in sc and (i, k) not in pits]
            if len(pts) < 8: continue
            med = st.median(y for _, y in pts); pts = [(x, y) for x, y in pts if y < med * 1.03]
            if len(pts) >= 8: slopes.append(slope([x for x, _ in pts], [y for _, y in pts]))
    deg = st.median(slopes) if slopes else None
    # top-team spread in qualifying and flat-out share of the pole lap
    pace = sorted(v[str(rnd)] for v in (t['pace'] for t in LAB['teams'].values()) if str(rnd) in v)
    spread = pace[3] if len(pace) > 3 else None
    du = DU.get(str(rnd)); flat = None
    if du:
        pole = min(du['drivers'], key=lambda x: x['lap']); flat = sum(1 for v in pole['speed'] if v >= 290) / len(pole['speed'])
    w = D.get('weather') or {}
    rows.append({'round': rnd, 'race': c['place'].split(' ')[0] if False else (c['name'].replace(' Grand Prix', '').replace('Bahrain  in Malaysia', 'Malaysia')),
                 'within1': within1, 'passes': passes, 'tow': tow, 'deg': deg, 'track': (w.get('track') or [None])[0], 'rain': w.get('rain'),
                 'spread': spread, 'flat': flat, 'sc': len(sc)})

rows.sort(key=lambda r: r['round'])
def rank(v):
    o = sorted(range(len(v)), key=lambda i: v[i]); r = [0] * len(v)
    for k, i in enumerate(o): r[i] = k
    return r
def spearman(a, b):
    p = [(x, y) for x, y in zip(a, b) if x is not None and y is not None]
    if len(p) < 6: return None
    ra, rb = rank([x for x, _ in p]), rank([y for _, y in p]); n = len(p)
    return 1 - 6 * sum((x - y) ** 2 for x, y in zip(ra, rb)) / (n * (n * n - 1))
F = ['tow', 'deg', 'track', 'spread', 'flat', 'sc']
corr = {k: {m: spearman([r[k] for r in rows], [r[m] for r in rows]) for m in ('within1', 'passes')} for k in F}
dry = [r for r in rows if not r['rain']]
corr_dry = {k: {m: spearman([r[k] for r in dry], [r[m] for r in dry]) for m in ('within1', 'passes')} for k in F}
json.dump({'rows': rows, 'corr': corr, 'corr_dry': corr_dry}, open('closeness.json', 'w'), indent=1)
fmt = lambda v, d=2: '–' if v is None else (f'{v:.{d}f}' if isinstance(v, float) else str(v))
print(f"{'R':>2} {'race':16} {'within1':>7} {'pass/lap':>8} {'tow':>5} {'deg':>6} {'trk':>4} {'sprd':>5} {'flat':>5} {'sc':>3} rain")
for r in rows:
    print(f"{r['round']:>2} {r['race'][:16]:16} {fmt(r['within1']):>7} {fmt(r['passes']):>8} {fmt(r['tow'],1):>5} {fmt(r['deg'],3):>6} {fmt(r['track'],0):>4} {fmt(r['spread']):>5} {fmt(r['flat']):>5} {r['sc']:>3} {'wet' if r['rain'] else ''}")
print('\nSpearman rho (all races / dry only)')
for k in F: print(f"  {k:7} within1 {fmt(corr[k]['within1'])} / {fmt(corr_dry[k]['within1'])}   passes {fmt(corr[k]['passes'])} / {fmt(corr_dry[k]['passes'])}")
