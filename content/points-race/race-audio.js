/* ---------- sound: an original chiptune in the style of an 80s/90s arcade racer, made live with Web Audio ----------
   192 BPM, so one bar (4 beats x 0.3125 s) = 1.25 s = one round. The intro bar is the start-light countdown.
   Everything is scheduled against the race clock t, so music, scrubbing and video export stay in sync. */
const BEAT = STEP / 4, SIX = BEAT / 4;                     // a 16th note
const NOTE = (n) => { const m = n.match(/^([A-G])(#?)(\d)$/); const k = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] ? 1 : 0); return 440 * Math.pow(2, (k + 12 * (+m[3] + 1) - 69) / 12); };
// 8-bar loop in D major. Melody as "note:16ths", R = rest.
const MELODY = [
  "A4:2 D5:2 F#5:2 A5:4 F#5:2 E5:2 D5:2", "F#5:2 E5:2 D5:2 B4:4 D5:2 E5:4",
  "D5:2 F#5:2 G5:2 B5:6 A5:2 G5:2", "F#5:3 E5:3 C#5:2 E5:4 R:4",
  "A5:2 F#5:2 A5:2 D6:4 C#6:2 B5:2 A5:2", "C#6:2 A5:2 F#5:2 C#5:4 E5:2 F#5:4",
  "G5:2 F#5:2 E5:2 D5:2 B4:2 D5:2 G5:4", "A5:4 G5:2 F#5:2 E5:2 C#5:2 A4:4",
];
const CHORDS = [["D", "F#", "A", "C#"], ["B", "D", "F#", "A"], ["G", "B", "D", "F#"], ["A", "C#", "E", "G"],
                ["D", "F#", "A", "C#"], ["F#", "A", "C#", "E"], ["G", "B", "D", "F#"], ["A", "C#", "E", "G"]];
const BASS = ["D2", "B1", "G1", "A1", "D2", "F#1", "G1", "A1"];

let AC = null, master = null, bus = null, pulse25 = null, pulse12 = null, noiseBuf = null;
let soundOn = false, schedUpTo = 0, events = [];
function initAudio() {
  if (AC) return;
  AC = new (window.AudioContext || window.webkitAudioContext)();
  const comp = AC.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3; comp.connect(AC.destination);
  master = AC.createGain(); master.gain.value = 0.33; master.connect(comp);
  const pw = (d) => { const n = 64, re = new Float32Array(n), im = new Float32Array(n); for (let k = 1; k < n; k++) re[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * d); return AC.createPeriodicWave(re, im); };
  pulse25 = pw(0.25); pulse12 = pw(0.125);
  noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}
function newBus() { // a fresh output per play segment, so a scrub or pause can silence what was queued
  if (bus) { const old = bus; old.gain.setTargetAtTime(0, AC.currentTime, 0.02); setTimeout(() => old.disconnect(), 300); }
  bus = AC.createGain(); bus.connect(master);
}
/* instruments: each takes (when, duration, ...) in AudioContext seconds and the output node */
function tone(out, when, dur, f, wave, vol, slideTo) {
  const o = AC.createOscillator(), g = AC.createGain();
  if (typeof wave === "string") o.type = wave; else o.setPeriodicWave(wave);
  o.frequency.setValueAtTime(f, when); if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, when + dur);
  g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(vol, when + 0.005);
  g.gain.setValueAtTime(vol, when + Math.max(0.01, dur - 0.03)); g.gain.linearRampToValueAtTime(0, when + dur);
  o.connect(g).connect(out); o.start(when); o.stop(when + dur + 0.02);
}
function noise(out, when, dur, vol, hp) {
  const s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
  s.buffer = noiseBuf; f.type = "highpass"; f.frequency.value = hp;
  g.gain.setValueAtTime(vol, when); g.gain.exponentialRampToValueAtTime(0.001, when + dur);
  s.connect(f).connect(g).connect(out); s.start(when, Math.random() * 0.5); s.stop(when + dur + 0.02);
}
const kick = (out, w) => tone(out, w, 0.14, 150, "triangle", 0.9, 40);

/* the song as a list of {at (race seconds), play(when, out)} */
function buildSong() {
  const ev = [], add = (at, play) => ev.push({ at, play });
  // start lights: three short beeps then GO
  [0, 1, 2].forEach((b) => add(b * BEAT, (w, o) => tone(o, w, 0.12, 440, pulse25, 0.28)));
  add(3 * BEAT, (w, o) => tone(o, w, 0.32, 880, pulse25, 0.32));
  const bars = N + 1;                                      // music runs through the race and into the finish
  for (let b = 0; b < bars; b++) {
    const t0 = INTRO + b * STEP, k = b % 8, chord = CHORDS[k];
    // melody (from the second loop on, the first loop is just groove so the start feels like a build)
    let s = 0;
    if (b >= 4) MELODY[k].split(" ").forEach((tok) => { const [n, len] = tok.split(":"); const L = +len; if (n !== "R") { const f = NOTE(n); add(t0 + s * SIX, (w, o) => tone(o, w, L * SIX * 0.92, f, pulse25, 0.16)); } s += L; });
    // arpeggio: chord tones in 16ths
    for (let i = 0; i < 16; i++) { const n = chord[i % 4] + (i % 8 < 4 ? "4" : "5"); const f = NOTE(n); add(t0 + i * SIX, (w, o) => tone(o, w, SIX * 0.8, f, pulse12, b >= 4 ? 0.045 : 0.06)); }
    // bass: octave-bouncing 8ths
    for (let i = 0; i < 8; i++) { const f = NOTE(BASS[k]) * (i % 2 ? 2 : 1); add(t0 + i * 2 * SIX, (w, o) => tone(o, w, 2 * SIX * 0.85, f, "triangle", 0.42)); }
    // drums: kick 1 & 3, snare 2 & 4, hats on 8ths, a fill every 8th bar
    [0, 2].forEach((q) => add(t0 + q * BEAT, (w, o) => kick(o, w)));
    [1, 3].forEach((q) => add(t0 + q * BEAT, (w, o) => noise(o, w, 0.16, 0.32, 1200)));
    for (let i = 0; i < 8; i++) add(t0 + i * 2 * SIX, (w, o) => noise(o, w, 0.04, 0.09, 7000));
    if (k === 7) [12, 13, 14, 15].forEach((i) => add(t0 + i * SIX, (w, o) => noise(o, w, 0.08, 0.22, 1500)));
  }
  // victory fanfare on the finish card
  const end = INTRO + N * STEP;
  ["D5", "E5", "F#5", "A5"].forEach((n, i) => add(end + i * 2 * SIX, (w, o) => tone(o, w, 2 * SIX * 0.9, NOTE(n), pulse25, 0.22)));
  add(end + 8 * SIX, (w, o) => { ["D5", "F#5", "A5", "D6"].forEach((n) => tone(o, w, 1.6, NOTE(n), pulse25, 0.12)); tone(o, w, 1.6, NOTE("D3"), "triangle", 0.4); kick(o, w); noise(o, w, 1.2, 0.18, 4000); });
  // game sounds for the selected drivers: win = coin, DNF = fall, move up = arpeggio
  for (let j = 1; j <= N; j++) {
    const at = INTRO + (j - 1) * STEP;
    if (sel.some((id) => resAt(id, j) === 1)) add(at + 0.15, (w, o) => { tone(o, w, 0.07, NOTE("B5"), "square", 0.16); tone(o, w + 0.07, 0.25, NOTE("E6"), "square", 0.16); });
    if (sel.some((id) => resAt(id, j) === "DNF")) add(at + 0.15, (w, o) => tone(o, w, 0.45, 620, "square", 0.12, 110));
    if (moves.some((m) => m.j === j)) add(at + 0.5, (w, o) => ["C6", "E6", "G6", "C7"].forEach((n, i) => tone(o, w + i * 0.045, 0.06, NOTE(n), pulse12, 0.12)));
  }
  events = ev.sort((a, b) => a.at - b.at);
}
/* called every animation frame: queue anything due in the next ~150 ms of race time */
function pumpAudio(t, playing, speed) {
  if (!soundOn || !AC || !playing) return;
  const horizon = t + 0.15 * speed;
  for (const e of events) {
    if (e.at < schedUpTo) continue;
    if (e.at >= horizon) break;
    e.play(AC.currentTime + Math.max(0, (e.at - t) / speed), bus);
  }
  schedUpTo = horizon;
}
function resyncAudio(t) { if (AC && soundOn) { newBus(); schedUpTo = t; } }
function setSound(on) {
  if (on) { initAudio(); AC.resume(); newBus(); schedUpTo = window.__raceT || 0; }
  else if (AC) { newBus(); }
  soundOn = on;
  const b = document.getElementById("sound"); b.textContent = on ? "Sound on" : "Sound off"; b.setAttribute("aria-pressed", on);
}
/* render the whole soundtrack offline (for the video export): returns an AudioBuffer */
async function renderSoundtrack(sampleRate = 48000) {
  const OAC = new OfflineAudioContext(2, Math.ceil(DURATION * sampleRate), sampleRate);
  const saved = AC; AC = OAC;
  const comp = OAC.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3; comp.connect(OAC.destination);
  const m = OAC.createGain(); m.gain.value = 0.33; m.connect(comp);
  const pw = (d) => { const n = 64, re = new Float32Array(n), im = new Float32Array(n); for (let k = 1; k < n; k++) re[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * d); return OAC.createPeriodicWave(re, im); };
  const keep = [pulse25, pulse12, noiseBuf]; pulse25 = pw(0.25); pulse12 = pw(0.125);
  noiseBuf = OAC.createBuffer(1, sampleRate, sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  events.forEach((e) => e.play(e.at, m));
  const buf = await OAC.startRendering();
  [pulse25, pulse12, noiseBuf] = keep; AC = saved;
  return buf;
}
