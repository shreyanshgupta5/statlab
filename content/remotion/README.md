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
