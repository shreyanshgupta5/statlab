"""Builds the realistic app icon from the flat speed-cut monogram (icons/*-speed-cut.png):
brushed-metal "O", candy-red "1", bevelled edges, contact shadow, carbon-fibre background with studio light.

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


# ---- background: carbon-fibre twill under a soft key light from the top left
cell = 22
u, v = (np.mgrid[0:S, 0:S] // cell)
tw = ((u + v) // 2 % 2).astype(float)                                  # 2x2 twill
fine = (np.mgrid[0:S, 0:S][0 if True else 1] % cell) / cell
weave = np.where(tw > 0, 0.55 + 0.45 * np.sin(np.pi * ((np.mgrid[0:S, 0:S][1] % cell) / cell)),
                 0.55 + 0.45 * np.sin(np.pi * fine))
base = 0.045 + 0.035 * weave
light = np.exp(-(((xx - 0.3) ** 2) / 0.18 + ((yy - 0.22) ** 2) / 0.14))           # studio key light
vign = 1 - 0.55 * np.clip(((xx - 0.5) ** 2 + (yy - 0.5) ** 2) / 0.5, 0, 1)
bg_l = (base * (0.55 + 0.9 * light)) * vign
bg = np.stack([bg_l * 1.0, bg_l * 1.03, bg_l * 1.12], -1)
glow = blur(red, 120) * 0.35                                           # red bounce light behind the 1
bg[..., 0] += glow * 0.55; bg[..., 1] += glow * 0.05; bg[..., 2] += glow * 0.03

# ---- contact shadow
sh = blur(np.roll(np.roll(ink, 34, 0), 22, 1), 34) * 0.85
bg *= (1 - sh[..., None] * 0.9)

# ---- bevel: height from a blurred mask, lit from the top left
h = blur(ink, 18)
gy, gx = np.gradient(h)
lx, ly, lz = -0.55, -0.7, 0.45
nz = 0.02
shade = (-(gx * lx + gy * ly) / (np.sqrt(gx ** 2 + gy ** 2 + nz ** 2)) * 0.5)   # -0.5..0.5
edge = np.clip(1 - blur(ink, 6) * 1.0, 0, 1) * ink                    # rim zone near the outline
rim = blur(edge, 3)

# ---- materials
brushed = (np.random.default_rng(7).random((S, 1)) * 0.06).repeat(S, 1)       # horizontal brushing
metal_l = 0.93 - 0.42 * yy + brushed + 0.18 * np.exp(-((yy - 0.38) ** 2) / 0.004)  # sky band reflection
metal = np.stack([metal_l, metal_l * 1.01, metal_l * 1.05], -1)
candy_t = np.clip(1.05 - 0.75 * yy, 0, 1)
candy = np.stack([0.55 + 0.45 * candy_t, 0.02 + 0.08 * candy_t, 0.0 + 0.05 * candy_t], -1)
gloss = np.exp(-((yy - 0.36) ** 2) / 0.0025) * 0.35                    # clear-coat highlight

out = bg.copy()
for mask, mat in ((white, metal), (red, candy)):
    lit = mat * (1 + shade[..., None] * 1.6) + rim[..., None] * shade[..., None] * 0.9
    if mat is candy:
        lit = lit + gloss[..., None] * np.array([1, 0.55, 0.5])
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
