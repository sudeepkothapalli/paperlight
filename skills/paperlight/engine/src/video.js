// Parallel render: N worker threads each render a contiguous run of frames and stream raw
// RGBA into their own ffmpeg; chunks are concatenated losslessly and muxed with the audio.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Worker } from 'node:worker_threads';
import { spawnSync } from 'node:child_process';
import { createRenderer } from './render.js';
import { renderAudio } from './audio.js';
import { Path2D } from '@napi-rs/canvas';

export async function renderVideo(film, { filmPath, W, H, out, workers = 0, shots: shotSel, noAudio = false, publish = false }) {
  const cacheDir = path.join(path.dirname(filmPath), '.cache');
  // build the terrain cache once, before the workers start
  const R = createRenderer(film, { W, H, cacheDir, Path2D, log: console.log });
  const fps = film.fps ?? 24;
  let f0 = 0, f1 = Math.round(R.duration * fps);
  if (shotSel) {
    const [a, b] = shotSel.split('-').map((x) => parseInt(x, 10) - 1);
    const sa = R.shots[a], sb = R.shots[b ?? a];
    f0 = Math.round(sa.ft0 * fps); f1 = Math.round((sb.ft0 + sb.dur) * fps);
  }
  const total = f1 - f0;
  const n = workers || Math.max(1, Math.min(os.cpus().length - 1, 8));
  const tmp = path.join(out, '.chunks');
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  const per = Math.ceil(total / n);
  const t0 = Date.now();
  const done = new Array(n).fill(0);
  let lastLog = 0;
  const jobs = [];
  for (let i = 0; i < n; i++) {
    const a = f0 + i * per, b = Math.min(f1, a + per);
    if (a >= b) break;
    const file = path.join(tmp, `chunk-${String(i).padStart(3, '0')}.mp4`);
    jobs.push({ file, p: new Promise((res, rej) => {
      const w = new Worker(new URL('./worker.js', import.meta.url), { workerData: { filmPath, W, H, from: a, to: b, fps, file, publish } });
      w.on('message', (m) => {
        done[i] = m.done;
        const now = Date.now();
        if (now - lastLog > 3000) {
          lastLog = now;
          const d = done.reduce((s, x) => s + x, 0);
          const el = (now - t0) / 1000;
          process.stdout.write(`  ${d}/${total} frames  ${(d / el).toFixed(1)} fps  eta ${((total - d) / Math.max(0.1, d / el)).toFixed(0)}s\n`);
        }
      });
      w.on('error', rej);
      w.on('exit', (c) => (c === 0 ? res() : rej(new Error(`worker ${i} exited ${c}`))));
    }) });
  }
  if (!noAudio) {
    console.log('  synthesising audio…');
    renderAudio(film, R, path.join(out, 'audio.wav'));
  }
  await Promise.all(jobs.map((j) => j.p));
  console.log(`  frames done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  const list = path.join(tmp, 'list.txt');
  fs.writeFileSync(list, jobs.map((j) => `file '${j.file}'`).join('\n'));
  const slug = (film.title || 'film').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const suffix = shotSel ? `-shots-${shotSel}` : '';
  const outFile = path.join(out, `${slug}${suffix}-${publish ? 'publish' : 'draft'}-${H}p.mp4`);
  const audioArgs = noAudio ? [] : shotSel
    ? ['-ss', String(f0 / fps), '-t', String(total / fps), '-i', path.join(out, 'audio.wav')]
    : ['-i', path.join(out, 'audio.wav')];
  // external tracks (narration, music, recorded sound): film.audio = [{ file, at, gain, fadeIn, fadeOut }]
  const tracks = noAudio || shotSel ? [] : [...(film.music?.file ? [{ file: film.music.file, at: film.music.at ?? 0, gain: film.music.gain ?? 0.8, fadeOut: 2, dur: R.duration + 0.4 }] : []), ...(film.audio || [])];
  const trackArgs = tracks.flatMap((tk) => ['-i', path.resolve(path.dirname(filmPath), tk.file)]);
  const args = ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, ...audioArgs, ...trackArgs];
  if (!noAudio && tracks.length) {
    const parts = tracks.map((tk, i) => {
      const ms = Math.round((tk.at ?? 0) * 1000);
      const fades = [tk.fadeIn ? `afade=t=in:st=0:d=${tk.fadeIn}` : null, tk.fadeOut && tk.dur ? `afade=t=out:st=${tk.dur - tk.fadeOut}:d=${tk.fadeOut}` : null].filter(Boolean).join(',');
      return `[${i + 2}:a]${tk.dur ? `atrim=0:${tk.dur},` : ''}${fades ? fades + ',' : ''}volume=${tk.gain ?? 1},adelay=${ms}|${ms}[t${i}]`;
    });
    const mix = `[1:a]${tracks.map((_, i) => `[t${i}]`).join('')}amix=inputs=${tracks.length + 1}:normalize=0:duration=first[m];[m]loudnorm=I=-19:TP=-1.5:LRA=11[a]`;
    args.push('-filter_complex', [...parts, mix].join(';'), '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-ar', '48000', '-c:a', 'aac', '-b:a', '192k', '-shortest');
  } else {
    args.push('-c:v', 'copy');
    if (!noAudio) args.push('-af', 'loudnorm=I=-19:TP=-1.5:LRA=11', '-ar', '48000', '-c:a', 'aac', '-b:a', '192k', '-shortest');
  }
  args.push('-movflags', '+faststart', outFile);
  const r = spawnSync('ffmpeg', args, { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('ffmpeg concat failed');
  fs.rmSync(tmp, { recursive: true, force: true });
  return outFile;
}
