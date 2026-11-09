# Stat Lab content

Social content made for the 2026 season, with the source to rebuild or remake each piece.
Nothing in this folder is part of the app; it lives on the `content` branch so it never goes live on GitHub Pages.

Requirements for rebuilding: Python 3, Node with Playwright (`npm i playwright`), ffmpeg. Fonts load from Google Fonts, so exports need internet access.

## Finished files

| File | What it is |
|---|---|
| `videos/battle-for-p2.mp4` | Battle for P2 points race, 1080×1920, 29.5 s, chiptune soundtrack |
| `videos/sao-paulo-gp-recap-v2.mp4` | São Paulo GP race recap reel, 1080×1920, 85 s, event cards + cartoon reactions |
| `videos/max-interlagos-fx-preview-0-48.mp4` | Motion + sound pass on "Max × Interlagos", first 48 s (preview) |
| `brazil-race-recap/statlab-interlagos-recap-cover.png` | Reel cover, 1080×1920 (`-grid.png` = the 1080×1440 profile-grid crop) |
| `covers/out/statlab-cover-*.png` | Reel covers in one shared design for all five reels, 1080×1920 (`-grid.png` = the 1080×1440 profile-grid crop) |
| `brazil-quali-carousel/slides/*.png` | São Paulo qualifying carousel, 5 slides, 1080×1350 |
| `data/brazil_2026_race_results.csv` | Full São Paulo GP classification: grid, places gained, tyres, stops, best lap, penalties |
| `data/drivers_standings_after_r20.csv` | Top 8 after round 20 (official totals before the race + Brazil points) |
| `data/verstappen-brazil-csvs.zip` | Verstappen at Interlagos 2015–2025, lap by lap (from `statlab-data`) |
| `data/brazil-data.zip` | Interlagos history 2021–2025 + 2026 FP1/FP2 (from `statlab-data`) |

## Rebuilding

Each folder has a template, a script and a data file; a small Python build joins them into one page. Run builds from inside the folder.

**Points race** (`points-race/`)
```bash
cd points-race && python3 build-race.py          # -> points-race.html + points-race.local.html
node export/render-soundtrack.js soundtrack.wav  # offline-rendered music
node export/record-video.js battle.mp4 soundtrack.wav
```
Change the battle, look or timing in `points-race.js` (`PRESETS`, `setLook`, `STEP`). Music and game sounds are in `race-audio.js`. `race-data.json` comes from the app's `data.js` (Grand Prix points per round, race results, championship positions).

**Race recap reel** (`brazil-race-recap/`)
```bash
cd brazil-race-recap && python3 build.py         # -> recap.html + recap.local.html
node export-video.js recap.mp4 recap.wav         # renders soundtrack, then the video
node export-cover.js                             # cover PNG
```
Events, reactions and pacing (`HOLD`, `PER_LAP`, `SLOW_LAP`) are at the top of `recap.js`. `recap-order.json` is the running order at the end of every lap, built from OpenF1 session 11412 (`position` and `laps` endpoints).

**Qualifying carousel** (`brazil-quali-carousel/`)
```bash
node brazil-quali-carousel/export-slides.js      # -> slides/statlab-brazil-quali-1..5.png
```
Numbers are written into `brazil-carousel.html`. Note: slides 2–3 show the grid as known on Saturday night (only Russell's penalty); the race-day grid had Hamilton 20th, Verstappen 21st, Leclerc 14th.

**Reel covers** (`covers/`)
```bash
node covers/export-covers.js                     # -> covers/out/statlab-cover-<id>.png + -grid.png
```
All covers share one template in `covers.html`: brand tag, LED kicker, title (auto-fits), hero number, one data panel, format tag. Add a cover by copying a `.cover` block. Mexico sector times and the champion ages are typed in by hand; the 2016 position trace comes from `data/verstappen-brazil-csvs.zip`.

**Video motion/sound pass** (`interlagos-video-fx/tools/`)
`cues.py` holds the timeline found by frame analysis (`onsets.py`, `reveals.py`). `sfx.py` synthesises the sound effects, `render.py` does the motion pass and mix:
```bash
python3 tools/sfx.py tools sfx.wav
python3 tools/render.py tools input.mp4 sfx.wav out.mp4 [start end]
```

## Notes
- All music, sound effects and voices are synthesised in code. No samples, so no licensing issues.
- Data: OpenF1 (timing, positions, race control, weather) and Jolpica (past results). Unofficial fan project.
- São Paulo recap: Leclerc crossed the line 7th but is classified 8th; the steward decision was not in the timing feed, so the reel says "after review". Some incidents were still under investigation when it was made.
