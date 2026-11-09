"""Synthesises every sound effect from scratch (no samples, so no licensing questions) and lays them
on a stereo track that matches the video's timeline. Output: sfx.wav (48 kHz stereo float)."""
import sys, numpy as np, wave
sys.path.insert(0, sys.argv[1]); from cues import *
SR = 48000
rng = np.random.default_rng(7)
N = int(DURATION * SR) + SR
L = np.zeros(N); R = np.zeros(N)

def env(n, a, d, curve=4.0):
    """attack a, exponential decay d (seconds)"""
    t = np.arange(n) / SR
    e = np.minimum(1, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a) * curve / max(d, 1e-4))
    return e

def lp(x, cut):                         # one-pole low-pass, cut can be an array
    y = np.zeros_like(x); k = 1 - np.exp(-2 * np.pi * np.atleast_1d(cut) / SR); k = np.broadcast_to(k, x.shape); s = 0.0
    for i in range(len(x)):
        s += k[i] * (x[i] - s); y[i] = s
    return y

def hp(x, cut): return x - lp(x, cut)

def place(sig, t, gain=1.0, pan=0.0):
    """pan -1 left .. +1 right, equal power; sig can be mono or (pan_from, pan_to) sweep via array"""
    i = int(t * SR); j = min(N, i + len(sig)); s = sig[: j - i] * gain
    p = np.broadcast_to(np.atleast_1d(pan), (len(sig),))[: j - i]
    L[i:j] += s * np.cos((p + 1) * np.pi / 4); R[i:j] += s * np.sin((p + 1) * np.pi / 4)

def tone(f, dur, a=0.002, d=0.12, curve=5, harm=(1, .35, .12)):
    n = int(dur * SR); t = np.arange(n) / SR
    f = np.broadcast_to(np.atleast_1d(f), (n,)); ph = 2 * np.pi * np.cumsum(f) / SR
    return sum(h * np.sin(ph * (k + 1)) for k, h in enumerate(harm)) * env(n, a, d, curve)

def whoosh(dur=0.55):                   # rising-then-falling filtered noise, swept left -> right
    n = int(dur * SR); t = np.linspace(0, 1, n)
    shape = np.sin(np.pi * t) ** 2
    cut = 300 + 5200 * np.sin(np.pi * np.clip(t * 1.1, 0, 1)) ** 2
    x = hp(lp(rng.standard_normal(n), cut), 120) * shape
    return x / np.abs(x).max(), np.linspace(-0.7, 0.7, n)

def impact():                           # sub drop + click + short noise tail
    n = int(0.9 * SR); t = np.arange(n) / SR
    sub = np.sin(2 * np.pi * np.cumsum(38 + 60 * np.exp(-t * 18)) / SR) * np.exp(-t * 5)
    click = lp(rng.standard_normal(n), 4000) * np.exp(-t * 60)
    tail = lp(rng.standard_normal(n), 1800) * np.exp(-t * 9) * 0.25
    x = sub + 0.5 * click + tail
    return x / np.abs(x).max()

def riser(dur):                         # noise + rising tone into the first cut
    n = int(dur * SR); t = np.linspace(0, 1, n)
    noise = hp(lp(rng.standard_normal(n), 400 + 7000 * t ** 2), 200) * t ** 2.2
    sweep = tone(180 + 520 * t ** 2, dur, a=dur * .9, d=1, curve=1, harm=(1, .2)) * t ** 2
    x = noise / np.abs(noise).max() * 0.7 + sweep * 0.5
    return x / np.abs(x).max()

def pop(f):                             # UI pop for an event row: pitch drop blip + soft body
    n = int(0.16 * SR); t = np.arange(n) / SR
    return tone(f * (1 + 0.6 * np.exp(-t * 60)), 0.16, d=0.08, curve=6, harm=(1, .25)) * 0.9 \
        + lp(rng.standard_normal(n), 3000) * np.exp(-t * 120) * 0.15

def thock(f):                           # stat card: weighty mallet note
    n = int(0.5 * SR); t = np.arange(n) / SR
    body = tone(f, 0.5, d=0.35, curve=7, harm=(1, .5, .2, .08))
    thump = np.sin(2 * np.pi * np.cumsum(70 + 90 * np.exp(-t * 30)) / SR) * np.exp(-t * 14)
    return 0.7 * body + 0.6 * thump

def tick(f):                            # counter tick
    n = int(0.05 * SR); t = np.arange(n) / SR
    return tone(f, 0.05, d=0.02, curve=8, harm=(1,)) * 0.8 + hp(rng.standard_normal(n), 3000) * np.exp(-t * 300) * 0.3

def shimmer(dur=1.2):                   # soft sparkle for intro graphics
    n = int(dur * SR); out = np.zeros(n)
    for k, f in enumerate([1318.5, 1567.98, 1975.53, 2637.0]):
        i = int(k * 0.07 * SR); s = tone(f, dur - k * .07, a=.005, d=.6, curve=5, harm=(1, .1)); out[i:i + len(s)] += s[: n - i]
    return out / np.abs(out).max()

# pentatonic, in the key the pops and cards share (A minor pentatonic) so the whole thing feels musical
ROW_NOTES = [880.0, 987.77, 1174.66, 1318.51, 1567.98]
CARD_NOTES = [440.0, 523.25, 659.25]

w, wpan = whoosh()
cuts = CUTS
for c, r in zip(cuts, REVEALS):
    place(w, c - 0.26, 0.55, wpan)                 # whoosh peaks as the wipe covers the screen
    place(impact(), r, 0.9)                        # hit as the new chapter is revealed
place(riser(2.9), cuts[0] - 2.9, 0.5)
for t in INTRO_ELEMENTS: place(shimmer(), t, 0.35, 0.2)
# rows: note climbs within each chapter
for ch_start, ch_end in CHAPTERS:
    rows = [t for t in ROWS if ch_start < t < ch_end]
    for k, t in enumerate(rows): place(pop(ROW_NOTES[k % 5]), t, 1.6, -0.25 + 0.12 * k)
for i, t in enumerate(CARDS): place(thock(CARD_NOTES[i % 3]), t, 0.6, (-0.4, 0, 0.4)[i % 3])
for t in COUNTER_IN: place(thock(523.25), t, 0.5)
for i, t in enumerate(COUNTER_TICKS): place(tick(2093 + 40 * (i % 2)), t, 0.9, 0.3)
for i, t in enumerate(OUTRO): place(thock([440, 523.25, 587.33, 659.25, 880][i]), t, 0.6, (-0.4, 0.4, -0.4, 0.4, 0)[i])
place(impact(), OUTRO[-1] + 0.6, 0.6)

st = np.stack([L, R], 1)[: int(DURATION * SR)]
st = 0.9 * np.tanh(st * 0.8)                       # fixed gains + soft limiter, so each sound keeps its own level
with wave.open(sys.argv[2], "wb") as f:
    f.setnchannels(2); f.setsampwidth(2); f.setframerate(SR)
    f.writeframes((st * 32767).astype(np.int16).tobytes())
print("sfx written", st.shape[0] / SR, "s")
