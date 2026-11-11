# ONE F1 (formerly Stat Lab)

A mobile web app for the 2026 season: standings, schedule, race results, news, and head-to-head driver duels with qualifying telemetry. Installable as an app on phones (PWA) and usable offline.

Unofficial fan project. Data: OpenF1.

## Files

| File | What it is |
|---|---|
| `index.html` | Page shell: header, bottom tabs, loads everything else |
| `styles.css` | All styling |
| `app.js` | Router and views |
| `play.js` | Play tab: Lights Out, Higher or Lower, Guess the Track, Podium Predictor; XP, 10 levels with unlocks (games, helmets, Pro mode), badges, rivals. Friend play works through challenge links (`#/play/<game>/c/<seed>-<score>-<name>`) that replay the same seed. Progress lives in `localStorage` on the device. |
| `data.js` | Season data (generated, do not edit by hand) |
| `manifest.webmanifest`, `icons/` | App name and icons for "Add to Home Screen" |
| `sw.js` | Service worker: offline support and caching |
| `tools/build_data.py` | Rebuilds `data.js` from Stat Lab's `season.js` and `news.js` |

## Run locally

```bash
python3 -m http.server 8080
```

Then open http://localhost:8080.

## Update the data

Put Stat Lab's `season.js` and `news.js` in a `site/` folder (it is git-ignored), or point `STATLAB_SITE` at wherever they live, then:

```bash
python3 tools/build_data.py
```

Commit and push `data.js`. GitHub Pages redeploys in about a minute, and installed apps fetch the new data next time they open.

If you change `styles.css` or `app.js`, also bump `VERSION` in `sw.js` (for example `statlab-v2`) so installed apps pick up the new files.

## Deploy on GitHub Pages

Repository **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main`, folder `/ (root)` → Save.**
The site appears at `https://<your-username>.github.io/<repo-name>/`.

## After each race

```bash
python3 tools/add_round.py 21 path/to/race_results.csv --short LVG --location "Las Vegas"   # adds the round to data.js
python3 tools/build_previews.py                                                             # refreshes previews.js for the races still to come
```

`add_round.py` takes the race order from a curated results CSV and Q1–Q3 times from OpenF1. `build_previews.py` writes the race preview pages (track layout from OpenF1, past winners and each current driver's record at the venue from Jolpica). When you change `app.js` or `styles.css`, bump `VERSION` in `sw.js` and `APP_VERSION` in `app.js` so installed apps update.
python3 tools/build_duels.py                                                                # adds Duel telemetry (track map, speed trace, corners) for new rounds to duels.js

## Play tab

No server is needed. Each game is built from a random seed; a challenge link carries the seed and the sender's score, so the friend gets identical lights, questions or circuits. Podium Predictor picks lock at `raceStart` and are scored the next time the player opens Play after that round's results are in `data.js`. Real-time head-to-head or leaderboards across phones would need a backend (e.g. Firebase or Supabase).

## Race data freshness

The Season page shows `SEASON.DATA_UPDATED_AT` in the visitor's timezone. `tools/build_data.py` and `tools/add_round.py` stamp it in UTC when writing race data; news-only updates leave it unchanged. The initial timestamp comes from the last Git commit that changed `data.js`, since older data did not record an update time.
