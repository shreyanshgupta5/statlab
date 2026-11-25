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
    ('origins', "Oviedo, northern Spain. His father, a mechanic who raced karts for fun, built a kart for Fernando's older sister. She didn't want it. Fernando, aged three, did. By fifteen he was junior world karting champion. Formula Nissan champion at eighteen. And in 2001, at nineteen, he was on the Formula One grid, with Minardi. He scored zero points."),
    ('renault', "Renault saw something. In 2003 he wins in Hungary, the youngest winner Formula One had ever seen. Then he takes on the two giants of his time. Michael Schumacher: seven world titles. Kimi Räikkönen: the Iceman, in a McLaren that was often the fastest car on the grid. In 2005, Alonso beats Räikkönen to the title. In 2006, he beats Schumacher, head to head. Two titles by twenty-five. Everyone expected a dynasty."),
    ('mclaren', "2007. The double champion joins McLaren. His teammate: a rookie called Lewis Hamilton. Alonso expects to lead. Instead, Hamilton finishes on the podium in each of his first nine races. The garage splits. In Hungary, Alonso holds Hamilton up in the pit lane and is moved from pole to sixth. In Japan, he crashes out in the rain. And in Brazil, Räikkönen steals the title from both of them. Alonso misses it by one point. After one season, he leaves."),
    ('f2010', "2010. Ferrari. Against him: Sebastian Vettel, and a Red Bull that was the fastest car of the era. Abu Dhabi, the final race. Alonso leads the championship. Fourth would be enough. Ferrari pits him early, he comes out behind Petrov's Renault, and he never gets past. Seventh. Vettel is champion by four points."),
    ('f2012', "2012 is his masterpiece. His Ferrari starts sixth on average. He finishes third on average, with thirteen podiums and more than double his teammate's points. He leads by forty-four in July. Then two first-lap crashes, at Spa and Suzuka. Vettel wins it by three."),
    ('honda', "2015. Back to McLaren, now with Honda. It's a disaster. In Japan he says it on the radio: GP2 engine. Four seasons. Zero podiums. In 2018, he walks away from Formula One."),
    ('away', "So he goes looking for other wins. Le Mans, twice, with Toyota. The Indy 500. The Dakar. Then in 2021, he comes back: a podium with Alpine at forty, and eight more with Aston Martin in 2023."),
    ('reveal', "One point. Four points. Three points. Eight points between two titles and five."),
    ('today', "Now he's forty-five. Four hundred and forty-nine Grands Prix. His last win: Spain, 2013. This year, seven points from twenty-one races. But he's still here, chasing one thing. Win number thirty-three."),
]
SPOKEN_LEN = {'2001': 4, '2003': 4, '2005': 4, '2006': 4, '2007': 4, '2010': 3, '2012': 3, '2013': 3, '2015': 3, '2018': 3, '2021': 3, '2023': 3,
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
    'origins': ('#1F3F95', 'rgba(255,255,255,.07)',  ('#111111', '#FFFFFF', '#FFD200')),
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

scenes = {}
def S(ch): scenes[ch] = Scene(ch); return scenes[ch]

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

# ---- 1 origins
s = S('origins'); hc = ERA['origins'][2]
s.add('<div id="or-t1" class="tape" style="left:130px;top:300px">Oviedo · 1981</div>')
s.add(photo('or-k83', 'kart1983', 140, 370, 600, 470, 2))
s.add('<div id="or-t2" class="tape" style="left:150px;top:900px;font-size:44px">his first kart, built by his father</div>')
s.add('<div id="or-t3" class="tape" style="left:540px;top:800px;font-size:66px">age 3</div>')
s.add(photo('or-k96', 'kart1996', 140, 370, 600, 470, 3))
s.add('<div id="or-st1" class="stamp solid" style="left:140px;top:880px;font-size:46px">1996 · junior world champion</div>')
s.add('<div id="or-t4" class="tape" style="left:180px;top:990px;font-size:44px">1999 · Formula Nissan champion</div>')
s.add(helmet('or-h', hc, 300, 120, 340))
s.add('<div id="or-19" class="tape" style="left:460px;top:360px;font-size:60px">2001 · age 19</div>')
s.add('<div id="or-zero" class="big" style="left:460px;top:470px;font-size:300px;color:#FFD200">0</div>')
s.add('<div id="or-zl" class="lab" style="position:absolute;left:640px;top:690px;font-size:34px">points</div>')
s.add('<div id="or-st2" class="stamp solid" style="left:150px;top:820px;font-size:64px">Minardi</div>')
s.tape('#or-t1', s.at('Oviedo'), -4)
s.card_in('#or-k83', s.at('built'), -2); s.tape('#or-t2', s.at('built') + .3, 2)
s.tape('#or-t3', s.at('three'), 6)
for x in ('#or-k83', '#or-t2', '#or-t3', '#or-t1'): s.out(x, s.at('fifteen') - .3)
s.card_in('#or-k96', s.at('fifteen') - .1, 2); s.stamp('#or-st1', s.at('junior'), -3)
s.tape('#or-t4', s.at('Formula', 1), 2)
for x in ('#or-k96', '#or-st1', '#or-t4'): s.out(x, s.at('2001') - .3)
s.card_in('#or-h', s.at('2001')); s.tape('#or-19', s.at('nineteen'), -3)
s.stamp('#or-st2', s.at('Minardi'), -6)
s.pop('#or-zero', s.at('zero')); s.fade('#or-zl', s.at('zero') + .2)

# ---- 2 Renault: the giants
s = S('renault'); hc = ERA['renault'][2]
s.add(photo('rn-big', 'renault', 120, 340, 580, 420, 4))
s.add('<div id="rn-t1" class="tape" style="left:140px;top:300px">2003 · Hungary · first win</div>')
s.add('<div id="rn-st1" class="stamp solid" style="left:180px;top:800px;font-size:52px">youngest winner</div>')
s.add(photo('rn-schu', 'schumacher', 110, 300, 330, 380, 5))
s.add('<div id="rn-schu-n" class="band" style="left:120px;top:640px">Schumacher</div>')
s.add('<div id="rn-schu-s" class="stamp solid" style="left:150px;top:300px;font-size:44px">7 titles</div>')
s.add(photo('rn-kimi', 'raikkonen', 470, 330, 400, 286, 6))
s.add('<div id="rn-kimi-n" class="band" style="left:500px;top:590px">Räikkönen</div>')
s.add('<div id="rn-kimi-t" class="tape" style="left:560px;top:660px">the Iceman</div>')
s.add('<div id="rn-vs" class="big" style="left:430px;top:710px;font-size:110px;color:#FFD200">VS</div>')
s.add(photo('rn-alo', 'renault_s', 230, 800, 420, 280, 7))
s.add('<div id="rn-alo-n" class="band" style="left:250px;top:1030px;background:#FFD200;color:#0B3D91">Alonso</div>')
s.add(chart('renault', []))
s.add(helmet('rn-h', hc, 220, 120, 770))
s.add('<div id="rn-c1" class="big" style="left:380px;top:800px;font-size:92px"><span id="rn-a1">0</span><span style="color:#FFD200"> v </span>112</div>')
s.add('<div id="rn-l1" class="lab" style="position:absolute;left:384px;top:910px;color:#FFD200;letter-spacing:.04em">2005 · v Räikkönen</div>')
s.add('<div id="rn-c2" class="big" style="left:380px;top:800px;font-size:92px"><span id="rn-a2">0</span><span style="color:#FFD200"> v </span>121</div>')
s.add('<div id="rn-l2" class="lab" style="position:absolute;left:384px;top:910px;color:#FFD200;letter-spacing:.04em">2006 · v Schumacher</div>')
s.add('<div id="rn-dyn" class="tape" style="left:420px;top:990px;font-size:56px">a dynasty?</div>')
s.card_in('#rn-big', 0, -2); s.tape('#rn-t1', s.at('Hungary'), -3); s.stamp('#rn-st1', s.at('youngest'), -5)
for x in ('#rn-big', '#rn-t1', '#rn-st1'): s.out(x, s.at('giants') - .3)
s.card_in('#rn-schu', s.at('Schumacher', 1), -5); s.fade('#rn-schu-n', s.at('Schumacher', 1) + .3); s.stamp('#rn-schu-s', s.at('seven'), -8)
s.card_in('#rn-kimi', s.at('Räikkönen', 1), 4); s.fade('#rn-kimi-n', s.at('Räikkönen', 1) + .3); s.tape('#rn-kimi-t', s.at('Iceman'), -3)
s.pop('#rn-vs', s.at('McLaren')); s.card_in('#rn-alo', s.at('McLaren') + .2, -2); s.fade('#rn-alo-n', s.at('McLaren') + .5)
for x in ('#rn-schu', '#rn-schu-n', '#rn-schu-s', '#rn-kimi', '#rn-kimi-n', '#rn-kimi-t', '#rn-vs', '#rn-alo', '#rn-alo-n'): s.out(x, s.at('2005') - .3)
chart_slide(s, s.at('2005') - .1)
s.card_in('#rn-h', s.at('2005'))
s.fade('#rn-c1', s.at('Alonso')); s.count('#rn-a1', 0, 133, s.at('Alonso'), 1.2); s.fade('#rn-l1', s.at('Alonso') + .2)
s.bar('renault', 2005, s.at('title'))
for x in ('#rn-c1', '#rn-l1'): s.out(x, s.at('2006') - .25)
s.fade('#rn-c2', s.at('2006')); s.count('#rn-a2', 0, 134, s.at('2006'), 1.2); s.fade('#rn-l2', s.at('2006') + .2)
s.bar('renault', 2006, s.at('head', 1))
s.tape('#rn-dyn', s.at('dynasty'), 3)

# ---- 3 McLaren 2007: the rookie
s = S('mclaren'); hc = ERA['mclaren'][2]
s.add(photo('mc-alo', 'alonso07', 110, 320, 360, 250, 8))
s.add('<div id="mc-alo-n" class="band" style="left:120px;top:570px;font-size:42px">Alonso · 2× champ</div>')
s.add(photo('mc-ham', 'hamilton07', 500, 470, 360, 250, 9))
s.add('<div id="mc-ham-n" class="band" style="left:500px;top:720px;background:#FFD400;color:#111;font-size:46px">Hamilton · rookie</div>')
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
chart_slide(s, s.at('Hungary') - .2); s.card_in('#mc-h', s.at('Hungary'))
s.card_in('#mc-c1', s.at('Hungary') + .1, 2); s.stamp('#mc-pen', s.at('sixth'), -7)
for x in ('#mc-c1', '#mc-pen'): s.out(x, s.at('Japan') - .25)
s.card_in('#mc-c2', s.at('Japan'), -2); s.stamp('#mc-dnf', s.at('crashes'), 6)
for x in ('#mc-c2', '#mc-dnf'): s.out(x, s.at('Brazil') - .25)
s.card_in('#mc-c3', s.at('Brazil'), 1)
s.bar('mclaren', 2007, s.at('one', 1))
s.stamp('#mc-one', s.at('leaves'), -4)

# ---- 4 Ferrari 2010
s = S('f2010'); hc = ERA['f2010'][2]
s.add(photo('f10-vet', 'vettel', 120, 380, 700, 300, 14))
s.add('<div id="f10-vet-n" class="band" style="left:130px;top:690px;background:#1E3A8A">Vettel · Red Bull</div>')
s.add('<div id="f10-fast" class="tape" style="left:420px;top:780px;font-size:48px">fastest car of the era</div>')
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
s.card_in('#f10-vet', s.at('Vettel', 1) - .2, -2); s.fade('#f10-vet-n', s.at('Vettel', 1) + .2); s.tape('#f10-fast', s.at('fastest'), 3)
for x in ('#f10-vet', '#f10-vet-n', '#f10-fast'): s.out(x, s.at('Abu') - .3)
chart_slide(s, s.at('Abu') - .2); s.card_in('#f10-h', s.at('Abu'))
s.card_in('#f10-c1', s.at('Abu') + .1, 2); s.tape('#f10-4th', s.at('Fourth'), -3)
for x in ('#f10-c1', '#f10-4th', '#f10-h'): s.out(x, s.at('pits') - .25)
s.card_in('#f10-c2', s.at('pits'), -1)
t0, t1 = s.at('comes'), s.at('Seventh') - .1
s.fade('#f10-hm', t0, .25)
s.tw(f'tl.fromTo("#f10-hm", {{x:-16, y:0}}, {{x:14, y:-8, duration:.32, ease:"sine.inOut", yoyo:true, repeat:{max(1, int((t1 - t0) / .32) - 1)}}}, {t0:.3f});')
s.stamp('#f10-p7', s.at('Seventh'), -6)
s.bar('f2010', 2010, s.at('four', 2))

# ---- 5 Ferrari 2012: the masterpiece
s = S('f2012'); hc = ERA['f2012'][2]
s.add(photo('f12-p', 'f2012', 120, 300, 640, 424, 15))
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
chart_slide(s, s.at('leads') - .2)
s.card_in('#f12-card', s.at('leads'), -1); s.fade('#f12-plot', s.at('leads') + .2, .2)
pts = [[round(px(i), 1), round(py(v), 1)] for i, v in enumerate(lead12)]
s.tw('const P12 = ' + json.dumps(pts) + ', L12 = document.getElementById("f12-line"), g12 = {i: 0};')
s.tw('const d12 = () => { const k = Math.floor(g12.i), f = g12.i - k; let d = "M" + P12[0]; for (let j = 1; j <= k && j < P12.length; j++) d += " L" + P12[j]; if (k + 1 < P12.length && f > 0) d += " L" + (P12[k][0] + (P12[k + 1][0] - P12[k][0]) * f) + "," + (P12[k][1] + (P12[k + 1][1] - P12[k][1]) * f); L12.setAttribute("d", d); };')
s.tw(f'tl.fromTo(g12, {{i:0}}, {{i:{i_ger}, duration:1.2, ease:"power2.out", onUpdate:d12}}, {s.at("leads") + .3:.3f});')
s.pop('#f12-dger', s.at('forty-four')); s.pop('#f12-44', s.at('forty-four') + .1)
s.tw(f'tl.to(g12, {{i:{i_spa}, duration:.6, ease:"power2.inOut", onUpdate:d12}}, {s.at("Spa"):.3f});')
s.stamp('#f12-spa', s.at('Spa') + .3, -6)
s.tw(f'tl.to(g12, {{i:{i_suz}, duration:.6, ease:"power2.inOut", onUpdate:d12}}, {s.at("Suzuka"):.3f});')
s.stamp('#f12-suz', s.at('Suzuka') + .3, 5)
s.tw(f'tl.to(g12, {{i:{len(lead12) - 1}, duration:1.0, ease:"power2.inOut", onUpdate:d12}}, {s.at("Vettel"):.3f});')
s.pop('#f12-end', s.at('three'))
s.bar('f2012', 2012, s.at('three'))

# ---- 6 McLaren-Honda: the wilderness
s = S('honda'); hc = ERA['honda'][2]
s.add(photo('hd-p', 'honda', 120, 320, 640, 300, 16))
s.add('<div id="hd-n" class="band" style="left:130px;top:620px;background:#FF8000;color:#111">McLaren-Honda · 2015</div>')
s.add('<div id="hd-dis" class="stamp solid" style="left:430px;top:300px;font-size:56px">disaster</div>')
s.add('<div id="hd-q" class="big" style="left:120px;top:740px;font-size:120px;line-height:1;color:#FF8000">“GP2<br>ENGINE!”</div>')
s.add('<div id="hd-ql" class="lab" style="position:absolute;left:126px;top:1000px;font-size:28px">team radio · Suzuka 2015</div>')
s.add('<div id="hd-0" class="big" style="left:120px;top:720px;font-size:260px">0</div>')
s.add('<div id="hd-0l" class="lab" style="position:absolute;left:330px;top:820px;font-size:34px;line-height:1.35">podiums<br>in four seasons</div>')
s.add('<div id="hd-st" class="stamp solid" style="left:140px;top:1000px;font-size:60px">gone · 2018</div>')
s.card_in('#hd-p', 0, -2); s.fade('#hd-n', .3)
s.stamp('#hd-dis', s.at('disaster'), -6)
s.pop('#hd-q', s.at('GP2'), .35); s.fade('#hd-ql', s.at('GP2') + .3)
for x in ('#hd-q', '#hd-ql'): s.out(x, s.at('Zero') - .3)
s.pop('#hd-0', s.at('Zero')); s.fade('#hd-0l', s.at('Zero') + .2)
s.stamp('#hd-st', s.at('walks'), -4)

# ---- 7 away and back
s = S('away'); hc = ERA['away'][2]
s.add(photo('aw-p', 'lemans', 120, 320, 640, 380, 17))
s.add('<div id="aw-lm" class="stamp solid" style="left:420px;top:640px;font-size:64px">Le Mans ×2</div>')
s.add('<div id="aw-indy" class="tape" style="left:140px;top:760px;font-size:54px">Indy 500</div>')
s.add('<div id="aw-dak" class="tape" style="left:420px;top:780px;font-size:54px">Dakar</div>')
s.add('<div id="aw-q" class="tape" style="left:140px;top:880px;font-size:50px">2021 · Qatar · P3 · age 40</div>')
s.add('<div id="aw-8" class="stamp solid" style="left:160px;top:980px;font-size:54px">2023 · 8 podiums</div>')
s.card_in('#aw-p', s.at('Le') - .2, -2); s.stamp('#aw-lm', s.at('twice'), -5)
s.tape('#aw-indy', s.at('Indy'), -3); s.tape('#aw-dak', s.at('Dakar'), 4)
s.tape('#aw-q', s.at('podium'), -2); s.stamp('#aw-8', s.at('eight'), -4)

# ---- 8 reveal: 1 + 4 + 3 = 8
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

# ---- 9 today
s = S('today'); hc = ERA['today'][2]
s.add(photo('td-p', 'today', 120, 310, 400, 500, 18))
s.add('<div id="td-45" class="tape" style="left:560px;top:330px;font-size:64px">age 45</div>')
s.add('<div id="td-n" class="big" style="left:560px;top:430px;font-size:150px;color:#CEDC00">0</div>')
s.add('<div id="td-nl" class="lab" style="position:absolute;left:566px;top:590px;font-size:30px">Grands Prix</div>')
s.add('<div id="td-win" class="tape" style="left:540px;top:660px;font-size:42px">last win: Spain 2013</div>')
s.add('<div id="td-26" class="tape" style="left:150px;top:870px;font-size:46px">2026: 7 points, 21 races</div>')
s.add('<div id="td-33" class="stamp solid" style="left:200px;top:960px;font-size:110px">#33?</div>')
end_t = round(last['today'] - START['today'] + .25, 2)
s.add(f'<div id="td-end" style="position:absolute;inset:0;background:#0E0F12"><div style="position:absolute;left:120px;top:640px;width:768px;font:italic 900 140px Archivo, Oswald;color:#fff;letter-spacing:-.02em">ONE <span style="color:#E10600">F1</span></div>'
      '<div class="lab" style="position:absolute;left:126px;top:820px;font-size:34px;color:#B9BDC4">Follow @F1STATLAB</div>'
      '<div class="lab" style="position:absolute;left:126px;top:880px;font-size:28px;color:#7D828C">Data: Jolpica · photos: CC, credits in caption</div></div>')
s.card_in('#td-p', 0, -3); s.tape('#td-45', s.at('forty-five'), 4)
s.fade('#td-n', s.at('Four') - .1, .2); s.count('#td-n', 0, 449, s.at('Four'), 1.3); s.fade('#td-nl', s.at('Four') + .3)
s.tape('#td-win', s.at('2013'), -3); s.tape('#td-26', s.at('seven'), 2)
s.stamp('#td-33', s.at('thirty-three'), -6)
s.fade('#td-end', end_t, .4)

for sc in scenes.values(): sc.write()

# captions, sound and root: same as v1
exec(src[src.index('# ------------------------------------------------------------------ captions'):src.index("print('total'")], globals())
print('total', TOTAL, 's |', ' '.join(f'{c} {START[c]}+{DUR[c]}' for c in CH), '|', len(groups), 'captions,', len(audio), 'sounds')
