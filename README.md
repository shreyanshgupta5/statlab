# Stat Lab

A mobile web app for the 2026 season: standings, schedule, race results, news, and head-to-head driver duels with qualifying telemetry. Installable as an app on phones (PWA) and usable offline.

Unofficial fan project. Data: OpenF1.

## Files

| File | What it is |
|---|---|
| `index.html` | Page shell: header, bottom tabs, loads everything else |
| `styles.css` | All styling |
| `app.js` | Router and views |
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
