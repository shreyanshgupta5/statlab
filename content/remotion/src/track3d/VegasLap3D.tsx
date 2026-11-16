import React, { useLayoutEffect, useMemo, useState } from "react";
import { AbsoluteFill, Audio, continueRender, delayRender, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { Scene } from "./Scene";
import { INTRO, LAP_END_V, LAP_M, LAP_TIME, RAWPTS, SPEED_STOPS, STATS, STRAIGHTS, ZONES, isSlow, lapTimeAt, speedColor, tel } from "./lapData";

/* "One lap of Las Vegas" in 3D: Russell's 2024 pole lap, real telemetry. Landscape 1920x1080.
   3D world in Scene.tsx; this file is the dashboard overlay, pop-up explanations, intro and outro. */
export type Lap3DProps = { voiceover: string | null; music: string | null; musicVolume: number };
const FONTS = "https://fonts.googleapis.com/css2?family=Archivo:ital,wdth,wght@0,100,500;0,100,700;1,125,800;1,125,900&family=JetBrains+Mono:wght@500;700&family=Doto:wght@800;900&display=swap";
const C = { fg: "#F2F2F0", soft: "#C9CDD2", muted: "#7D838C", amber: "#FFB000", yellow: "#FFD400", red: "#E10600", ice: "#7FD3FF", heat: "#FF7A1A", good: "#5BE38F" };
const DISP: React.CSSProperties = { fontFamily: "Archivo, sans-serif", fontWeight: 900, fontStyle: "italic", fontStretch: "125%", textTransform: "uppercase" };
const MONO: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, letterSpacing: 3 };
const LED: React.CSSProperties = { fontFamily: "Doto, monospace", fontWeight: 900 };
const PANEL: React.CSSProperties = { background: "rgba(8,9,13,.82)", border: "2px solid #2B2615", borderRadius: 18, backdropFilter: "blur(6px)" };
const clamp = (x: number) => Math.max(0, Math.min(1, x)), easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
const fmt = (s: number) => { const m = Math.floor(s / 60), r = s - m * 60; return `${m}:${r.toFixed(3).padStart(6, "0")}`; };

const useFonts = () => {
  const [h] = useState(() => delayRender("fonts"));
  useLayoutEffect(() => { const l = document.createElement("link"); l.rel = "stylesheet"; l.href = FONTS;
    l.onload = () => Promise.all(["900 italic 40px Archivo", "700 20px 'JetBrains Mono'", "900 20px Doto"].map((f) => document.fonts.load(f))).then(() => continueRender(h));
    l.onerror = () => continueRender(h); document.head.appendChild(l); }, [h]);
};

// 2D mini-map from the same positions
const MAP = (() => { const xs = RAWPTS.map((p) => p.x), zs = RAWPTS.map((p) => p.z), x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
  const W = 330, H = 250, s = Math.min((W - 30) / (x1 - x0), (H - 30) / (z1 - z0)), ox = (W - (x1 - x0) * s) / 2, oy = (H - (z1 - z0) * s) / 2;
  const P = RAWPTS.map((p) => [ox + (p.x - x0) * s, oy + (p.z - z0) * s]); return { W, H, P }; })();

const Gauge: React.FC<{ v: number }> = ({ v }) => { const A = (x: number) => Math.PI * (0.75 + 1.5 * x / 360), R = 92, c = 110;
  const pt = (a: number, r: number) => `${c + r * Math.cos(a)} ${c + r * Math.sin(a)}`, arc = (a0: number, a1: number) => `M${pt(a0, R)} A${R} ${R} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${pt(a1, R)}`;
  return (<svg width={220} height={200} viewBox="0 0 220 200"><path d={arc(A(0), A(360))} stroke="#1F232B" strokeWidth={16} fill="none" strokeLinecap="round" />
    <path d={arc(A(0), A(Math.max(1, v)))} stroke={"#" + speedColor(v).getHexString()} strokeWidth={16} fill="none" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 8px #${speedColor(v).getHexString()})` }} />
    {[0, 60, 120, 180, 240, 300, 360].map((x) => { const a = A(x); return <text key={x} x={c + 66 * Math.cos(a)} y={c + 66 * Math.sin(a) + 5} textAnchor="middle" fill={C.muted} style={{ ...MONO, fontSize: 13, letterSpacing: 0 }}>{x}</text>; })}</svg>); };

export const VegasLap3D: React.FC<Lap3DProps> = ({ voiceover, music, musicVolume }) => {
  useFonts();
  const frame = useCurrentFrame(), { fps, width, height } = useVideoConfig(), v = frame / fps;
  const l = lapTimeAt(v), t = tel(l), slow = isSlow(v), inLap = v >= INTRO && v < LAP_END_V, outro = v >= LAP_END_V;
  const zone = ZONES.find((z) => l >= z.brakeT - 0.4 && l <= z.apexT + 1.4 && inLap);
  const straight = !zone && STRAIGHTS.find((s) => l >= s.t0 && l <= s.t1 && inLap);
  const trail = useMemo(() => MAP.P.map((p, i) => ({ p, c: "#" + speedColor(tel(i / 20).speed).getHexString() })), []);
  const idx = Math.floor(clamp(l / LAP_TIME) * (MAP.P.length - 1));
  const introA = 1 - clamp((v - (INTRO - 0.9)) / 0.9), outA = clamp((v - LAP_END_V - 2.6) / 0.8), hudA = inLap ? 1 : outro ? 1 - clamp((v - LAP_END_V) / 0.8) : clamp((v - INTRO + 0.6) / 0.6);
  const card = (key: string, kick: string, title: string, rows: [string, string, string?][], color: string, start: number) => {
    const a = clamp((l - start) / 0.25);
    return (<div key={key} style={{ position: "absolute", left: 70, top: 170, width: 500, padding: "22px 28px", ...PANEL, borderColor: color, opacity: a, transform: `translateX(${(1 - easeOut(a)) * -60}px)`, boxShadow: `0 0 30px ${color}33` }}>
      <div style={{ ...MONO, fontSize: 18, color }}>{kick}</div><div style={{ ...DISP, fontSize: 46, color: C.fg, marginTop: 6, lineHeight: 1 }}>{title}</div>
      {rows.map(([k, val, col], i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 10, borderTop: "1px solid #232833", paddingTop: 8 }}>
        <span style={{ ...MONO, fontSize: 16, color: C.muted }}>{k}</span><span style={{ ...LED, fontSize: 34, color: col || C.amber }}>{val}</span></div>)}</div>);
  };
  return (
    <AbsoluteFill style={{ background: "#07090D" }}>
      <ThreeCanvas width={width} height={height} gl={{ antialias: true }}><Scene v={v} /></ThreeCanvas>
      {/* vignette */}
      <AbsoluteFill style={{ background: "radial-gradient(120% 90% at 50% 50%, transparent 55%, rgba(0,0,0,.55))", pointerEvents: "none" }} />
      {/* header */}
      <div style={{ position: "absolute", left: 70, right: 70, top: 46, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}><span style={{ display: "inline-block", padding: "6px 20px", background: C.red, transform: "skewX(-16deg)" }}><span style={{ display: "inline-block", transform: "skewX(16deg)", ...DISP, fontSize: 26, color: "#0A0A0A" }}>ONE F1</span></span>
          <span style={{ ...MONO, fontSize: 20, color: C.muted }}>ONE LAP OF <b style={{ color: C.amber }}>LAS VEGAS</b> · RUSSELL · 2024 POLE</span></div>
        <div style={{ display: "flex", alignItems: "center", gap: 18, opacity: hudA }}>
          {slow ? <span style={{ ...MONO, fontSize: 18, color: "#0A0A0A", background: C.yellow, padding: "6px 14px", borderRadius: 8 }}>SLOW MOTION ×⅓</span> : null}
          <div style={{ ...PANEL, padding: "8px 20px" }}><span style={{ ...MONO, fontSize: 16, color: C.muted, marginRight: 14 }}>LAP</span><span style={{ ...LED, fontSize: 44, color: C.fg }}>{fmt(l)}</span></div></div>
      </div>
      <div style={{ position: "absolute", left: 70, right: 70, top: 112, height: 6, borderRadius: 3, background: "#1A1D24", opacity: hudA }}><div style={{ width: `${100 * clamp(t.dist / LAP_M)}%`, height: "100%", borderRadius: 3, background: C.amber, boxShadow: `0 0 10px ${C.amber}` }} /></div>
      <div style={{ position: "absolute", right: 70, top: 128, ...MONO, fontSize: 16, color: C.muted, opacity: hudA }}>{(t.dist / 1000).toFixed(2)} / {(LAP_M / 1000).toFixed(2)} KM</div>
      {/* pop-up explanations */}
      {zone ? card("z" + zone.n, zone.complex ? `BRAKING ZONE ${zone.n} · ${zone.apexes}-CORNER COMPLEX` : `BRAKING ZONE ${zone.n}`, zone.apexSpeed > 180 ? "FAST CORNER" : zone.complex ? "THE TWISTY BIT" : "HARD STOP",
        [["SPEED IN", `${zone.entrySpeed}`, C.heat], ["APEX", `${zone.apexSpeed} KM/H`, C.ice], ["GEAR AT APEX", `${zone.gear}`], zone.braked ? ["BRAKING DISTANCE", `${zone.brakeM} M`] : ["BRAKES", "LIFT ONLY", C.good]], C.heat, zone.brakeT - 0.4) : null}
      {straight ? card("s" + straight.n, straight.name === "THE STRIP" ? "LONGEST STRAIGHT" : `STRAIGHT ${straight.n}`, straight.name === "THE STRIP" ? "THE STRIP" : "FLAT OUT",
        [["FULL THROTTLE FOR", `${straight.len.toLocaleString("en")} M`, C.ice], ["TOP SPEED", `${straight.top} KM/H`, "#FF3B30"], ["TIME", `${(straight.t1 - straight.t0).toFixed(1)} S`]], C.ice, straight.t0) : null}
      {/* dashboard */}
      <div style={{ position: "absolute", left: 70, bottom: 56, ...PANEL, padding: "16px 24px 16px 10px", display: "flex", alignItems: "center", gap: 18, opacity: hudA }}>
        <div style={{ position: "relative" }}><Gauge v={t.speed} />
          <div style={{ position: "absolute", left: 0, right: 0, top: 70, textAlign: "center" }}><div style={{ ...LED, fontSize: 64, color: C.fg, lineHeight: 1 }}>{Math.round(t.speed)}</div><div style={{ ...MONO, fontSize: 14, color: C.muted }}>KM/H</div></div></div>
        <div style={{ textAlign: "center" }}><div style={{ ...MONO, fontSize: 14, color: C.muted }}>GEAR</div><div style={{ ...LED, fontSize: 96, color: C.amber, lineHeight: 1, textShadow: `0 0 18px ${C.amber}88` }}>{t.gear || "N"}</div></div>
        {[["THR", t.throttle / 100, C.good], ["BRK", t.brake ? 1 : 0, "#FF3B30"], ["RPM", clamp((t.rpm - 6000) / 6500), C.ice]].map(([k, val, col]) => (
          <div key={k as string} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <div style={{ width: 26, height: 150, borderRadius: 8, background: "#1A1D24", position: "relative", overflow: "hidden" }}><div style={{ position: "absolute", bottom: 0, width: "100%", height: `${100 * (val as number)}%`, background: col as string, boxShadow: `0 0 12px ${col}` }} /></div>
            <span style={{ ...MONO, fontSize: 13, color: C.muted, letterSpacing: 1 }}>{k as string}</span></div>))}
      </div>
      {/* mini-map + speed legend */}
      <div style={{ position: "absolute", right: 70, bottom: 56, ...PANEL, padding: 14, opacity: hudA }}>
        <svg width={MAP.W} height={MAP.H}><polyline points={MAP.P.map((p) => p.join(",")).join(" ")} fill="none" stroke="#2A303C" strokeWidth={9} strokeLinejoin="round" />
          {trail.slice(0, idx).filter((_, i) => i % 3 === 0).map((s, i, arr) => i < arr.length - 1 ? <line key={i} x1={s.p[0]} y1={s.p[1]} x2={arr[i + 1].p[0]} y2={arr[i + 1].p[1]} stroke={s.c} strokeWidth={5} strokeLinecap="round" /> : null)}
          {ZONES.map((z) => { const p = MAP.P[Math.min(MAP.P.length - 1, Math.round(z.apexT * 20))]; return <circle key={z.n} cx={p[0]} cy={p[1]} r={6} fill="none" stroke={C.amber} strokeWidth={2} />; })}
          <circle cx={MAP.P[idx][0]} cy={MAP.P[idx][1]} r={8} fill="#fff" stroke={C.red} strokeWidth={3} /></svg>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}><span style={{ ...MONO, fontSize: 12, color: C.muted, letterSpacing: 1 }}>{SPEED_STOPS[0][0]}</span>
          <div style={{ flex: 1, height: 8, borderRadius: 4, background: `linear-gradient(90deg, ${SPEED_STOPS.map(([, c]) => c).join(",")})` }} /><span style={{ ...MONO, fontSize: 12, color: C.muted, letterSpacing: 1 }}>{SPEED_STOPS[SPEED_STOPS.length - 1][0]} KM/H</span></div></div>
      {/* intro */}
      <div style={{ position: "absolute", left: 70, top: 300, opacity: introA, transform: `translateY(${(1 - introA) * -30}px)` }}>
        <div style={{ ...LED, fontSize: 30, letterSpacing: 4, color: C.amber }}>ONE F1 EXPLAINED · 3D</div>
        <div style={{ ...DISP, fontSize: 110, lineHeight: 0.95, color: C.fg, marginTop: 14 }}>ONE LAP OF<br /><span style={{ color: C.amber }}>LAS VEGAS</span></div>
        <div style={{ ...MONO, fontSize: 24, color: C.soft, marginTop: 24 }}>Russell's 2024 pole lap · {fmt(LAP_TIME)} · real telemetry</div></div>
      {/* outro */}
      <div style={{ position: "absolute", left: 70, top: 220, width: 620, opacity: outA, transform: `translateX(${(1 - easeOut(outA)) * -50}px)` }}>
        <div style={{ ...LED, fontSize: 28, letterSpacing: 4, color: C.amber }}>THE LAP IN NUMBERS</div>
        <div style={{ ...DISP, fontSize: 80, lineHeight: 0.95, color: C.fg, marginTop: 10 }}>{fmt(LAP_TIME)}</div>
        {[["FULL THROTTLE", `${STATS.full}%`, C.good], ["ON THE BRAKES", `${STATS.brake}%`, "#FF3B30"], ["TOP SPEED", `${STATS.top} KM/H`, C.heat], ["SLOWEST POINT", `${STATS.slow} KM/H`, C.ice],
          ["BRAKING ZONES", `${ZONES.length}`, C.amber], ["STRAIGHTS OVER 400 M", `${STRAIGHTS.length}`, C.amber]].map(([k, val, col], i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 14, paddingTop: 10, borderTop: "1px solid #232833", opacity: clamp((v - LAP_END_V - 3 - i * 0.25) / 0.4) }}>
            <span style={{ ...MONO, fontSize: 20, color: C.muted }}>{k}</span><span style={{ ...LED, fontSize: 44, color: col }}>{val}</span></div>))}
        <div style={{ display: "inline-flex", alignItems: "center", gap: 16, marginTop: 34, padding: "16px 28px 16px 16px", borderRadius: 999, background: C.red, boxShadow: "0 0 34px rgba(225,6,0,.5)", opacity: clamp((v - LAP_END_V - 5) / 0.5) }}>
          <span style={{ display: "grid", placeItems: "center", width: 48, height: 48, borderRadius: "50%", background: "#fff", color: C.red, fontSize: 40, lineHeight: 1 }}>+</span>
          <span style={{ ...DISP, fontSize: 30, color: "#fff" }}>FOLLOW FOR MORE <span style={{ color: C.yellow }}>F1 EXPLAINED</span></span></div></div>
      <div style={{ position: "absolute", left: 70, right: 70, bottom: 18, display: "flex", justifyContent: "space-between", ...MONO, fontSize: 15, color: C.muted }}>
        <span>@F1STATLAB</span><span>DATA: OPENF1 · RUSSELL 2024 QUALIFYING · CAR AND CITY ARE ILLUSTRATIONS</span></div>
      {voiceover ? <Audio src={staticFile(voiceover)} /> : null}
      {music ? <Audio src={staticFile(music)} volume={musicVolume} /> : null}
    </AbsoluteFill>
  );
};
