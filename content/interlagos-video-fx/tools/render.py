"""Motion pass + audio mix for the Max x Interlagos video.

  python3 render.py <tools_dir> <input.mp4> <sfx.wav> <out.mp4> [start end]

Video: frames are piped out of ffmpeg, transformed here (slow push-in per chapter, impact zoom + shake +
flash on chapter cuts, small punch-ins toward each row/card as it appears, light film grain), then
piped back into ffmpeg. Audio: original voice + synthesised SFX, SFX ducked under the voice, then
loudness-normalised to -14 LUFS for social platforms.
"""
import sys, subprocess, numpy as np, cv2
sys.path.insert(0, sys.argv[1]); from cues import *

SRC, SFX, OUT = sys.argv[2], sys.argv[3], sys.argv[4]
T0, T1 = (float(sys.argv[5]), float(sys.argv[6])) if len(sys.argv) > 6 else (0.0, DURATION)
W, H = 1080, 1920
ROW_Y, CARD_Y = 1180, 1330                         # where rows / cards sit, so punch-ins zoom toward them

def ease(x): x = np.clip(x, 0, 1); return x * x * (3 - 2 * x)
def pulse(dt, rise=0.07, decay=5.0):               # 0 -> 1 quickly, then exponential fall
    if dt < 0: return 0.0
    return min(1.0, dt / rise) * np.exp(-max(0.0, dt - rise) * decay)

segments = [(0.0, CUTS[0])] + CHAPTERS + [(CUTS[-1], DURATION)]
rng = np.random.default_rng(3)
grain = [rng.normal(0, 2.0, (H // 2, W // 2)).astype(np.float32) for _ in range(6)]

def transform(t):
    """returns (2x3 affine, flash alpha)"""
    seg = next((s for s in segments if s[0] <= t < s[1]), segments[-1])
    push = 1 + 0.03 * ease((t - seg[0]) / (seg[1] - seg[0]))
    M = np.array([[push, 0, (1 - push) * W / 2], [0, push, (1 - push) * H / 2], [0, 0, 1]])
    def about(s, cx, cy): return np.array([[s, 0, (1 - s) * cx], [0, s, (1 - s) * cy], [0, 0, 1]])
    shake = np.zeros(2); flash = 0.0
    for c in REVEALS:                              # impact lands as the wipe clears
        dt = t - c
        if 0 <= dt < 1.2:
            M = about(1 + 0.07 * np.exp(-dt * 7), W / 2, H / 2) @ M
            a = 14 * np.exp(-dt * 11); shake += a * np.array([np.sin(dt * 93), np.cos(dt * 71)])
            flash = max(flash, 0.45 * np.exp(-dt * 16))
    for r in ROWS:
        p = pulse(t - r, 0.06, 6);
        if p: M = about(1 + 0.012 * p, W / 2, ROW_Y) @ M
    for k in CARDS + COUNTER_IN + OUTRO:
        dt = t - k; p = pulse(dt, 0.05, 6)
        if p:
            M = about(1 + 0.02 * p, W / 2, CARD_Y) @ M
            shake += 4 * np.exp(-max(dt, 0) * 14) * np.array([np.sin(dt * 120), np.cos(dt * 97)])
    for k in COUNTER_TICKS:
        p = pulse(t - k, 0.03, 12)
        if p: M = about(1 + 0.004 * p, W / 2, CARD_Y) @ M
    M[0, 2] += shake[0]; M[1, 2] += shake[1]
    return M[:2], flash

dec = subprocess.Popen(["ffmpeg", "-v", "error", "-ss", str(T0), "-t", str(T1 - T0), "-i", SRC,
                        "-f", "rawvideo", "-pix_fmt", "bgr24", "-"], stdout=subprocess.PIPE)
af = (f"[1:a]atrim={T0}:{T1},asetpts=N/SR/TB,aformat=channel_layouts=stereo,asplit=2[v1][v2];"
      f"[2:a]atrim={T0}:{T1},asetpts=N/SR/TB,volume=0.67[fx];"
      "[fx][v1]sidechaincompress=threshold=0.08:ratio=2:attack=12:release=160[fxd];"
      "[v2][fxd]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=9[a]")
enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}",
                        "-r", str(FPS), "-i", "-", "-i", SRC, "-i", SFX, "-filter_complex", af,
                        "-map", "0:v", "-map", "[a]", "-c:v", "libx264", "-preset", "medium", "-crf", "20",
                        "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-c:a", "aac", "-b:a", "192k",
                        "-ar", "48000", OUT], stdin=subprocess.PIPE)
n = W * H * 3; i = 0
while True:
    b = dec.stdout.read(n)
    if len(b) < n: break
    f = np.frombuffer(b, np.uint8).reshape(H, W, 3)
    t = T0 + i / FPS
    M, flash = transform(t)
    g = cv2.warpAffine(f, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    out = g.astype(np.float32)
    out += cv2.resize(grain[i % len(grain)], (W, H), interpolation=cv2.INTER_NEAREST)[..., None]
    if flash: out = out * (1 - flash) + 255 * flash
    enc.stdin.write(np.clip(out, 0, 255).astype(np.uint8).tobytes())
    i += 1
    if i % 300 == 0: print(f"  {t:.0f}s", flush=True)
enc.stdin.close(); enc.wait(); dec.wait()
print("frames", i, "->", OUT)
