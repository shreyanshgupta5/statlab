# How Alonso could have been a 5-time champion

Illustrated data documentary (Dugout style, with helmets instead of faces). The script and checked facts are in `SCRIPT.md`, and the race data (Jolpica) is in `data/`.

- `python3 build_film2.py` builds the current film (script v3, 2:40): from the 2001 Minardi debut to Ferrari 2012, then a straight cut to 2026 and Adrian Newey. Every beat opens on a photo; 2005 and 2006 get head-to-head stat cards (wins, fastest laps, podiums, points) and a wins-per-season strip.
- `python3 build_film.py` builds v1, the near-misses only, and the HyperFrames project in `film/` (scenes, captions, sound effects).
- `python3 build_film.py --vo vo.json` retimes everything to a recorded voiceover. `vo.json` is `{"words": [[start, end], ...]}`, one entry per script word.
- Preview render: `film/renders/alonso-v5-preview.mp4` (v1–v4 kept for comparison). It is timed to the script read at an estimated pace, with no voiceover or music yet.
