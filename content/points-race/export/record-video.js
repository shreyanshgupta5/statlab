// Records the race page to frames (30 fps, 1080x1920) and pipes them into ffmpeg with the offline-rendered soundtrack.
const { chromium } = require('playwright'); const { spawn } = require('child_process');
const [OUT, WAV] = process.argv.slice(2); const FPS = 30;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1500, height: 1952 }, deviceScaleFactor: 1 });
  await p.goto('file://' + require("path").resolve(__dirname, "../points-race.local.html"));
  await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(800);
  const dur = await p.evaluate(() => { window.statlabRace.setLook('led'); window.statlabRace.seek(0); return window.statlabRace.DURATION; });
  const box = await (await p.$('.stage')).boundingBox(); console.log('stage', box.width, box.height);
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-i', WAV,
    '-vf', 'scale=1080:1920:flags=lanczos,format=yuv420p', '-af', 'alimiter=limit=0.89,loudnorm=I=-14:TP=-1.5:LRA=9',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', '-shortest', OUT], { stdio: ['pipe', 'inherit', 'inherit'] });
  const n = Math.round(dur * FPS);
  for (let i = 0; i < n; i++) {
    await p.evaluate((x) => new Promise((r) => { window.statlabRace.seek(x); requestAnimationFrame(() => requestAnimationFrame(r)); }), i / FPS);
    const jpg = await p.screenshot({ type: 'jpeg', quality: 92, clip: box });
    if (!ff.stdin.write(jpg)) await new Promise((r) => ff.stdin.once('drain', r));
    if (i % 150 === 0) console.log('  frame', i, '/', n);
  }
  ff.stdin.end(); await new Promise((r) => ff.on('close', r)); await b.close(); console.log('done', OUT);
})();
