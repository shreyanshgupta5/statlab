"""Last-lap replay data for the animatic, from OpenF1 location + car_data (data/*.json, fetched for session 11420).
Writes animatic/compositions/replay-data.js: the track path (rotated so the Strip runs vertically) and, per car, position,
speed and throttle at every video frame of the replay. Real time T0..T1 is replayed at SPEED x."""
import json, math
from datetime import datetime
ts = lambda s: datetime.fromisoformat(s).timestamp()
T0, T1 = ts('2026-11-22T05:29:29.0+00:00'), ts('2026-11-22T05:29:56.0+00:00')
FPS, SPEED = 30, 3.0
CARS = {12: 'ANT', 1: 'NOR', 81: 'PIA', 3: 'VER'}
LAP50 = ts('2026-11-22T05:29:51.373+00:00')

loc = {n: json.load(open(f'data/loc_{n}.json')) for n in CARS}
car = {n: json.load(open(f'data/car_{n}.json')) for n in CARS}
# reference path: Verstappen's full lap 50, smoothed (Chaikin) for round corners
ref = [(p['x'], p['y']) for p in loc[3] if LAP50 - 0.5 <= ts(p['date']) <= LAP50 + 97.5]
for _ in range(3):
    out = []
    for a, b in zip(ref, ref[1:] + ref[:1]):
        out += [(0.75*a[0]+0.25*b[0], 0.75*a[1]+0.25*b[1]), (0.25*a[0]+0.75*b[0], 0.25*a[1]+0.75*b[1])]
    ref = out
cum = [0.0]
for a, b in zip(ref, ref[1:] + ref[:1]): cum.append(cum[-1] + math.dist(a, b))
L = cum[-1]

def project(x, y, hint=None):
    best = None
    rng = range(len(ref)) if hint is None else [(hint + k) % len(ref) for k in range(-40, 120)]
    for i in rng:
        a, b = ref[i], ref[(i + 1) % len(ref)]
        dx, dy = b[0]-a[0], b[1]-a[1]; d2 = dx*dx+dy*dy or 1
        t = max(0, min(1, ((x-a[0])*dx + (y-a[1])*dy) / d2))
        px, py = a[0]+t*dx, a[1]+t*dy; e = (px-x)**2+(py-y)**2
        if best is None or e < best[0]: best = (e, i, cum[i] + t*math.dist(a, b))
    return best[1], best[2]

def at_progress(s):
    s %= L
    lo, hi = 0, len(cum) - 1
    while hi - lo > 1:
        m = (lo + hi) // 2
        if cum[m] <= s: lo = m
        else: hi = m
    a, b = ref[lo % len(ref)], ref[(lo + 1) % len(ref)]; seg = cum[lo+1] - cum[lo] or 1; t = (s - cum[lo]) / seg
    return a[0] + t*(b[0]-a[0]), a[1] + t*(b[1]-a[1])

def series(n):
    pts = [p for p in loc[n] if T0 - 3 <= ts(p['date']) <= T1 + 3]
    prog, hint, off, last = [], None, 0.0, None
    for p in pts:
        hint, s = project(p['x'], p['y'], hint)
        if last is not None: off = min((off - L, off, off + L), key=lambda o: abs(s + o - last))   # unwrap at the line
        prog.append((ts(p['date']), s + off)); last = s + off
    cd = [(ts(c['date']), c['speed'], c['throttle']) for c in car[n] if T0 - 3 <= ts(c['date']) <= T1 + 3]
    return prog, cd

def interp(seq, t, k=1):
    for (ta, *va), (tb, *vb) in zip(seq, seq[1:]):
        if ta <= t <= tb:
            f = (t - ta) / ((tb - ta) or 1); return va[k-1] + f * (vb[k-1] - va[k-1])
    return (seq[0] if t < seq[0][0] else seq[-1])[k]

frames = int((T1 - T0) / SPEED * FPS) + 1
data = {}
allxy = []
for n, code in CARS.items():
    prog, cd = series(n)
    xs, ys, sp, th = [], [], [], []
    for f in range(frames):
        t = T0 + f / FPS * SPEED
        x, y = at_progress(interp(prog, t)); xs.append(x); ys.append(y); allxy.append((x, y))
        sp.append(round(interp(cd, t, 1))); th.append(round(interp(cd, t, 2)))
    data[code] = {'x': xs, 'y': ys, 'speed': sp, 'throttle': th}
# rotate so the start/finish straight (direction at the line) points up the screen
# Antonelli's run from the slowest point of the last chicane to the line, where the passes happen, points up the screen
A = data['ANT']; k0 = min(range(len(A['speed']) // 2), key=lambda k: A['speed'][k])
k1 = int((LAP50 - T0) / SPEED * FPS)
ang = math.atan2(A['y'][k1] - A['y'][k0], A['x'][k1] - A['x'][k0])
rot = -math.pi/2 - ang
R = lambda x, y: (x*math.cos(rot) - y*math.sin(rot), x*math.sin(rot) + y*math.cos(rot))
track = [R(x, y) for x, y in ref]
for d in data.values():
    pts = [R(x, y) for x, y in zip(d['x'], d['y'])]; d['x'] = [round(p[0]) for p in pts]; d['y'] = [round(p[1]) for p in pts]
act = [R(x, y) for x, y in allxy]
box = [min(p[0] for p in act), min(p[1] for p in act), max(p[0] for p in act), max(p[1] for p in act)]
fbox = [min(p[0] for p in track), min(p[1] for p in track), max(p[0] for p in track), max(p[1] for p in track)]
# real position changes (OpenF1 position feed), as replay seconds
pos = json.load(open('data/position.json'))
changes = [{'t': round((ts(p['date']) - T0) / SPEED, 2), 'code': CARS[p['driver_number']], 'pos': p['position']}
           for p in pos if p['driver_number'] in CARS and T0 <= ts(p['date']) <= T1]
line = R(*at_progress(0))
out = {'fps': FPS, 'speed': SPEED, 'frames': frames, 'start': '05:29:29 UTC', 'track': [[round(x), round(y)] for x, y in track],
       'box': [round(v) for v in box], 'trackBox': [round(v) for v in fbox], 'line': [round(line[0]), round(line[1])], 'changes': changes, 'cars': data}
json.dump(out, open('animatic/compositions/replay-data.json', 'w'), separators=(',', ':'))
print('frames', frames, 'replay s', frames / FPS, 'track len m', round(L / 10), 'action box', out['box'], 'track box', out['trackBox'])
print('changes', changes)
for code in ('ANT', 'NOR', 'PIA'):
    print(code, 'max speed on straight', max(data[code]['speed'][int(13/SPEED*FPS):int(23/SPEED*FPS)]))
