"""Clean vector ONE F1 "O1" mark and app icons, drawn from geometry (no traced pixels, no textures), so every size is crisp.

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
  <radialGradient id="bg" cx="50%" cy="30%" r="80%"><stop offset="0" stop-color="#22252C"/><stop offset=".55" stop-color="#121418"/><stop offset="1" stop-color="#07080A"/></radialGradient>
  <filter id="shadow" x="-20%" y="-20%" width="140%" height="160%"><feOffset dy="10"/><feGaussianBlur stdDeviation="9"/></filter>
</defs>'''


def icon_svg(size=1024, fill=0.66, maskable=False):
    """Square icon: mark centred, `fill` = share of the width it takes."""
    if maskable: fill *= 0.82                                 # keep inside Android's 80% safe zone
    sc = size * fill / W
    ox, oy = (size - W * sc) / 2, (size - H * sc) / 2 - size * 0.01
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 {size} {size}">{DEFS}'
            f'<rect width="{size}" height="{size}" fill="url(#bg)"/>{mark(sc, ox, oy)}</svg>')


def mark_svg():
    pad = 8
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{-pad} {-pad} {W + 2 * pad:.1f} {H + 2 * pad + 12}">{DEFS}'
            f'{mark(1, 0, 0, shadow=False)}</svg>')


if __name__ == '__main__':
    brand, icons = os.path.join(ROOT, 'brand'), os.path.join(ROOT, 'icons')
    open(os.path.join(brand, 'onef1-mark.svg'), 'w').write(mark_svg())
    open(os.path.join(brand, 'onef1-icon.svg'), 'w').write(icon_svg())
    open(os.path.join(brand, 'onef1-icon-maskable.svg'), 'w').write(icon_svg(maskable=True))
    js = f'''
    const {{ chromium }} = require('playwright');
    (async () => {{
      const b = await chromium.launch(); const p = await b.newPage({{ viewport: {{ width: 1024, height: 1024 }} }});
      for (const [src, sizes] of [['onef1-icon.svg', [[512,'icon-512.png'],[192,'icon-192.png'],[180,'apple-touch-icon.png'],[1024,'../brand/onef1-icon-1024.png']]],
                                  ['onef1-icon-maskable.svg', [[512,'maskable-512.png']]]]) {{
        for (const [s, out] of sizes) {{
          await p.setViewportSize({{ width: s, height: s }});
          await p.goto('file://{brand}/' + src); await p.evaluate((s) => {{ const v = document.querySelector('svg'); v.setAttribute('width', s); v.setAttribute('height', s); }}, s);
          await p.screenshot({{ path: '{icons}/' + out, clip: {{ x: 0, y: 0, width: s, height: s }} }});
        }}
      }}
      await b.close(); console.log('icons rendered');
    }})();'''
    subprocess.run(['node', '-e', js], check=True)
