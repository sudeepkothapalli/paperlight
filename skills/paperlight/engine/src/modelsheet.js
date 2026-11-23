// Character model sheet, as an animation studio would pin on the wall:
//   row 1  turnaround — the figure at 8 angles, standing
//   row 2  walk cycle in profile — 8 phases across one stride pair
//   row 3  walk cycle seen front / three-quarter / back
//   row 4  head studies — profile both ways, 3/4, a head turn, close
// Rendered with a long lens so proportions read without perspective distortion.

import fs from 'node:fs';
import path from 'node:path';
import { createCanvas } from '@napi-rs/canvas';
import { makeView } from './camera.js';
import { drawPerson } from './figures.js';
import { DEFAULT_PALETTE } from './render.js';
import { DEG } from './math.js';

export function modelSheet(film, { actor = 'walker', out, cell = 260 }) {
  const def = film.cast[actor];
  const palette = { ...DEFAULT_PALETTE, ...(film.palette || {}), ...Object.fromEntries(Object.entries(film.colors || {}).map(([k, m]) => [k, m.color])) }; // accents show in their colours
  const H = def.height ?? 1.75;
  const cols = 8;
  const people = Object.entries(film.cast).filter(([, d]) => d.kind !== 'bird' && d.kind !== 'cloud').map(([n]) => n);
  const rows = [
    { label: 'turnaround', n: 8, frame: H * 1.15, cy: H * 0.5, st: (i) => ({ heading: (i * 45) * DEG }) },
    { label: 'walk · profile', n: 8, frame: H * 1.15, cy: H * 0.5, st: (i) => ({ heading: 90 * DEG, walking: 1, dist: (i / 8) * 1.48 }) },
    { label: 'walk · front, 3/4, back', n: 8, frame: H * 1.15, cy: H * 0.5, st: (i) => ({ heading: [180, 180, 140, 140, 0, 0, 220, 220][i] * DEG, walking: 1, dist: (i % 2) * 0.37 + 0.1 }) },
    { label: 'heads', n: 8, frame: 0.42, cy: H - 0.13, st: (i) => ({ heading: [90, -90, 135, 45, 180, 180, 0, 90][i] * DEG, head: [0, 0, 0, 0, 0, -60 * DEG, 0, -30 * DEG][i] }) },
  ];
  // acting: attitudes and actions, all from the same figure
  const G = (name) => ({ name, amt: 1, t: 0.3 });
  const acting = [
    ['slumped', { heading: 90 * DEG, pose: { slump: 1 } }],


    ['running (light)', { heading: 90 * DEG, walking: 1, speed: 3.0, steps: 0.3 }],
    ['sitting', { heading: 90 * DEG, sit: 1 }],
    ['kneeling', { heading: 90 * DEG, sit: 1, sitOn: 'kneel', gesture: G('offer') }],
    ['lying', { heading: 90 * DEG, sit: 1, sitOn: 'lie' }],
    ['holds + waves', { heading: 140 * DEG, gesture: { ...G('hold'), arms: 'near' }, gesture2: { ...G('wave'), arms: 'far' } }],
    ['flying a kite', { heading: 90 * DEG, gesture: { ...G('fly'), arms: 'both' }, pose: { chin: 20 } }],
    ['catching', { heading: 90 * DEG, gesture: G('catch'), pose: { chin: 25, lean: -3 } }],
  ];
  rows.push({ label: 'acting · ' + acting.map((a) => a[0]).join(', '), n: 8, frame: H * 1.15, cy: H * 0.5, st: (i) => acting[i][1] });
  if (people.length > 1) {
    // cast line-up: everyone at the same scale, alternating profile and three-quarter
    const n = Math.min(cols, people.length * 2);
    rows.push({ label: 'cast · ' + people.join(', '), n, frame: 2.05, cy: 0.98, who: (i) => people[Math.floor(i / 2) % people.length], st: (i) => ({ heading: (i % 2 ? 140 : 90) * DEG }) });
    rows.push({ label: 'cast · heads', n, frame: 0.5, cy: null, who: (i) => people[Math.floor(i / 2) % people.length], st: (i) => ({ heading: (i % 2 ? 180 : 90) * DEG }) });
  }
  const pad = Math.round(cell * 0.08), labelH = Math.round(cell * 0.12);
  const W = pad + cols * (cell + pad), SH = pad + rows.length * (cell + labelH + pad);
  const c = createCanvas(W, SH), g = c.getContext('2d');
  g.fillStyle = palette.paper; g.fillRect(0, 0, W, SH);
  rows.forEach((row, r) => {
    const y0 = pad + r * (cell + labelH + pad);
    g.fillStyle = palette.ink; g.globalAlpha = 0.55;
    g.font = `${Math.round(labelH * 0.6)}px Avenir Next`;
    g.fillText(row.label, pad, y0 + labelH * 0.7);
    g.globalAlpha = 1;
    for (let i = 0; i < row.n; i++) {
      const x0 = pad + i * (cell + pad);
      const d = row.who ? film.cast[row.who(i)] : def;
      const cy = row.cy ?? (d.height ?? 1.75) - 0.14;
      const lens = 300, f = (cell * lens) / 36;
      const D = (f * row.frame) / cell;
      const cam = { pos: [0, cy, -D], yaw: 0, pitch: 0, roll: 0, lens };
      const view = makeView(cam, cell, cell);
      const sub = createCanvas(cell, cell), sg = sub.getContext('2d');
      sg.fillStyle = palette.paper; sg.fillRect(0, 0, cell, cell);
      // ground line
      const gp = view.project(0, 0, 0);
      if (gp && gp[1] < cell) { sg.strokeStyle = 'rgba(20,18,15,0.25)'; sg.lineWidth = 1; sg.beginPath(); sg.moveTo(0, gp[1]); sg.lineTo(cell, gp[1]); sg.stroke(); }
      const st = { pos: [0, 0], heading: 0, walking: 0, dist: 0, head: 0, visible: true, ...row.st(i) };
      drawPerson(sg, view, d, st, i * 0.37, palette, 0.6, { tonal: film.figures === 'tonal' });
      g.drawImage(sub, x0, y0 + labelH);
      g.strokeStyle = 'rgba(20,18,15,0.15)'; g.strokeRect(x0 + 0.5, y0 + labelH + 0.5, cell - 1, cell - 1);
    }
  });
  const file = path.join(out, `model-${actor}.png`);
  fs.writeFileSync(file, c.toBuffer('image/png'));
  return file;
}
