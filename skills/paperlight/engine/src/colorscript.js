// Colour script, in the animation-studio sense: the whole film's colour on one page.
//   row 1  one thumbnail per shot, in order, sized by duration
//   row 2  that shot's palette: paper and wash as fields, every motif colour as a chip at its current strength
//   row 3  each motif's level across the film (story time mapped to screen time), with its written meaning
// It answers "where does colour live, change and mean something?" at a glance.

import fs from 'node:fs';
import path from 'node:path';
import { createCanvas } from '@napi-rs/canvas';
import { createRenderer } from './render.js';
import { trackValue } from './scenery.js';

export function colorScript(film, { filmPath, out, Path2D, W = 1800 }) {
  const [FW, FH] = film.size || [1920, 1080];
  const R = createRenderer(film, { W: 384, H: Math.round((384 * FH) / FW), cacheDir: path.join(path.dirname(filmPath), '.cache'), Path2D });
  const shots = R.shots.filter((s) => !s.blank);
  const total = shots.reduce((a, s) => a + s.dur, 0);
  const pad = 30, thumbH = 150, chipH = 46, motifs = Object.entries(R.motifs || {});
  const graphH = 38 * Math.max(1, motifs.length) + 24;
  const H = pad * 2 + 60 + thumbH + 12 + chipH + 30 + graphH + 20;
  const c = createCanvas(W, H), g = c.getContext('2d');
  g.fillStyle = '#f4f2ee'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#222'; g.font = '30px Baskerville'; g.fillText(`${film.title} — colour script`, pad, pad + 26);
  g.font = '15px Avenir Next'; g.fillStyle = '#777';
  g.fillText(motifs.length ? motifs.map(([n, m]) => `${n}: ${m.meaning || '(no meaning given)'}`).join('   ·   ') : 'no colour motifs declared (film.colors)', pad, pad + 50);
  const frame = createCanvas(R.W, R.H), fg = frame.getContext('2d');
  const x0 = pad, usable = W - pad * 2, y1 = pad + 60, y2 = y1 + thumbH + 12, y3 = y2 + chipH + 30;
  let x = x0;
  const xOfFt = (ft) => x0 + (ft / total) * usable; // approximately (blank shots excluded)
  let acc = 0;
  for (const s of shots) {
    const w = (s.dur / total) * usable;
    R.renderFrame(fg, s.ft0 + s.dur * 0.55);
    // thumbnail, cropped to fill
    const sc = Math.max(w / R.W, thumbH / R.H), sw = w / sc, sh = thumbH / sc;
    g.drawImage(frame, (R.W - sw) / 2, (R.H - sh) / 2, sw, sh, x, y1, w - 2, thumbH);
    // palette chips
    const pal = R.paletteAt(s, s.dur * 0.55);
    g.fillStyle = pal.paper; g.fillRect(x, y2, w - 2, chipH);
    const chips = motifs.map(([n]) => pal[n]).filter(Boolean);
    const cw = Math.min(22, (w - 10) / Math.max(1, chips.length + 1));
    chips.forEach((col, i) => { g.fillStyle = col; g.beginPath(); g.arc(x + 8 + cw / 2 + i * (cw + 3), y2 + chipH / 2, cw / 2, 0, Math.PI * 2); g.fill(); });
    g.fillStyle = pal.ink; g.fillRect(x + w - 10, y2 + 6, 6, chipH - 12);
    g.fillStyle = '#555'; g.font = '11px Avenir Next';
    if (w > 40) g.fillText(s.name.slice(0, Math.floor(w / 6.5)), x + 3, y2 + chipH + 14);
    x += w; acc += s.dur;
  }
  // motif levels over the film
  motifs.forEach(([name, m], k) => {
    const yb = y3 + 38 * k + 34;
    g.strokeStyle = '#ddd'; g.beginPath(); g.moveTo(x0, yb); g.lineTo(x0 + usable, yb); g.stroke();
    g.fillStyle = '#666'; g.font = '12px Avenir Next'; g.fillText(name, x0 - 2, yb - 24);
    g.strokeStyle = m.color; g.lineWidth = 3; g.beginPath();
    let xx = x0, first = true;
    for (const s of shots) {
      const w = (s.dur / total) * usable;
      for (let i = 0; i <= 12; i++) {
        const t = (i / 12) * s.dur, lv = m.level == null ? 1 : trackValue(m.level, s.wt0 + t);
        const px = xx + (i / 12) * w, py = yb - Math.max(0, Math.min(1.2, lv)) * 20;
        if (first) { g.moveTo(px, py); first = false; } else g.lineTo(px, py);
      }
      xx += w;
    }
    g.stroke(); g.lineWidth = 1;
  });
  const file = path.join(out, 'colorscript.png');
  fs.writeFileSync(file, c.toBuffer('image/png'));
  return file;
}
