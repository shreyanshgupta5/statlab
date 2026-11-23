# Why are some races close? A framework

Run after each race: `python3 fetch_laps.py && python3 analyse.py` (uses the app's data.js, racedetail.js, duels.js, lab.js,
so run the app's build_race_detail.py / build_lab.py for the new round first). Output: `closeness.json` and a table.

## Measures
| | What | How |
|---|---|---|
| **Closeness** | within1 | share of green-flag laps with P1–P2 inside 1 s |
| | passes | on-track overtakes per lap after lap 1 |
| **Causes** | flat | share of the pole lap above 290 km/h (long straights) |
| | deg | tyre degradation, median lap-time slope in clean stints (s/lap; negative = fuel burn beats tyre wear) |
| | track | track temperature at the start |
| | spread | qualifying gap fastest → 4th-fastest team |
| | sc | safety-car / VSC laps (bunching) |
| | tow | speed-trap gain when <1 s behind vs >2.5 s (slipstream) |

## 2026 so far (21 races, Spearman rank correlation)
- **Straights (flat): strongest link.** ρ ≈ 0.6 with laps-within-1s and 0.64–0.75 with passes. Monza (0.55 of the lap flat out)
  and Las Vegas (0.47) are the two most open tracks and the two closest, most passing races.
- **Low tyre degradation: second.** ρ ≈ −0.5 with passes. Las Vegas had the lowest degradation of the year (−0.067 s/lap)
  on a 14 °C track: tyres never fell away, so the chasing car could sit in dirty air without overheating them.
  Hot, high-wear races (Barcelona, Austria, Hungary, 50 °C+) were processions.
- **Safety cars** add passing (ρ 0.3–0.4) by bunching the field, but don't keep the leaders close.
- **Car parity** among the top four teams: weak link (ρ ≈ −0.1).
- **Slipstream as measured at the speed trap: no link** (ρ ≈ 0). In Vegas cars within 1 s were *not* faster at the trap.
  Likely why: in 2026 straight-line speed is limited by battery energy (Overtake Mode / deployment), not drag alone,
  so the tow shows up as energy saved and a pass later in the straight, not a higher trap speed. Needs GPS-position
  overtake locations or car_data to measure properly.

**Las Vegas = long straights + lowest tyre wear (cold track) + 7 safety-car laps.** Monza had the straights but a hot track
and no safety car; Canada had a cold track but fewer straights. Vegas is the only race with all three.
