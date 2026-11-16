// Russell's 2024 Las Vegas pole lap (OpenF1, scripts/fetch_vegas_lap3d.py), turned into everything the 3D video needs:
// a smooth 3D centreline, distance/time lookups, braking zones and straights found in the data, and the video clock
// (real time, with slow motion through each braking zone).
import * as THREE from "three";
import raw from "./lap.json";

export const LAP_TIME: number = raw.lap;
const S: number[][] = raw.samples;                         // [t, x, y, z, speed, gear, throttle, brake, rpm]; x/y/z in decimetres
export const HZ: number = raw.hz;
export const N = S.length;

// ---- geometry: 1 scene unit = 10 m; height exaggerated x3 so the (small) elevation change reads
const ELEV = 3;
const xs = S.map((s) => s[1]), ys = S.map((s) => s[2]), zs = S.map((s) => s[3]);
const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2, z0 = Math.min(...zs);
const toScene = (s: number[]) => new THREE.Vector3((s[1] - cx) / 100, ((s[3] - z0) / 100) * ELEV, -(s[2] - cy) / 100);
export const RAWPTS = S.map(toScene);
// centreline: centripetal Catmull-Rom through every 5th sample (≈ the raw 4 Hz position rate), closed loop
export const CURVE = new THREE.CatmullRomCurve3(RAWPTS.filter((_, i) => i % 5 === 0), true, "centripetal");
export const TRACK_LEN_UNITS = CURVE.getLength();

// distance travelled at each sample (metres), from the planar positions
export const DIST: number[] = [0];
for (let i = 1; i < N; i++) DIST.push(DIST[i - 1] + Math.hypot(S[i][1] - S[i - 1][1], S[i][2] - S[i - 1][2]) / 10);
export const LAP_M = DIST[N - 1];

// ---- lookups by lap time
const idxAt = (t: number) => Math.max(0, Math.min(N - 1.001, t * HZ));
const lerpField = (t: number, f: number) => { const x = idxAt(t), i = Math.floor(x), k = x - i; return S[i][f] + (S[i + 1][f] - S[i][f]) * k; };
export const tel = (t: number) => { const i = Math.round(idxAt(t));
  const x = idxAt(t), j = Math.floor(x);
  return { speed: lerpField(t, 4), gear: S[i][5], throttle: lerpField(t, 6), brake: S[i][7], rpm: lerpField(t, 8), dist: DIST[j] + (DIST[j + 1] - DIST[j]) * (x - j) }; };
export const uAt = (t: number) => Math.min(0.99999, tel(t).dist / LAP_M);     // arc-length parameter on the curve
export const speedAtU = (u: number) => { let lo = 0, hi = N - 1; const d = u * LAP_M; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (DIST[m] < d) lo = m; else hi = m; } return S[lo][4]; };

// ---- braking zones: local speed minima at least 40 km/h below the speed before them
type Zone = { n: number; apexT: number; apexSpeed: number; gear: number; entrySpeed: number; brakeT: number; brakeM: number; braked: boolean; apexU: number; complex: boolean; apexes: number };
const sp = S.map((s) => s[4]); const mins: number[] = [];
for (let i = 10; i < N - 10; i++) {
  const w = sp.slice(i - 10, i + 11); if (sp[i] !== Math.min(...w)) continue;
  if (mins.length && i - mins[mins.length - 1] <= 15) continue;
  if (Math.max(...sp.slice(Math.max(0, i - 200), i)) - sp[i] >= 40) mins.push(i);
}
// minima < 6 s apart join one complex only if the car never gets back above 200 km/h between them
const groups: number[][] = []; mins.forEach((i) => { const g = groups[groups.length - 1], prev = g ? g[g.length - 1] : -1;
  if (g && (i - prev) / HZ < 6 && Math.max(...sp.slice(prev, i)) < 200) g.push(i); else groups.push([i]); });
export const ZONES: Zone[] = groups.map((g, n) => {
  const apex = g.reduce((a, b) => (sp[b] < sp[a] ? b : a)), first = g[0];
  const prev = n > 0 ? groups[n - 1][groups[n - 1].length - 1] : 0;
  let pk = Math.max(prev, first - 200); for (let j = pk; j < first; j++) if (sp[j] > sp[pk]) pk = j;   // top speed since the previous corner
  let b = -1; for (let j = pk; j < first; j++) if (S[j][7]) { b = j; break; }                        // first brake application after it (none = a lift)
  return { n: n + 1, apexT: S[apex][0], apexSpeed: sp[apex], gear: S[apex][5], entrySpeed: sp[pk], brakeT: S[b >= 0 ? b : pk][0], brakeM: b >= 0 ? Math.round(DIST[first] - DIST[b]) : 0,
    braked: b >= 0, apexU: DIST[apex] / LAP_M, complex: g.length > 1, apexes: g.length };
});
// ---- straights: full throttle (≥98%) for at least 400 m
type Straight = { n: number; t0: number; t1: number; len: number; top: number; u0: number; u1: number; name: string };
export const STRAIGHTS: Straight[] = []; { let s = -1;
  for (let i = 0; i <= N; i++) { const on = i < N && S[i][6] >= 98;
    if (on && s < 0) s = i;
    if (!on && s >= 0) { const len = DIST[i - 1] - DIST[s]; if (len >= 400) STRAIGHTS.push({ n: STRAIGHTS.length + 1, t0: S[s][0], t1: S[i - 1][0], len: Math.round(len), top: Math.max(...sp.slice(s, i)), u0: DIST[s] / LAP_M, u1: DIST[i - 1] / LAP_M, name: "" }); s = -1; } } }
const longest = STRAIGHTS.reduce((a, b) => (b.len > a.len ? b : a), STRAIGHTS[0]); STRAIGHTS.forEach((s) => (s.name = s === longest ? "THE STRIP" : `STRAIGHT ${s.n}`));
export const STATS = { full: Math.round((100 * S.filter((s) => s[6] >= 98).length) / N), brake: Math.round((100 * S.filter((s) => s[7]).length) / N), top: Math.max(...sp), slow: Math.min(...sp) };

// ---- video clock: intro, the lap in real time with x3 slow motion from 1.2 s before each apex to 0.4 s after, outro
export const INTRO = 5, OUTRO = 9, SLOW = 3;
const WINDOWS = ZONES.map((z) => [Math.max(0, z.apexT - 1.2), Math.min(LAP_TIME, z.apexT + 0.4)]);
type Seg = { v0: number; l0: number; rate: number; v1: number };
export const SEGS: Seg[] = []; { let v = INTRO, l = 0;
  const push = (l1: number, rate: number) => { if (l1 <= l) return; const dv = (l1 - l) / rate; SEGS.push({ v0: v, l0: l, rate, v1: v + dv }); v += dv; l = l1; };
  WINDOWS.forEach(([a, b]) => { push(a, 1); push(b, 1 / SLOW); }); push(LAP_TIME, 1); }
export const LAP_END_V = SEGS[SEGS.length - 1].v1;
export const VIDEO_LEN = LAP_END_V + OUTRO;
export const lapTimeAt = (v: number) => { if (v <= INTRO) return 0; for (const s of SEGS) if (v < s.v1) return s.l0 + (v - s.v0) * s.rate; return LAP_TIME; };
export const isSlow = (v: number) => SEGS.some((s) => s.rate < 1 && v >= s.v0 && v < s.v1);

// ---- colours
const STOPS: [number, THREE.Color][] = [[90, new THREE.Color("#2B6CFF")], [180, new THREE.Color("#7FD3FF")], [270, new THREE.Color("#FFB000")], [347, new THREE.Color("#FF3B30")]];
export const speedColor = (v: number) => { for (let i = 1; i < STOPS.length; i++) if (v <= STOPS[i][0]) { const [a, ca] = STOPS[i - 1], [b, cb] = STOPS[i]; return ca.clone().lerp(cb, Math.max(0, (v - a) / (b - a))); } return STOPS[STOPS.length - 1][1].clone(); };
export const SPEED_STOPS = STOPS.map(([v, c]) => [v, "#" + c.getHexString()] as [number, string]);
