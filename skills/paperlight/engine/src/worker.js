// One render worker: frames [from, to) -> raw RGBA -> its own ffmpeg -> chunk.mp4
import { parentPort, workerData } from 'node:worker_threads';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createCanvas, Path2D } from '@napi-rs/canvas';
import { createRenderer } from './render.js';

const { filmPath, W, H, from, to, fps, file, publish } = workerData;
const mod = await import(pathToFileURL(filmPath).href);
const film = typeof mod.default === 'function' ? mod.default({ cam: (await import('./camera.js')).cam }) : mod.default; // films may be functions of the engine's tools
const R = createRenderer(film, { W, H, cacheDir: path.join(path.dirname(filmPath), '.cache'), Path2D });
const c = createCanvas(W, H), g = c.getContext('2d');

const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(fps), '-i', '-',
  '-c:v', 'libx264', '-preset', publish ? 'slow' : 'veryfast', '-crf', publish ? '16' : '21', '-tune', 'animation', '-pix_fmt', 'yuv420p', '-r', String(fps), file], { stdio: ['pipe', 'inherit', 'inherit'] });
const write = (buf) => new Promise((res) => { if (ff.stdin.write(buf)) res(); else ff.stdin.once('drain', res); });

for (let f = from; f < to; f++) {
  R.renderFrame(g, f / fps);
  const img = g.getImageData(0, 0, W, H);
  await write(Buffer.from(img.data.buffer, img.data.byteOffset, img.data.byteLength));
  if ((f - from) % 4 === 0) parentPort.postMessage({ done: f - from + 1 });
}
parentPort.postMessage({ done: to - from });
ff.stdin.end();
await new Promise((res, rej) => ff.on('close', (code) => (code === 0 ? res() : rej(new Error('ffmpeg ' + code)))));
