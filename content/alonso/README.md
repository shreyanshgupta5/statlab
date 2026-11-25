# How Alonso could have been a 5-time champion

Illustrated data documentary (Dugout style, with helmets instead of faces). The script and checked facts are in `SCRIPT.md`, and the race data (Jolpica) is in `data/`.

- `python3 build_film.py` builds the HyperFrames project in `film/` (scenes, captions, sound effects).
- `python3 build_film.py --vo vo.json` retimes everything to a recorded voiceover. `vo.json` is `{"words": [[start, end], ...]}`, one entry per script word.
- Preview render: `film/renders/alonso-v1-preview.mp4`. It is timed to the script read at an estimated pace, with no voiceover or music yet.
