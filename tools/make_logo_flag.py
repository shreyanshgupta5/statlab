"""Background options for the flag version of the clean vector ONE F1 "O1" mark and app icons, drawn from geometry (no traced pixels, no textures), so every size is crisp.

    python3 tools/make_logo.py            # writes brand/onef1-mark.svg, brand/onef1-icon.svg and the app icons (via Playwright)

The mark: an italic open "O" (rounded left corners, top bar cut on the same diagonal as the 1's flag) and a "1"
(stem with a sharp flag), both on one 37-degree slant, with an even gap between them.
"""
import os, subprocess, textwrap

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
H = 166                     # cap height of the mark (unslanted units)
SLANT = 0.754               # tan(37 deg)
GAP = 14

# unslanted geometry
O = (f"M34 0 L244 0 L195 42 L60 42 Q48 42 48 54 L48 112 Q48 124 60 124 L188 124 L188 {H} L34 {H} "
     f"Q0 {H} 0 {H - 34} L0 34 Q0 0 34 0 Z")
ONE = f"M258 0 L258 {H} L202 {H} L202 92 L150 92 Z"
W = 258 + SLANT * H          # slanted width


def mark(scale, ox, oy, shadow=True):
    """Mark group placed with its top-left at (ox, oy) and the given scale."""
    sk = f"translate({ox} {oy}) scale({scale}) translate(0 {H}) skewX(-37) translate(0 -{H})"
    return textwrap.dedent(f'''
    <g>
      {f'<g transform="{sk}" filter="url(#shadow)" opacity=".75"><path d="{O}" fill="#000"/><path d="{ONE}" fill="#000"/></g>' if shadow else ''}
      <g transform="{sk}">
        <path d="{O}" fill="url(#silver)"/>
        <path d="{ONE}" fill="url(#red)"/>
        <path d="{O}" fill="none" stroke="url(#edge)" stroke-width="3" clip-path="url(#clipO)"/>
        <path d="{ONE}" fill="none" stroke="url(#edgeR)" stroke-width="3" clip-path="url(#clip1)"/>
      </g>
    </g>''')


DEFS = f'''
<defs>
  <linearGradient id="silver" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#FFFFFF"/><stop offset=".48" stop-color="#E4E7EC"/><stop offset=".52" stop-color="#C9CED6"/><stop offset="1" stop-color="#9DA3AC"/></linearGradient>
  <linearGradient id="red" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#FF4A3D"/><stop offset=".5" stop-color="#F01E12"/><stop offset="1" stop-color="#B80A02"/></linearGradient>
  <linearGradient id="edge" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="1"/><stop offset=".25" stop-color="#fff" stop-opacity="0"/></linearGradient>
  <linearGradient id="edgeR" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFB3AC" stop-opacity=".9"/><stop offset=".3" stop-color="#FFB3AC" stop-opacity="0"/></linearGradient>
  <clipPath id="clipO"><path d="{O}"/></clipPath><clipPath id="clip1"><path d="{ONE}"/></clipPath>
__BG__
  <filter id="shadow" x="-20%" y="-20%" width="140%" height="160%"><feOffset dy="10"/><feGaussianBlur stdDeviation="9"/></filter>
</defs>'''


def _rad(c0, c1, c2, cx="50%", cy="30%"):
    return f'<radialGradient id="bg" cx="{cx}" cy="{cy}" r="80%"><stop offset="0" stop-color="{c0}"/><stop offset=".55" stop-color="{c1}"/><stop offset="1" stop-color="{c2}"/></radialGradient>'
def _lin(c0, c1, c2):
    return f'<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{c0}"/><stop offset=".55" stop-color="{c1}"/><stop offset="1" stop-color="{c2}"/></linearGradient>'
BGS = {
    # colour in the top-left fading to black (same diagonal as the live icon)
    'red':      ('Red to black (live)',     _lin('#7A110C', '#22090A', '#08080A')),
    'crimson':  ('Crimson to black',        _lin('#9E1030', '#2A0610', '#08080A')),
    'orange':   ('Burnt orange to black',   _lin('#8A3A0C', '#2A1206', '#08080A')),
    'gold':     ('Gold to black',           _lin('#7A5A14', '#241A08', '#08080A')),
    'green':    ('Racing green to black',   _lin('#11553A', '#06200F', '#08080A')),
    'teal':     ('Teal to black',           _lin('#0D5560', '#052026', '#08080A')),
    'blue':     ('Blue to black',           _lin('#1A3C8A', '#0A1430', '#08080A')),
    'purple':   ('Purple to black',         _lin('#4A1E7A', '#1A0B2C', '#08080A')),
    # black variants
    'charcoal': ('Charcoal to black',       _lin('#3A3D44', '#16181C', '#050506')),
    'graphite': ('Graphite to onyx',        _lin('#2A2D33', '#121418', '#000000')),
    'warm':     ('Warm black',              _lin('#2E2622', '#141010', '#050404')),
    'cool':     ('Cool black (blue-black)', _lin('#1C2230', '#0C0F16', '#030405')),
    'gunmetal': ('Gunmetal to black',       _lin('#4C525C', '#1E2126', '#060607')),
    'onyx':     ('Onyx, red glow corner',   _lin('#3A0A08', '#0B0B0D', '#000000')),
    'jet':      ('Jet black, soft sheen',   _lin('#1A1B1F', '#0A0A0C', '#000000')),
    'redblack': ('Red to black to red',     _lin('#6A0F0B', '#09090B', '#4A0A07')),
}

def icon_svg(size=1024, fill=0.80, maskable=False, bg="graphite"):
    """Square icon: mark centred, `fill` = share of the width it takes."""
    if maskable: fill *= 0.82                                 # keep inside Android's 80% safe zone
    sc = size * fill / W
    ox, oy = (size - W * sc) / 2, (size - H * sc) / 2 - size * 0.01
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 {size} {size}">{DEFS.replace("__BG__", BGS[bg][1])}'
            f'<rect width="{size}" height="{size}" fill="url(#bg)"/>{mark(sc, ox, oy)}</svg>')


def mark_svg():
    pad = 8
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{-pad} {-pad} {W + 2 * pad:.1f} {H + 2 * pad + 12}">{DEFS}'
            f'{mark(1, 0, 0, shadow=False)}</svg>')


if __name__ == '__main__':
    import sys, json
    out = sys.argv[1]; os.makedirs(out, exist_ok=True)
    for k in BGS: open(os.path.join(out, f'{k}.svg'), 'w').write(icon_svg(bg=k))
    json.dump({k: v[0] for k, v in BGS.items()}, open(os.path.join(out, 'labels.json'), 'w'))
    js = """const { chromium } = require('playwright'); const fs=require('fs'); const out=process.argv[1];
    (async()=>{ const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1024,height:1024}});
      for (const f of fs.readdirSync(out).filter(x=>x.endsWith('.svg'))) { await p.goto('file://'+out+'/'+f); await p.screenshot({path: out+'/'+f.replace('.svg','.png')}); }
      await b.close(); })();"""
    subprocess.run(['node', '-e', js, out], check=True)
