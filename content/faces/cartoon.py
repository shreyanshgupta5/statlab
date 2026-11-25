"""Turn a driver photo into a round cartoon avatar in one of three styles.
    python3 cartoon.py <in.jpg> <out_prefix> [teamcolor] [cx cy r]   (face centre and radius as fractions of width)"""
import sys
import cv2, numpy as np
from PIL import Image, ImageDraw

def load_crop(path, cx=.5, cy=.4, r=.42, size=512):
    im = cv2.imread(path); h, w = im.shape[:2]
    R = int(r * w); x0, y0 = int(cx * w) - R, int(cy * h) - R
    pad = cv2.copyMakeBorder(im, R, R, R, R, cv2.BORDER_REPLICATE)
    crop = pad[y0 + R:y0 + 3 * R, x0 + R:x0 + 3 * R]
    return cv2.resize(crop, (size, size), interpolation=cv2.INTER_LANCZOS4)

def cel(img, levels=6):
    """Cel-shaded cartoon: smooth colour regions, quantised tones, bold ink edges."""
    sm = img.copy()
    for _ in range(5): sm = cv2.bilateralFilter(sm, 9, 60, 9)
    Z = sm.reshape(-1, 3).astype(np.float32)
    _, lab, cen = cv2.kmeans(Z, 14, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 20, 1), 3, cv2.KMEANS_PP_CENTERS)
    q = cen[lab.flatten()].reshape(img.shape).astype(np.uint8)
    hsv = cv2.cvtColor(q, cv2.COLOR_BGR2HSV); hsv[..., 1] = np.clip(hsv[..., 1] * 1.25, 0, 255); q = cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)
    g = cv2.medianBlur(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY), 7)
    edges = cv2.adaptiveThreshold(g, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY, 11, 6)
    edges = cv2.erode(edges, np.ones((2, 2), np.uint8))
    return cv2.bitwise_and(q, q, mask=edges)

def comic(img):
    """Two-tone comic: ink shadows and highlights over a halftone dot screen in the team colour feel."""
    g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255
    g = cv2.GaussianBlur(g, (0, 0), 1.2)
    h, w = g.shape; out = np.full((h, w, 3), 245, np.uint8)
    cell = 9
    yy, xx = np.mgrid[0:h, 0:w]
    cxg, cyg = (xx // cell) * cell + cell / 2, (yy // cell) * cell + cell / 2
    gs = cv2.resize(cv2.resize(g, (w // cell, h // cell), interpolation=cv2.INTER_AREA), (w, h), interpolation=cv2.INTER_NEAREST)
    rad = (1 - gs) * cell * 0.72
    dot = ((xx - cxg) ** 2 + (yy - cyg) ** 2) < rad ** 2
    col = cel(img, 5)
    out = col.copy(); out[dot & (gs < .55)] = (out[dot & (gs < .55)] * .55).astype(np.uint8)
    return out

def poster(img):
    """Flat poster: 4 tones of the photo's own colours, thick ink outline, no texture."""
    sm = img.copy()
    for _ in range(7): sm = cv2.bilateralFilter(sm, 9, 80, 9)
    Z = sm.reshape(-1, 3).astype(np.float32)
    _, lab, cen = cv2.kmeans(Z, 7, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 20, 1), 3, cv2.KMEANS_PP_CENTERS)
    q = cen[lab.flatten()].reshape(img.shape).astype(np.uint8)
    e = cv2.Canny(cv2.GaussianBlur(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY), (5, 5), 0), 60, 140)
    e = cv2.dilate(e, np.ones((3, 3), np.uint8))
    q[e > 0] = (20, 20, 24)
    return q

def person_mask(img):
    """GrabCut cut-out of the person: centre-bottom is foreground, the border is background."""
    h, w = img.shape[:2]
    mask = np.full((h, w), cv2.GC_PR_BGD, np.uint8)
    cv2.ellipse(mask, (w // 2, int(h * .55)), (int(w * .30), int(h * .45)), 0, 0, 360, cv2.GC_PR_FGD, -1)
    cv2.ellipse(mask, (w // 2, int(h * .48)), (int(w * .16), int(h * .22)), 0, 0, 360, cv2.GC_FGD, -1)
    mask[:, :int(w * .04)] = cv2.GC_BGD; mask[:, -int(w * .04):] = cv2.GC_BGD; mask[:int(h * .03)] = cv2.GC_BGD
    bgd, fgd = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
    cv2.grabCut(img, mask, None, bgd, fgd, 6, cv2.GC_INIT_WITH_MASK)
    m = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(m)
    if n > 1: m = np.where(lab == 1 + np.argmax(st[1:, cv2.CC_STAT_AREA]), 255, 0).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((15, 15), np.uint8))
    return cv2.GaussianBlur(m, (0, 0), 2.0)

def clean(img, k=9):
    """Clean cartoon: smooth regions, k flat tones, thin dark outlines only on strong edges."""
    sm = img.copy()
    for _ in range(6): sm = cv2.bilateralFilter(sm, 9, 50, 7)
    lab_img = cv2.cvtColor(sm, cv2.COLOR_BGR2LAB)
    Z = lab_img.reshape(-1, 3).astype(np.float32)
    _, lab, cen = cv2.kmeans(Z, k, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 30, .5), 4, cv2.KMEANS_PP_CENTERS)
    q = cv2.cvtColor(cen[lab.flatten()].reshape(img.shape).astype(np.uint8), cv2.COLOR_LAB2BGR)
    q = cv2.medianBlur(q, 5)
    e = cv2.Canny(cv2.GaussianBlur(cv2.cvtColor(sm, cv2.COLOR_BGR2GRAY), (0, 0), 1.6), 40, 110)
    e = cv2.dilate(e, np.ones((2, 2), np.uint8))
    q[e > 0] = (q[e > 0] * .25).astype(np.uint8)
    hsv = cv2.cvtColor(q, cv2.COLOR_BGR2HSV).astype(np.float32); hsv[..., 1] *= 1.15; hsv[..., 2] = np.clip(hsv[..., 2] * 1.06, 0, 255)
    return cv2.cvtColor(hsv.clip(0, 255).astype(np.uint8), cv2.COLOR_HSV2BGR)

def halftone(img):
    """The clean cartoon with comic dots in the shadows."""
    q = clean(img, 8); g = cv2.cvtColor(q, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255
    h, w = g.shape; cell = 8; yy, xx = np.mgrid[0:h, 0:w]
    gs = cv2.resize(cv2.resize(g, (w // cell, h // cell), interpolation=cv2.INTER_AREA), (w, h), interpolation=cv2.INTER_NEAREST)
    dot = ((xx % cell - cell / 2) ** 2 + (yy % cell - cell / 2) ** 2) < ((1 - gs) * cell * .62) ** 2
    q[dot & (gs < .5)] = (q[dot & (gs < .5)] * .45).astype(np.uint8)
    return q

def roundel(img, color, path, size=256, mask=None):
    rgb = Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB)).resize((size, size), Image.LANCZOS)
    if mask is not None:
        pm = Image.fromarray(mask).resize((size, size), Image.LANCZOS)
        card = Image.new('RGB', (size, size), color)
        # a soft ink rim around the cut-out
        rim = Image.fromarray(cv2.dilate(np.array(pm), np.ones((7, 7), np.uint8))).point(lambda v: 255 if v > 90 else 0)
        card.paste((14, 15, 18), (0, 0), rim); card.paste(rgb, (0, 0), pm); rgb = card
    m = Image.new('L', (size * 4, size * 4), 0); ImageDraw.Draw(m).ellipse([0, 0, size * 4 - 1, size * 4 - 1], fill=255)
    m = m.resize((size, size), Image.LANCZOS)
    bg = Image.new('RGB', (size, size), color); bg.paste(rgb, (0, 0), m)
    out = Image.new('RGBA', (size, size)); out.paste(bg, (0, 0), m); out.save(path)

if __name__ == '__main__':
    src, pre = sys.argv[1], sys.argv[2]; color = sys.argv[3] if len(sys.argv) > 3 else '#3B6FD8'
    cx, cy, r = (float(v) for v in sys.argv[4:7]) if len(sys.argv) > 6 else (.5, .4, .42)
    im = load_crop(src, cx, cy, r)
    pm = person_mask(im)
    for name, f in (('clean', clean), ('halftone', halftone)):
        roundel(f(im), color, f'{pre}-{name}.png', mask=pm)
    print('ok')
