"""Builds the HyperFrames animatic (animatic/index.html + compositions/hook.html + compositions/lastlap.html).

    python3 build_replay.py      # OpenF1 position + speed  -> animatic/compositions/replay-data.json
    python3 build_animatic.py    # scenes, with every number inlined from the data

Scene 1 (hook): gap between P1 and P2 on every lap (the app's racedetail.js, from OpenF1), counting down to the closest.
Scene 2 (last lap): the real run from the last chicane to Turn 1 on lap 49/50, cars placed from OpenF1 location data.
"""
import json, math, os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'animatic')
RD = json.loads(open('/home/user/app/racedetail.js').read().split('|| {}, ', 1)[1].rsplit(');', 1)[0])['21']
R = json.load(open(os.path.join(OUT, 'compositions', 'replay-data.json')))

W, H = 1080, 1920
C = dict(bg='#0E0F12', card='#17191E', card2='#1E2128', fg='#F2F2F0', soft='#B9BDC4', muted='#7D828C', red='#E10600',
         amber='#F5B700', mer='#27E0C2', mcl='#FF8A1F', mcl2='#FFC38A', rbr='#3B6FD8')
FONTS = '''
@font-face { font-family: "Archivo"; src: url("assets/fonts/Archivo.ttf"); font-weight: 100 900; font-stretch: 62% 125%; }
@font-face { font-family: "Archivo"; src: url("assets/fonts/Archivo-Italic.ttf"); font-weight: 100 900; font-stretch: 62% 125%; font-style: italic; }
@font-face { font-family: "Chakra Petch"; src: url("assets/fonts/ChakraPetch-SemiBold.ttf"); font-weight: 600; }
@font-face { font-family: "Chakra Petch"; src: url("assets/fonts/ChakraPetch-Bold.ttf"); font-weight: 700; }'''
BASE = f'''
#root {{ position: absolute; inset: 0; background: {C['bg']}; color: {C['fg']}; overflow: hidden; font-family: "Archivo", sans-serif; }}
.kick {{ font: 500 30px "JetBrains Mono", monospace; letter-spacing: .16em; text-transform: uppercase; color: #FF5A4F; }}
.disp {{ font-family: "Archivo"; font-style: italic; font-weight: 900; font-stretch: 112%; text-transform: uppercase; line-height: .92; letter-spacing: -.01em; }}
.num {{ font-family: "Chakra Petch"; font-weight: 700; font-variant-numeric: tabular-nums; }}
.mono {{ font-family: "JetBrains Mono", monospace; }}
  .src {{ position: absolute; left: 120px; width: 660px; font: 400 28px "JetBrains Mono", monospace; letter-spacing: .06em; color: {C['muted']}; }}'''

# ---------------------------------------------------------------- scene 1: hook
DUR1 = 4.6
gap = RD['gap12']; N = len(gap)
sc = set()
for e in RD['events']:
    if e['type'] in ('sc', 'vsc'): sc |= set(range(e['lap'], e.get('to', e['lap']) + 1))
green = [(l, g) for l, g in enumerate(gap, 1) if l not in sc]
under1 = sum(g < 1 for _, g in green); best_lap, best = min(green, key=lambda t: t[1])
X0, X1, BASEY, PX = 120, 888, 990, 170           # chart box: 1.0 s = 170 px
bw = (X1 - X0) / N
bars = []
for l, g in enumerate(gap, 1):
    h = min(g, 1.55) * PX; x = X0 + (l - 1) * bw + 2
    cls = 'sc' if l in sc else ('best' if l == best_lap else 'g')
    bars.append(f'<rect id="h-bar-{l}" class="bar {cls}" x="{x:.1f}" y="{BASEY - h:.1f}" width="{bw - 4:.1f}" height="{h:.1f}" rx="3"/>')
hook = f'''<template>
<style>{FONTS}{BASE}
#h-title {{ position: absolute; left: 120px; top: 330px; width: 768px; font-size: 100px; }}
#h-title .r {{ color: {C['red']}; }}
#h-sub {{ position: absolute; left: 120px; top: 646px; width: 660px; font: 500 32px "Archivo"; color: {C['soft']}; line-height: 1.25; }}
#h-sub b {{ color: {C['fg']}; }}
#h-chart {{ position: absolute; left: 0; top: 0; width: {W}px; height: {H}px; }}
.bar.g {{ fill: #3A3E47; }} .bar.sc {{ fill: {C['amber']}; opacity: .38; }} .bar.best {{ fill: {C['fg']}; }}
#h-sclab {{ font: 600 28px "JetBrains Mono"; fill: {C['amber']}; letter-spacing: .12em; }}
#h-onelab {{ font: 600 28px "JetBrains Mono"; fill: #FF5A4F; letter-spacing: .1em; }}
#h-count {{ position: absolute; left: 120px; top: 1010px; width: 660px; display: flex; align-items: baseline; gap: 18px; }}
#h-count .v {{ font-size: 130px; line-height: 1; color: {C['fg']}; }}
#h-count .u {{ font: 700 54px "Chakra Petch"; color: {C['soft']}; }}
#h-count .l {{ font: 500 28px "JetBrains Mono"; letter-spacing: .12em; color: {C['muted']}; text-transform: uppercase; margin-left: auto; text-align: right; line-height: 1.3; }}
#h-src {{ top: 1190px; }}
#h-line {{ position: absolute; left: 120px; top: {BASEY - PX - 2}px; width: 768px; height: 4px; background: {C['red']}; transform-origin: 0 50%; }}
</style>
<div id="root" data-composition-id="hook" data-width="{W}" data-height="{H}">
  <div id="h-head" class="clip" data-start="0" data-duration="{DUR1}" data-track-index="1">
    <div id="h-kick" class="kick" style="position:absolute;left:120px;top:288px;">Las Vegas GP · gap P1 to P2</div>
    <div id="h-title" class="disp">Under<br><span class="r">1 second.</span><br>Every lap.</div>
    <div id="h-sub">All <b>{under1} of {len(green)}</b> green-flag laps. Verstappen never shook them.</div>
  </div>
  <svg id="h-chart" class="clip" data-start="0" data-duration="{DUR1}" data-track-index="2" viewBox="0 0 {W} {H}" data-layout-allow-overflow>
    <g id="h-bars">{''.join(bars)}</g>
    <text id="h-sclab" x="{X0 + (min(sc) - 1) * bw:.0f}" y="{BASEY - 1.55 * PX - 14:.0f}">SAFETY CAR</text>
    <text id="h-onelab" x="780" y="{BASEY - PX - 16}" text-anchor="end">1 SECOND</text>
  </svg>
  <div id="h-line" class="clip" data-start="0" data-duration="{DUR1}" data-track-index="3"></div>
  <div id="h-count" class="clip" data-start="0" data-duration="{DUR1}" data-track-index="4">
    <span id="h-num" class="v num">1.000</span><span class="u">s</span>
    <span class="l">Closest:<br>lap {best_lap}</span>
  </div>
  <div id="h-src" class="src clip" data-start="0" data-duration="{DUR1}" data-track-index="5">P1–P2 gap, every lap · OpenF1</div>
</div>
<script>
(() => {{
  const tl = gsap.timeline({{ paused: true }});
  const bars = gsap.utils.toArray("#h-bars rect");
  tl.fromTo("#h-line", {{ scaleX: 0 }}, {{ scaleX: 1, duration: .5, ease: "power3.out" }}, .1);
  tl.fromTo(bars, {{ scaleY: 0, transformOrigin: "50% 100%" }}, {{ scaleY: 1, duration: .32, ease: "power2.out", stagger: .026 }}, .2);
  tl.fromTo(["#h-sclab", "#h-onelab"], {{ opacity: 0 }}, {{ opacity: 1, duration: .25 }}, 1.0);
  tl.to("#h-bars rect.g, #h-bars rect.sc", {{ opacity: .28, duration: .3 }}, 2.0);
  tl.fromTo("#h-bar-{best_lap}", {{ fill: "{C['fg']}" }}, {{ fill: "{C['red']}", duration: .2, repeat: 3, yoyo: true }}, 2.0);
  const n = {{ v: 1 }};
  tl.fromTo(n, {{ v: 1 }}, {{ v: {best}, duration: 1.3, ease: "power3.out",
    onUpdate: () => {{ document.getElementById("h-num").textContent = n.v.toFixed(3); }} }}, 2.0);
  tl.fromTo("#h-count", {{ opacity: 0 }}, {{ opacity: 1, duration: .2 }}, 1.95);
  // hand-off: everything clears except the red 1-second line, which spans the frame
  tl.to(["#h-head", "#h-bars", "#h-sclab", "#h-onelab", "#h-count", "#h-src"], {{ opacity: 0, duration: .35, ease: "power2.in" }}, 3.95);
  tl.to("#h-line", {{ x: -120, width: {W}, duration: .45, ease: "power3.inOut" }}, 3.95);
  window.__timelines["hook"] = tl;
}})();
</script>
</template>'''

# ---------------------------------------------------------------- scene 2: the last straight
INTRO, RP = 0.8, (R['frames'] - 1) / R['fps']
END = INTRO + RP
DUR2 = round(END + 4.4, 2)
line_y = BASEY - PX                                  # where the hook's red line sits
track_d = 'M' + ' L'.join(f'{x},{y}' for x, y in R['track']) + ' Z'
# start/finish bar: perpendicular to the track at the line
tr = R['track']; lx, ly = R['line']
i = min(range(len(tr)), key=lambda k: (tr[k][0] - lx) ** 2 + (tr[k][1] - ly) ** 2)
dx, dy = tr[(i + 3) % len(tr)][0] - tr[i - 3][0], tr[(i + 3) % len(tr)][1] - tr[i - 3][1]; d = math.hypot(dx, dy) or 1
px, py = -dy / d * 140, dx / d * 140
# position order at the start of the replay, then the real changes from the timing feed
order0 = ['ANT', 'PIA', 'NOR']
swaps = sorted({c['t'] for c in R['changes']})
orders, cur = [], {'ANT': 2, 'PIA': 3, 'NOR': 4}
for t in swaps:
    for c in R['changes']:
        if c['t'] == t and c['code'] in cur: cur[c['code']] = c['pos']
    orders.append((t, dict(cur)))
A, Nn, Pp = R['cars']['ANT'], R['cars']['NOR'], R['cars']['PIA']
# biggest deficit while Antonelli is flat out (throttle 100%), so the 'flat out' label is true
flat = [k for k in range(R['frames']) if A['throttle'][k] >= 99]
kmax = max(flat, key=lambda k: max(Nn['speed'][k], Pp['speed'][k]) - A['speed'][k])
dmax = max(Nn['speed'][kmax], Pp['speed'][kmax]) - A['speed'][kmax]
t_gap = INTRO + kmax / R['fps']
data = {'fps': R['fps'], 'frames': R['frames'], 'box': R['box'], 'cars': {k: {kk: v[kk] for kk in ('x', 'y', 'speed', 'throttle')} for k, v in R['cars'].items()}}
col = {'ANT': C['mer'], 'NOR': C['mcl'], 'PIA': C['mcl2'], 'VER': C['rbr']}
name = {'ANT': 'Antonelli', 'NOR': 'Norris', 'PIA': 'Piastri', 'VER': 'Verstappen'}
side = {'ANT': -1, 'NOR': 1, 'PIA': 1, 'VER': 1}
dots = ''.join(f'''<g id="ll-car-{c}" class="car"><circle r="{24 if c == 'ANT' else 19}" fill="{col[c]}" stroke="{C['bg']}" stroke-width="5"/>
  <text x="{side[c] * 38}" y="11" text-anchor="{'end' if side[c] < 0 else 'start'}" class="tag" fill="{col[c]}">{c}</text></g>''' for c in ('VER', 'PIA', 'NOR', 'ANT'))
rows = ''.join(f'''<div id="ll-row-{c}" class="row" style="--c:{col[c]}"><span class="p num" id="ll-p-{c}">P{p}</span><span class="n">{name[c]}</span></div>'''
               for c, p in (('ANT', 2), ('PIA', 3), ('NOR', 4)))
spd = ''.join(f'''<div class="sp" style="--c:{col[c]}"><span class="c">{c}</span><span class="vv"><span class="v num" id="ll-s-{c}">0</span><span class="u">km/h</span></span></div>''' for c in ('ANT', 'NOR', 'PIA'))
swap_js = '\n'.join(
    f'''  tl.to({json.dumps([f"#ll-row-{c}" for c in o])}, {{ y: (i, el) => ({json.dumps(o)}[el.id.slice(7)] - 2) * 86, duration: .35, ease: "power3.inOut" }}, {INTRO + t:.2f});
  tl.call(() => {{ {''.join(f'document.getElementById("ll-p-{c}").textContent = "P{p}"; ' for c, p in o.items())} }}, null, {INTRO + t + .18:.2f});'''
    for t, o in orders)
lastlap = f'''<template>
<style>{FONTS}{BASE}
#ll-map {{ position: absolute; left: 0; top: 0; width: {W}px; height: {H}px; }}
#ll-track-under {{ fill: none; stroke: #1B1D22; stroke-width: 58px; stroke-linejoin: round; }}
#ll-track {{ fill: none; stroke: #2B2F37; stroke-width: 44px; stroke-linejoin: round; }}
#ll-edge {{ fill: none; stroke: #3A3F49; stroke-width: 2px; }}
#ll-trail {{ fill: none; stroke: {C['mer']}; stroke-width: 6px; stroke-linecap: round; opacity: .55; }}
.tag {{ font: 700 30px "Chakra Petch"; letter-spacing: .04em; paint-order: stroke; stroke: {C['bg']}; stroke-width: 8px; }}
#ll-wipe {{ position: absolute; left: 0; top: {line_y - 2}px; width: {W}px; height: 4px; background: {C['red']}; }}
#ll-head {{ position: absolute; left: 120px; top: 288px; width: 768px; }}
#ll-title {{ font-size: 84px; margin-top: 12px; }}
#ll-tower {{ position: absolute; left: 120px; top: 510px; width: 300px; height: 250px; }}
.row {{ position: absolute; left: 0; top: 0; width: 300px; height: 74px; display: flex; align-items: center; gap: 16px; padding: 0 18px;
  background: rgba(23,25,30,.88); border-left: 6px solid var(--c); border-radius: 10px; }}
.row .p {{ font-size: 40px; width: 64px; }} .row .n {{ font: italic 800 30px "Archivo"; font-stretch: 112%; text-transform: uppercase; }}
#ll-x3 {{ position: absolute; left: 640px; top: 512px; font: 600 28px "JetBrains Mono"; letter-spacing: .14em; color: {C['muted']};
  border: 2px solid #3A3F49; border-radius: 999px; padding: 6px 16px; }}
#ll-panel {{ position: absolute; left: 120px; top: 990px; width: 660px; height: 250px; padding: 22px 26px; background: rgba(23,25,30,.9);
  border-radius: 16px; border-top: 4px solid {C['mer']}; }}
#ll-panel .lab {{ font: 500 28px "JetBrains Mono"; letter-spacing: .14em; color: {C['muted']}; text-transform: uppercase; }}
.sps {{ display: flex; justify-content: space-between; margin-top: 10px; }}
.sp {{ display: flex; flex-direction: column; }} .sp .c {{ font: 700 30px "Chakra Petch"; color: var(--c); letter-spacing: .06em; }}
.sp .vv {{ display: flex; align-items: baseline; gap: 6px; }} .sp .v {{ font-size: 68px; line-height: 1.05; }} .sp .u {{ font: 500 28px "JetBrains Mono"; color: {C['muted']}; }}
#ll-thr {{ position: absolute; left: 26px; right: 26px; bottom: 20px; height: 10px; border-radius: 5px; background: #2B2F37; overflow: hidden; }}
#ll-thr i {{ position: absolute; left: 0; top: 0; bottom: 0; width: 100%; background: {C['mer']}; transform-origin: 0 50%; }}
#ll-delta {{ position: absolute; left: 120px; top: 846px; width: 660px; display: flex; align-items: baseline; gap: 18px; }}
#ll-delta .v {{ font-size: 104px; color: {C['red']}; line-height: 1; }} #ll-delta .t {{ font: italic 800 34px "Archivo"; font-stretch: 112%; text-transform: uppercase; line-height: 1.05; }}
#ll-end {{ position: absolute; inset: 0; background: rgba(14,15,18,.9); }}
#ll-end .big {{ position: absolute; left: 120px; top: 470px; width: 768px; font-size: 168px; line-height: 1; white-space: nowrap; }}
#ll-end .big .to {{ color: {C['red']}; }}
#ll-end .why {{ position: absolute; left: 120px; top: 680px; width: 768px; font-size: 64px; }}
#ll-end .q {{ position: absolute; left: 120px; top: 880px; width: 660px; font: italic 700 38px "Archivo"; color: {C['soft']}; line-height: 1.25; }}
#ll-end .q small {{ display: block; margin-top: 14px; font: 500 28px "JetBrains Mono"; font-style: normal; letter-spacing: .12em; color: {C['muted']}; }}
#ll-src {{ top: 1190px; }}
</style>
<div id="root" data-composition-id="lastlap" data-width="{W}" data-height="{H}">
  <svg id="ll-map" class="clip" data-start="0" data-duration="{DUR2}" data-track-index="1" viewBox="0 0 {W} {H}" data-layout-allow-overflow data-layout-ignore>
    <g id="ll-cam">
      <path id="ll-track-under" d="{track_d}" vector-effect="non-scaling-stroke"/>
      <path id="ll-track" d="{track_d}" vector-effect="non-scaling-stroke" pathLength="1"/>
      <path id="ll-trail" d="" vector-effect="non-scaling-stroke"/>
      <line id="ll-sf" x1="{lx - px:.0f}" y1="{ly - py:.0f}" x2="{lx + px:.0f}" y2="{ly + py:.0f}" stroke="#fff" stroke-width="8" stroke-dasharray="8 8" vector-effect="non-scaling-stroke"/>
    </g>
    <g id="ll-cars">{dots}</g>
  </svg>
  <div id="ll-wipe" class="clip" data-start="0" data-duration="0.8" data-track-index="2"></div>
  <div id="ll-hud" class="clip" data-start="0" data-duration="{END:.2f}" data-track-index="3">
    <div id="ll-head"><div class="kick">Lap 49 → 50 · real car positions</div><div id="ll-title" class="disp">The last<br>straight.</div></div>
    <div id="ll-x3">3× speed</div>
    <div id="ll-tower">{rows}</div>
    <div id="ll-delta"><span class="v num" id="ll-dv">−{dmax}</span><span class="t">km/h.<br>Flat out.</span></div>
    <div id="ll-panel"><div class="lab">Speed · bar: Antonelli throttle</div><div class="sps">{spd}</div><div id="ll-thr"><i id="ll-thr-bar"></i></div></div>
  </div>
  <div id="ll-end" class="clip" data-start="{END:.2f}" data-duration="{DUR2 - END:.2f}" data-track-index="4">
    <div class="big disp num">P2<span class="to"> → </span>P4</div>
    <div class="why disp">Battery empty.<br>Two cars by.</div>
    <div class="q">“Probably it was a mistake on my side.”<small>Kimi Antonelli · via formula1.com</small></div>
    <div id="ll-src" class="src">OpenF1 · position &amp; speed data</div>
  </div>
</div>
<script>
(() => {{
  const D = {json.dumps(data, separators=(',', ':'))};
  const INTRO = {INTRO}, END = {END:.3f}, DUR = {DUR2};
  const cam = document.getElementById("ll-cam"), trail = document.getElementById("ll-trail");
  const cars = Object.fromEntries(Object.keys(D.cars).map(c => [c, document.getElementById("ll-car-" + c)]));
  const sp = Object.fromEntries(["ANT", "NOR", "PIA"].map(c => [c, document.getElementById("ll-s-" + c)]));
  const thr = document.getElementById("ll-thr-bar");
  const b = D.box, bcx = (b[0] + b[2]) / 2, bcy = (b[1] + b[3]) / 2;
  const kWide = Math.min(760 / (b[2] - b[0]), 1500 / (b[3] - b[1]));
  const ease = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
  const at = (arr, f) => {{ const i = Math.floor(f), j = Math.min(i + 1, arr.length - 1); return arr[i] + (arr[j] - arr[i]) * (f - i); }};
  function draw(tau) {{
    const r = Math.max(0, Math.min(tau - INTRO, (D.frames - 1) / D.fps));
    const f = r * D.fps, A = D.cars.ANT;
    const ax = at(A.x, f), ay = at(A.y, f);
    // camera: whole run, then follow Antonelli close, then pull back for the result
    const zin = ease((tau - 1.4) / 1.4), zout = ease((tau - (END - .2)) / .9);
    const w = zin * (1 - zout);
    const k = kWide + (0.3 - kWide) * w;
    const cx = bcx + (ax - 110 / k - bcx) * w, cy = bcy + (ay + 200 / k - bcy) * w;
    cam.setAttribute("transform", `translate(540 960) scale(${{k}}) translate(${{-cx}} ${{-cy}})`);
    for (const c in cars) {{
      const x = (at(D.cars[c].x, f) - cx) * k + 540, y = (at(D.cars[c].y, f) - cy) * k + 960;
      cars[c].setAttribute("transform", `translate(${{x.toFixed(1)}} ${{y.toFixed(1)}})`);
    }}
    let p = "";
    for (let i = Math.max(0, Math.floor(f) - 40); i <= Math.floor(f); i++) p += (p ? " L" : "M") + A.x[i] + "," + A.y[i];
    trail.setAttribute("d", p);
    for (const c in sp) sp[c].textContent = Math.round(at(D.cars[c].speed, f));
    thr.style.transform = `scaleX(${{at(A.throttle, f) / 100}})`;
  }}
  const tl = gsap.timeline({{ paused: true }});
  const clock = {{ tau: 0 }};
  tl.fromTo(clock, {{ tau: 0 }}, {{ tau: DUR, duration: DUR, ease: "none", onUpdate: () => draw(clock.tau) }}, 0);
  tl.fromTo("#ll-wipe", {{ scaleX: 1 }}, {{ scaleX: 0, duration: .6, ease: "power3.in" }}, 0);
  tl.fromTo("#ll-track", {{ strokeDasharray: "1 1", strokeDashoffset: 1 }}, {{ strokeDashoffset: 0, duration: .9, ease: "power2.inOut" }}, 0);
  tl.fromTo("#ll-cars", {{ opacity: 0 }}, {{ opacity: 1, duration: .3 }}, .5);
  tl.fromTo("#ll-head", {{ opacity: 0, y: 24 }}, {{ opacity: 1, y: 0, duration: .4, ease: "power3.out" }}, .25);
  tl.fromTo(["#ll-tower", "#ll-x3"], {{ opacity: 0, x: -24 }}, {{ opacity: 1, x: 0, duration: .4, ease: "power3.out" }}, .45);
  tl.fromTo("#ll-panel", {{ opacity: 0, y: 30 }}, {{ opacity: 1, y: 0, duration: .4, ease: "power3.out" }}, .6);
  tl.fromTo(".row", {{ y: (i) => i * 86 }}, {{ y: (i) => i * 86, duration: .01 }}, 0);
{swap_js}
  tl.fromTo("#ll-delta", {{ opacity: 0, scale: .8, transformOrigin: "0% 100%" }}, {{ opacity: 1, scale: 1, duration: .3, ease: "back.out(2)" }}, {t_gap - .3:.2f});
  tl.fromTo("#ll-end", {{ opacity: 0 }}, {{ opacity: 1, duration: .35 }}, END);
  tl.fromTo("#ll-end .big", {{ opacity: 0, y: 40 }}, {{ opacity: 1, y: 0, duration: .45, ease: "power4.out" }}, END + .05);
  tl.fromTo("#ll-end .why", {{ opacity: 0, y: 30 }}, {{ opacity: 1, y: 0, duration: .4, ease: "power3.out" }}, END + .4);
  tl.fromTo("#ll-end .q", {{ opacity: 0 }}, {{ opacity: 1, duration: .4 }}, END + .8);
  window.__timelines["lastlap"] = tl;
}})();
</script>
</template>'''

TOTAL = round(DUR1 + DUR2, 2)
# sound: CC0 effects from the sound-effects skill; each clip starts so its measured peak lands one frame after its picture
FR = 1 / 30
PEAK = {'whoosh': .085, 'pop': .005, 'kenney-interface-pluck-001': 0, 'kenney-interface-drop-002': 0, 'impact': .058, 'riser': 1.953}
DURS = {'whoosh': .424, 'pop': .114, 'kenney-interface-pluck-001': .097, 'kenney-interface-drop-002': .186, 'impact': .271, 'riser': 2.015}
pops = ['pop', 'kenney-interface-drop-002', 'kenney-interface-pluck-001']
cues = [('sfx-closest', 'kenney-interface-pluck-001', 2.0, .7, 2), ('sfx-cut', 'whoosh', DUR1, .8, 2)]
for n, (t, _) in enumerate(orders):
    cues.append((f'sfx-swap{n + 1}', pops[n % 3], DUR1 + INTRO + t + .18, .75, 2))
cues.append(('sfx-delta', 'pop', DUR1 + t_gap - .3 + .12, .75, 2))
hit = DUR1 + END + .12
cues.append(('sfx-impact', 'impact', hit, 1.0, 2))
cues.append(('sfx-riser', 'riser', hit, .55, 3))
audio = '\n'.join(f'      <audio id="{i}" class="clip" src="assets/sfx/{f}.wav" data-start="{max(0, t + FR - PEAK[f]):.3f}" data-duration="{DURS[f]}" data-track-index="{lane}" data-volume="{v}"></audio>'
                  for i, f, t, v, lane in sorted(cues, key=lambda c: c[2]))
index = f'''<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width={W}, height={H}" />
    <script src="assets/vendor/gsap.min.js"></script>
    <style>
      * {{ margin: 0; padding: 0; box-sizing: border-box; }}
      html, body {{ margin: 0; width: {W}px; height: {H}px; overflow: hidden; background: {C['bg']}; }}
      #root {{ position: relative; width: 100%; height: 100%; }}
      #bg {{ position: absolute; inset: 0; background: {C['bg']}; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{TOTAL}" data-width="{W}" data-height="{H}">
      <div id="bg"></div>
      <div id="hook" data-composition-id="hook" data-composition-src="compositions/hook.html" data-start="0" data-duration="{DUR1}"
        data-track-index="1" data-track-kind="graphics" data-width="{W}" data-height="{H}"></div>
      <div id="lastlap" data-composition-id="lastlap" data-composition-src="compositions/lastlap.html" data-start="{DUR1}" data-duration="{DUR2}"
        data-track-index="1" data-track-kind="graphics" data-width="{W}" data-height="{H}"></div>
{audio}
    </div>
    <script>
      window.__timelines["main"] = gsap.timeline({{ paused: true }});
    </script>
  </body>
</html>
'''
open(os.path.join(OUT, 'index.html'), 'w').write(index)
open(os.path.join(OUT, 'compositions', 'hook.html'), 'w').write(hook)
open(os.path.join(OUT, 'compositions', 'lastlap.html'), 'w').write(lastlap)
print(f'hook {DUR1}s, last lap {DUR2}s, total {TOTAL}s | under 1 s: {under1}/{len(green)} | closest lap {best_lap}: {best}s | max deficit {dmax} km/h at replay {t_gap:.2f}s')
