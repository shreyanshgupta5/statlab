# Voiceover: "Who wins Vegas?" (110 s, 2026 data only)

Same script for 16:9 and 9:16. Confident, slightly playful; about 2.5 words a second. Start each block when its chapter label appears.

| Time | Chapter | Voiceover |
|---|---|---|
| 0:00 – 0:08 | Hook | "Night race. November. Desert air. Vegas should be the coldest track of the season. So who's actually fast in the cold?" |
| 0:08 – 0:30 | The problem (4 beats) | "F1 tyres need heat to grip, around a hundred degrees. That heat comes from braking and from the load through corners. But Vegas takes it straight back out: long straights, cold night air. So when the next corner arrives, the tyres are cold, and a cold tyre doesn't grip. It slides." |
| 0:30 – 0:56 | Evidence 1 · cold races | "Here are the four coldest dry races of 2026. Montréal, Shanghai, Spa, Suzuka. Mercedes took pole in all four, and Antonelli won every single one. And on race pace, Mercedes was the fastest team in all four. Red Bull and McLaren? They lose the most when the temperature drops." |
| 0:56 – 1:12 | Evidence 2 · Vegas-type tracks | "Now the tracks that look most like Vegas: Monza and Baku. Long straights, low downforce. Mercedes won both. Antonelli from nineteenth on the grid at Monza, Russell from pole in Baku." |
| 1:12 – 1:28 | The twist | "But there's a problem. Max Verstappen is on fire: a hundred and eight points from the last five races, more than anyone. The catch? All three wins came in hot or wet races. And the cold is exactly where Red Bull is weakest." |
| 1:28 – 1:50 | The verdict | "So we built a model, using only 2026 races: cold races count forty-five percent, Vegas-type tracks thirty, recent form twenty, the season five. Antonelli comes out on top, at thirty-seven percent. Verstappen is the main threat, at sixteen. Then it's wide open: Russell, Leclerc and Hamilton, all around eleven. Who's your pick? Drop it in the comments, and follow for more F1, explained." |

## Facts behind each line (all 2026, OpenF1)

- Coldest dry races, by median race track temperature (readings from minute 4; São Paulo and Zandvoort left out as wet): Montréal 17.9°C, Shanghai 22.2°C, Spa 30.6°C, Suzuka 34.0°C. Poles: Russell, Antonelli, Antonelli, Antonelli. Winners: Antonelli in all four.
- Race pace = each team's fastest median clean lap (no lap 1, no pit laps, within 107% of the driver's median), as a gap to the fastest team. Cold races vs other dry races: Mercedes 0.00% vs 0.21%, Ferrari 0.46% vs 0.29%, McLaren 0.97% vs 0.65%, Red Bull 0.95% vs 0.51%.
- Monza: Antonelli won from P19 on the grid. Baku: Russell won from pole.
- Last five races (Kuala Lumpur, Singapore, Austin, Mexico City, São Paulo): Verstappen 108 points, Antonelli 83, Leclerc 64, Norris 59, Hamilton 55, Russell 26. Verstappen's wins: Kuala Lumpur (wet), Singapore (42.6°C), Mexico City (42.2°C).
- Model (predict/model_2026.py): points per race, weighted cold 45%, Monza + Baku 30%, last five 20%, season 5%; chance = score squared as a share of the grid. Antonelli 37%, Verstappen 16%, Russell 11%, Leclerc 11%, Hamilton 11%, Norris 4%, others 9%.
- The problem chapter is an illustration (no public tyre-temperature data). Its lap strip is the shape of a Vegas lap (2024 pole-lap telemetry), shown without numbers.
