"""Round driver avatar from a real photo: comic halftone print (like the reel), team-colour ring.
    python3 avatar.py <in.jpg> <out.png> <teamcolor> [cx cy r]   (face centre and crop radius as fractions of width)"""
import sys
import cv2, numpy as np
from PIL import Image, ImageDraw

def avatar(src, out, color, cx=.5, cy=.42, r=.46, size=256):
    im = cv2.imread(src); h, w = im.shape[:2]
    R = int(r * w); x0, y0 = int(cx * w) - R, int(cy * h) - R
    pad = cv2.copyMakeBorder(im, R, R, R, R, cv2.BORDER_REPLICATE)
    im = cv2.resize(pad[y0 + R:y0 + 3 * R, x0 + R:x0 + 3 * R], (size * 2, size * 2), interpolation=cv2.INTER_LANCZOS4)
    # print look: a touch more contrast and colour, then halftone dots in the darker tones (CMYK-style screen angle)
    im = cv2.convertScaleAbs(im, alpha=1.12, beta=-8)
    hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV).astype(np.float32); hsv[..., 1] *= 1.12
    im = cv2.cvtColor(hsv.clip(0, 255).astype(np.uint8), cv2.COLOR_HSV2BGR)
    g = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255
    n = size * 2; yy, xx = np.mgrid[0:n, 0:n].astype(np.float32); a = np.deg2rad(45)
    u, v = xx * np.cos(a) + yy * np.sin(a), -xx * np.sin(a) + yy * np.cos(a); cell = 7.0
    du, dv = (u % cell) - cell / 2, (v % cell) - cell / 2
    gb = cv2.GaussianBlur(g, (0, 0), 2)
    dot = (du * du + dv * dv) < ((1 - gb) * cell * .55) ** 2
    im = im.astype(np.float32); im[dot] *= .62; im = im.clip(0, 255).astype(np.uint8)
    paper = np.full_like(im, (210, 228, 241)); im = cv2.addWeighted(im, .9, paper, .1, 0)
    rgb = Image.fromarray(cv2.cvtColor(im, cv2.COLOR_BGR2RGB)).resize((size, size), Image.LANCZOS)
    S = size * 4; m = Image.new('L', (S, S), 0); ImageDraw.Draw(m).ellipse([0, 0, S - 1, S - 1], fill=255); m = m.resize((size, size), Image.LANCZOS)
    inner = Image.new('L', (S, S), 0); ImageDraw.Draw(inner).ellipse([int(S * .07)] * 2 + [S - 1 - int(S * .07)] * 2, fill=255); inner = inner.resize((size, size), Image.LANCZOS)
    out_im = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    out_im.paste(Image.new('RGB', (size, size), color), (0, 0), m)
    ph = rgb.resize((size, size)); out_im.paste(ph, (0, 0), inner)
    out_im.save(out)

if __name__ == '__main__':
    a = sys.argv[1:]; avatar(a[0], a[1], a[2], *(float(x) for x in a[3:6]))
