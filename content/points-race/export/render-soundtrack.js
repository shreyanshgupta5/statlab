const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + require("path").resolve(__dirname, "../points-race.local.html")); await p.waitForTimeout(1000);
  const res = await p.evaluate(async () => {
    const buf = await window.statlabRace.renderSoundtrack(48000);
    const L = buf.getChannelData(0), R = buf.getChannelData(1), n = L.length;
    let peak = 0; for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(L[i]));
    // 16-bit WAV
    const out = new DataView(new ArrayBuffer(44 + n * 4)); const w = (o, s) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
    w(0, 'RIFF'); out.setUint32(4, 36 + n * 4, true); w(8, 'WAVEfmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 2, true);
    out.setUint32(24, 48000, true); out.setUint32(28, 48000 * 4, true); out.setUint16(32, 4, true); out.setUint16(34, 16, true); w(36, 'data'); out.setUint32(40, n * 4, true);
    for (let i = 0; i < n; i++) { out.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true); out.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true); }
    const bytes = new Uint8Array(out.buffer); let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return { seconds: n / 48000, peak, wav: btoa(s), dur: window.statlabRace.DURATION };
  });
  fs.writeFileSync(process.argv[2], Buffer.from(res.wav, 'base64'));
  console.log('length', res.seconds.toFixed(2), 's  race', res.dur.toFixed(2), 's  peak', res.peak.toFixed(3), ' errors', errs);
  await b.close();
})();
