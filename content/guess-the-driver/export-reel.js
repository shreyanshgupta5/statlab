// Renders guess-the-driver.html to a 1080x1920 30 fps MP4 with its synthesised soundtrack, plus a cover frame.
//   node guess-the-driver/export-reel.js out.mp4 out.wav
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const fs = require('fs'); const path = require('path');
const [OUT, WAV] = process.argv.slice(2); const FPS = 30;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await p.goto('file://' + path.resolve(__dirname, 'guess-the-driver.html'));
  await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(600);
  if (process.env.SFX_ONLY) await p.evaluate(() => { window.reel.sfxOnly = true; });   // SFX_ONLY=1: effects without music
  const wav = await p.evaluate(async () => {
    const buf = await window.reel.renderSoundtrack(48000), L = buf.getChannelData(0), R = buf.getChannelData(1), n = L.length;
    const out = new DataView(new ArrayBuffer(44 + n * 4)), w = (o, s) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
    w(0, 'RIFF'); out.setUint32(4, 36 + n * 4, true); w(8, 'WAVEfmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 2, true);
    out.setUint32(24, 48000, true); out.setUint32(28, 192000, true); out.setUint16(32, 4, true); out.setUint16(34, 16, true); w(36, 'data'); out.setUint32(40, n * 4, true);
    for (let i = 0; i < n; i++) { out.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true); out.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true); }
    const bytes = new Uint8Array(out.buffer); let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s);
  });
  fs.writeFileSync(WAV, Buffer.from(wav, 'base64'));
  const dur = await p.evaluate(() => window.reel.DURATION);
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-i', WAV,
    '-vf', 'format=yuv420p', '-af', 'alimiter=limit=0.89,loudnorm=I=-14:TP=-1.5:LRA=9',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', '-shortest', OUT], { stdio: ['pipe', 'inherit', 'inherit'] });
  const n = Math.round(dur * FPS);
  for (let i = 0; i < n; i++) {
    await p.evaluate((x) => new Promise((r) => { window.reel.seek(x); requestAnimationFrame(() => requestAnimationFrame(r)); }), i / FPS);
    const jpg = await p.screenshot({ type: 'jpeg', quality: 92 });
    if (!ff.stdin.write(jpg)) await new Promise((r) => ff.stdin.once('drain', r));
    if (i % 300 === 0) console.log('  frame', i, '/', n);
  }
  ff.stdin.end(); await new Promise((r) => ff.on('close', r));
  // cover: see export-cover.js
  await b.close(); console.log('done', OUT, dur + 's');
})();
