"""Builds the realistic app icon from the flat speed-cut monogram (icons/*-speed-cut.png):
a metal "O" with a horizon reflection, a metallic candy "1", bright chamfers, contact shadow, glossy-floor reflection,
fine carbon twill under one spotlight. Colours come from a theme.

    python3 tools/make_icon.py                 # writes the app icons with the default theme
    python3 tools/make_icon.py --theme NAME    # writes the app icons with another theme
    python3 tools/make_icon.py --options OUT   # renders every theme side by side into OUT (a PNG)
"""
import os, sys
import numpy as np
from PIL import Image, ImageFilter, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# bg: background tint and brightness; o: metal tint for the O; one: candy colour (top, bottom) for the 1; glow: under-light
THEMES = {
    'carbon-red':   dict(label='Carbon · chrome · red',    bg=(1.0, 1.02, 1.08), lum=1.0,  o=(0.97, 0.99, 1.04), one=((0.95, 0.06, 0.05), (0.42, 0.0, 0.01))),
    'gunmetal':     dict(label='Gunmetal · chrome · red',  bg=(1.0, 1.04, 1.12), lum=2.6,  o=(0.97, 0.99, 1.04), one=((0.95, 0.06, 0.05), (0.42, 0.0, 0.01))),
    'midnight':     dict(label='Midnight blue · chrome · red', bg=(0.55, 0.75, 1.9), lum=1.9, o=(0.95, 0.99, 1.06), one=((0.98, 0.1, 0.08), (0.45, 0.0, 0.02))),
    'black-gold':   dict(label='Black · gold · red',       bg=(1.0, 0.98, 0.92), lum=1.0,  o=(1.05, 0.83, 0.45), one=((0.95, 0.06, 0.05), (0.42, 0.0, 0.01))),
    'racing-red':   dict(label='Racing red · chrome · black', bg=(2.6, 0.25, 0.22), lum=1.6, o=(0.97, 0.99, 1.04), one=((0.32, 0.33, 0.36), (0.05, 0.05, 0.06))),
    'green-gold':   dict(label='Racing green · chrome · gold', bg=(0.35, 1.35, 0.75), lum=1.6, o=(0.97, 0.99, 1.04), one=((1.0, 0.8, 0.35), (0.5, 0.33, 0.06))),
    'titanium':     dict(label='Titanium · black chrome · red', bg=(1.0, 1.01, 1.04), lum=9.0, o=(0.42, 0.44, 0.48), one=((0.95, 0.06, 0.05), (0.42, 0.0, 0.01))),
    'stealth':      dict(label='Stealth · black chrome · red 1', bg=(1.0, 1.0, 1.02), lum=0.8, o=(0.36, 0.37, 0.4), one=((1.0, 0.1, 0.06), (0.5, 0.0, 0.02))),
}


def render(theme, S=2048):
    th = THEMES[theme]
    src = np.array(Image.open(os.path.join(ROOT, 'icons/icon-512-speed-cut.png')).convert('RGB').resize((S, S), Image.LANCZOS)).astype(float)
    r, g, b = src[..., 0], src[..., 1], src[..., 2]
    k = S / 2048                                                  # scale blur radii with the canvas

    def blur(a, rad):
        return np.array(Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(max(1, rad * k)))).astype(float) / 255

    def clean(m):
        a = blur(m, 6)
        return np.clip((a - 0.5) * 6 + 0.5, 0, 1)

    white = clean(((r > 150) & (g > 150) & (b > 150)).astype(float))
    red = clean(((r > 150) & (g < 110)).astype(float))
    ink = np.clip(white + red, 0, 1)
    yy, xx = np.mgrid[0:S, 0:S] / S

    # background: fine carbon twill under one overhead spotlight, tinted by the theme
    cell = max(6, int(12 * k)); I, J = np.mgrid[0:S, 0:S]
    tw = (((I // cell) + (J // cell)) // 2 % 2).astype(float)
    weave = np.where(tw > 0, np.sin(np.pi * (J % cell) / cell), np.sin(np.pi * (I % cell) / cell))
    base = (0.028 + 0.016 * weave) * th['lum']
    spot = np.exp(-(((xx - 0.5) ** 2) / 0.22 + ((yy - 0.18) ** 2) / 0.10))
    vign = 1 - 0.75 * np.clip(((xx - 0.5) ** 2 + (yy - 0.52) ** 2) / 0.42, 0, 1)
    bg_l = base * (0.6 + 1.5 * spot) * vign
    bg = np.stack([bg_l * th['bg'][0], bg_l * th['bg'][1], bg_l * th['bg'][2]], -1)
    top1 = np.array(th['one'][0])
    bg += blur(red, 140)[..., None] * 0.13 * top1                 # the 1 throws a little coloured light

    # glossy floor reflection
    ys = np.where(ink.max(1) > 0.5)[0]; y0, y1 = ys.min(), ys.max(); span = y1 - y0
    n = min(span, S - y1 - 1)
    refl = np.zeros_like(ink); fade = np.zeros_like(ink); redr = np.zeros_like(red)
    rows = np.arange(n)
    refl[y1 + rows] = ink[y1 - rows]; redr[y1 + rows] = red[y1 - rows]
    fade[y1 + rows] = np.clip(1 - rows / (span * 0.75), 0, 1)[:, None]
    rc = blur(refl * fade * 0.16, 4); rr = blur(redr, 4)
    ocol = np.array(th['o']) * 0.9
    bg += rc[..., None] * (ocol * (1 - rr[..., None]) + top1 * rr[..., None])

    # contact shadow
    sh = blur(np.roll(np.roll(ink, int(26 * k), 0), int(10 * k), 1), 30) * 0.9
    bg *= (1 - sh[..., None] * 0.92)

    # bevel lighting
    h = blur(ink, 14); gy, gx = np.gradient(h)
    shade = -(gx * -0.45 + gy * -0.85) / np.sqrt(gx ** 2 + gy ** 2 + 0.0004 * k * k) * 0.5
    rim = blur(np.clip(1 - blur(ink, 5), 0, 1) * ink, 2)
    spec = np.clip(shade, 0, None) ** 3 * rim

    # materials over the mark's own height
    t = np.clip((yy * S - y0) / max(1, span), 0, 1)
    brushed = (np.random.default_rng(3).random((S, 1)) * 0.035).repeat(S, 1)
    metal_l = 1.0 - 0.38 * t ** 1.4 - 0.42 * np.exp(-((t - 0.56) ** 2) / 0.0035) + 0.22 * np.clip((t - 0.62) / 0.38, 0, 1) + brushed
    metal = np.stack([metal_l * th['o'][0], metal_l * th['o'][1], metal_l * th['o'][2]], -1)
    flake = np.random.default_rng(11).random((S, S)) * 0.05
    ct = np.clip(1 - t, 0, 1)[..., None]
    candy = np.array(th['one'][1]) + (np.array(th['one'][0]) - np.array(th['one'][1])) * ct + flake[..., None] * np.array([1, 0.6, 0.5])
    gloss = np.exp(-((t - 0.22) ** 2) / 0.004) * 0.42

    out = bg.copy()
    for mask, mat, isone in ((white, metal, False), (red, candy, True)):
        lit = mat * (1 + shade[..., None] * 1.2) + spec[..., None] * 1.4
        if isone:
            lit = lit + gloss[..., None] * (0.55 + 0.45 * np.array(th['one'][0]))
        out = out * (1 - mask[..., None]) + np.clip(lit, 0, 1) * mask[..., None]
    return Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8)), Image.fromarray((np.clip(bg, 0, 1) * 255).astype(np.uint8)), \
        Image.fromarray((blur(np.clip(ink + sh * 0.9, 0, 1), 1) * 255).astype(np.uint8))


def write_icons(theme):
    img, bg, alpha = render(theme)
    icons = os.path.join(ROOT, 'icons'); S = img.width
    img.resize((512, 512), Image.LANCZOS).save(os.path.join(icons, 'icon-512.png'), optimize=True)
    img.resize((192, 192), Image.LANCZOS).save(os.path.join(icons, 'icon-192.png'), optimize=True)
    img.resize((180, 180), Image.LANCZOS).save(os.path.join(icons, 'apple-touch-icon.png'), optimize=True)
    mark = img.resize((int(S * 0.78), int(S * 0.78)), Image.LANCZOS)   # maskable: mark inside the 80% safe zone
    bg.paste(mark, ((S - mark.width) // 2, (S - mark.height) // 2), alpha.resize(mark.size, Image.LANCZOS))
    bg.resize((512, 512), Image.LANCZOS).save(os.path.join(icons, 'maskable-512.png'), optimize=True)
    print('icons written:', theme)


def options(out):
    names = list(THEMES); tile, pad, lab = 300, 24, 46
    cols = 4; rows = (len(names) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * (tile + pad) + pad, rows * (tile + pad + lab) + pad), (236, 236, 238))
    d = ImageDraw.Draw(sheet)
    try: font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 15)
    except Exception: font = ImageFont.load_default()
    for i, nme in enumerate(names):
        img = render(nme, S=1024)[0].resize((tile, tile), Image.LANCZOS)
        m = Image.new('L', (tile, tile), 0); ImageDraw.Draw(m).rounded_rectangle([0, 0, tile - 1, tile - 1], 66, fill=255)
        x, y = pad + (i % cols) * (tile + pad), pad + (i // cols) * (tile + pad + lab)
        sheet.paste(img, (x, y), m)
        d.text((x + 4, y + tile + 12), f'{i + 1}. {THEMES[nme]["label"]}', fill=(30, 30, 34), font=font)
    sheet.save(out); print('options sheet:', out)


if __name__ == '__main__':
    a = sys.argv[1:]
    if '--options' in a: options(a[a.index('--options') + 1])
    else: write_icons(a[a.index('--theme') + 1] if '--theme' in a else 'carbon-red')
