// Beat detection for an imported music track, so cuts can land on the music.
// Onset strength from rising energy, tempo from autocorrelation, phase from the strongest beat grid.
// Results are cached next to the film.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { hashStr } from './math.js';

const SR = 11025, HOP = 256, WIN = 1024;

export function detectBeats(file, cacheDir) {
  const stat = fs.statSync(file);
  const key = hashStr(`${file}:${stat.size}:${stat.mtimeMs}:v2`).toString(16);
  const cf = cacheDir && path.join(cacheDir, `beats-${key}.json`);
  if (cf && fs.existsSync(cf)) return JSON.parse(fs.readFileSync(cf, 'utf8'));
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(`could not decode ${file}`);
  const x = new Float32Array(r.stdout.buffer, r.stdout.byteOffset, r.stdout.byteLength / 4);
  // onset envelope: half-wave-rectified rise of log energy, in short frames
  const n = Math.floor((x.length - WIN) / HOP), env = new Float32Array(n);
  let prev = 0;
  for (let i = 0; i < n; i++) {
    let e = 0; for (let j = 0; j < WIN; j++) { const v = x[i * HOP + j]; e += v * v; }
    const le = Math.log(1e-6 + e / WIN);
    env[i] = Math.max(0, le - prev); prev = le;
  }
  // smooth + normalise
  const mean = env.reduce((a, b) => a + b, 0) / n;
  for (let i = 0; i < n; i++) env[i] = Math.max(0, env[i] - mean);
  const fps = SR / HOP;
  // tempo: autocorrelation over 60–180 bpm, gently preferring ~110
  let best = 0, bestLag = 0;
  for (let bpm = 60; bpm <= 180; bpm += 0.5) {
    const lag = (60 / bpm) * fps;
    let s = 0;
    for (let i = 0; i + lag * 2 < n; i++) s += env[i] * (env[Math.round(i + lag)] + 0.5 * env[Math.round(i + 2 * lag)]);
    s *= Math.exp(-0.5 * Math.pow(Math.log2(bpm / 110) / 0.9, 2));
    if (s > best) { best = s; bestLag = lag; }
  }
  const bpm = (60 * fps) / bestLag;
  // phase: offset with the most onset energy on the grid
  let bestPh = 0, bestS = -1;
  for (let ph = 0; ph < bestLag; ph += 0.5) { let s = 0; for (let t = ph; t < n; t += bestLag) s += env[Math.round(t)] || 0; if (s > bestS) { bestS = s; bestPh = ph; } }
  const beats = []; for (let t = bestPh; t < n; t += bestLag) beats.push(+(t / fps).toFixed(3));
  const out = { file: path.basename(file), bpm: +bpm.toFixed(1), beats, duration: x.length / SR };
  if (cf) { fs.mkdirSync(path.dirname(cf), { recursive: true }); fs.writeFileSync(cf, JSON.stringify(out)); }
  return out;
}

/** Move each cut to the nearest beat (or bar), keeping every shot at least `min` seconds long. */
export function snapShots(shots, beats, { every = 1, min = 0.8 } = {}) {
  const grid = beats.filter((_, i) => i % every === 0);
  let ft = 0;
  const out = shots.map((s) => ({ ...s }));
  for (let i = 0; i < out.length - 1; i++) {
    const cut = ft + out[i].dur;
    let near = grid.reduce((a, b) => (Math.abs(b - cut) < Math.abs(a - cut) ? b : a), grid[0] ?? cut);
    if (near - ft < min) near = cut; // never squeeze a shot below min
    out[i].dur = near - ft;
    ft = near;
  }
  return out;
}
