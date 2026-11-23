"""Builds the realistic app icon from the flat speed-cut monogram (icons/*-speed-cut.png):
mirror-chrome "O" with a horizon reflection, metallic candy-red "1", bright chamfers, contact shadow, glossy-floor
reflection, fine carbon twill on satin black under one spotlight.

    python3 tools/make_icon.py        # writes icons/icon-512.png, icon-192.png, maskable-512.png, apple-touch-icon.png
"""
import os
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S = 2048                                    # work large, downsample at the end for clean edges
src = np.array(Image.open(os.path.join(ROOT, 'icons/icon-512-speed-cut.png')).convert('RGB').resize((S, S), Image.LANCZOS)).astype(float)
r, g, b = src[..., 0], src[..., 1], src[..., 2]


def clean(m):                               # smooth the upscaled mask, then re-threshold with a soft edge
    im = Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(6))
    a = np.array(im).astype(float) / 255
    return np.clip((a - 0.5) * 6 + 0.5, 0, 1)


white = clean(((r > 150) & (g > 150) & (b > 150)).astype(float))
red = clean(((r > 150) & (g < 110)).astype(float))
ink = np.clip(white + red, 0, 1)
yy, xx = np.mgrid[0:S, 0:S] / S


def blur(a, rad):
    return np.array(Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(rad))).astype(float) / 255


# ---- background: satin black, fine carbon twill, one overhead spotlight
cell = 12
I, J = np.mgrid[0:S, 0:S]
tw = (((I // cell) + (J // cell)) // 2 % 2).astype(float)
weave = np.where(tw > 0, np.sin(np.pi * (J % cell) / cell), np.sin(np.pi * (I % cell) / cell))
base = 0.028 + 0.016 * weave
spot = np.exp(-(((xx - 0.5) ** 2) / 0.22 + ((yy - 0.18) ** 2) / 0.10))
vign = 1 - 0.75 * np.clip(((xx - 0.5) ** 2 + (yy - 0.52) ** 2) / 0.42, 0, 1)
bg_l = base * (0.6 + 1.5 * spot) * vign
bg = np.stack([bg_l, bg_l * 1.02, bg_l * 1.08], -1)
glow = blur(red, 140) * 0.22
bg[..., 0] += glow * 0.6; bg[..., 1] += glow * 0.04

# ---- glossy floor: faint mirrored reflection under the mark
ys = np.where(ink.max(1) > 0.5)[0]; y0, y1 = ys.min(), ys.max()
refl = np.zeros_like(ink); fade = np.zeros_like(ink)
span = y1 - y0
for k in range(min(span, S - y1 - 1)):
    refl[y1 + k] = ink[y1 - k]; fade[y1 + k] = (1 - k / (span * 0.75)) if k < span * 0.75 else 0
refl_col = blur(refl * fade * 0.16, 4)
redr = np.zeros_like(red)
for k in range(min(span, S - y1 - 1)): redr[y1 + k] = red[y1 - k]
bg += refl_col[..., None] * np.stack([0.85 + 0.15 * (1 - blur(redr, 4)), 0.85 - 0.7 * blur(redr, 4), 0.9 - 0.75 * blur(redr, 4)], -1)

# ---- contact shadow
sh = blur(np.roll(np.roll(ink, 26, 0), 10, 1), 30) * 0.9
bg *= (1 - sh[..., None] * 0.92)

# ---- bevel lighting
h = blur(ink, 14)
gy, gx = np.gradient(h)
lx, ly = -0.45, -0.85
shade = -(gx * lx + gy * ly) / np.sqrt(gx ** 2 + gy ** 2 + 0.0004) * 0.5
rim = blur(np.clip(1 - blur(ink, 5), 0, 1) * ink, 2)
spec = np.clip(shade, 0, None) ** 3 * rim                                # bright chamfer on the lit edges

# ---- materials, mapped over the mark's own height
t = np.clip((yy * S - y0) / max(1, span), 0, 1)
brushed = (np.random.default_rng(3).random((S, 1)) * 0.035).repeat(S, 1)
sky = 1.0 - 0.38 * t ** 1.4                                                 # bright sky fading down
horizon = 0.42 * np.exp(-((t - 0.56) ** 2) / 0.0035)                       # soft dark horizon band
chrome_l = sky - horizon + 0.22 * np.clip((t - 0.62) / 0.38, 0, 1) + brushed  # ground bounce at the bottom
chrome = np.stack([chrome_l * 0.97, chrome_l * 0.99, chrome_l * 1.04], -1)
flake = np.random.default_rng(11).random((S, S)) * 0.06
candy_t = np.clip(1 - t, 0, 1)
candy = np.stack([0.42 + 0.5 * candy_t + flake, 0.0 + 0.05 * candy_t + flake * 0.2, 0.01 + 0.04 * candy_t + flake * 0.15], -1)
gloss = np.exp(-((t - 0.22) ** 2) / 0.004) * 0.45

out = bg.copy()
for mask, mat, isred in ((white, chrome, False), (red, candy, True)):
    lit = mat * (1 + shade[..., None] * 1.2) + spec[..., None] * 1.4
    if isred:
        lit = lit + gloss[..., None] * np.array([1, 0.6, 0.55])
    out = out * (1 - mask[..., None]) + np.clip(lit, 0, 1) * mask[..., None]

img = Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8))
icons = os.path.join(ROOT, 'icons')
img.resize((512, 512), Image.LANCZOS).save(os.path.join(icons, 'icon-512.png'), optimize=True)
img.resize((192, 192), Image.LANCZOS).save(os.path.join(icons, 'icon-192.png'), optimize=True)
img.resize((180, 180), Image.LANCZOS).save(os.path.join(icons, 'apple-touch-icon.png'), optimize=True)
# maskable: same art with the monogram inside the 80% safe zone (Android crops to circles / squircles)
full = Image.fromarray((np.clip(bg, 0, 1) * 255).astype(np.uint8))
mark = img.resize((int(S * 0.78), int(S * 0.78)), Image.LANCZOS)
m_alpha = Image.fromarray((blur(np.clip(ink + sh * 0.9, 0, 1), 1) * 255).astype(np.uint8)).resize(mark.size, Image.LANCZOS)
full.paste(mark, ((S - mark.width) // 2, (S - mark.height) // 2), m_alpha)
full.resize((512, 512), Image.LANCZOS).save(os.path.join(icons, 'maskable-512.png'), optimize=True)
print('icons written')
