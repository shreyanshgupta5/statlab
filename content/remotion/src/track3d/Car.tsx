import React from "react";

// A generic 2026-style F1 car in ONE F1 colours (not any team's livery), built from simple shapes.
// Local axes: nose points +z, up is +y. About 1.4 units long (drawn ~2.5x real size so it reads on a 6 km track).
const RED = "#E10600", BLACK = "#14161A", CARBON = "#22252B", AMBER = "#FFB000";
const Wheel: React.FC<{ p: [number, number, number]; r: number; w: number; spin: number; glow: number }> = ({ p, r, w, spin, glow }) => (
  <group position={p}>
    <mesh rotation={[spin, 0, Math.PI / 2]}><cylinderGeometry args={[r, r, w, 28]} /><meshStandardMaterial color="#0C0D10" roughness={0.9} /></mesh>
    <mesh rotation={[spin, 0, Math.PI / 2]} position={[p[0] > 0 ? w / 2 + 0.001 : -w / 2 - 0.001, 0, 0]}><cylinderGeometry args={[r * 0.62, r * 0.62, 0.004, 24]} /><meshStandardMaterial color="#3A3D44" metalness={0.6} roughness={0.4} /></mesh>
    {/* sidewall stripe so the spin is visible */}
    <mesh rotation={[spin, 0, Math.PI / 2]} position={[p[0] > 0 ? w / 2 + 0.003 : -w / 2 - 0.003, 0, 0]}><torusGeometry args={[r * 0.8, 0.008, 6, 24, Math.PI * 1.2]} /><meshStandardMaterial color={AMBER} emissive={AMBER} emissiveIntensity={0.4} /></mesh>
    {/* brake disc glow (front axle only gets glow > 0) */}
    {glow > 0 ? <mesh position={[p[0] > 0 ? -0.02 : 0.02, 0, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[r * 0.55, r * 0.55, 0.02, 20]} /><meshStandardMaterial color="#FF5A1A" emissive="#FF5A1A" emissiveIntensity={3 * glow} /></mesh> : null}
  </group>
);

export const Car: React.FC<{ spin: number; brake: number; speed: number }> = ({ spin, brake }) => (
  <group>
    {/* floor and plank */}
    <mesh position={[0, 0.05, -0.02]}><boxGeometry args={[0.52, 0.02, 1.28]} /><meshStandardMaterial color={CARBON} roughness={0.6} /></mesh>
    {/* monocoque + nose */}
    <mesh position={[0, 0.13, 0.12]}><boxGeometry args={[0.2, 0.13, 0.62]} /><meshStandardMaterial color={RED} roughness={0.35} metalness={0.2} /></mesh>
    <mesh position={[0, 0.11, 0.55]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.035, 0.08, 0.32, 16]} /><meshStandardMaterial color={RED} roughness={0.35} /></mesh>
    {/* sidepods */}
    <mesh position={[0, 0.12, -0.08]}><boxGeometry args={[0.46, 0.11, 0.42]} /><meshStandardMaterial color={BLACK} roughness={0.4} /></mesh>
    <mesh position={[0.235, 0.125, -0.08]}><boxGeometry args={[0.012, 0.09, 0.4]} /><meshStandardMaterial color={RED} emissive={RED} emissiveIntensity={0.25} /></mesh>
    <mesh position={[-0.235, 0.125, -0.08]}><boxGeometry args={[0.012, 0.09, 0.4]} /><meshStandardMaterial color={RED} emissive={RED} emissiveIntensity={0.25} /></mesh>
    {/* engine cover + airbox */}
    <mesh position={[0, 0.2, -0.33]}><boxGeometry args={[0.16, 0.16, 0.5]} /><meshStandardMaterial color={RED} roughness={0.35} /></mesh>
    <mesh position={[0, 0.3, -0.06]}><boxGeometry args={[0.1, 0.12, 0.14]} /><meshStandardMaterial color={BLACK} /></mesh>
    {/* cockpit, helmet, halo */}
    <mesh position={[0, 0.2, 0.18]}><boxGeometry args={[0.14, 0.04, 0.2]} /><meshStandardMaterial color="#050506" /></mesh>
    <mesh position={[0, 0.25, 0.16]}><sphereGeometry args={[0.055, 16, 12]} /><meshStandardMaterial color={AMBER} roughness={0.3} /></mesh>
    <mesh position={[0, 0.27, 0.16]} rotation={[0, Math.PI / 2, 0]}><torusGeometry args={[0.1, 0.012, 8, 24, Math.PI]} /><meshStandardMaterial color="#2A2D33" metalness={0.7} roughness={0.3} /></mesh>
    {/* front wing */}
    <mesh position={[0, 0.045, 0.66]}><boxGeometry args={[0.6, 0.018, 0.14]} /><meshStandardMaterial color={BLACK} /></mesh>
    <mesh position={[0, 0.07, 0.63]}><boxGeometry args={[0.56, 0.012, 0.06]} /><meshStandardMaterial color={RED} emissive={RED} emissiveIntensity={0.2} /></mesh>
    {[-0.3, 0.3].map((x) => <mesh key={x} position={[x, 0.07, 0.65]}><boxGeometry args={[0.012, 0.07, 0.16]} /><meshStandardMaterial color={BLACK} /></mesh>)}
    {/* rear wing + endplates + rain light */}
    <mesh position={[0, 0.34, -0.62]}><boxGeometry args={[0.44, 0.02, 0.1]} /><meshStandardMaterial color={BLACK} /></mesh>
    <mesh position={[0, 0.39, -0.63]}><boxGeometry args={[0.44, 0.014, 0.07]} /><meshStandardMaterial color={RED} emissive={RED} emissiveIntensity={0.3} /></mesh>
    {[-0.225, 0.225].map((x) => <mesh key={x} position={[x, 0.3, -0.62]}><boxGeometry args={[0.012, 0.2, 0.16]} /><meshStandardMaterial color={BLACK} /></mesh>)}
    <mesh position={[0, 0.17, -0.7]}><boxGeometry args={[0.05, 0.03, 0.01]} /><meshStandardMaterial color="#FF2020" emissive="#FF2020" emissiveIntensity={1.5 + 2 * brake} /></mesh>
    {/* wheels: front glow when braking */}
    <Wheel p={[0.31, 0.1, 0.42]} r={0.1} w={0.11} spin={spin} glow={brake} />
    <Wheel p={[-0.31, 0.1, 0.42]} r={0.1} w={0.11} spin={spin} glow={brake} />
    <Wheel p={[0.31, 0.11, -0.42]} r={0.11} w={0.14} spin={spin} glow={0} />
    <Wheel p={[-0.31, 0.11, -0.42]} r={0.11} w={0.14} spin={spin} glow={0} />
  </group>
);
