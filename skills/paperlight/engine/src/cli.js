#!/usr/bin/env node
// paperlight — command line for the Paperlight film engine.
//
//   node engine/src/cli.js caps   <film.js>                    (the full capability list: what this film uses)
//   node engine/src/cli.js still  <film.js> [--shot N|name] [--at 0.5] [--scale 0.5] [--out file.png]
//   node engine/src/cli.js board  <film.js> [--scale 0.25]           storyboard contact sheet
//   node engine/src/cli.js lint   <film.js>                          continuity / grammar report
//   node engine/src/cli.js model  <film.js> [--actor walker]         character model sheet (turnaround, walk, acting, heads)
//   node engine/src/cli.js qa     <film.js>                          automated checks on keyframes (readability, jumps, flicker, accent…)
//   node engine/src/cli.js colors <film.js>                          colour script: palette per shot + motif levels over the film
//   node engine/src/cli.js beats  <film.js>                          tempo + beats of film.music, and where the cuts land
//   any command: --size WxH (e.g. 1080x1920 vertical)
//   node engine/src/cli.js audio  <film.js>                          score + sound design -> wav
//   node engine/src/cli.js render <film.js> [--publish] [--scale s] [--workers 8] [--shots 3-5]   -> mp4 (draft 640x360 by default)

import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createCanvas, Path2D } from '@napi-rs/canvas';

const args = process.argv.slice(2);
const cmd = args[0];
const filmPath = path.resolve(args[1] || '');
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : def; };
const flag = (name) => args.includes(`--${name}`);

// A film is a module whose default export is the film object — or a function that receives the engine's tools
// ({ cam }) and returns it, so a film can live in any folder without importing from the skill's path.
export async function loadFilm(p) {
  const mod = await import(pathToFileURL(p).href + `?v=${Date.now()}`);
  if (typeof mod.default === 'function') { const { cam } = await import('./camera.js'); return mod.default({ cam }); }
  return mod.default;
}
export const outDirFor = (p) => {
  const d = path.join(path.dirname(p), 'out');
  fs.mkdirSync(d, { recursive: true });
  return d;
};
export const cacheDirFor = (p) => path.join(path.dirname(p), '.cache');

async function main() {
  if (!cmd || !args[1]) { console.log(fs.readFileSync(new URL(import.meta.url)).toString().split("\n").slice(1, 14).join('\n')); return; }
  const film = await loadFilm(filmPath);
  const out = outDirFor(filmPath);
  const publish = flag('publish');
  // drafts are small (640x360) for quick assessment; --publish renders full size with high quality encoding
  const scale = parseFloat(opt('scale', publish ? '1' : cmd === 'board' ? '0.25' : cmd === 'render' ? String(1 / 3) : '0.5'));
  if (opt('size')) film.size = opt('size').split('x').map(Number); // e.g. --size 1080x1920 for vertical
  const [FW, FH] = film.size || [1920, 1080];
  const W = Math.round(FW * scale / 2) * 2, H = Math.round(FH * scale / 2) * 2;
  const { createRenderer } = await import('./render.js');

  if (cmd === 'still') {
    const t0 = Date.now();
    const R = createRenderer(film, { W, H, cacheDir: cacheDirFor(filmPath), log: console.log, Path2D });
    const sel = opt('shot', '0');
    const shot = R.shots.find((s) => s.name === sel) || R.shots[parseInt(sel, 10)] || R.shots[0];
    const at = parseFloat(opt('at', '0.5'));
    const ft = opt('time') != null ? parseFloat(opt('time')) : shot.ft0 + at * shot.dur;
    const c = createCanvas(W, H), g = c.getContext('2d');
    const t1 = Date.now();
    R.renderFrame(g, ft);
    const file = opt('out', path.join(out, `still-${shot.index}-${shot.name}-${String(at).replace('.', '_')}.png`));
    fs.writeFileSync(file, c.toBuffer('image/png'));
    console.log(`${file}  (setup ${t1 - t0}ms, frame ${Date.now() - t1}ms)`);
  } else if (cmd === 'board') {
    const { storyboard } = await import('./storyboard.js');
    const file = await storyboard(film, { filmPath, W, H, out, Path2D });
    console.log(file);
  } else if (cmd === 'colors' || cmd === 'colorscript') {
    const { colorScript } = await import('./colorscript.js');
    console.log(colorScript(film, { filmPath, out, Path2D }));
  } else if (cmd === 'beats') {
    const { detectBeats } = await import('./beats.js');
    const b = detectBeats(path.resolve(path.dirname(filmPath), film.music?.file || opt('file')), cacheDirFor(filmPath));
    console.log(`${b.file}: ${b.bpm} bpm, ${b.beats.length} beats, first at ${b.beats[0]} s`);
    const R = createRenderer(film, { W: 320, H: 180, cacheDir: cacheDirFor(filmPath), Path2D });
    console.log('cuts: ' + R.shots.slice(1).map((s) => s.ft0.toFixed(2)).join(' · ') + (film.music?.snapCuts ? '  (snapped to ' + (film.music.snapCuts === 'bar' ? 'bars' : 'beats') + ')' : ''));
  } else if (cmd === 'qa') {
    const { qa } = await import('./qa.js');
    console.log(qa(film, { cacheDir: cacheDirFor(filmPath), Path2D }).text);
  } else if (cmd === 'model') {
    const { modelSheet } = await import('./modelsheet.js');
    console.log(modelSheet(film, { actor: opt('actor', 'walker'), out }));
  } else if (cmd === 'caps') {
    const { capsText } = await import('./caps.js');
    const R = createRenderer(film, { W: 384, H: Math.round(384 * FH / FW), cacheDir: cacheDirFor(filmPath), Path2D });
    console.log(capsText(film, R));
  } else if (cmd === 'lint') {
    const { lint } = await import('./lint.js');
    const R = createRenderer(film, { W: 384, H: Math.round(384 * FH / FW), cacheDir: cacheDirFor(filmPath), Path2D });
    const report = lint(film, R);
    console.log(report.text);
  } else if (cmd === 'audio') {
    const { renderAudio } = await import('./audio.js');
    const R = createRenderer(film, { W: 384, H: Math.round(384 * FH / FW), cacheDir: cacheDirFor(filmPath), Path2D });
    const file = path.join(out, 'audio.wav');
    renderAudio(film, R, file);
    console.log(file);
  } else if (cmd === 'render') {
    const { renderVideo } = await import('./video.js');
    const file = await renderVideo(film, { filmPath, W, H, out, workers: parseInt(opt('workers', '0'), 10), shots: opt('shots'), noAudio: flag('no-audio'), publish });
    console.log(file);
  } else {
    console.error(`unknown command ${cmd}`);
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
