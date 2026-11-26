# F1 StatLab videos and content — notes for Claude

This `content` branch holds the Instagram content for @F1STATLAB: reels, carousels, explainers and the video toolkit.
The ONE F1 app is on the `app-v2` branch and is worked on in a separate session.

## Tools
- `.claude/skills/`: 120 video and motion skills (HyperFrames, FFmpeg, motion graphics, the iart-ai packs, Three.js, Higgsfield…). Index: `content/video-skills.md`.
- **HyperFrames** (HTML → video) is the main engine. Run the CLI as `node .claude/skills/hyperframes/scripts/plugin-cli.mjs <command>`
  from inside a project folder, with `DO_NOT_TRACK=1 HYPERFRAMES_NO_TELEMETRY=1` (usage tracking stays off; skip the usage-note beacon).
  The jsdelivr CDN is blocked, so projects load GSAP from `assets/vendor/gsap.min.js` (npm `gsap@3.15.0`).
- `bash tools/install_video_tools.sh`: yt-dlp, Whisper, and two unlicensed skills, per session. Whisper models and Hugging Face are blocked here, so there is no transcription.
- Higgsfield needs its CLI (`curl … install.sh | sh`) and `higgsfield auth login` on the user's machine.
- Renders are slow on this machine (about 25 min for a 3-minute 1080×1920 film). Run them in the background. Keep `*-scratch.mp4` masters
  out of git; commit only a compressed `*-preview.mp4` (CRF 28 for films with moving textures).

## Projects
- `content/alonso/`: **"The champion who should have won five"** — Fernando Alonso documentary reel, 2:54, illustrated data style
  (inspired by Dugout's Kohli reel). Script and checked facts: `SCRIPT.md` (v2). Build: `python3 build_film2.py` → `film/`, then render.
  Current: `film/renders/alonso-v3-preview.mp4` (driver portraits, halftone photos, motion, word-lit captions), timed at an estimated pace.
  **Waiting on the user:** the voiceover recording (via Google Drive) → retime with `python3 build_film2.py --vo vo.json`
  (one `[start, end]` per script word); music; checking the facts marked † in SCRIPT.md. Photo credits for the caption: `photos/credits.json`.
- `content/vegas-reel/`: Vegas animatic (hook "under 1 second" + the real OpenF1 last-lap replay). Plan for the full 50 s reel was agreed.
- `content/vegas-race-recap/`: earlier Vegas storyboard stills and story frames.
- `content/faces/`: cartoon driver portraits for the app: spec + style prompt (`PORTRAITS.md`); the user generates them (Higgsfield or an illustrator).
- `content/explained/closeness/`: why races are close (closeness framework analysis).
- Older carousels and reels: brazil-*, vegas-preview-carousel, driver-quiz-reel, guess-the-driver, points-race, covers.

## Sources and rules
- Data: OpenF1 (api.openf1.org) for telemetry and positions, Jolpica (api.jolpi.ca) for results history. Check every number against the data.
- Photos: only openly licensed (CC BY / BY-SA / CC0), found via Openverse (api.openverse.org). Wikimedia images download from
  upload.wikimedia.org at standard thumbnail widths (500/960/1280) and rate-limit hard: fetch slowly in the background (`content/faces/fetch.py`).
  Keep a credits file per project and put credits in the Instagram caption. No photos of TV screens or broadcast footage.
- No AI-generated likenesses of real drivers unless the user asks (they chose cartoon portraits for the app, generated on their side).
- Never include the user's identity in requests to outside services. Wikipedia, Reddit and most news sites are blocked here.
