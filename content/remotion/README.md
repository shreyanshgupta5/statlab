# ONE F1 · Remotion

Videos written as React components and rendered to MP4 with [Remotion](https://www.remotion.dev).

```bash
cd content/remotion
npm install                 # first time only
npm run studio              # live preview in the browser (scrub, tweak props)
npm test                    # renders the HelloOneF1 test to out/hello-onef1.mp4
npx remotion render src/index.ts <CompositionId> out/<file>.mp4
```

- Compositions (one per video) are registered in `src/Root.tsx`.
- `remotion.config.ts` points Remotion at the Chromium already installed in the cloud session. On your own computer, delete that line and Remotion downloads its own browser.
- Licence: Remotion is free for individuals and companies of up to 3 people; larger companies need a company licence (see remotion.dev/license).

## Who wins Vegas?

Two compositions: `WhoWinsVegasVertical` (1080×1920) and `WhoWinsVegasWide` (1920×1080), 110 s.

```bash
npx remotion render src/index.ts WhoWinsVegasVertical out/who-wins-vegas-9x16.mp4
npx remotion render src/index.ts WhoWinsVegasWide out/who-wins-vegas-16x9.mp4
```

- Remotion runs the timeline: one `<Sequence>` per chapter, the camera move between chapters, the text column, snow, progress bar and audio (`src/vegas/WhoWinsVegas.tsx`).
- The chapter drawings and their animations come from the approved explainer (`../explained/who-wins-template.html`). After changing that, run `python3 ../explained/build-who-wins.py && python3 scripts/sync_vegas.py`.
- **Voiceover and music:** drop the files into `public/` and set `voiceover` / `music` (and `musicVolume`, default 0.25) in `src/Root.tsx` or in the Studio props panel.

## VegasLap3D — one lap of Las Vegas in 3D (1920×1080)

Russell's 2024 Las Vegas pole lap (1:32.312), real OpenF1 telemetry, on a 3D track built from the car's own
position data. Live speed / gear / throttle / brake / RPM, a speed-coloured trace laid behind the car,
x3 slow motion through each of the 6 braking zones, cards for each zone and straight, mini-map, outro stats.

```bash
python3 scripts/fetch_vegas_lap3d.py          # refresh src/track3d/lap.json
npx remotion render src/index.ts VegasLap3D out/vegas-lap-3d-16x9.mp4 --concurrency=4
```

Uses software WebGL (`swangle`) so it renders without a GPU — about 1 s per frame on 4 cores.
Files: `src/track3d/lapData.ts` (geometry, zones, straights, video clock), `Scene.tsx` (world + camera director),
`Car.tsx` (generic car, ONE F1 colours), `VegasLap3D.tsx` (HUD).
