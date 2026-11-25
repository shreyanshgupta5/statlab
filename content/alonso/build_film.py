"""Builds the HyperFrames film "How Alonso could have been a 5-time champion" (film/).

    python3 build_film.py                 # timing estimated from the script (scratch pace)
    python3 build_film.py --vo vo.json    # timing from the recorded voiceover: {"words": [[start, end], ...]} one per script word

Every visual cue is tied to a word of the voiceover, so re-timing to a real recording only changes the word times.
Numbers come from data/ (Jolpica race results), checked in SCRIPT.md.
"""
import json, math, os, random, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
FILM = os.path.join(HERE, 'film')
W, H, FPS = 1080, 1920, 30

# ------------------------------------------------------------------ the voiceover, by chapter
VO = [
    ('hook',   "Fernando Alonso has two world titles. He was eight points away from five."),
    ('renault', "2005. A 24-year-old at Renault ends Michael Schumacher's reign. In 2006 he beats him again, head to head. Two titles by 25. Everyone expected a dynasty."),
    ('mclaren', "2007. McLaren, alongside a rookie called Lewis Hamilton. In Hungary he's moved from pole to sixth on the grid, for holding Hamilton up in the pit lane. In Japan he crashes out in the rain. In Brazil, Kimi Räikkönen takes the title. Alonso misses it by one point."),
    ('f2010',  "2010. Ferrari. He arrives in Abu Dhabi leading the championship. Fourth place would be enough. Ferrari pits him early to cover Webber, and he comes out behind Vitaly Petrov's Renault. He never gets past. Seventh. Vettel is champion, by four points."),
    ('f2012',  "2012. A slower car, and somehow a 44-point lead by July. Then Spa: Grosjean's Lotus flies over his car at the first corner. Out. Then Suzuka: a puncture at the start. Out. Two first-lap exits, zero points. Vettel wins the title, by three."),
    ('reveal', "One point. Four points. Three points. Eight points between two titles and five."),
    ('today',  "He hasn't won a race since 2013. He's 45 now, with 449 Grands Prix behind him, and he's still out there, chasing number three."),
]
SPOKEN_LEN = {'2005': 4, '2006': 4, '2007': 4, '2010': 3, '2012': 3, '2013': 3, '24-year-old': 4, '44-point': 3, '449': 5, '25': 2, '45': 2}

words = []                                   # (chapter, text, start, end)
def scratch_timing():
    t = 0.4
    for ci, (ch, text) in enumerate(VO):
        if ci: t += 0.7
        for w in text.split():
            core = w.strip('.,:')
            syl = SPOKEN_LEN.get(core, max(1, len(re.findall(r'[aeiouyäö]+', core.lower()))))
            d = 0.12 + 0.17 * syl
            words.append((ch, w, t, t + d)); t += d
            if w.endswith('.'): t += 0.38
            elif w.endswith(':'): t += 0.3
            elif w.endswith(','): t += 0.16
            else: t += 0.03
def vo_timing(path):
    wt = json.load(open(path))['words']
    flat = [(ch, w) for ch, text in VO for w in text.split()]
    assert len(wt) == len(flat), f'{len(wt)} times for {len(flat)} words'
    for (ch, w), (a, b) in zip(flat, wt): words.append((ch, w, a, b))
if '--vo' in sys.argv: vo_timing(sys.argv[sys.argv.index('--vo') + 1])
else: scratch_timing()

CH = [c for c, _ in VO]
first = {c: min(s for ch, _, s, _ in words if ch == c) for c in CH}
last = {c: max(e for ch, _, _, e in words if ch == c) for c in CH}
START = {c: 0 if i == 0 else round(first[c] - 0.35, 2) for i, c in enumerate(CH)}
END_CARD = 3.8
TOTAL = round(last['today'] + END_CARD, 2)
DUR = {c: round((START[CH[i + 1]] if i + 1 < len(CH) else TOTAL) - START[c], 2) for i, c in enumerate(CH)}

def T(ch, key, n=1):
    """Local time (in the chapter's scene) of the n-th word starting with key."""
    k = 0
    for c, w, s, e in words:
        if c == ch and w.strip('.,:').lower().startswith(key.lower()):
            k += 1
            if k == n: return round(s - START[ch], 3)
    raise KeyError(f'{ch}: {key} #{n}')
def TE(ch, key, n=1):
    k = 0
    for c, w, s, e in words:
        if c == ch and w.strip('.,:').lower().startswith(key.lower()):
            k += 1
            if k == n: return round(e - START[ch], 3)
    raise KeyError(key)

# ------------------------------------------------------------------ data (checked in SCRIPT.md)
D = os.path.join(HERE, 'data')
def cum(f):
    r = json.load(open(os.path.join(D, f)))['MRData']['RaceTable']['Races']; c = 0; out = []
    for x in r: c += float(x['Results'][0]['points']); out.append(c)
    return out, [x['raceName'].replace(' Grand Prix', '') for x in r]
a12, races12 = cum('alonso_2012.json'); v12, _ = cum('res_2012_drivers_vettel.json')
lead12 = [int(a - b) for a, b in zip(a12, v12)]
def standing(y, name):
    for s in json.load(open(os.path.join(D, f'standings_{y}.json')))['MRData']['StandingsTable']['StandingsLists'][0]['DriverStandings']:
        if s['Driver']['familyName'] == name: return int(float(s['points']))
GAP = {2005: standing(2005, 'Alonso') - standing(2005, 'Räikkönen'), 2006: standing(2006, 'Alonso') - standing(2006, 'Schumacher'),
       2007: standing(2007, 'Alonso') - standing(2007, 'Räikkönen'), 2010: standing(2010, 'Alonso') - standing(2010, 'Vettel'),
       2012: standing(2012, 'Alonso') - standing(2012, 'Vettel')}
assert GAP == {2005: 21, 2006: 13, 2007: -1, 2010: -4, 2012: -3}, GAP

# ------------------------------------------------------------------ look
ERA = {   # background, rays, helmet (shell, stripe, line)
    'hook':    ('#121318', 'rgba(225,6,0,.10)',      ('#1F3F95', '#FFD200', '#C8102E')),
    'renault': ('#0B3D91', 'rgba(255,210,0,.10)',    ('#0B4EA2', '#FFD200', '#111111')),
    'mclaren': ('#4B5159', 'rgba(255,255,255,.07)',  ('#C9CED4', '#E10600', '#1A1A1A')),
    'f2010':   ('#A70D12', 'rgba(255,214,0,.09)',    ('#DC0000', '#FFD200', '#111111')),
    'f2012':   ('#5E0A0F', 'rgba(255,255,255,.06)',  ('#DC0000', '#FFFFFF', '#111111')),
    'reveal':  ('#14161C', 'rgba(239,230,210,.06)',  ('#1F3F95', '#FFD200', '#C8102E')),
    'today':   ('#00352F', 'rgba(206,220,0,.08)',    ('#00594F', '#CEDC00', '#111111')),
}
SHARED_CSS = '''
@font-face { font-family: "Oswald"; src: url("fonts/Oswald.ttf"); font-weight: 200 700; }
@font-face { font-family: "Caveat"; src: url("fonts/Caveat.ttf"); font-weight: 400 700; }
@font-face { font-family: "Archivo"; src: url("fonts/Archivo-Italic.ttf"); font-weight: 100 900; font-style: italic; }
.ray { position: absolute; left: 0; top: 0; width: 1080px; height: 1920px; }
.grain { position: absolute; inset: 0; background: url("tex/grain.png") 0 0 / 540px 960px; opacity: .07; mix-blend-mode: overlay; pointer-events: none; }
.card { position: absolute; background: #F1E8D4; color: #2A2522; box-shadow: 0 18px 30px rgba(0,0,0,.35); }
.card::after { content: ""; position: absolute; inset: 0; background: url("tex/grain.png") 0 0 / 540px 960px; opacity: .10; mix-blend-mode: multiply; }
.ctitle { position: absolute; left: 30px; top: 20px; font: 700 40px "Oswald"; letter-spacing: .01em; text-transform: uppercase; }
.hand { font-family: "Caveat"; font-weight: 700; }
.stamp.solid { background: #F1E8D4; box-shadow: 0 8px 16px rgba(0,0,0,.3); }
.tape { position: absolute; padding: 6px 24px 8px; background: rgba(238,224,186,.95); color: #2A2522; font: 700 46px "Caveat"; white-space: nowrap; box-shadow: 0 6px 12px rgba(0,0,0,.25); }
.stamp { position: absolute; padding: 4px 20px; border: 7px solid #D7261E; color: #D7261E; font: 700 64px "Oswald"; text-transform: uppercase; letter-spacing: .03em; white-space: nowrap;
  -webkit-mask-image: url("tex/stamp-mask.png"); mask-image: url("tex/stamp-mask.png"); -webkit-mask-size: 300px 150px; mask-size: 300px 150px; }
.big { position: absolute; font: 700 120px "Oswald"; line-height: 1; color: #fff; font-variant-numeric: tabular-nums; text-shadow: 0 6px 0 rgba(0,0,0,.25); }
.lab { font: 500 28px "JetBrains Mono", monospace; letter-spacing: .12em; text-transform: uppercase; }
.helm { position: absolute; filter: drop-shadow(0 16px 18px rgba(0,0,0,.4)); }
.row3 { display: flex; justify-content: space-between; align-items: baseline; font: 700 46px "Oswald"; padding: 6px 0; border-top: 2px solid rgba(42,37,34,.18); }
.row3:first-of-type { border-top: 0; }
.row3 .n { font-size: 40px; text-transform: uppercase; } .row3.me { color: #C8102E; }
'''

# ------------------------------------------------------------------ pieces
def helmet(uid, cols, size, x, y, look=4):
    h1, h2, h3 = cols; K = '#0A0A0A'; cy = 348
    def eye(cx, side):
        ix = cx + look; inner, outer = cx - side * 30, cx + side * 36
        shape = f'M{cx-34} {cy} Q{cx} {cy-20} {cx+34} {cy} Q{cx} {cy+14} {cx-34} {cy} Z'
        return (f'<path d="{shape}" fill="#FBF8F2"/><clipPath id="{uid}e{side}"><path d="{shape}"/></clipPath>'
                f'<g clip-path="url(#{uid}e{side})"><circle cx="{ix}" cy="{cy}" r="14" fill="#5A4632"/><circle cx="{ix}" cy="{cy}" r="6.5" fill="{K}"/><circle cx="{ix+4}" cy="{cy-5}" r="4" fill="#fff"/></g>'
                f'<path d="M{cx-36} {cy+1} Q{cx} {cy-22} {cx+36} {cy+1}" fill="none" stroke="{K}" stroke-width="5" stroke-linecap="round"/>'
                f'<path d="M{inner} {cy-26} Q{(inner+outer)/2} {cy-44} {outer} {cy-36}" fill="none" stroke="#3A2A1E" stroke-width="9" stroke-linecap="round"/>')
    shell = 'M300 130 C420 130 500 215 500 340 C500 430 480 500 440 545 C400 575 200 575 160 545 C120 500 100 430 100 340 C100 215 180 130 300 130 Z'
    hgt = round(size * 480 / 440)
    return (f'<svg id="{uid}" class="helm" viewBox="80 110 440 480" style="left:{x}px;top:{y}px;width:{size}px;height:{hgt}px">'
            f'<defs><radialGradient id="{uid}g" cx=".38" cy=".3" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".38"/></radialGradient>'
            f'<linearGradient id="{uid}v" x1="0" x2="1"><stop offset="0" stop-color="#1B1030"/><stop offset=".45" stop-color="#2B3F8F"/><stop offset=".75" stop-color="#9B3FB5"/><stop offset="1" stop-color="#F28B2E"/></linearGradient>'
            f'<clipPath id="{uid}c"><path d="{shell}"/></clipPath></defs>'
            f'<path d="{shell}" fill="{h1}"/><g clip-path="url(#{uid}c)"><path d="M90 410 C170 330 430 330 510 410 L510 470 C430 380 170 380 90 470 Z" fill="{h2}"/>'
            f'<path d="M90 450 C170 380 430 380 510 450 L510 462 C430 392 170 392 90 462 Z" fill="{h3}"/><path d="M276 120 C284 190 288 236 286 258 L314 258 C312 236 316 190 324 120 Z" fill="{h2}"/>'
            f'<path d="M200 505 H400 V528 H200 Z" fill="rgba(0,0,0,.55)"/><rect x="80" y="100" width="440" height="500" fill="url(#{uid}g)"/></g>'
            f'<path d="{shell}" fill="none" stroke="{K}" stroke-width="6"/>'
            f'<path d="M170 296 H430 Q458 296 458 324 V362 Q458 392 428 394 C360 400 240 400 172 394 Q142 392 142 362 V324 Q142 296 170 296 Z" fill="#141518" stroke="{K}" stroke-width="6"/>'
            f'<path d="M178 306 H422 Q446 306 446 328 V360 Q446 382 420 384 C356 389 244 389 180 384 Q154 382 154 360 V328 Q154 306 178 306 Z" fill="#E9E6E0"/>'
            f'<path d="M196 316 H404 Q426 316 426 336 V358 Q426 374 404 376 C350 380 250 380 196 376 Q174 374 174 358 V336 Q174 316 196 316 Z" fill="#E2B48E"/>'
            f'{eye(250, -1)}{eye(350, 1)}'
            f'<path d="M146 252 C200 226 400 226 454 252 L460 298 H140 Z" fill="url(#{uid}v)" stroke="{K}" stroke-width="6" stroke-linejoin="round"/>'
            f'<path d="M176 262 C240 246 300 244 360 248" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="7" stroke-linecap="round"/>'
            f'<circle cx="122" cy="330" r="15" fill="#2A2C31" stroke="{K}" stroke-width="5"/><circle cx="478" cy="330" r="15" fill="#2A2C31" stroke="{K}" stroke-width="5"/></svg>')

def trophy(uid, x, y, filled, s=1.0):
    body = 'M20 8 H90 V40 C90 70 74 86 55 90 C36 86 20 70 20 40 Z M47 90 H63 V112 H47 Z M30 112 H80 V124 H30 Z'
    handles = 'M20 18 C2 18 2 52 22 56 M90 18 C108 18 108 52 88 56'
    if filled:
        paint = f'<path d="{body}" fill="#F4C430" stroke="#7A5A00" stroke-width="4"/><path d="{handles}" fill="none" stroke="#F4C430" stroke-width="7"/>'
    else:
        paint = f'<path d="{body}" fill="none" stroke="rgba(255,255,255,.75)" stroke-width="5" stroke-dasharray="10 8"/><path d="{handles}" fill="none" stroke="rgba(255,255,255,.75)" stroke-width="5" stroke-dasharray="10 8"/>'
    return f'<svg id="{uid}" viewBox="0 0 110 130" style="position:absolute;left:{x}px;top:{y}px;width:{110*s:.0f}px;height:{130*s:.0f}px">{paint}</svg>'

def rays(uid, color):
    cx, cy, R, n = 540, 960, 2000, 22
    paths = []
    for i in range(0, n, 2):
        a0, a1 = 2 * math.pi * i / n, 2 * math.pi * (i + 1) / n
        paths.append(f'M{cx} {cy} L{cx + R*math.cos(a0):.0f} {cy + R*math.sin(a0):.0f} L{cx + R*math.cos(a1):.0f} {cy + R*math.sin(a1):.0f} Z')
    return f'<svg class="ray" viewBox="0 0 {W} {H}" data-layout-ignore><g id="{uid}">' + ''.join(f'<path d="{p}" fill="{color}"/>' for p in paths) + '</g></svg>'

def torn(seed, w, h, bottom=True):
    """clip-path polygon with a torn bottom edge (and a slightly rough top)."""
    r = random.Random(seed); pts = []
    for x in range(0, w + 1, 24): pts.append((x, r.uniform(0, 4)))
    for x in range(w, -1, -18): pts.append((x, h - (r.uniform(2, 14) if bottom else r.uniform(0, 4))))
    return 'polygon(' + ','.join(f'{x}px {y:.0f}px' for x, y in pts) + ')'

# The running chart: "points from the title"
CX, CY, CWID, CHGT = 120, 300, 768, 436
ZERO, PXPT, BX0, BW, BSTEP = 300, 5.4, 92, 92, 130
YEARS = [2005, 2006, 2007, 2010, 2012]
def chart(p, shown, rot=-1.0):
    bars = []
    for i, y in enumerate(YEARS):
        g = GAP[y]; h = max(abs(g) * PXPT, 4); x = BX0 + i * BSTEP
        top = ZERO - h if g > 0 else ZERO
        col = '#E3A92B' if g > 0 else '#C8102E'
        vis = '' if y in shown else 'opacity:0;'
        vy = top - 52 if g > 0 else ZERO + h + 2
        bars.append(f'<div id="{p}-b{y}" style="position:absolute;left:{x}px;top:{top:.0f}px;width:{BW}px;height:{h:.0f}px;background:{col};{vis}"></div>'
                    f'<div id="{p}-v{y}" style="position:absolute;left:{x - 10}px;top:{vy:.0f}px;width:{BW + 20}px;text-align:center;font:700 44px Oswald;color:{col};{vis}">{"+" if g > 0 else "−"}{abs(g)}</div>'
                    f'<div id="{p}-y{y}" class="lab" style="position:absolute;left:{x - 10}px;top:{ZERO + 74}px;width:{BW + 20}px;text-align:center;color:#6B625A;{vis}">{y}</div>')
    return (f'<div id="{p}-chart" class="card" style="left:{CX}px;top:{CY}px;width:{CWID}px;height:{CHGT}px;clip-path:{torn(p, CWID, CHGT)};transform:rotate({rot}deg)">'
            f'<div class="ctitle">Points from the title</div>'
            f'<div class="hand" style="position:absolute;left:32px;top:70px;font-size:34px;color:#6B625A">one bar per title fight</div>'
            f'<div style="position:absolute;left:30px;right:30px;top:{ZERO - 2}px;border-top:4px dashed #2A2522"></div>'
            f'<div class="lab" style="position:absolute;right:30px;top:{ZERO - 44}px;color:#2A2522">champion</div>'
            + ''.join(bars) + '</div>')

# ------------------------------------------------------------------ scene assembly
class Scene:
    def __init__(self, ch):
        self.ch, self.html, self.js, self.sfx = ch, [], [], []
    def add(self, s): self.html.append(s)
    def tw(self, s): self.js.append(s)
    def at(self, key, n=1): return T(self.ch, key, n)
    # motion vocabulary
    def card_in(self, sel, t, rot=0):
        self.tw(f'tl.fromTo("{sel}", {{opacity:0, y:70, rotation:{rot - 7}}}, {{opacity:1, y:0, rotation:{rot}, duration:.45, ease:"back.out(1.5)"}}, {t:.3f});')
    def out(self, sel, t):
        self.tw(f'tl.to("{sel}", {{opacity:0, y:-40, duration:.28, ease:"power2.in"}}, {t:.3f});')
    def pop(self, sel, t, dur=.3):
        self.tw(f'tl.fromTo("{sel}", {{opacity:0, scale:.6}}, {{opacity:1, scale:1, duration:{dur}, ease:"back.out(2.2)"}}, {t:.3f});')
    def fade(self, sel, t, dur=.3):
        self.tw(f'tl.fromTo("{sel}", {{opacity:0}}, {{opacity:1, duration:{dur}}}, {t:.3f});')
    def tape(self, sel, t, rot=-3):
        self.tw(f'tl.fromTo("{sel}", {{opacity:0, scaleX:.15, rotation:{rot}, transformOrigin:"0% 50%"}}, {{opacity:1, scaleX:1, rotation:{rot}, duration:.3, ease:"power3.out"}}, {t:.3f});')
        self.sound('kenney-interface-pluck-001', t + .12, .7)
    def stamp(self, sel, t, rot=-8):
        self.tw(f'tl.fromTo("{sel}", {{opacity:0, scale:2.4, rotation:{rot - 12}}}, {{opacity:.92, scale:1, rotation:{rot}, duration:.2, ease:"power4.in"}}, {t:.3f});')
        self.sound(['kenney-impact-impactpunch-heavy-000', 'kenney-impact-impactpunch-heavy-001'][len(self.sfx) % 2], t + .2, .9)
    def count(self, sel, a, b, t, dur=1.2, dec=0, pre=''):
        self.tw(f'(() => {{ const o = {{v:{a}}}; tl.fromTo(o, {{v:{a}}}, {{v:{b}, duration:{dur}, ease:"power3.out", onUpdate:() => {{ document.querySelector("{sel}").textContent = "{pre}" + o.v.toFixed({dec}); }} }}, {t:.3f}); }})();')
    def bar(self, p, y, t):
        g = GAP[y]
        self.tw(f'tl.fromTo("#{p}-b{y}", {{opacity:1, scaleY:0, transformOrigin:"50% {"100%" if g > 0 else "0%"}"}}, {{opacity:1, scaleY:1, duration:.5, ease:"power3.out"}}, {t:.3f});')
        self.fade(f'#{p}-v{y}', t + .3, .25); self.fade(f'#{p}-y{y}', t, .25)
        self.sound('pop', t + .5, .7)
    def sound(self, name, t, vol): self.sfx.append((name, START[self.ch] + t, vol))
    def write(self):
        bg, ray_col, _ = ERA[self.ch]; p = self.ch
        body = ''.join(self.html)
        doc = f'''<template>
<link rel="stylesheet" href="assets/film.css" />
<style>
#root {{ position: absolute; inset: 0; background: {bg}; overflow: hidden; color: #fff; }}
</style>
<div id="root" data-composition-id="{p}" data-width="{W}" data-height="{H}">
  <div id="{p}-all" class="clip" data-start="0" data-duration="{DUR[p]}" data-track-index="1" data-layout-allow-overlap>
    {rays(p + '-rays', ray_col)}
    {body}
    <div class="grain"></div>
  </div>
</div>
<script>
(() => {{
  const tl = gsap.timeline({{ paused: true }});
  tl.fromTo("#{p}-rays", {{ rotation: 0, svgOrigin: "540 960" }}, {{ rotation: 14, duration: {DUR[p]}, ease: "none" }}, 0);
  {chr(10).join("  " + j for j in self.js)}
  window.__timelines["{p}"] = tl;
}})();
</script>
</template>'''
        open(os.path.join(FILM, 'compositions', p + '.html'), 'w').write(doc)

scenes = {}
def S(ch): scenes[ch] = Scene(ch); return scenes[ch]

# ---- 0 hook
s = S('hook'); hc = ERA['hook'][2]
s.add(helmet('hook-h', hc, 430, 120, 360))
s.add('<div id="hook-two" class="big" style="left:590px;top:390px;font-size:380px">2</div>')
s.add('<div id="hook-five" class="stamp solid" style="left:560px;top:520px;font-size:150px;padding:0 26px;border-width:12px">5?</div>')
for i in range(5):
    s.add(trophy(f'hook-t{i}', 131 + i * 132, 900, i < 2))
s.tw('tl.fromTo("#hook-h", {opacity:1, scale:1}, {scale:1.04, duration:2, ease:"sine.inOut"}, 0);')
s.tw('tl.fromTo("#hook-two", {opacity:1, y:0}, {y:0, duration:.01}, 0);')
s.pop('#hook-t0', s.at('two')); s.pop('#hook-t1', s.at('two') + .12)
s.stamp('#hook-five', s.at('five'), -8)
for i in (2, 3, 4): s.pop(f'#hook-t{i}', s.at('five') + .25 + (i - 2) * .12)
s.tw(f'tl.to("#hook-two", {{opacity:.25, duration:.3}}, {s.at("five"):.3f});')

# ---- 1 Renault 2005-06
s = S('renault'); hc = ERA['renault'][2]
s.add(chart('renault', []))
s.add(helmet('ren-h', hc, 250, 120, 760))
s.add('<div id="ren-tape1" class="tape" style="left:400px;top:740px">2005</div>')
s.add('<div id="ren-n1" class="big" style="left:390px;top:820px;font-size:92px"><span id="ren-a1">0</span><span style="color:#FFD200"> v </span>112</div>')
s.add('<div id="ren-l1" class="lab" style="position:absolute;left:392px;top:930px;color:#FFD200;letter-spacing:.04em">Alonso · Räikkönen</div>')
s.add('<div id="ren-st" class="stamp solid" style="left:130px;top:1010px;font-size:46px">Youngest ever champion (2005)</div>')
s.add('<div id="ren-tape2" class="tape" style="left:400px;top:740px">2006</div>')
s.add('<div id="ren-n2" class="big" style="left:390px;top:820px;font-size:92px"><span id="ren-a2">0</span><span style="color:#FFD200"> v </span>121</div>')
s.add('<div id="ren-l2" class="lab" style="position:absolute;left:392px;top:930px;color:#FFD200;letter-spacing:.04em">Alonso · Schumacher</div>')
s.add('<div id="ren-dyn" class="tape" style="left:420px;top:1010px;font-size:56px">a dynasty?</div>')
s.fade('#renault-chart', 0, .35)
s.card_in('#ren-h', .05)
s.tape('#ren-tape1', s.at('2005')); s.fade('#ren-n1', s.at('2005') + .1); s.count('#ren-a1', 0, 133, s.at('2005') + .1, 1.3); s.fade('#ren-l1', s.at('2005') + .3)
s.bar('renault', 2005, s.at('reign'))
s.stamp('#ren-st', s.at('24-year-old'), -4)
s.out('#ren-st', s.at('In') - .1)
for sel in ('#ren-tape1', '#ren-n1', '#ren-l1'): s.out(sel, s.at('2006') - .25)
s.tape('#ren-tape2', s.at('2006')); s.fade('#ren-n2', s.at('2006') + .1); s.count('#ren-a2', 0, 134, s.at('2006') + .1, 1.3); s.fade('#ren-l2', s.at('2006') + .3)
s.bar('renault', 2006, s.at('head', 1))
s.tape('#ren-dyn', s.at('dynasty'), 3)

# ---- 2 McLaren 2007
s = S('mclaren'); hc = ERA['mclaren'][2]
s.add(chart('mclaren', [2005, 2006]))
s.add(helmet('mcl-h', hc, 200, 120, 740, look=6))
s.add(helmet('mcl-ham', ('#FFD400', '#0B8F3A', '#1C3F94'), 140, 150, 950, look=-6))
s.add('<div id="mcl-rk" class="tape" style="left:150px;top:1062px;font-size:34px;padding:2px 16px 4px">rookie: Hamilton</div>')
s.add(f'<div id="mcl-c1" class="card" style="left:380px;top:740px;width:400px;height:330px;clip-path:{torn(11, 400, 330)}"><div class="ctitle">Hungary</div>'
      '<div class="lab" style="position:absolute;left:30px;top:84px;color:#6B625A">starting grid</div>'
      '<div style="position:absolute;left:30px;top:128px;font:700 86px Oswald;white-space:nowrap">P1<span style="color:#C8102E"> → </span>P6</div></div>')
s.add('<div id="mcl-pen" class="stamp" style="left:500px;top:990px;font-size:48px">Penalty</div>')
s.add(f'<div id="mcl-c2" class="card" style="left:380px;top:740px;width:400px;height:330px;clip-path:{torn(12, 400, 330)}"><div class="ctitle">Japan</div>'
      '<div class="lab" style="position:absolute;left:30px;top:84px;color:#6B625A">Fuji · rain</div>'
      + ''.join(f'<div style="position:absolute;left:{40 + i * 46}px;top:{140 + (i % 3) * 22}px;width:4px;height:70px;background:#5C7FA3;transform:rotate(14deg)"></div>' for i in range(8)) + '</div>')
s.add('<div id="mcl-dnf" class="stamp" style="left:470px;top:960px;font-size:72px">DNF</div>')
s.add(f'<div id="mcl-c3" class="card" style="left:380px;top:740px;width:400px;height:330px;clip-path:{torn(13, 400, 330)}"><div class="ctitle">Final table</div>'
      '<div style="position:absolute;left:30px;right:30px;top:90px">'
      '<div class="row3"><span class="n">Räikkönen</span><span>110</span></div><div class="row3"><span class="n">Hamilton</span><span>109</span></div>'
      '<div class="row3 me"><span class="n">Alonso</span><span>109</span></div></div></div>')
s.add('<div id="mcl-one" class="tape" style="left:420px;top:1090px;font-size:52px">one point.</div>')
s.card_in('#mcl-h', .05)
s.card_in('#mcl-ham', s.at('rookie')); s.tape('#mcl-rk', s.at('Lewis'))
s.card_in('#mcl-c1', s.at('Hungary'), 2); s.stamp('#mcl-pen', s.at('sixth'), -7)
for sel in ('#mcl-c1', '#mcl-pen'): s.out(sel, s.at('Japan') - .25)
s.card_in('#mcl-c2', s.at('Japan'), -2); s.stamp('#mcl-dnf', s.at('crashes'), 6)
for sel in ('#mcl-c2', '#mcl-dnf'): s.out(sel, s.at('Brazil') - .25)
s.card_in('#mcl-c3', s.at('Brazil'), 1)
s.bar('mclaren', 2007, s.at('one'))
s.tape('#mcl-one', s.at('point'), -2)

# ---- 3 Ferrari 2010
s = S('f2010'); hc = ERA['f2010'][2]
s.add(chart('f2010', [2005, 2006, 2007]))
s.add(helmet('f10-h', hc, 230, 120, 770))
s.add(f'<div id="f10-c1" class="card" style="left:380px;top:740px;width:400px;height:330px;clip-path:{torn(21, 400, 330)}"><div class="ctitle">Before Abu Dhabi</div>'
      '<div style="position:absolute;left:30px;right:30px;top:90px">'
      '<div class="row3 me"><span class="n">Alonso</span><span>246</span></div><div class="row3"><span class="n">Webber</span><span>238</span></div>'
      '<div class="row3"><span class="n">Vettel</span><span>231</span></div></div></div>')
s.add('<div id="f10-4th" class="tape" style="left:420px;top:1080px;font-size:52px">4th is enough</div>')
# the Petrov train: a strip of track, a yellow-and-black Renault, Alonso's helmet stuck behind it
s.add(f'<div id="f10-c2" class="card" style="left:120px;top:760px;width:660px;height:300px;clip-path:{torn(22, 660, 300)}"><div class="ctitle">Lap after lap</div>'
      '<div style="position:absolute;left:30px;right:30px;top:190px;height:18px;background:#3A3530;border-radius:9px"></div>'
      '<div id="f10-pet" style="position:absolute;left:300px;top:168px;width:64px;height:64px;border-radius:50%;background:#FFD200;border:8px solid #111"></div>'
      '<div class="lab" style="position:absolute;left:280px;top:100px;color:#2A2522">Petrov</div></div>')
s.add(helmet('f10-hm', hc, 110, 300, 900))
s.add('<div id="f10-p7" class="stamp" style="left:560px;top:870px;font-size:80px">P7</div>')
s.fade('#f10-h', 0, .3)
s.card_in('#f10-c1', s.at('Abu'), 2)
s.tape('#f10-4th', s.at('Fourth'), -3)
for sel in ('#f10-c1', '#f10-4th', '#f10-h'): s.out(sel, s.at('pits') - .25)
s.card_in('#f10-c2', s.at('pits'), -1)
t0, t1 = s.at('comes'), s.at('Seventh') - .1
s.fade('#f10-hm', s.at('comes'), .25)
s.tw(f'tl.fromTo("#f10-hm", {{x:-16, y:0}}, {{x:14, y:-8, duration:.32, ease:"sine.inOut", yoyo:true, repeat:{max(1, int((t1 - t0) / .32) - 1)}}}, {t0:.3f});')
s.stamp('#f10-p7', s.at('Seventh'), -6)
s.bar('f2010', 2010, s.at('four'))

# ---- 4 Ferrari 2012: the lead that disappeared
s = S('f2012'); hc = ERA['f2012'][2]
s.add(chart('f2012', [2005, 2006, 2007, 2010]))
LX, LY, LW, LH = 150, 860, 600, 190          # line plot box inside the scene
mx, mn = 50, -15
px = lambda i: LX + i * LW / (len(lead12) - 1)
py = lambda v: LY + (mx - v) / (mx - mn) * LH
path = 'M' + ' L'.join(f'{px(i):.1f},{py(v):.1f}' for i, v in enumerate(lead12))
i_ger, i_spa, i_suz = races12.index('German'), races12.index('Belgian'), races12.index('Japanese')
s.add(f'<div id="f12-card" class="card" style="left:120px;top:740px;width:660px;height:350px;clip-path:{torn(31, 660, 350)}"><div class="ctitle">Lead over Vettel, 2012</div></div>')
s.add(f'<svg id="f12-plot" viewBox="0 0 {W} {H}" style="position:absolute;left:0;top:0;width:{W}px;height:{H}px" data-layout-ignore>'
      f'<line x1="{LX}" y1="{py(0):.0f}" x2="{LX + LW}" y2="{py(0):.0f}" stroke="#2A2522" stroke-width="3" stroke-dasharray="10 8"/>'
      f'<path id="f12-line" d="M{px(0):.1f},{py(lead12[0]):.1f}" fill="none" stroke="#C8102E" stroke-width="8" stroke-linejoin="round" stroke-linecap="round"/>'
      f'<circle id="f12-dger" cx="{px(i_ger):.0f}" cy="{py(lead12[i_ger]):.0f}" r="12" fill="#C8102E"/></svg>')
s.add(f'<div id="f12-44" style="position:absolute;left:{px(i_ger) - 70:.0f}px;top:{py(44) - 74:.0f}px;font:700 56px Oswald;color:#C8102E">+44</div>')
s.add(f'<div id="f12-spa" class="stamp" style="left:{px(i_spa) + 14:.0f}px;top:{py(24) - 84:.0f}px;font-size:40px;padding:0 10px;border-width:5px">DNF Spa</div>')
s.add(f'<div id="f12-suz" class="stamp" style="left:{px(i_suz) - 40:.0f}px;top:{py(4) + 30:.0f}px;font-size:40px;padding:0 10px;border-width:5px">DNF Suzuka</div>')
s.add(f'<div id="f12-end" style="position:absolute;left:{px(len(lead12) - 1) - 40:.0f}px;top:{py(-3) + 8:.0f}px;font:700 48px Oswald;color:#C8102E">−3</div>')
s.card_in('#f12-card', .05, -1)
s.fade('#f12-plot', .3, .2)
seg = lambda i: i / (len(lead12) - 1)
pts = [[round(px(i), 1), round(py(v), 1)] for i, v in enumerate(lead12)]
s.tw('const P12 = ' + json.dumps(pts) + ', L12 = document.getElementById("f12-line"), g12 = {i: 0};')
s.tw('const d12 = () => { const k = Math.floor(g12.i), f = g12.i - k; let d = "M" + P12[0]; for (let j = 1; j <= k && j < P12.length; j++) d += " L" + P12[j]; if (k + 1 < P12.length && f > 0) d += " L" + (P12[k][0] + (P12[k + 1][0] - P12[k][0]) * f) + "," + (P12[k][1] + (P12[k + 1][1] - P12[k][1]) * f); L12.setAttribute("d", d); };')
s.tw(f'tl.fromTo(g12, {{i:0}}, {{i:{i_ger}, duration:1.4, ease:"power2.out", onUpdate:d12}}, {s.at("2012") + .2:.3f});')
s.pop('#f12-dger', s.at('44-point')); s.pop('#f12-44', s.at('44-point') + .1)
s.tw(f'tl.to(g12, {{i:{i_spa}, duration:.6, ease:"power2.inOut", onUpdate:d12}}, {s.at("Spa"):.3f});')
s.stamp('#f12-spa', s.at('Out', 1), -6)
s.tw(f'tl.to(g12, {{i:{i_suz}, duration:.6, ease:"power2.inOut", onUpdate:d12}}, {s.at("Suzuka"):.3f});')
s.stamp('#f12-suz', s.at('Out', 2), 5)
s.tw(f'tl.to(g12, {{i:{len(lead12) - 1}, duration:1.0, ease:"power2.inOut", onUpdate:d12}}, {s.at("Vettel"):.3f});')
s.pop('#f12-end', s.at('three'))
s.bar('f2012', 2012, s.at('three'))

# ---- 5 reveal: 1 + 4 + 3 = 8
s = S('reveal')
s.add(chart('reveal', YEARS, rot=0))
s.add('<div id="rv-eq" class="big" style="left:120px;top:770px;font-size:150px;white-space:nowrap"><span id="rv-1">1</span> <span id="rv-p1" style="color:#888">+</span> <span id="rv-4">4</span> <span id="rv-p2" style="color:#888">+</span> <span id="rv-3">3</span></div>')
s.add('<div id="rv-8" class="big" style="left:120px;top:930px;font-size:250px;color:#E10600">= 8</div>')
s.add('<div id="rv-8l" class="lab" style="position:absolute;left:470px;top:1010px;color:#fff;font-size:36px;line-height:1.3">points<br>from five</div>')
s.fade('#reveal-chart', 0, .01)
for i, (y, word, el) in enumerate(((2007, 'One', '#rv-1'), (2010, 'Four', '#rv-4'), (2012, 'Three', '#rv-3'))):
    t = s.at(word)
    s.tw(f'tl.fromTo("#reveal-b{y}", {{scaleY:1}}, {{scaleY:2.2, transformOrigin:"50% 0%", duration:.18, yoyo:true, repeat:1, ease:"power2.out"}}, {t:.3f});')
    s.pop(el, t, .25); s.sound('pop', t + .1, .7)
    if i: s.fade(f'#rv-p{i}', t - .1, .2)
s.pop('#rv-8', s.at('Eight'), .4); s.fade('#rv-8l', s.at('Eight') + .3)
s.sound('riser', s.at('Eight') + 1 / 30 - 1.953, .5); s.sound('fs-222517-dramatic-hit', s.at('Eight') + 1 / 30 - .322, .8)

# ---- 6 today: Aston Martin, still chasing
s = S('today'); hc = ERA['today'][2]
s.add(helmet('tod-h', hc, 330, 120, 330))
s.add('<div id="tod-win" class="tape" style="left:470px;top:380px">last win: Spain 2013</div>')
s.add('<div id="tod-age" class="tape" style="left:500px;top:480px;font-size:60px">age 45</div>')
s.add('<div id="tod-n" class="big" style="left:120px;top:740px;font-size:200px;color:#CEDC00">0</div>')
s.add('<div id="tod-nl" class="lab" style="position:absolute;left:126px;top:950px;font-size:34px">Grands Prix</div>')
for i in range(3): s.add(trophy(f'tod-t{i}', 470 + i * 104, 800, i < 2, .85))
s.add('<div id="tod-3" class="stamp solid" style="left:640px;top:950px;font-size:60px">3?</div>')
end_t = round(last['today'] - START['today'] + .25, 2)
s.add(f'<div id="tod-end" style="position:absolute;inset:0;background:#0E0F12"><div style="position:absolute;left:120px;top:640px;width:768px;font:italic 900 140px Archivo, Oswald;color:#fff;letter-spacing:-.02em">ONE <span style="color:#E10600">F1</span></div>'
      '<div class="lab" style="position:absolute;left:126px;top:820px;font-size:34px;color:#B9BDC4">Follow @F1STATLAB</div>'
      '<div class="lab" style="position:absolute;left:126px;top:880px;font-size:28px;color:#7D828C">Data: F1 results via Jolpica</div></div>')
s.card_in('#tod-h', .05)
s.tape('#tod-win', s.at('2013')); s.tape('#tod-age', s.at('45'), 4)
s.fade('#tod-n', s.at('449') - .1, .2); s.count('#tod-n', 0, 449, s.at('449'), 1.2); s.fade('#tod-nl', s.at('449') + .3)
for i in range(3): s.pop(f'#tod-t{i}', s.at('chasing') + i * .12)
s.stamp('#tod-3', s.at('three'), -6)
s.fade('#tod-end', end_t, .4)

for sc in scenes.values(): sc.write()

# ------------------------------------------------------------------ captions: 2-3 words, broken at punctuation
caps = []
cur = []
for ch, w, st, en in words:
    cur.append((w, st, en))
    if len(cur) == 3 or w[-1] in '.,:' or (len(cur) == 2 and len(''.join(x[0] for x in cur)) > 15):
        caps.append(cur); cur = []
if cur: caps.append(cur)
groups = []
for i, g in enumerate(caps):
    st = g[0][1]; en = caps[i + 1][0][1] if i + 1 < len(caps) and caps[i + 1][0][1] - g[-1][2] < .9 else g[-1][2] + .35
    txt = ' '.join(x[0] for x in g).rstrip('.,:').replace("'", "’")
    groups.append((round(st - .05, 3), round(en - st, 3), txt))
cap_html = '\n'.join(f'    <div id="cap-{i}" class="cap clip" data-start="{s_:.3f}" data-duration="{d:.3f}" data-track-index="1"><span>{t.upper()}</span></div>' for i, (s_, d, t) in enumerate(groups))
cap_doc = f'''<template>
<link rel="stylesheet" href="assets/film.css" />
<style>
#root {{ position: absolute; inset: 0; }}
.cap {{ position: absolute; left: 120px; width: 660px; top: 1130px; text-align: center; }}
.cap span {{ display: inline-block; font: 700 66px "Oswald"; letter-spacing: .01em; color: #fff; line-height: 1.05;
  text-shadow: 0 4px 0 rgba(0,0,0,.55), 0 0 18px rgba(0,0,0,.5); }}
</style>
<div id="root" data-composition-id="captions" data-width="{W}" data-height="{H}">
{cap_html}
</div>
<script>
(() => {{
  const tl = gsap.timeline({{ paused: true }});
  {chr(10).join(f'  tl.fromTo("#cap-{i} span", {{opacity:0, y:14, scale:.96}}, {{opacity:1, y:0, scale:1, duration:.12, ease:"power2.out"}}, {s_:.3f});' for i, (s_, d, t) in enumerate(groups))}
  window.__timelines["captions"] = tl;
}})();
</script>
</template>'''
open(os.path.join(FILM, 'compositions', 'captions.html'), 'w').write(cap_doc)
open(os.path.join(FILM, 'assets', 'film.css'), 'w').write(SHARED_CSS)

# ------------------------------------------------------------------ sound and root
SFX = json.load(open(os.path.join(HERE, 'sfx.json')))
cues = []
whooshes = ['fs-127197-fast-simple-chop-5-aif', 'fs-169867-swoosh']
for i, c in enumerate(CH[1:]):
    w_ = whooshes[i % 2]; cues.append((w_, START[c], .55))
for sc in scenes.values(): cues += sc.sfx
audio = []
lanes = []                                       # one lane per overlap
for n, (name, t, vol) in enumerate(sorted(cues, key=lambda c: c[1])):
    st = max(0, t + 1 / FPS - SFX[name]['peak']) if name not in ('riser', 'fs-222517-dramatic-hit') else max(0, t)
    du = SFX[name]['dur']
    lane = next((k for k, e in enumerate(lanes) if e <= st), None)
    if lane is None: lanes.append(0); lane = len(lanes) - 1
    lanes[lane] = st + du
    audio.append(f'      <audio id="sfx-{n}" class="clip" src="assets/sfx/{name}.wav" data-start="{st:.3f}" data-duration="{du}" data-track-index="{3 + lane}" data-volume="{vol}"></audio>')
hosts = '\n'.join(f'      <div id="{c}" data-composition-id="{c}" data-composition-src="compositions/{c}.html" data-start="{START[c]}" data-duration="{DUR[c]}" data-track-index="1" data-track-kind="graphics" data-width="{W}" data-height="{H}"></div>' for c in CH)
index = f'''<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width={W}, height={H}" />
    <script src="assets/vendor/gsap.min.js"></script>
    <style>
      @font-face {{ font-family: "Archivo"; src: url("assets/fonts/Archivo-Italic.ttf"); font-weight: 100 900; font-style: italic; }}
      * {{ margin: 0; padding: 0; box-sizing: border-box; }}
      html, body {{ margin: 0; width: {W}px; height: {H}px; overflow: hidden; background: #0E0F12; }}
      #root {{ position: relative; width: 100%; height: 100%; }}
      #bg {{ position: absolute; inset: 0; background: #0E0F12; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{TOTAL}" data-width="{W}" data-height="{H}">
      <div id="bg"></div>
{hosts}
      <div id="captions" data-composition-id="captions" data-composition-src="compositions/captions.html" data-start="0" data-duration="{TOTAL}" data-track-index="2" data-track-kind="captions" data-width="{W}" data-height="{H}"></div>
{chr(10).join(audio)}
    </div>
    <script>
      window.__timelines["main"] = gsap.timeline({{ paused: true }});
    </script>
  </body>
</html>
'''
open(os.path.join(FILM, 'index.html'), 'w').write(index)
print('total', TOTAL, 's |', ' '.join(f'{c} {START[c]}+{DUR[c]}' for c in CH), '|', len(groups), 'captions,', len(audio), 'sounds')
