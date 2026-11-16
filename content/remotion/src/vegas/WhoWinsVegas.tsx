import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import { AbsoluteFill, Audio, Sequence, continueRender, delayRender, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
// @ts-ignore  generated JS module (scripts/sync_vegas.py)
import * as V from "./legacy";
// @ts-ignore
import { CSS } from "./styles";

/* "Who wins Vegas?" in Remotion.
   Remotion owns the timeline: one <Sequence> per chapter, the camera move between chapters, the text column, snow,
   progress bar and the audio tracks. Each chapter's chart is the approved SVG drawing from the explainer (V.G[i]),
   animated each frame by its matching function (V.A[i]). */

export type VegasProps = { mode: "land" | "port"; voiceover: string | null; music: string | null; musicVolume: number };
const FONTS = "https://fonts.googleapis.com/css2?family=Archivo:ital,wdth,wght@0,100,500;0,100,700;1,125,800;1,125,900&family=JetBrains+Mono:wght@500;700&family=Doto:wght@800;900&family=Caveat+Brush&display=swap";
const { CH, T0, XF, G, A, rnd, clamp, easeOut, easeIn } = V;

const useFonts = () => {
  const [handle] = useState(() => delayRender("Loading Google Fonts"));
  useLayoutEffect(() => {
    let link = document.querySelector<HTMLLinkElement>("link[data-onef1-fonts]");
    const done = () => Promise.all(["900 italic 40px Archivo", "700 20px 'JetBrains Mono'", "900 20px Doto", "40px 'Caveat Brush'"].map((f) => document.fonts.load(f)))
      .then(() => document.fonts.ready).then(() => continueRender(handle));
    if (!link) { link = document.createElement("link"); link.rel = "stylesheet"; link.href = FONTS; link.dataset.onef1Fonts = "1"; link.onload = done; link.onerror = () => continueRender(handle); document.head.appendChild(link); }
    else done();
  }, [handle]);
};

const Chapter: React.FC<{ i: number; from: number }> = ({ i, from }) => {
  const frame = useCurrentFrame(), { fps } = useVideoConfig();
  const c = CH[i], last = i === CH.length - 1, lt = (frame + from) / fps - T0[i];
  const enter = i === 0 ? 1 : clamp((lt + XF) / XF), exit = last ? 0 : clamp((lt - (c.d - XF)) / XF);
  const gRef = useRef<HTMLDivElement>(null);
  const svg = useMemo(() => ({ __html: G[i] }), [i]);
  useLayoutEffect(() => { A[i](lt); });                                   // animate this chapter's drawing for the current frame
  const f = c.focus || [500, 400];
  const caps: [number, string][] = c.caps;
  return (
    <>
      <div className="txt" style={{ opacity: easeOut(enter) * (1 - easeIn(exit)), transform: `translateY(${(1 - easeOut(enter)) * 40 - easeIn(exit) * 40}px)` }}>
        <div className="kick">{c.kick}</div>
        <h1 className="ttl">{c.title.map(([w, k]: [string, string], n: number) => { const p = clamp((lt - n * 0.15) / 0.35);
          return <span key={n} className={`w ${k}`} style={{ opacity: p, transform: `translateY(${(1 - easeOut(p)) * 34}px)` }}>{w}</span>; })}</h1>
        <div className="cap">{caps.map(([s, h], n) => { const e = n < caps.length - 1 ? caps[n + 1][0] : 1e9, p = clamp((lt - s) / 0.4);
          return <p key={n} style={{ opacity: p * (1 - clamp((lt - e + 0.3) / 0.3)), transform: `translateY(${(1 - easeOut(p)) * 20}px)` }} dangerouslySetInnerHTML={{ __html: h }} />; })}</div>
        {c.cta ? <div className="ctaw"><div className="ask" id="cta1">who's your pick? 👇</div><br /><div className="follow" id="cta2"><span className="plus">+</span><span>FOLLOW FOR MORE <b>F1 EXPLAINED</b></span></div></div> : null}
      </div>
      <div className="gbox"><div className="g" ref={gRef} dangerouslySetInnerHTML={svg}
        style={{ opacity: easeOut(enter) * (1 - easeIn(exit)), transformOrigin: `${f[0] / 10}% ${f[1] / 8}%`, transform: `scale(${(0.86 + 0.14 * easeOut(enter)) * (c.focus ? 1 + 1.8 * easeIn(exit) : 1)})` }} /></div>
    </>
  );
};

export const WhoWinsVegas: React.FC<VegasProps> = ({ mode, voiceover, music, musicVolume }) => {
  useFonts();
  const frame = useCurrentFrame(), { fps, width, height, durationInFrames } = useVideoConfig(), t = frame / fps;
  const ci = Math.max(0, T0.findIndex((s: number, k: number) => t >= s && t < s + CH[k].d));
  const cold = clamp((t - T0[1] + 0.5) / 1) * clamp((T0[3] - t) / 0.8);
  return (
    <AbsoluteFill>
      <style>{CSS}</style>
      <div className={`stage ${mode}`} style={{ width, height }}>
        <div className="ruler l" /><div className="ruler r" />
        <div className="hdr"><span className="brand"><span>ONE F1</span></span><span className="tag">EXPLAINED · <b>LAS VEGAS GP</b></span></div>
        <div className="prog"><i style={{ width: `${(100 * frame) / durationInFrames}%` }} /></div>
        <div className="chap">{CH.map((_: unknown, k: number) => <i key={k} className={k <= ci ? "on" : ""} />)}</div>
        <div className="snow" style={{ opacity: cold * 0.65 }}>{cold > 0 && Array.from({ length: 40 }, (_, k) => { const sp = 60 + 80 * rnd(k), sz = 3 + 7 * rnd(k + 99);
          return <i key={k} style={{ width: sz, height: sz, opacity: 0.2 + 0.5 * rnd(k + 7), left: width * rnd(k + 31) + 30 * Math.sin(t * 0.8 + k), top: ((t * sp + height * rnd(k + 57)) % (height - 100)) + 60 }} />; })}</div>
        {CH.map((c: { d: number }, k: number) => { const from = Math.max(0, Math.round((T0[k] - (k ? XF : 0)) * fps)), to = Math.round((T0[k] + c.d) * fps);
          return <Sequence key={k} from={from} durationInFrames={to - from} layout="none"><Chapter i={k} from={from} /></Sequence>; })}
        <div className="ftr"><span>@F1STATLAB</span><span>{CH[ci].src}</span></div>
      </div>
      {voiceover ? <Audio src={staticFile(voiceover)} /> : null}
      {music ? <Audio src={staticFile(music)} volume={musicVolume} /> : null}
    </AbsoluteFill>
  );
};
