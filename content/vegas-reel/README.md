# Las Vegas GP reel: animatic (storylines 0 and 5)

18.8 s, 1080×1920, 30 fps: `animatic/renders/vegas-animatic.mp4`.

1. **Hook (0–4.6 s):** "Under 1 second. Every lap." The P1–P2 gap for all 50 laps, then the closest: 0.030 s on lap 8. 43 of 43 green-flag laps under 1 s.
2. **The last straight (4.6–18.8 s):** a real replay at 3× speed of the run from the last chicane to Turn 1, lap 49 to 50. Cars are placed from OpenF1 location data, speeds come from OpenF1 car data, and the position tower uses the official timing feed. Flat out, Antonelli was 36 km/h slower than Piastri. He went from P2 to P4.

Rebuild: `python3 build_replay.py && python3 build_animatic.py`, then render with HyperFrames (`.claude/skills/hyperframes`).
Raw OpenF1 data is in `data/` (session 11420). Sound effects are CC0, from the sound-effects skill. There is no music yet.
