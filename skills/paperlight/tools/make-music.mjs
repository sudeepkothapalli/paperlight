// A small, playful test score made entirely in code (plucks, soft bass, a tick) — used to test beat-synced cutting.
//   node tools/make-music.mjs out.wav [bpm] [seconds]
import fs from 'node:fs';
const [, , out = 'music.wav', bpmA = '104', durA = '60'] = process.argv;
const SR = 44100, bpm = +bpmA, dur = +durA, N = SR * dur, L = new Float32Array(N);
const beat = 60 / bpm, f = (m) => 440 * 2 ** ((m - 69) / 12);
const pluck = (t0, m, v, d = 0.6) => { const i0 = Math.floor(t0 * SR); for (let i = 0; i < SR * d && i0 + i < N; i++) { const t = i / SR; L[i0 + i] += v * Math.exp(-t * 6) * (Math.sin(2 * Math.PI * f(m) * t) + 0.3 * Math.sin(4 * Math.PI * f(m) * t)) * Math.min(1, t * 400); } };
const bass = (t0, m, v) => { const i0 = Math.floor(t0 * SR); for (let i = 0; i < SR * beat * 1.8 && i0 + i < N; i++) { const t = i / SR; L[i0 + i] += v * Math.exp(-t * 2.2) * Math.sin(2 * Math.PI * f(m) * t) * Math.min(1, t * 200); } };
const tick = (t0, v) => { const i0 = Math.floor(t0 * SR); for (let i = 0; i < SR * 0.03 && i0 + i < N; i++) L[i0 + i] += v * (Math.random() * 2 - 1) * Math.exp(-i / (SR * 0.004)); };
const motif = [[76, 79], [74, 77], [72, 76], [74, 71]], roots = [48, 45, 41, 43];
for (let b = 0, t = 0.25; t < dur - 1; b++, t += beat) {
  const bar = Math.floor(b / 4) % 4, pos = b % 4;
  if (pos === 0 || pos === 2) bass(t, roots[bar], 0.32);
  pluck(t, motif[bar][pos % 2], pos === 0 ? 0.24 : 0.16);
  if (b % 2 === 1) pluck(t + beat / 2, motif[bar][(pos + 1) % 2] + 12, 0.07, 0.3);
  tick(t + beat / 2, 0.05);
}
let peak = 0; for (const v of L) peak = Math.max(peak, Math.abs(v));
const buf = Buffer.alloc(44 + N * 2);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 2, 4); buf.write('WAVE', 8); buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(N * 2, 40);
for (let i = 0; i < N; i++) buf.writeInt16LE(Math.round((L[i] / peak) * 0.8 * 32767), 44 + i * 2);
fs.writeFileSync(out, buf); console.log(out, bpm, 'bpm');
