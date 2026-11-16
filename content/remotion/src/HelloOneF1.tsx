import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

// A 3-second test in the ONE F1 look: five start lights come on, go out, then a number counts up.
export const HelloOneF1: React.FC<{ title: string; value: number }> = ({ title, value }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lightsOn = Math.min(5, Math.floor(frame / 8));            // one light every 8 frames
  const out = frame >= 48;                                         // lights out at 1.6 s
  const pop = spring({ frame: frame - 48, fps, config: { damping: 12 } });
  const count = Math.round(interpolate(frame, [52, 82], [0, value], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  return (
    <AbsoluteFill style={{ background: "radial-gradient(80% 60% at 60% 45%, #121722, #08090D 75%)", alignItems: "center", justifyContent: "center", fontFamily: "Arial Black, sans-serif", color: "#F2F2F0" }}>
      <div style={{ display: "flex", gap: 28, padding: 28, borderRadius: 24, background: "#050506", border: "4px solid #1C1C22" }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} style={{ width: 120, height: 120, borderRadius: "50%",
            background: !out && i < lightsOn ? "radial-gradient(circle at 40% 35%, #FF9C8F, #FF1E1E 45%, #B00000)" : "#2A0C0C",
            boxShadow: !out && i < lightsOn ? "0 0 40px #FF2A2A" : "inset 0 4px 8px rgba(0,0,0,.6)" }} />
        ))}
      </div>
      <div style={{ marginTop: 90, fontSize: 120, fontStyle: "italic", transform: `scale(${out ? pop : 0})`, color: "#FFD400" }}>{title}</div>
      <div style={{ marginTop: 30, fontSize: 200, color: "#FFB000", opacity: out ? 1 : 0, fontFamily: "monospace" }}>{count}%</div>
    </AbsoluteFill>
  );
};
