"""v2: the whole career story. Builds film/ from script v2 (SCRIPT.md), with halftone photo cards.

    python3 build_film2.py                 # timing estimated from the script
    python3 build_film2.py --vo vo.json    # timing from the recorded voiceover ({"words": [[start, end], ...]}, one per script word)

Shared pieces (helmet, trophy, sunburst, torn paper, the running chart, the Scene class) come from build_film.py.
"""
import json, math, os, random, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
FILM = os.path.join(HERE, 'film')
W, H, FPS = 1080, 1920, 30

VO = [
    ('hook', "Two world titles. Eight points from five. This is the story of Fernando Alonso, and the championships that got away."),
    ('origins', "Formula One, 2001. A nineteen-year-old from Oviedo, in northern Spain, makes his debut with Minardi. He scores zero points all season. So does the whole team."),
    ('renault', "Renault saw something. In 2003 he wins in Hungary, the youngest winner Formula One had ever seen. Then he takes on the two giants of his time. Michael Schumacher: seven world titles. Kimi Räikkönen: the Iceman, in a McLaren that was often the fastest car on the grid. 2005. Räikkönen wins seven races. So does Alonso. Räikkönen sets ten fastest laps. Alonso sets two. But twice, the McLaren breaks down after starting from pole. Alonso is on the podium fifteen times, and wins the title by twenty-one points. 2006. Schumacher, in his last season with Ferrari. Seven wins each, again. Alonso's fourteen podiums take the title by thirteen. Two titles by twenty-five. Everyone expected a dynasty."),
    ('mclaren', "2007. The double champion joins McLaren. His teammate: a rookie called Lewis Hamilton. Alonso expects to lead. Instead, Hamilton finishes on the podium in each of his first nine races. The garage splits. In Hungary, Alonso holds Hamilton up in the pit lane and is moved from pole to sixth. In Japan, he crashes out in the rain. And in Brazil, Räikkönen steals the title from both of them. Alonso misses it by one point. After one season, he leaves."),
    ('f2010', "2010. Ferrari. Against him: Sebastian Vettel, and a Red Bull that was the fastest car of the era. Abu Dhabi, the final race. Alonso leads the championship. Fourth would be enough. Ferrari pits him early, he comes out behind Petrov's Renault, and he never gets past. Seventh. Vettel is champion by four points."),
    ('f2012', "2012 is his masterpiece. His Ferrari starts sixth on average. He finishes third on average, with thirteen podiums and more than double his teammate's points. He leads by forty-four in July. Then two first-lap crashes, at Spa and Suzuka. Vettel wins it by three. One point. Four points. Three points. Eight points from five titles."),
    ('today', "2026. He's forty-five, and he's still out there. Four hundred and forty-nine Grands Prix. Thirty-two wins, the last in Spain, 2013. In 2025, Aston Martin signed Adrian Newey, the designer of the Red Bulls that beat him in 2010 and 2012. Now Newey's car is his car. And Fernando Alonso is still chasing one last title."),
]
SPOKEN_LEN = {'2001': 4, 'nineteen-year-old': 5, '2003': 4, '2005': 4, '2006': 4, '2007': 4, '2010': 3, '2012': 3, '2013': 3, '2015': 3, '2025': 4, '2026': 4, 'thirty-two': 3, '2018': 3, '2021': 3, '2023': 3,
              'twenty-five': 3, 'forty-four': 3, 'forty-five': 3, 'twenty-one': 3, 'thirty-three': 3, 'first-lap': 2, 'GP2': 3, '500': 3}

words = []
if '--vo' in sys.argv:
    wt = json.load(open(sys.argv[sys.argv.index('--vo') + 1]))['words']
    flat = [(ch, w) for ch, text in VO for w in text.split()]
    assert len(wt) == len(flat), f'{len(wt)} times for {len(flat)} words'
    for (ch, w), (a, b) in zip(flat, wt): words.append((ch, w, a, b))
else:
    t = 0.4
    for ci, (ch, text) in enumerate(VO):
        if ci: t += 0.7
        for w in text.split():
            core = w.strip('.,:')
            syl = SPOKEN_LEN.get(core, max(1, len(re.findall(r'[aeiouyäö]+', core.lower()))))
            d = 0.08 + 0.135 * syl
            words.append((ch, w, t, t + d)); t += d
            t += 0.3 if w.endswith('.') else 0.22 if w.endswith(':') else 0.12 if w.endswith(',') else 0.02

CH = [c for c, _ in VO]
first = {c: min(s for ch, _, s, _ in words if ch == c) for c in CH}
last = {c: max(e for ch, _, _, e in words if ch == c) for c in CH}
START = {c: 0 if i == 0 else round(first[c] - 0.35, 2) for i, c in enumerate(CH)}
END_CARD = 3.8
TOTAL = round(last['today'] + END_CARD, 2)
DUR = {c: round((START[CH[i + 1]] if i + 1 < len(CH) else TOTAL) - START[c], 2) for i, c in enumerate(CH)}

def T(ch, key, n=1):
    k = 0
    for c, w, s, e in words:
        if c == ch and w.strip('.,:').lower().startswith(key.lower()):
            k += 1
            if k == n: return round(s - START[ch], 3)
    raise KeyError(f'{ch}: {key} #{n}')

# shared pieces from v1: data, look, helmet, trophy, rays, torn, chart, Scene
src = open(os.path.join(HERE, 'build_film.py')).read()
exec(src[src.index('# ------------------------------------------------------------------ data'):src.index('scenes = {}')], globals())
ERA = {
    'hook':    ('#121318', 'rgba(225,6,0,.10)',      ('#1F3F95', '#FFD200', '#C8102E')),
    'origins': ('#17181C', 'rgba(255,210,0,.07)',    ('#111111', '#FFFFFF', '#FFD200')),
    'renault': ('#0B3D91', 'rgba(255,210,0,.10)',    ('#0B4EA2', '#FFD200', '#111111')),
    'mclaren': ('#4B5159', 'rgba(255,255,255,.07)',  ('#C9CED4', '#E10600', '#1A1A1A')),
    'f2010':   ('#A70D12', 'rgba(255,214,0,.09)',    ('#DC0000', '#FFD200', '#111111')),
    'f2012':   ('#5E0A0F', 'rgba(255,255,255,.06)',  ('#DC0000', '#FFFFFF', '#111111')),
    'honda':   ('#1B1B1E', 'rgba(255,128,0,.10)',    ('#FF8000', '#111111', '#FFFFFF')),
    'away':    ('#2A2D34', 'rgba(235,10,30,.08)',    ('#FFFFFF', '#EB0A1E', '#111111')),
    'reveal':  ('#14161C', 'rgba(239,230,210,.06)',  ('#1F3F95', '#FFD200', '#C8102E')),
    'today':   ('#00352F', 'rgba(206,220,0,.08)',    ('#00594F', '#CEDC00', '#111111')),
}
SHARED_CSS += '''
.pcard { position: absolute; background: #F1E8D4; box-shadow: 0 18px 30px rgba(0,0,0,.42); }
.pcard img { position: absolute; left: 14px; top: 14px; object-fit: cover; }
.band { position: absolute; padding: 4px 18px; background: #111; color: #fff; font: 700 52px "Oswald"; text-transform: uppercase; letter-spacing: .02em; white-space: nowrap; }
'''
HT = open(os.path.join(HERE, 'ht_attr.txt')).read().strip()          # halftone treatment (written by hyperframes media-treatment)

def photo(uid, name, x, y, w, h, seed):
    return (f'<div id="{uid}" class="pcard" style="left:{x}px;top:{y}px;width:{w + 28}px;height:{h + 28}px;clip-path:{torn(seed, w + 28, h + 28)}">'
            f'<img id="{uid}-img" src="assets/photos/{name}.jpg" style="width:{w}px;height:{h}px" {HT} /></div>')

def chart_slide(s, t_in, t_out=None):
    s.tw(f'tl.fromTo("#{s.ch}-chart", {{opacity:0, y:-80, rotation:-4}}, {{opacity:1, y:0, rotation:-1, duration:.45, ease:"back.out(1.4)"}}, {t_in:.3f});')
    s.sound('fs-127197-fast-simple-chop-5-aif', t_in + .2, .4)
    if t_out is not None: s.tw(f'tl.to("#{s.ch}-chart", {{opacity:0, y:-60, duration:.3, ease:"power2.in"}}, {t_out:.3f});')

BIGWORD = {'hook': '5?', 'origins': '2001', 'renault': '2005', 'mclaren': '2007', 'f2010': '2010', 'f2012': '2012', 'honda': 'GP2',
           'away': 'LE MANS', 'reveal': '8', 'today': '2026'}
ACCENT = {'hook': '#E10600', 'origins': '#FFD200', 'renault': '#FFD200', 'mclaren': '#E10600', 'f2010': '#FFD200', 'f2012': '#FFFFFF',
          'honda': '#FF8000', 'away': '#EB0A1E', 'reveal': '#E10600', 'today': '#CEDC00'}
SHARED_CSS += '''
.dots { position: absolute; left: -200px; top: -200px; width: 1480px; height: 2320px; opacity: .10;
  background-image: radial-gradient(circle, #fff 2.2px, transparent 2.6px); background-size: 26px 26px; }
.bigword { position: absolute; left: 0; top: 1290px; font: 700 520px "Oswald"; line-height: 1; white-space: nowrap; color: transparent;
  -webkit-text-stroke: 4px rgba(255,255,255,.16); letter-spacing: -.02em; }
.streak { position: absolute; height: 6px; border-radius: 3px; background: linear-gradient(90deg, transparent, rgba(255,255,255,.55), transparent); }
.sweep { position: absolute; left: 0; top: -300px; width: 900px; height: 2600px; transform-origin: 50% 50%; }
.scrib { position: absolute; left: 0; top: 0; width: 1080px; height: 1920px; pointer-events: none; }
'''

class Scene2(Scene):
    def scribble(self, x, y, w, h, t, color='#FFD200', sw=7):
        """Hand-drawn loop around a box, drawn on at t."""
        rx, ry, cx, cy = w / 2 + 18, h / 2 + 14, x + w / 2, y + h / 2
        pts = []
        for i in range(0, 41):
            a = -2.2 + i / 40 * 2 * math.pi * 1.08
            wob = 1 + 0.05 * math.sin(i * 1.7)
            pts.append(f'{cx + rx * wob * math.cos(a):.0f},{cy + ry * wob * math.sin(a):.0f}')
        n = len(self.html); L = 2 * math.pi * math.sqrt((rx * rx + ry * ry) / 2) * 1.12
        self.add(f'<svg class="scrib" viewBox="0 0 1080 1920" data-layout-ignore><path id="{self.ch}-sc{n}" d="M{" L".join(pts)}" fill="none" stroke="{color}" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="{L:.0f} {L:.0f}" stroke-dashoffset="{L:.0f}" opacity="0"/></svg>')
        self.tw(f'tl.fromTo("#{self.ch}-sc{n}", {{opacity:0, attr:{{"stroke-dashoffset":{L:.0f}}}}}, {{opacity:1, attr:{{"stroke-dashoffset":0}}, duration:.45, ease:"power2.out"}}, {t:.3f});')
        return f'#{self.ch}-sc{n}'
    def stamp(self, sel, t, rot=-8):
        Scene.stamp(self, sel, t, rot)
        self.tw(f'tl.fromTo("{sel}", {{x:-5}}, {{x:5, duration:.04, repeat:3, yoyo:true, ease:"none"}}, {t + .2:.3f});')
        self.tw(f'tl.to("{sel}", {{x:0, duration:.04}}, {t + .38:.3f});')
    def write(self):
        bg, ray_col, _ = ERA[self.ch]; p = self.ch; d = DUR[p]; acc = ACCENT[p]
        streaks = ''.join(f'<div id="{p}-st{i}" class="streak" data-layout-ignore style="top:{260 + i * 610}px;left:-700px;width:{520 - i * 90}px"></div>' for i in range(3))
        doc = f'''<template>
<link rel="stylesheet" href="assets/film.css" />
<style>
#root {{ position: absolute; inset: 0; background: {bg}; overflow: hidden; color: #fff; }}
</style>
<div id="root" data-composition-id="{p}" data-width="{W}" data-height="{H}">
  <div id="{p}-all" class="clip" data-start="0" data-duration="{d}" data-track-index="1" data-layout-allow-overlap>
    {rays(p + '-rays', ray_col)}
    <div id="{p}-dots" class="dots" data-layout-ignore></div>
    <div id="{p}-big" class="bigword" data-layout-ignore>{BIGWORD[p]}</div>
    {streaks}
    <div id="{p}-cam" style="position:absolute;inset:0" data-layout-allow-overlap>{''.join(self.html)}</div>
    <div id="{p}-sweep" class="sweep" style="background:{acc};{'display:none' if p == 'hook' else ''}" data-layout-ignore></div>
    <div class="grain"></div>
  </div>
</div>
<script>
(() => {{
  const tl = gsap.timeline({{ paused: true }});
  tl.fromTo("#{p}-rays", {{ rotation: 0, svgOrigin: "540 960" }}, {{ rotation: {d * 3.2:.1f}, duration: {d}, ease: "none" }}, 0);
  tl.fromTo("#{p}-dots", {{ x: 0, y: 0 }}, {{ x: {-d * 9:.0f}, y: {-d * 14:.0f}, duration: {d}, ease: "none" }}, 0);
  tl.fromTo("#{p}-big", {{ x: 90 }}, {{ x: {90 - min(d * 9, 220):.0f}, duration: {d}, ease: "none" }}, 0);
  tl.fromTo("#{p}-cam", {{ scale: 1, transformOrigin: "50% 40%" }}, {{ scale: 1.045, duration: {d}, ease: "none" }}, 0);
  {"//" if "pcard" not in "".join(self.html) else ""}tl.fromTo("#{p}-all .pcard img", {{ scale: 1.0, xPercent: -2.5 }}, {{ scale: 1.14, xPercent: 2.5, duration: {d}, ease: "none" }}, 0);
  {"//" if p == "hook" else ""}tl.fromTo("#{p}-sweep", {{ x: 1300, rotation: 14 }}, {{ x: -1400, rotation: 14, duration: .55, ease: "power2.inOut" }}, 0);
  {chr(10).join(f'  tl.fromTo("#{p}-st{i}", {{ x: 0 }}, {{ x: 2400, duration: .7, ease: "power1.in", repeat: {int(d / 2.6)}, repeatDelay: {1.9 + i * .35:.2f} }}, {.4 + i * .8:.2f});' for i in range(3))}
  {chr(10).join("  " + j for j in self.js)}
  window.__timelines["{p}"] = tl;
}})();
</script>
</template>'''
        open(os.path.join(FILM, 'compositions', p + '.html'), 'w').write(doc)

scenes = {}
def S(ch): scenes[ch] = Scene2(ch); return scenes[ch]

# ---- 0 hook
s = S('hook')
s.add(photo('hk-p', 'hook', 120, 300, 360, 540, 1))
s.add('<div id="hk-two" class="big" style="left:580px;top:360px;font-size:380px">2</div>')
s.add('<div id="hk-five" class="stamp solid" style="left:560px;top:540px;font-size:150px;padding:0 26px;border-width:12px">5?</div>')
for i in range(5): s.add(trophy(f'hk-t{i}', 131 + i * 132, 900, i < 2))
s.card_in('#hk-p', 0, -3)
s.pop('#hk-t0', s.at('two')); s.pop('#hk-t1', s.at('two') + .12)
s.stamp('#hk-five', s.at('five'), -8)
for i in (2, 3, 4): s.pop(f'#hk-t{i}', s.at('five') + .25 + (i - 2) * .12)
s.tw(f'tl.to("#hk-two", {{opacity:.25, duration:.3}}, {s.at("five"):.3f});')
s.out('#hk-p', s.at('This') - .2); s.out('#hk-five', s.at('This') - .2); s.out('#hk-two', s.at('This') - .2)
s.add('<div id="hk-name" class="big" style="left:120px;top:420px;font-size:150px;line-height:.95">FERNANDO<br><span style="color:#E10600">ALONSO</span></div>')
s.pop('#hk-name', s.at('Fernando'), .35)

# ---- 1 origins: straight into Formula One, 2001 (no openly licensed Minardi photo yet, so the drawn helmet leads)
s = S('origins'); hc = ERA['origins'][2]
s.add(helmet('or-h', hc, 320, 120, 330))
s.add('<div id="or-f1" class="tape" style="left:470px;top:330px;font-size:60px">Formula One · 2001</div>')
s.add('<div id="or-19" class="tape" style="left:480px;top:430px;font-size:56px">age 19 · Oviedo, Spain</div>')
s.add('<div id="or-st2" class="stamp solid" style="left:150px;top:720px;font-size:72px">Minardi</div>')
s.add('<div id="or-zero" class="big" style="left:580px;top:560px;font-size:300px;color:#FFD200">0</div>')
s.add('<div id="or-zl" class="lab" style="position:absolute;left:760px;top:780px;font-size:34px">points</div>')
s.add('<div id="or-team" class="tape" style="left:180px;top:930px;font-size:52px">the whole team: 0</div>')
s.card_in('#or-h', 0); s.tape('#or-f1', max(.7, s.at('Formula')), -3)
s.tape('#or-19', s.at('nineteen'), 2)
s.stamp('#or-st2', s.at('Minardi'), -6)
s.pop('#or-zero', s.at('zero')); s.scribble(580, 590, 180, 250, s.at("zero") + .3, '#FFFFFF'); s.fade('#or-zl', s.at('zero') + .2)
s.tape('#or-team', s.at('whole'), -2)

# ---- 2 Renault: the giants (every beat opens on a photo; 2005 and 2006 stat duels from data/h2h_2005_2006.json)
H2H = json.load(open(os.path.join(D, 'h2h_2005_2006.json')))
WINS_BY_SEASON = {}
for r in json.load(open(os.path.join(D, 'alonso_all_results.json'))):
    WINS_BY_SEASON[int(r['season'])] = WINS_BY_SEASON.get(int(r['season']), 0) + (r['Results'][0]['position'] == '1')
assert [WINS_BY_SEASON.get(y) for y in (2003, 2004, 2005, 2006)] == [1, 0, 7, 7]
assert H2H['2005']['alonso']['wins'] == H2H['2005']['raikkonen']['wins'] == 7 and H2H['2005']['raikkonen']['fastest_laps'] == 10
assert H2H['2006']['alonso']['wins'] == H2H['2006']['michael_schumacher']['wins'] == 7 and H2H['2006']['alonso']['podiums'] == 14

def duel(uid, year, rival, rcode, rows, seed):
    """Stat card: Alonso v a rival, one row per stat. rows = [(label, key)]; the better number goes red."""
    a, b = H2H[str(year)]['alonso'], H2H[str(year)][rival]
    html = (f'<div id="{uid}" class="card" style="left:120px;top:740px;width:660px;height:370px;clip-path:{torn(seed, 660, 370)}">'
            f'<div class="ctitle">{year} · head to head</div>'
            f'<div class="lab" style="position:absolute;left:372px;top:80px;width:120px;text-align:center;color:#C8102E">ALO</div>'
            f'<div class="lab" style="position:absolute;left:512px;top:80px;width:120px;text-align:center;color:#6B625A">{rcode}</div>')
    for i, (lab, key) in enumerate(rows):
        va, vb = int(a[key]), int(b[key])
        ca = '#C8102E' if va > vb else '#2A2522'; cb = '#2A2522'
        html += (f'<div id="{uid}-r{i}" style="position:absolute;left:30px;right:30px;top:{118 + i * 60}px;height:58px;border-top:2px solid rgba(42,37,34,.18)">'
                 f'<div class="lab" style="position:absolute;left:0;top:14px;color:#2A2522;font-size:27px">{lab}</div>'
                 f'<div style="position:absolute;left:342px;width:120px;text-align:center;font:700 50px Oswald;color:{ca}">{va}</div>'
                 f'<div style="position:absolute;left:482px;width:120px;text-align:center;font:700 50px Oswald;color:{cb}">{vb}</div></div>')
    return html + '</div>'

def wins_strip(uid, years, gold, seed):
    mx = 7; bw, step, base = 64, 92, 300
    html = (f'<div id="{uid}" class="card" style="left:120px;top:740px;width:660px;height:370px;clip-path:{torn(seed, 660, 370)}">'
            f'<div class="ctitle">Wins per season</div>')
    for i, y in enumerate(years):
        v = WINS_BY_SEASON.get(y); x = 44 + i * step; h = 0 if not v else v / mx * 170
        col = '#E3A92B' if y in gold else '#8A8178'
        html += (f'<div id="{uid}-b{i}" style="position:absolute;left:{x}px;top:{base - h:.0f}px;width:{bw}px;height:{max(h, 4):.0f}px;background:{col}"></div>'
                 f'<div id="{uid}-v{i}" style="position:absolute;left:{x - 10}px;top:{base - h - 54:.0f}px;width:{bw + 20}px;text-align:center;font:700 44px Oswald;color:{col if y in gold else "#6B625A"}">{"–" if v is None else v}</div>'
                 f'<div class="lab" style="position:absolute;left:{x - 14}px;top:{base + 12}px;width:{bw + 28}px;text-align:center;color:{"#2A2522" if y in gold else "#6B625A"};font-size:24px">{y}</div>')
    return html + '</div>'

s = S('renault'); hc = ERA['renault'][2]
# beat 1: Renault, Hungary 2003
s.add(photo('rn-big', 'renault', 120, 340, 580, 420, 4))
s.add('<div id="rn-t1" class="tape" style="left:140px;top:300px">2003 · Hungary · first win</div>')
s.add('<div id="rn-st1" class="stamp solid" style="left:180px;top:800px;font-size:52px">youngest winner</div>')
s.card_in('#rn-big', 0, -2); s.tape('#rn-t1', max(.7, s.at('Hungary')), -3); s.stamp('#rn-st1', s.at('youngest'), -5)
for x in ('#rn-big', '#rn-t1', '#rn-st1'): s.out(x, s.at('giants') - .3)
# beat 2: the giants, dealt like trading cards
s.add(photo('rn-schu', 'schu_face', 110, 300, 300, 340, 5))
s.add('<div id="rn-schu-n" class="band" style="left:120px;top:610px">Schumacher</div>')
s.add('<div id="rn-schu-s" class="stamp solid" style="left:150px;top:300px;font-size:44px">7 titles</div>')
s.add(photo('rn-kimi', 'kimi_face', 520, 320, 300, 340, 6))
s.add('<div id="rn-kimi-n" class="band" style="left:530px;top:630px">Räikkönen</div>')
s.add('<div id="rn-kimi-t" class="tape" style="left:580px;top:700px">the Iceman</div>')
s.add('<div id="rn-vs" class="big" style="left:420px;top:680px;font-size:120px;color:#FFD200">VS</div>')
s.add(photo('rn-alo', 'alo05_face', 300, 770, 260, 300, 7))
s.add('<div id="rn-alo-n" class="band" style="left:310px;top:1030px;background:#FFD200;color:#0B3D91">Alonso · 23</div>')
s.card_in('#rn-schu', s.at('giants') - .1, -5); s.fade('#rn-schu-n', s.at('Schumacher', 1) + .1); s.stamp('#rn-schu-s', s.at('seven'), -8); sc7 = s.scribble(150, 300, 220, 70, s.at('seven') + .3, '#FFD200')
s.card_in('#rn-kimi', s.at('Räikkönen', 1) - .3, 4); s.fade('#rn-kimi-n', s.at('Räikkönen', 1) + .1); s.tape('#rn-kimi-t', s.at('Iceman'), -3)
s.card_in('#rn-alo', s.at('McLaren') - .1, -2); s.pop('#rn-vs', s.at('McLaren') + .3); s.fade('#rn-alo-n', s.at('McLaren') + .5)
for x in (sc7, '#rn-schu', '#rn-schu-n', '#rn-schu-s', '#rn-kimi', '#rn-kimi-n', '#rn-kimi-t', '#rn-vs', '#rn-alo', '#rn-alo-n'): s.out(x, s.at('2005') - .45)
# beat 3: 2005 v Räikkönen. Photo first, then the duel card, then the chart bar
s.add(photo('rn-k05', 'raikkonen', 120, 300, 640, 400, 41))
s.add('<div id="rn-k05-n" class="band" style="left:130px;top:670px;background:#C9CED4;color:#111;font-size:44px">Räikkönen · McLaren 2005</div>')
s.add('<div id="rn-k05-st" class="stamp solid" style="left:380px;top:330px;font-size:44px">broke down from pole ×2</div>')
s.add(duel('rn-d05', 2005, 'raikkonen', 'RÄI', [('wins', 'wins'), ('fastest laps', 'fastest_laps'), ('podiums', 'podiums'), ('points', 'points')], 42))
s.add(chart('renault', []))
t05 = s.at('2005')
s.card_in('#rn-k05', t05 - .3, -2); s.fade('#rn-k05-n', t05 + .15)
s.card_in('#rn-d05', s.at('seven', 2) - .4, 1)
s.pop('#rn-d05-r0', s.at('Alonso', 1), .25); s.pop('#rn-d05-r1', s.at('ten'), .25)
sc05 = s.scribble(120 + 30 + 482, 740 + 118 + 60, 120, 52, s.at('two', 2) + .1, '#C8102E', 6)
s.stamp('#rn-k05-st', s.at('breaks'), -5)
s.pop('#rn-d05-r2', s.at('fifteen'), .25)
t_title = s.at('title', 2)
for x in ('#rn-k05', '#rn-k05-n', '#rn-k05-st'): s.out(x, t_title - .3)
chart_slide(s, t_title - .1); s.pop('#rn-d05-r3', s.at('twenty-one'), .25)
s.bar('renault', 2005, s.at('twenty-one'))
for x in ('#renault-chart', '#rn-d05', sc05): s.out(x, s.at('2006') - .45)
# beat 4: 2006 v Schumacher
s.add(photo('rn-s06', 'schumacher', 120, 300, 640, 400, 43))
s.add('<div id="rn-s06-n" class="band" style="left:130px;top:670px;background:#DC0000;font-size:44px">Schumacher · Ferrari</div>')
s.add('<div id="rn-s06-t" class="tape" style="left:440px;top:320px;font-size:44px">his last Ferrari season</div>')
s.add(duel('rn-d06', 2006, 'michael_schumacher', 'MSC', [('wins', 'wins'), ('fastest laps', 'fastest_laps'), ('podiums', 'podiums'), ('points', 'points')], 44))
s.add(chart('renault2', [2005]))
t06 = s.at('2006')
s.card_in('#rn-s06', t06 - .3, 2); s.fade('#rn-s06-n', t06 + .15); s.tape('#rn-s06-t', s.at('last'), 3)
s.card_in('#rn-d06', s.at('Seven', 3) - .4, -1)
s.pop('#rn-d06-r0', s.at('each'), .25); s.pop('#rn-d06-r1', s.at('again') + .1, .25)
s.pop('#rn-d06-r2', s.at('fourteen'), .25); sc06 = s.scribble(120 + 30 + 342, 740 + 118 + 120, 120, 52, s.at('fourteen') + .3, '#C8102E', 6)
t_th = s.at('thirteen')
for x in ('#rn-s06', '#rn-s06-n', '#rn-s06-t'): s.out(x, t_th - .55)
s.tw(f'tl.fromTo("#renault2-chart", {{opacity:0, y:-80, rotation:-4}}, {{opacity:1, y:0, rotation:-1, duration:.45, ease:"back.out(1.4)"}}, {t_th - .35:.3f});')
s.pop('#rn-d06-r3', t_th, .25); s.bar('renault2', 2006, t_th)
for x in ('#renault2-chart', '#rn-d06', sc06): s.out(x, s.at('titles', 2) - .45)
# beat 5: two titles by 25, wins per season
s.add(photo('rn-a25', 'renault_s', 120, 300, 640, 400, 45))
s.add('<div id="rn-a25-n" class="band" style="left:130px;top:670px;background:#FFD200;color:#0B3D91;font-size:44px">Alonso · 2× champion at 25</div>')
s.add(wins_strip('rn-ws', [2001, 2002, 2003, 2004, 2005, 2006], (2005, 2006), 46))
s.add('<div id="rn-dyn" class="tape" style="left:470px;top:310px;font-size:56px">a dynasty?</div>')
t2 = s.at('titles', 2)
s.card_in('#rn-a25', t2 - .1, -2); s.fade('#rn-a25-n', t2 + .1)
s.card_in('#rn-ws', t2 + .35, 1)
for i in range(6):
    s.tw(f'tl.fromTo("#rn-ws-b{i}", {{scaleY:0, transformOrigin:"50% 100%"}}, {{scaleY:1, duration:.4, ease:"power3.out"}}, {t2 + .6 + i * .08:.3f});')
    s.fade(f'#rn-ws-v{i}', t2 + .85 + i * .08, .2)
s.scribble(120 + 44 + 4 * 92 - 10, 740 + 70, 2 * 92 + 10, 250, t2 + 1.4, '#C8102E', 6)
s.tape('#rn-dyn', s.at('dynasty'), 3)

# ---- 3 McLaren 2007: the rookie
s = S('mclaren'); hc = ERA['mclaren'][2]
s.add(photo('mc-alo', 'alonso07', 110, 320, 360, 250, 8))
s.add('<div id="mc-alo-n" class="band" style="left:120px;top:570px;font-size:42px">Alonso · 2× champ</div>')
s.add(photo('mc-ham', 'ham_face', 500, 420, 360, 300, 9))
s.add('<div id="mc-ham-n" class="band" style="left:500px;top:740px;background:#FFD400;color:#111;font-size:40px">Hamilton · rookie</div>')
dots = ''.join(f'<div id="mc-d{i}" style="position:absolute;left:{120 + i * 73}px;top:800px;width:62px;height:62px;border-radius:50%;background:{"#F4C430" if p == 1 else "#C9CED4" if p == 2 else "#CD7F32"};color:#111;font:700 30px Oswald;display:flex;align-items:center;justify-content:center">P{p}</div>'
               for i, p in enumerate([3, 2, 2, 2, 2, 1, 1, 3, 3]))
s.add(dots)
s.add('<div id="mc-9" class="lab" style="position:absolute;left:120px;top:880px;font-size:30px">Hamilton · first nine races</div>')
s.add('<div id="mc-split" class="stamp solid" style="left:380px;top:950px;font-size:60px">split</div>')
s.add(chart('mclaren', [2005, 2006]))
s.add(helmet('mc-h', hc, 200, 120, 760, look=6))
s.add(f'<div id="mc-c1" class="card" style="left:380px;top:740px;width:400px;height:330px;clip-path:{torn(11, 400, 330)}"><div class="ctitle">Hungary</div>'
      '<div class="lab" style="position:absolute;left:30px;top:84px;color:#6B625A">starting grid</div>'
      '<div style="position:absolute;left:30px;top:128px;font:700 86px Oswald;white-space:nowrap">P1<span style="color:#C8102E"> → </span>P6</div></div>')
s.add('<div id="mc-pen" class="stamp" style="left:500px;top:990px;font-size:48px">Penalty</div>')
s.add(f'<div id="mc-c2" class="card" style="left:380px;top:740px;width:400px;height:330px;clip-path:{torn(12, 400, 330)}"><div class="ctitle">Japan</div>'
      '<div class="lab" style="position:absolute;left:30px;top:84px;color:#6B625A">Fuji · rain</div>'
      + ''.join(f'<div style="position:absolute;left:{40 + i * 46}px;top:{140 + (i % 3) * 22}px;width:4px;height:70px;background:#5C7FA3;transform:rotate(14deg)"></div>' for i in range(8)) + '</div>')
s.add('<div id="mc-dnf" class="stamp" style="left:470px;top:960px;font-size:72px">DNF</div>')
s.add(f'<div id="mc-c3" class="card" style="left:380px;top:740px;width:400px;height:330px;clip-path:{torn(13, 400, 330)}"><div class="ctitle">Final table</div>'
      '<div style="position:absolute;left:30px;right:30px;top:90px">'
      '<div class="row3"><span class="n">Räikkönen</span><span>110</span></div><div class="row3"><span class="n">Hamilton</span><span>109</span></div>'
      '<div class="row3 me"><span class="n">Alonso</span><span>109</span></div></div></div>')
s.add('<div id="mc-one" class="stamp solid" style="left:420px;top:1000px;font-size:48px">one season</div>')
s.card_in('#mc-alo', 0, -3); s.fade('#mc-alo-n', .3)
s.card_in('#mc-ham', s.at('rookie'), 3); s.fade('#mc-ham-n', s.at('Lewis'))
for i in range(9): s.pop(f'#mc-d{i}', s.at('podium') + i * .09, .22)
s.fade('#mc-9', s.at('nine'))
s.stamp('#mc-split', s.at('splits'), -6)
for x in ('#mc-alo', '#mc-alo-n', '#mc-ham', '#mc-ham-n', '#mc-9', '#mc-split') + tuple(f'#mc-d{i}' for i in range(9)): s.out(x, s.at('Hungary') - .3)
s.add(photo('mc-car', 'hamilton07', 120, 300, 640, 400, 47))
s.add('<div id="mc-car-n" class="band" style="left:130px;top:670px;background:#C9CED4;color:#111;font-size:44px">McLaren · 2007</div>')
s.card_in('#mc-car', s.at('Hungary') - .3, -2); s.fade('#mc-car-n', s.at('Hungary') + .1); s.card_in('#mc-h', s.at('Hungary') + .35)
s.card_in('#mc-c1', s.at('Hungary') + .1, 2); s.stamp('#mc-pen', s.at('sixth'), -7); s.out(s.scribble(520, 860, 160, 110, s.at('sixth') - .1), s.at('Japan') - .25)
for x in ('#mc-c1', '#mc-pen'): s.out(x, s.at('Japan') - .25)
s.card_in('#mc-c2', s.at('Japan'), -2); s.stamp('#mc-dnf', s.at('crashes'), 6)
for x in ('#mc-c2', '#mc-dnf'): s.out(x, s.at('Brazil') - .25)
s.card_in('#mc-c3', s.at('Brazil'), 1)
for x in ('#mc-car', '#mc-car-n'): s.out(x, s.at('Brazil') - .1)
chart_slide(s, s.at('Brazil') + .2)
s.bar('mclaren', 2007, s.at('one', 1)); s.scribble(CX + BX0 + 2 * BSTEP - 10, CY + ZERO - 10, BW + 20, 80, s.at('one', 1) + .5, '#E10600')
s.stamp('#mc-one', s.at('leaves'), -4)

# ---- 4 Ferrari 2010
s = S('f2010'); hc = ERA['f2010'][2]
s.add(photo('f10-vet', 'vet_face', 110, 320, 320, 380, 14)); s.add(photo('f10-alo', 'alo11_face', 500, 360, 320, 380, 19))
s.add('<div id="f10-vet-n" class="band" style="left:120px;top:680px;background:#1E3A8A;font-size:44px">Vettel · Red Bull</div><div id="f10-alo-n" class="band" style="left:510px;top:720px;background:#DC0000;font-size:44px">Alonso · Ferrari</div><div id="f10-vs" class="big" style="left:430px;top:560px;font-size:110px;color:#FFD200">VS</div>')
s.add('<div id="f10-fast" class="tape" style="left:140px;top:820px;font-size:48px">fastest car of the era</div>')
s.add(chart('f2010', [2005, 2006, 2007]))
s.add(helmet('f10-h', hc, 230, 120, 770))
s.add(f'<div id="f10-c1" class="card" style="left:380px;top:740px;width:400px;height:330px;clip-path:{torn(21, 400, 330)}"><div class="ctitle">Before Abu Dhabi</div>'
      '<div style="position:absolute;left:30px;right:30px;top:90px">'
      '<div class="row3 me"><span class="n">Alonso</span><span>246</span></div><div class="row3"><span class="n">Webber</span><span>238</span></div>'
      '<div class="row3"><span class="n">Vettel</span><span>231</span></div></div></div>')
s.add('<div id="f10-4th" class="tape" style="left:130px;top:1035px;font-size:46px">4th is enough</div>')
s.add(f'<div id="f10-c2" class="card" style="left:120px;top:760px;width:660px;height:300px;clip-path:{torn(22, 660, 300)}"><div class="ctitle">Lap after lap</div>'
      '<div style="position:absolute;left:30px;right:30px;top:190px;height:18px;background:#3A3530;border-radius:9px"></div>'
      '<div style="position:absolute;left:300px;top:168px;width:64px;height:64px;border-radius:50%;background:#FFD200;border:8px solid #111"></div>'
      '<div class="lab" style="position:absolute;left:280px;top:100px;color:#2A2522">Petrov</div></div>')
s.add(helmet('f10-hm', hc, 110, 300, 900))
s.add('<div id="f10-p7" class="stamp" style="left:560px;top:870px;font-size:80px">P7</div>')
s.card_in('#f10-alo', 0, 3); s.fade('#f10-alo-n', .3)
s.card_in('#f10-vet', s.at('Vettel', 1) - .2, -3); s.fade('#f10-vet-n', s.at('Vettel', 1) + .2); s.pop('#f10-vs', s.at('Vettel', 1) + .3); s.tape('#f10-fast', s.at('fastest'), -2)
for x in ('#f10-vet', '#f10-vet-n', '#f10-fast', '#f10-alo', '#f10-alo-n', '#f10-vs'): s.out(x, s.at('Abu') - .3)
s.add(photo('f10-rb', 'vettel', 120, 300, 640, 330, 48))
s.add('<div id="f10-rb-n" class="band" style="left:130px;top:610px;background:#1E3A8A;font-size:44px">Red Bull · Vettel</div>')
s.card_in('#f10-rb', s.at('Abu') - .3, 2); s.fade('#f10-rb-n', s.at('Abu') + .1); s.card_in('#f10-h', s.at('Abu') + .35)
s.card_in('#f10-c1', s.at('Abu') + .1, 2); s.tape('#f10-4th', s.at('Fourth'), -3)
for x in ('#f10-c1', '#f10-4th', '#f10-h'): s.out(x, s.at('pits') - .25)
s.card_in('#f10-c2', s.at('pits'), -1)
t0, t1 = s.at('comes'), s.at('Seventh') - .1
s.fade('#f10-hm', t0, .25)
s.tw(f'tl.fromTo("#f10-hm", {{x:-16, y:0}}, {{x:14, y:-8, duration:.32, ease:"sine.inOut", yoyo:true, repeat:{max(1, int((t1 - t0) / .32) - 1)}}}, {t0:.3f});')
s.stamp('#f10-p7', s.at('Seventh'), -6); s.scribble(560, 870, 150, 110, s.at('Seventh') + .25, '#FFD200')
for x in ('#f10-rb', '#f10-rb-n'): s.out(x, s.at('Vettel', 2) - .3)
chart_slide(s, s.at('Vettel', 2) - .1)
s.bar('f2010', 2010, s.at('four', 2)); s.scribble(CX + BX0 + 3 * BSTEP - 10, CY + ZERO - 10, BW + 20, 90, s.at('four', 2) + .5, '#FFD200')

# ---- 5 Ferrari 2012: the masterpiece
s = S('f2012'); hc = ERA['f2012'][2]
s.add(photo('f12-p', 'alo_fists', 120, 300, 560, 380, 15))
s.add('<div id="f12-mp" class="stamp solid" style="left:420px;top:300px;font-size:52px">masterpiece</div>')
s.add('<div id="f12-g" class="big" style="left:120px;top:790px;font-size:110px;white-space:nowrap">GRID <span id="f12-gv">6.1</span></div>')
s.add('<div id="f12-f" class="big" style="left:120px;top:910px;font-size:110px;white-space:nowrap;color:#FFD200">FINISH <span id="f12-fv">3.3</span></div>')
s.add('<div id="f12-avg" class="lab" style="position:absolute;left:126px;top:1036px;font-size:28px">average, 2012</div>')
s.add('<div id="f12-mas" class="tape" style="left:540px;top:800px;font-size:42px">278 v 122<br>(Massa)</div>')
s.add(chart('f2012', [2005, 2006, 2007, 2010]))
LX, LY, LW, LH = 150, 860, 600, 190
mx, mn = 50, -15
px = lambda i: LX + i * LW / (len(lead12) - 1)
py = lambda v: LY + (mx - v) / (mx - mn) * LH
i_ger, i_spa, i_suz = races12.index('German'), races12.index('Belgian'), races12.index('Japanese')
s.add(f'<div id="f12-card" class="card" style="left:120px;top:740px;width:660px;height:350px;clip-path:{torn(31, 660, 350)}"><div class="ctitle">Lead over Vettel, 2012</div></div>')
s.add(f'<svg id="f12-plot" viewBox="0 0 {W} {H}" style="position:absolute;left:0;top:0;width:{W}px;height:{H}px" data-layout-ignore>'
      f'<line x1="{LX}" y1="{py(0):.0f}" x2="{LX + LW}" y2="{py(0):.0f}" stroke="#2A2522" stroke-width="3" stroke-dasharray="10 8"/>'
      f'<path id="f12-line" d="M{px(0):.1f},{py(lead12[0]):.1f}" fill="none" stroke="#C8102E" stroke-width="8" stroke-linejoin="round" stroke-linecap="round"/>'
      f'<circle id="f12-dger" cx="{px(i_ger):.0f}" cy="{py(lead12[i_ger]):.0f}" r="12" fill="#C8102E"/></svg>')
s.add(f'<div id="f12-44" style="position:absolute;left:{px(i_ger) - 70:.0f}px;top:{py(44) - 74:.0f}px;font:700 56px Oswald;color:#C8102E">+44</div>')
s.add(f'<div id="f12-spa" class="stamp" style="left:{px(i_spa) + 14:.0f}px;top:{py(24) - 84:.0f}px;font-size:40px;padding:0 10px;border-width:5px">DNF Spa</div>')
s.add(f'<div id="f12-suz" class="stamp" style="left:{px(i_suz) - 90:.0f}px;top:{py(4) + 30:.0f}px;font-size:40px;padding:0 10px;border-width:5px">DNF Suzuka</div>')
s.add(f'<div id="f12-end" style="position:absolute;left:{px(len(lead12) - 1) - 40:.0f}px;top:{py(-3) + 8:.0f}px;font:700 48px Oswald;color:#C8102E">−3</div>')
s.card_in('#f12-p', 0, -2); s.stamp('#f12-mp', s.at('masterpiece'), -6)
s.pop('#f12-g', s.at('sixth')); s.pop('#f12-f', s.at('third')); s.fade('#f12-avg', s.at('third') + .3)
s.tape('#f12-mas', s.at('double'), -3)
for x in ('#f12-p', '#f12-mp', '#f12-g', '#f12-f', '#f12-avg', '#f12-mas'): s.out(x, s.at('leads') - .3)
s.add(photo('f12-race', 'f2012', 120, 300, 640, 400, 49))
s.add('<div id="f12-race-n" class="band" style="left:130px;top:670px;background:#DC0000;font-size:44px">Alonso leads · 2012</div>')
s.card_in('#f12-race', s.at('leads') - .3, -2); s.fade('#f12-race-n', s.at('leads') + .1)
s.card_in('#f12-card', s.at('leads'), -1); s.fade('#f12-plot', s.at('leads') + .2, .2)
pts = [[round(px(i), 1), round(py(v), 1)] for i, v in enumerate(lead12)]
s.tw('const P12 = ' + json.dumps(pts) + ', L12 = document.getElementById("f12-line"), g12 = {i: 0};')
s.tw('const d12 = () => { const k = Math.floor(g12.i), f = g12.i - k; let d = "M" + P12[0]; for (let j = 1; j <= k && j < P12.length; j++) d += " L" + P12[j]; if (k + 1 < P12.length && f > 0) d += " L" + (P12[k][0] + (P12[k + 1][0] - P12[k][0]) * f) + "," + (P12[k][1] + (P12[k + 1][1] - P12[k][1]) * f); L12.setAttribute("d", d); };')
s.tw(f'tl.fromTo(g12, {{i:0}}, {{i:{i_ger}, duration:1.2, ease:"power2.out", onUpdate:d12}}, {s.at("leads") + .3:.3f});')
s.pop('#f12-dger', s.at('forty-four')); s.pop('#f12-44', s.at('forty-four') + .1); sc44 = s.scribble(px(i_ger) - 70, py(44) - 74, 120, 70, s.at('forty-four') + .3, '#C8102E', 6)
s.tw(f'tl.to(g12, {{i:{i_spa}, duration:.6, ease:"power2.inOut", onUpdate:d12}}, {s.at("Spa"):.3f});')
s.stamp('#f12-spa', s.at('Spa') + .3, -6)
s.tw(f'tl.to(g12, {{i:{i_suz}, duration:.6, ease:"power2.inOut", onUpdate:d12}}, {s.at("Suzuka"):.3f});')
s.stamp('#f12-suz', s.at('Suzuka') + .3, 5)
s.tw(f'tl.to(g12, {{i:{len(lead12) - 1}, duration:1.0, ease:"power2.inOut", onUpdate:d12}}, {s.at("Vettel"):.3f});')
s.pop('#f12-end', s.at('three'))
for x in ('#f12-race', '#f12-race-n'): s.out(x, s.at('Vettel') - .3)
chart_slide(s, s.at('Vettel') - .1)
s.bar('f2012', 2012, s.at('three'))
# the 2012 chapter ends on 1 + 4 + 3 = 8, then a hard cut to today
s.add('<div id="f12-eq" class="big" style="left:120px;top:760px;font-size:130px;white-space:nowrap"><span id="f12-e1">1</span> <span id="f12-p1" style="color:#888">+</span> <span id="f12-e4">4</span> <span id="f12-p2" style="color:#888">+</span> <span id="f12-e3">3</span></div>')
s.add('<div id="f12-8" class="big" style="left:120px;top:890px;font-size:190px;color:#E10600">= 8</div>')
s.add('<div id="f12-8l" class="lab" style="position:absolute;left:420px;top:950px;color:#fff;font-size:36px;line-height:1.3">points<br>from five</div>')
for x in (sc44, '#f12-card', '#f12-plot', '#f12-44', '#f12-dger', '#f12-spa', '#f12-suz', '#f12-end'): s.out(x, s.at('One') - .3)
for i, (y, word, el) in enumerate(((2007, 'One', '#f12-e1'), (2010, 'Four', '#f12-e4'), (2012, 'Three', '#f12-e3'))):
    t = s.at(word, 2 if word == 'Three' else 1)
    s.tw(f'tl.to("#f2012-b{y}", {{scaleY:1.6, transformOrigin:"50% 0%", duration:.18, yoyo:true, repeat:1, ease:"power2.out"}}, {t:.3f});')
    s.pop(el, t, .25); s.sound('pop', t + .1, .7)
    if i: s.fade(f'#f12-p{i}', t - .1, .2)
s.pop('#f12-8', s.at('Eight'), .4); s.scribble(215, 900, 160, 180, s.at('Eight') + .4, '#FFD200', 9); s.fade('#f12-8l', s.at('Eight') + .3)
s.sound('riser', s.at('Eight') + 1 / 30 - 1.953, .5); s.sound('fs-222517-dramatic-hit', s.at('Eight') + 1 / 30 - .322, .8)

# ---- 9 today: straight cut from 2012 to 2026. Newey joins (no openly licensed Newey photo found yet, so a drawn blueprint card)
s = S('today'); hc = ERA['today'][2]
s.add(photo('td-p', 'today', 120, 310, 400, 500, 18))
s.add('<div id="td-45" class="tape" style="left:560px;top:330px;font-size:60px">2026 · age 45</div>')
s.add('<div id="td-n" class="big" style="left:560px;top:430px;font-size:150px;color:#CEDC00">0</div>')
s.add('<div id="td-nl" class="lab" style="position:absolute;left:566px;top:590px;font-size:30px">Grands Prix</div>')
s.add('<div id="td-w" class="big" style="left:560px;top:640px;font-size:110px">32</div>')
s.add('<div id="td-wl" class="lab" style="position:absolute;left:690px;top:676px;font-size:30px">wins</div>')
s.add('<div id="td-win" class="tape" style="left:540px;top:770px;font-size:42px">last: Spain 2013</div>')
car = ('<svg viewBox="0 0 400 120" style="position:absolute;left:24px;top:150px;width:372px;height:112px" fill="none" stroke="#DCE8F5" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">'
       '<path d="M8 84 L40 84 L62 70 L150 66 L178 44 L214 42 L232 60 L300 62 L340 40 L386 40 L388 74 L352 84 L300 88 L120 90 Z"/>'
       '<circle cx="86" cy="88" r="24"/><circle cx="318" cy="88" r="24"/><circle cx="86" cy="88" r="8"/><circle cx="318" cy="88" r="8"/>'
       '<path d="M8 84 L8 70 L44 70" /><path d="M190 44 Q200 30 214 30" /><path d="M120 100 L300 100" stroke-dasharray="6 6"/>'
       '<path d="M40 112 L120 112 M300 112 L370 112" stroke-width="2"/><path d="M40 106 L40 118 M120 106 L120 118" stroke-width="2"/></svg>')
grid = 'background-color:#0F3B73;background-image:linear-gradient(rgba(255,255,255,.10) 2px, transparent 2px),linear-gradient(90deg, rgba(255,255,255,.10) 2px, transparent 2px);background-size:40px 40px'
s.add(f'<div id="td-nw" class="pcard" style="left:540px;top:330px;width:420px;height:440px;{grid};clip-path:{torn(51, 420, 440)}">'
      '<div class="lab" style="position:absolute;left:26px;top:28px;color:#DCE8F5;font-size:24px">drawing no. 1 · design office</div>'
      f'{car}'
      '<div style="position:absolute;left:24px;top:300px;padding:2px 14px;background:#111;color:#fff;font:700 54px Oswald;text-transform:uppercase">Adrian Newey</div>'
      '<div class="hand" style="position:absolute;left:28px;top:376px;font-size:40px;color:#DCE8F5">joins Aston Martin · 2025</div></div>')
s.add('<div id="td-rb" class="card" style="left:120px;top:850px;width:660px;height:240px;clip-path:polygon(0 0,100% 2px,100% 100%,0 98%)">'
      '<div class="ctitle">His Red Bulls beat Alonso</div>'
      '<div class="row3" style="position:absolute;left:30px;right:30px;top:84px"><span class="n">2010</span><span style="color:#C8102E">−4</span></div>'
      '<div class="row3" style="position:absolute;left:30px;right:30px;top:150px"><span class="n">2012</span><span style="color:#C8102E">−3</span></div></div>')
s.add('<div id="td-same" class="tape" style="left:560px;top:790px;font-size:46px">now on his side</div>')
for i in range(3): s.add(trophy(f'td-t{i}', 150 + i * 140, 880, i < 2, 1.0))
s.add('<div id="td-last" class="stamp solid" style="left:500px;top:915px;font-size:54px">one last title?</div>')
end_t = round(last['today'] - START['today'] + .25, 2)
s.add(f'<div id="td-end" style="position:absolute;inset:0;background:#0E0F12"><div style="position:absolute;left:120px;top:640px;width:768px;font:italic 900 140px Archivo, Oswald;color:#fff;letter-spacing:-.02em">ONE <span style="color:#E10600">F1</span></div>'
      '<div class="lab" style="position:absolute;left:126px;top:820px;font-size:34px;color:#B9BDC4">Follow @F1STATLAB</div>'
      '<div class="lab" style="position:absolute;left:126px;top:880px;font-size:28px;color:#7D828C">Data: Jolpica · photos: CC, credits in caption</div></div>')
s.card_in('#td-p', 0, -3); s.tape('#td-45', max(.7, s.at('forty-five')), 4)
s.fade('#td-n', s.at('Four') - .1, .2); s.count('#td-n', 0, 449, s.at('Four'), 1.3); s.fade('#td-nl', s.at('Four') + .3)
s.pop('#td-w', s.at('Thirty-two')); s.fade('#td-wl', s.at('Thirty-two') + .2); s.tape('#td-win', s.at('2013'), -3)
for x in ('#td-45', '#td-n', '#td-nl', '#td-w', '#td-wl', '#td-win'): s.out(x, s.at('2025') - .3)
s.card_in('#td-nw', s.at('2025'), 3)
s.card_in('#td-rb', s.at('Red'), -1); scrb = s.scribble(560, 920, 200, 150, s.at('2012', 1) + .2, '#C8102E', 6)
s.tape('#td-same', s.at('car', 2), -3)
s.out('#td-rb', s.at('chasing') - .3); s.out(scrb, s.at('chasing') - .3)
for i in range(3): s.pop(f'#td-t{i}', s.at('chasing') + i * .15)
s.stamp('#td-last', s.at('title'), -5)
s.fade('#td-end', end_t, .4)

for sc in scenes.values(): sc.write()

# captions: 2-3 words, broken at punctuation; the word being spoken turns yellow
caps, cur = [], []
for ch, w, st, en in words:
    cur.append((w, st, en))
    if len(cur) == 3 or w[-1] in '.,:' or (len(cur) == 2 and len(''.join(x[0] for x in cur)) > 15):
        caps.append(cur); cur = []
if cur: caps.append(cur)
groups, hl = [], []
for i, g in enumerate(caps):
    st = g[0][1]; en = caps[i + 1][0][1] if i + 1 < len(caps) and caps[i + 1][0][1] - g[-1][2] < .9 else g[-1][2] + .35
    spans = []
    for j, (w, a, b) in enumerate(g):
        spans.append(f'<span id="cw{i}-{j}">{w.rstrip(".,:").replace(chr(39), "’").upper()}</span>')
        hl.append((f'#cw{i}-{j}', a, (g[j + 1][1] if j + 1 < len(g) else en)))
    groups.append((round(st - .05, 3), round(en - st, 3), ' '.join(spans)))
cap_html = '\n'.join(f'    <div id="cap-{i}" class="cap clip" data-start="{s_:.3f}" data-duration="{d:.3f}" data-track-index="1"><div class="in" id="capin-{i}">{t}</div></div>' for i, (s_, d, t) in enumerate(groups))
cap_js = '\n'.join(f'  tl.fromTo("#capin-{i}", {{opacity:0, y:18, scale:.9}}, {{opacity:1, y:0, scale:1, duration:.14, ease:"back.out(2)"}}, {s_:.3f});' for i, (s_, d, t) in enumerate(groups))
cap_js += '\n' + '\n'.join(f'  tl.fromTo("{sel}", {{color:"#FFFFFF"}}, {{color:"#FFD200", duration:.06}}, {a:.3f}); tl.to("{sel}", {{color:"#FFFFFF", duration:.06}}, {max(a + .07, b - .03):.3f});' for sel, a, b in hl)
cap_doc = f'''<template>
<link rel="stylesheet" href="assets/film.css" />
<style>
#root {{ position: absolute; inset: 0; }}
.cap {{ position: absolute; left: 120px; width: 660px; top: 1130px; text-align: center; }}
.cap .in {{ display: inline-block; font: 700 68px "Oswald"; letter-spacing: .01em; color: #fff; line-height: 1.05;
  text-shadow: 0 4px 0 rgba(0,0,0,.6), 0 0 18px rgba(0,0,0,.55); }}
.cap .in span {{ color: #fff; }}
</style>
<div id="root" data-composition-id="captions" data-width="{W}" data-height="{H}">
{cap_html}
</div>
<script>
(() => {{
  const tl = gsap.timeline({{ paused: true }});
{cap_js}
  window.__timelines["captions"] = tl;
}})();
</script>
</template>'''
open(os.path.join(FILM, 'compositions', 'captions.html'), 'w').write(cap_doc)
open(os.path.join(FILM, 'assets', 'film.css'), 'w').write(SHARED_CSS)
exec(src[src.index('# ------------------------------------------------------------------ sound and root'):src.index("print('total'")], globals())
print('total', TOTAL, 's |', ' '.join(f'{c} {START[c]}+{DUR[c]}' for c in CH), '|', len(groups), 'captions,', len(audio), 'sounds')
