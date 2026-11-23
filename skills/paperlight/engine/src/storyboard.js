// Storyboard contact sheet: for each shot, three frames (in / middle / out) and the
// director's notes: beat, duration, world time, camera grammar, lint warnings.

import fs from 'node:fs';
import path from 'node:path';
import { createCanvas } from '@napi-rs/canvas';
import { createRenderer } from './render.js';
import { lint } from './lint.js';

export async function storyboard(film, { filmPath, W, H, out, Path2D, at = [0.08, 0.5, 0.94] }) {
  const R = createRenderer(film, { W, H, cacheDir: path.join(path.dirname(filmPath), '.cache'), Path2D });
  const report = lint(film, R);
  const pad = Math.round(W * 0.05), textW = Math.round(W * 1.15), rowH = H + pad;
  const SW = pad + at.length * (W + pad / 2) + textW + pad;
  const head = Math.round(H * 0.55);
  const SH = head + R.shots.length * rowH + pad;
  const c = createCanvas(SW, SH), g = c.getContext('2d');
  g.fillStyle = R.palette.paper; g.fillRect(0, 0, SW, SH);
  const ink = R.palette.ink;
  const fs1 = Math.max(11, Math.round(H * 0.075));
  g.fillStyle = ink;
  g.font = `${Math.round(fs1 * 2)}px Baskerville`;
  g.fillText(film.title || 'Untitled', pad, head * 0.5);
  g.font = `${fs1}px Avenir Next`;
  g.globalAlpha = 0.6;
  g.fillText(`${R.shots.length} shots · ${R.duration.toFixed(1)}s · ${film.fps || 24}fps · ${(film.size || [1920, 1080]).join('×')}`, pad, head * 0.5 + fs1 * 1.8);
  g.globalAlpha = 1;

  const frame = createCanvas(W, H), fg = frame.getContext('2d');
  for (const shot of R.shots) {
    const y = head + shot.index * rowH;
    at.forEach((u, k) => {
      const ft = shot.ft0 + u * shot.dur;
      R.renderFrame(fg, ft);
      const x = pad + k * (W + pad / 2);
      g.drawImage(frame, x, y);
      g.strokeStyle = 'rgba(20,18,15,0.35)'; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, W - 1, H - 1);
    });
    const tx = pad + at.length * (W + pad / 2) + pad * 0.3;
    let ty = y + fs1 * 1.2;
    g.fillStyle = ink;
    g.font = `${Math.round(fs1 * 1.35)}px Baskerville`;
    g.fillText(`${String(shot.index + 1).padStart(2, '0')}  ${shot.name}`, tx, ty);
    ty += fs1 * 1.7;
    g.font = `${fs1}px Avenir Next`;
    g.globalAlpha = 0.65;
    g.fillText(`${shot.dur.toFixed(1)}s   film ${shot.ft0.toFixed(1)}–${(shot.ft0 + shot.dur).toFixed(1)}   world ${shot.wt0.toFixed(1)}${shot.transition ? '   ' + shot.transition.type : ''}`, tx, ty);
    ty += fs1 * 1.5;
    g.fillText(wrap(g, shot.camera.desc || '', textW - pad)[0] || '', tx, ty);
    g.globalAlpha = 1;
    ty += fs1 * 1.7;
    g.font = `italic ${fs1}px Baskerville`;
    for (const line of wrap(g, shot.beat || '', textW - pad).slice(0, 4)) { g.fillText(line, tx, ty); ty += fs1 * 1.3; }
    const warns = report.items.filter((w) => w.shot === shot.index);
    g.font = `${Math.round(fs1 * 0.9)}px Avenir Next`;
    for (const w of warns.slice(0, 2)) { g.fillStyle = R.palette.accent; g.fillText('⚑ ' + w.msg.slice(0, 80), tx, ty); ty += fs1 * 1.2; }
    g.fillStyle = ink;
  }
  const file = path.join(out, 'storyboard.png');
  fs.writeFileSync(file, c.toBuffer('image/png'));
  return file;
}

function wrap(g, text, maxW) {
  const words = String(text).split(/\s+/), lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}
