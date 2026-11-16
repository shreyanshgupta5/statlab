import React, { useMemo } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { Car } from "./Car";
import { CURVE, INTRO, LAP_END_V, STRAIGHTS, ZONES, lapTimeAt, isSlow, speedAtU, speedColor, tel, uAt, LAP_M } from "./lapData";

// The 3D world: track ribbon with edge lines and kerbs, the speed-coloured trace laid down behind the car,
// braking-zone markers, a generic neon city along the longest straight, and the camera director.
const M = 3000, UP = new THREE.Vector3(0, 1, 0);
const rnd = (i: number) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const frameAt = (u: number) => { const p = CURVE.getPointAt(((u % 1) + 1) % 1), d = CURVE.getTangentAt(((u % 1) + 1) % 1).normalize(); const side = new THREE.Vector3().crossVectors(d, UP).normalize(); return { p, d, side }; };

const ribbon = (width: number, lift: number, colorAt?: (u: number) => THREE.Color, u0 = 0, u1 = 1, steps = M) => {
  const pos: number[] = [], col: number[] = [], idx: number[] = [];
  for (let k = 0; k <= steps; k++) { const u = u0 + ((u1 - u0) * k) / steps, { p, side } = frameAt(u);
    const a = p.clone().addScaledVector(side, -width / 2), b = p.clone().addScaledVector(side, width / 2); a.y += lift; b.y += lift;
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z); if (colorAt) { const c = colorAt(u); col.push(c.r, c.g, c.b, c.r, c.g, c.b); }
    if (k < steps) { const i = k * 2; idx.push(i, i + 1, i + 2, i + 1, i + 3, i + 2); } }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); if (colorAt) g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
};
const edgeLine = (offset: number, color: string) => { const pts: THREE.Vector3[] = [];
  for (let k = 0; k <= M; k++) { const { p, side } = frameAt(k / M); pts.push(p.clone().addScaledVector(side, offset).add(new THREE.Vector3(0, 0.02, 0))); }
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85 })); };

const World: React.FC = () => {
  const geo = useMemo(() => {
    const track = ribbon(1.5, 0, undefined);
    const kerbs: THREE.Mesh[] = [];
    ZONES.forEach((z) => { for (let k = -8; k <= 8; k++) [-0.82, 0.82].forEach((off) => { const u = z.apexU + k * 0.0009, { p, d, side } = frameAt(u);
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.55), new THREE.MeshStandardMaterial({ color: k % 2 ? "#E10600" : "#F2F2F0" }));
      m.position.copy(p.clone().addScaledVector(side, off)).add(new THREE.Vector3(0, 0.015, 0)); m.lookAt(m.position.clone().add(d)); kerbs.push(m); }); });
    const city: { pos: THREE.Vector3; w: number; h: number; dp: number; color: string; rot: number }[] = [];
    const strip = STRAIGHTS.find((s) => s.name === "THE STRIP");
    if (strip) for (let k = 0; k < 70; k++) { const u = strip.u0 + ((strip.u1 - strip.u0) * k) / 70, { p, d, side } = frameAt(u), sgn = k % 2 ? 1 : -1;
      city.push({ pos: p.clone().addScaledVector(side, sgn * (4 + 6 * rnd(k))), w: 1.5 + 3 * rnd(k + 9), h: 5 + 26 * Math.pow(rnd(k + 3), 1.6), dp: 1.5 + 3 * rnd(k + 5), color: ["#FF3EA5", "#FFB000", "#7FD3FF", "#B98CFF"][k % 4], rot: Math.atan2(d.x, d.z) }); }
    for (let k = 0; k < 120; k++) { const u = rnd(k + 400), { p, d, side } = frameAt(u), sgn = rnd(k + 500) > 0.5 ? 1 : -1;     // sparse blocks around the rest of the lap
      city.push({ pos: p.clone().addScaledVector(side, sgn * (8 + 30 * rnd(k + 600))), w: 2 + 4 * rnd(k + 700), h: 2 + 9 * rnd(k + 800), dp: 2 + 4 * rnd(k + 900), color: ["#2B6CFF", "#FFB000", "#FF3EA5"][k % 3], rot: Math.atan2(d.x, d.z) }); }
    return { track, kerbs, city, edgeL: edgeLine(-0.75, "#F2F2F0"), edgeR: edgeLine(0.75, "#F2F2F0") };
  }, []);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}><planeGeometry args={[3000, 3000]} /><meshStandardMaterial color="#0A0D14" roughness={1} /></mesh>
      <gridHelper args={[1600, 160, "#22344E", "#141D2C"]} position={[0, -0.04, 0]} />
      <mesh geometry={geo.track}><meshStandardMaterial color="#323A48" emissive="#151A23" roughness={0.8} side={THREE.DoubleSide} /></mesh>
      <primitive object={geo.edgeL} /><primitive object={geo.edgeR} />
      {geo.kerbs.map((m, k) => <primitive key={k} object={m} />)}
      {geo.city.map((b, k) => (
        <group key={k} position={[b.pos.x, b.h / 2 - 0.05, b.pos.z]} rotation={[0, b.rot, 0]}>
          <mesh><boxGeometry args={[b.w, b.h, b.dp]} /><meshStandardMaterial color="#080A10" emissive={b.color} emissiveIntensity={0.035} roughness={0.9} /></mesh>
          <lineSegments><edgesGeometry args={[new THREE.BoxGeometry(b.w, b.h, b.dp)]} /><lineBasicMaterial color={b.color} transparent opacity={0.75} /></lineSegments>
        </group>))}
      {ZONES.map((z) => { const { p, side } = frameAt(z.apexU), q = p.clone().addScaledVector(side, -2.2);      // opposite side to the trackside camera
        return <group key={z.n}><mesh position={[q.x, 2, q.z]}><cylinderGeometry args={[0.05, 0.05, 4, 10]} /><meshStandardMaterial color="#FFB000" emissive="#FFB000" emissiveIntensity={1.2} transparent opacity={0.6} /></mesh>
          <mesh position={[q.x, 0.02, q.z]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.35, 0.5, 32]} /><meshBasicMaterial color="#FFB000" /></mesh></group>; })}
    </group>
  );
};

// a wide copy of the full trace for the overhead views (the thin one disappears from 300+ units up)
const Overview: React.FC<{ a: number }> = ({ a }) => {
  const g = useMemo(() => ribbon(3.2, 0.06, (x) => speedColor(speedAtU(x))), []);
  return a > 0 ? <mesh geometry={g}><meshBasicMaterial vertexColors toneMapped={false} transparent opacity={a} side={THREE.DoubleSide} /></mesh> : null;
};
const Trace: React.FC<{ u: number }> = ({ u }) => {
  const g = useMemo(() => ribbon(0.34, 0.035, (x) => speedColor(speedAtU(x))), []);
  g.setDrawRange(0, Math.max(0, Math.floor(u * M)) * 6);
  return <mesh geometry={g}><meshBasicMaterial vertexColors toneMapped={false} side={THREE.DoubleSide} /></mesh>;
};

// ---- camera director: a shot per moment of the lap, softened by averaging the last 0.5 s so cuts become quick moves
const CENTER = new THREE.Vector3(0, 0, 0);
const shot = (v: number) => {
  const l = lapTimeAt(v), u = uAt(l), { p, d, side } = frameAt(u);
  const look = (o: THREE.Vector3, lk: THREE.Vector3) => ({ pos: o, look: lk });
  if (v < INTRO) { const a = 0.9 + v * 0.16, r = 300 - v * 22; return look(new THREE.Vector3(Math.cos(a) * r, 150 - v * 18, Math.sin(a) * r), CENTER.clone()); }
  if (v >= LAP_END_V) { const k = Math.min(1, (v - LAP_END_V) / 3.5), e = 1 - Math.pow(1 - k, 3);
    const chase = p.clone().addScaledVector(d, -3).add(new THREE.Vector3(0, 1.2, 0)); return look(chase.lerp(new THREE.Vector3(10, 360, 140), e), p.clone().lerp(CENTER, e)); }
  const z = ZONES.find((zz) => isSlow(v) && Math.abs(zz.apexT - l) < 1.6);
  if (z) { const A = frameAt(z.apexU); return look(A.p.clone().addScaledVector(A.side, 4.5).addScaledVector(A.d, 2).add(new THREE.Vector3(0, 1.3, 0)), p.clone().add(new THREE.Vector3(0, 0.25, 0))); }
  const s = STRAIGHTS.find((ss) => l >= ss.t0 + 0.6 && l <= ss.t1 - 0.6);
  if (s && s.name === "THE STRIP") { const f = (l - s.t0) / (s.t1 - s.t0);
    if (f < 0.5) return look(p.clone().addScaledVector(d, -16).addScaledVector(side, 10).add(new THREE.Vector3(0, 22, 0)), p.clone().addScaledVector(d, 22));
    return look(p.clone().addScaledVector(d, -2.4).add(new THREE.Vector3(0, 0.55, 0)), p.clone().addScaledVector(d, 8).add(new THREE.Vector3(0, 0.3, 0))); }
  if (s) return look(p.clone().addScaledVector(side, s.n % 2 ? 6 : -6).addScaledVector(d, -2).add(new THREE.Vector3(0, 4, 0)), p.clone().addScaledVector(d, 3));
  return look(p.clone().addScaledVector(d, -3.2).add(new THREE.Vector3(0, 1.15, 0)), p.clone().addScaledVector(d, 4).add(new THREE.Vector3(0, 0.2, 0)));
};
const Director: React.FC<{ v: number }> = ({ v }) => {
  const camera = useThree((st) => st.camera) as THREE.PerspectiveCamera;
  const pos = new THREE.Vector3(), look = new THREE.Vector3(); const K = 6;
  for (let k = 0; k < K; k++) { const s = shot(Math.max(0, v - (0.5 * k) / (K - 1))); pos.add(s.pos); look.add(s.look); }
  pos.divideScalar(K); look.divideScalar(K);
  camera.position.copy(pos); camera.lookAt(look); camera.near = 0.05; camera.far = 4000; camera.fov = 50; camera.updateProjectionMatrix();
  return null;
};

export const Scene: React.FC<{ v: number }> = ({ v }) => {
  const l = lapTimeAt(v), t = tel(l), u = v >= LAP_END_V ? 1 : uAt(l), { p, d } = frameAt(Math.min(u, 0.99999));
  const spin = -(t.dist / 3.3) * 2 * Math.PI;                                    // wheel turns (car drawn ~2.5x real size)
  return (
    <>
      <color attach="background" args={["#07090D"]} />
      <fog attach="fog" args={["#07090D", 40, 520]} />
      <ambientLight intensity={0.8} /><hemisphereLight args={["#6A8AC8", "#05060A", 0.9]} /><directionalLight position={[120, 260, 80]} intensity={1.6} />
      <pointLight position={[p.x, p.y + 2.5, p.z]} intensity={6} distance={14} color="#FFE8C0" />
      <World />
      <Trace u={v < INTRO ? 0 : u} />
      <Overview a={v >= LAP_END_V ? Math.min(1, (v - LAP_END_V - 1.5) / 1.5) : 0} />
      <group position={[p.x, p.y + 0.02, p.z]} rotation={[0, Math.atan2(d.x, d.z), 0]}><Car spin={spin} brake={t.brake} speed={t.speed} /></group>
      <Director v={v} />
    </>
  );
};
export { LAP_M };
