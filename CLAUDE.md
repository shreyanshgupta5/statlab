# ONE F1 / StatLab app — notes for Claude

This branch (`app-v2`) is the ONE F1 progressive web app, live at https://shreyanshgupta5.github.io/statlab/
(GitHub Pages serves `main`). Video and Instagram content live on the `content` branch and are worked on in a separate session.

## Ship a change
1. Bump `APP_VERSION` in `app.js` (e.g. `"v66"` → `"v67"`) and `VERSION` in `sw.js` (`"statlab-v66"` → `"statlab-v67"`) together.
   Read the file before writing it: `open(f,'w').write(open(f).read()...)` empties the file (it did to sw.js in v70–v71).
2. Check in a browser at phone size with Playwright (390×844): no page errors. Set `localStorage onef1.welcomed.v1 = "1"` and
   `sessionStorage onef1-splash = "1"` to skip the welcome guide and the intro.
3. Commit, then deploy: `git push -q origin app-v2 && git push -q origin app-v2:main`.
4. Give the user the link above. They want the updated link after each change.
Never add a workflow that pushes to `main` automatically.

## Map
- `index.html`: shell, intro splash (logo on app black, then it lands in the header), header with the Guide button, glass tab bar.
- Tabs (v80): Home `#/`, Weekend `#/weekend`, Season `#/season` (was Lab; `#/lab` still works), Play `#/play`, Archive `#/archive`.
- Archive (`viewArchive`, `archiveStories`): every season 1950–last year as a story circle (champion, title fight, constructors,
  winners) plus all-time record stories, played in the home story viewer. Data: archive.js from `tools/build_archive.py` (Jolpica).
- `app.js`: everything else (routes `#/`, `#/weekend`, `#/play`, `#/season`, `#/news/ID` (articles, no tab), `#/race/N`, `#/driver/ID`, `#/welcome`, …).
  - `helmet(id, opts)` draws every driver image. It shows a cartoon portrait when `portraits.js` lists one, else the helmet (`helmetSVG`).
  - Home (v81): stories row, Up next (`upNext`: next session, countdown, weekend chips), latest session (`latestSession` from season data,
    replaced live by `WEEKEND.homeLast` when a newer session's OpenF1 data exists), Latest updates (`latestUpdates`, newest NEWS), following, standings.
  - Race preview: weekend schedule (`weekendSchedule`). Race analysis: `raceInsights`. Season tab (v79): filter Season / R1…Rn (`#/season`, `#/season/r/N`), sections Race pace · Quali pace · Tyres · Results ·
    Development, each opening with a chart (`overallSections`, `roundSections`, `hbars`, `lineChart`); numbers come last.
- `weekend.js`: the Weekend tab (replaced News in v74). Reads OpenF1 live in the browser (CORS open, queued ~0.65s apart
  because the free API rate-limits), analyses each finished session (timesheet, long runs, ideal laps, speed trap, teams, tyres,
  flags; quali results + team-mate gaps; race result, strategy, pit stops) and caches finished sessions in localStorage.
  One page (v75): stat tiles, then race / qualifying as they happen, then all practice sessions side by side (no prose).
  `#/weekend/m<meeting_key>` opens any past weekend (handy for testing; Qatar 2025 = m1275). practice.js is the offline fallback.
- `stories.js`: hand-written "burning" stories (label, date, cover, slides). New `id` = shows as unseen again.
- `portraits.js` + `portraits/`: cartoon driver portraits (spec and style prompt: `content/faces/PORTRAITS.md` on the `content` branch).
- `styles.css`: tokens (`--bg #0E0F12`, `--card`, `--fg`, `--red`) and versioned blocks appended at the end.
- `sw.js`: offline cache (CORE list) and network-first for the data files. Add any new JS file to both lists.
- Data files are generated: `data.js` (season + news), `racedetail.js`, `lab.js`, `duels.js`, `previews.js`, `analysis.js`, `practice.js`, `pace.js`, `archive.js`.
- Stories row: sorted newest first. Hand stories in `stories.js` (themes: next GP, contracts, rule changes, last-race fallout);
  `round: N` replaces the automatic next-race story, `news: [id prefixes]` hides news items a story already covers.

## Data tools (`tools/`)
- `build_data.py` (needs the Stat Lab season source), then `add_schedule.py` (session times from OpenF1) and `add_quali.py`.
- `build_race_detail.py`, `build_lab.py`, `build_duels.py`, `news_images.py` (news-site hosts are blocked here).
- `build_analysis.py 22 23`: race-weekend analysis from past editions (strategy, safety cars, temps) for the preview page.
- `build_practice.py 22`: practice best laps and long-run pace for a weekend (rerun after each session).
- `build_pace.py [round]`: race pace (median clean lap) and tyre wear (stint slope vs the field) per race → pace.js (Season tab).
- `build_archive.py [year]`: past seasons for the Archive tab (slow: ~20 s per season, saves as it goes; add each new season once it ends).
- `add_news.py stories.json`: add news items (optional `short` = 2-line story label).
- APIs that work from the cloud environment: api.openf1.org, api.jolpi.ca, api.openverse.org.

## Rules the user set
- Stay on brand: app black background, Chakra Petch numbers, Archivo italic display, team colours. Keep it minimal and number-led.
- One number font everywhere (v78): every number uses Chakra Petch (`var(--num)`), as on the home result card. Give new numeric
  elements the `mono` or `num` class (the v78 block in styles.css forces Chakra on them). JetBrains Mono only for small uppercase labels.
- Never include the user's identity in requests to outside services.
- Wikipedia/Commons pages, Reddit and most news sites are blocked in the cloud environment.
