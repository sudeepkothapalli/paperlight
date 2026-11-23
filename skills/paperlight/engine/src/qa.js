// Automated checks on rendered keyframes — the failures that actually happen in this style:
//   • a silhouette lost against its background (dark figure on a dark wall)     → contrast
//   • a subject too small to read, or cropped by the frame                      → size / crop
//   • an actor teleporting inside a shot; a camera popping                      → jumps
//   • the accent colour flooding the frame (restraint)                          → accent area
//   • the same frame rendering differently twice                                → determinism
// Renders at low resolution (a few seconds per film); reports, never blocks.

import { createCanvas } from '@napi-rs/canvas';
import { makeView } from './camera.js';
import { createRenderer } from './render.js';

const lum = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
const hexRGB = (h) => { const n = parseInt(h.slice(1, 7), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };

export function qa(film, { cacheDir, Path2D, W = 480 }) {
  const [FW, FH] = film.size || [1920, 1080];
  const H = Math.round((W * FH) / FW / 2) * 2;
  const R = createRenderer(film, { W, H, cacheDir, Path2D });
  const items = [], add = (shot, level, msg) => items.push({ shot, level, msg });
  const c1 = createCanvas(W, H), g1 = c1.getContext('2d');
  const c2 = createCanvas(W, H), g2 = c2.getContext('2d');
  const people = Object.entries(R.world.actors).filter(([, a]) => !a.def.kind || a.def.kind === 'person');

  for (const shot of R.shots) {
    if (shot.blank) continue;
    const setName = R.setOf(shot);
    let warnedRead = false, warnedTiny = false, warnedAccent = false;
    for (const u of [0.15, 0.5, 0.85]) {
      const t = u * shot.dur, ft = shot.ft0 + t, wt = shot.wt0 + t;
      R.renderFrame(g1, ft);
      R.renderFrame(g2, ft, { noFigures: true });
      const img = g1.getImageData(0, 0, W, H).data, bg = g2.getImageData(0, 0, W, H).data;
      const view = makeView(R.cameraAt(shot, t).cam, W, H);
      for (const [name, a] of people) {
        if (shot.hide?.includes(name)) continue;
        const st = a.state(wt);
        if (!st.visible || (film.sets && (st.set ?? 'main') !== setName)) continue;
        const Hh = a.def.height ?? 1.75, y0 = st.y || 0;
        const foot = view.project(st.pos[0], y0, st.pos[1]), head = view.project(st.pos[0], y0 + Hh, st.pos[1]);
        if (!foot || !head) continue;
        const h = Math.abs(foot[1] - head[1]), w = h * 0.28, cx = (foot[0] + head[0]) / 2;
        const x0 = cx - w / 2, x1 = cx + w / 2, yA = Math.min(foot[1], head[1]), yB = Math.max(foot[1], head[1]);
        const vis = Math.max(0, Math.min(W, x1) - Math.max(0, x0)) * Math.max(0, Math.min(H, yB) - Math.max(0, yA)) / Math.max(1, w * h);
        if (vis <= 0.02) continue;
        if (h / H < 0.025 && !warnedTiny) { add(shot.index, 'info', `${name} is tiny (${((h / H) * 100).toFixed(1)}% of frame height) at ${u * 100 | 0}% — intended?`); warnedTiny = true; }
        // close shots crop bodies on purpose; losing the head is the real failure
        const headIn = head[0] > 0 && head[0] < W && head[1] > -h * 0.02 && head[1] < H;
        if (!headIn && vis > 0.25 && !/POV/.test(shot.camera.desc || '')) add(shot.index, 'warn', `${name}'s head is out of frame at ${u * 100 | 0}% (body visible)`);
        // contrast of the silhouette against what is behind it (sampled from the figure-less frame)
        let sum = 0, n = 0;
        // what must read is the head and shoulders (bodies are often behind furniture or in a cloud)
        for (let y = Math.max(0, yA + h * 0.02 | 0); y < Math.min(H, yA + h * 0.32); y += 1) for (let x = Math.max(0, x0 + w * 0.15 | 0); x < Math.min(W, x1 - w * 0.15); x += 1) {
          const i = (y * W + x) * 4; sum += lum(bg[i], bg[i + 1], bg[i + 2]); n++;
        }
        if (n > 4) {
          const pal = R.paletteAt(shot, t), fig = lum(...hexRGB(pal[a.def.color || 'ink'] || pal.ink));
          const contrast = Math.abs(sum / n - fig);
          if (contrast < 0.2 && !warnedRead) { add(shot.index, 'warn', `${name} hard to read against the background (contrast ${contrast.toFixed(2)}) at ${u * 100 | 0}% — put them against light`); warnedRead = true; }
        }
      }
      // colour restraint: how much of the frame the motif colours cover
      const pal = R.paletteAt(shot, t);
      const cols = Object.keys(R.motifs || {}).length ? Object.keys(R.motifs) : (pal.accent ? ['accent'] : []);
      if (!warnedAccent) for (const name of cols) {
        if (!pal[name]) continue;
        const [ar, ag, ab] = hexRGB(pal[name]);
        let hit = 0; for (let i = 0; i < img.length; i += 16) if (Math.abs(img[i] - ar) + Math.abs(img[i + 1] - ag) + Math.abs(img[i + 2] - ab) < 60) hit++;
        const frac = hit / (img.length / 16), limit = R.motifs?.[name]?.maxArea ?? 0.08;
        if (frac > limit) { add(shot.index, 'info', `'${name}' covers ${(frac * 100).toFixed(0)}% of the frame at ${u * 100 | 0}% — still restrained?`); warnedAccent = true; }
      }
    }
    // continuity inside the shot: teleports and camera pops
    const dt = 1 / (film.fps ?? 24);
    let prevCam = null; const prevPos = {};
    for (let t = 0; t <= shot.dur; t += dt) {
      const wt = shot.wt0 + t, cam = R.cameraAt(shot, t).cam;
      if (prevCam) {
        const dp = Math.hypot(...cam.pos.map((v, i) => v - prevCam.pos[i]));
        const da = Math.abs(Math.atan2(Math.sin(cam.yaw - prevCam.yaw), Math.cos(cam.yaw - prevCam.yaw)));
        if (dp > 2.5 || da > 0.25) { add(shot.index, 'warn', `camera jumps ${dp.toFixed(1)} m / ${(da * 57.3).toFixed(0)}° at ${t.toFixed(2)} s`); break; }
      }
      prevCam = cam;
      for (const [name, a] of people) {
        const st = a.state(wt);
        if (!st.visible || (film.sets && (st.set ?? 'main') !== setName)) { delete prevPos[name]; continue; }
        const p = [st.pos[0], st.y || 0, st.pos[1]], q = prevPos[name];
        if (q && Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) > 0.6 && !st.riding) { add(shot.index, 'warn', `${name} jumps ${Math.hypot(p[0] - q[0], p[2] - q[2]).toFixed(1)} m at ${t.toFixed(2)} s (blocking discontinuity)`); prevPos[name] = p; break; }
        prevPos[name] = p;
      }
    }
  }
  // flicker / pops: across nine consecutive frames, one frame-to-frame change much larger than the rest is a pop,
  // a teleport or an unstable particle. Smooth motion and the deliberate boil (excluded) do not spike.
  const lumArr = (d) => { const o = new Float32Array(d.length / 4); for (let i = 0; i < o.length; i++) o[i] = lum(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]); return o; };
  const md = (A, B) => { let s = 0; for (let i = 0; i < A.length; i += 2) s += Math.abs(A[i] - B[i]); return s / (A.length / 2); };
  const fps = film.fps ?? 24;
  for (const shot of R.shots) {
    if (shot.blank || shot.dur < 1) continue;
    const t0 = shot.ft0 + Math.min(shot.dur * 0.5, shot.dur - 10 / fps), fr = [];
    for (let k = 0; k < 9; k++) { R.renderFrame(g1, t0 + k / fps, { noBoil: true }); fr.push(lumArr(g1.getImageData(0, 0, W, H).data)); }
    const d = fr.slice(1).map((f, i) => md(fr[i], f));
    if (process.env.QA_DEBUG) console.log(shot.name, d.map((v) => (v * 1000).toFixed(1)).join(' '));
    // an isolated jump: one step far larger than BOTH neighbours (motion that starts or stops is not a pop)
    for (let i = 1; i < d.length - 1; i++) {
      if (d[i] > 0.004 && d[i] > 3 * Math.max(d[i - 1], d[i + 1]) + 0.002) { add(shot.index, 'warn', `a pop at ${((t0 - shot.ft0) + (i + 1) / fps).toFixed(2)} s: one frame jumps ${(d[i] / Math.max(d[i - 1], d[i + 1], 1e-4)).toFixed(1)}× more than the frames around it`); break; }
    }
  }
  // determinism
  const mid = R.shots[Math.floor(R.shots.length / 2)];
  R.renderFrame(g1, mid.ft0 + mid.dur / 2); const A = Buffer.from(g1.getImageData(0, 0, W, H).data);
  R.renderFrame(g1, mid.ft0 + mid.dur / 2); const B = Buffer.from(g1.getImageData(0, 0, W, H).data);
  if (!A.equals(B)) add(-1, 'warn', 'the same frame rendered twice is not identical (non-determinism)');
  const text = [`QA ${film.title}: ${R.shots.length} shots`, ...items.map((i) => `  ${i.level === 'warn' ? '⚑' : '·'} ${i.shot >= 0 ? `shot ${i.shot + 1} ${R.shots[i.shot].name}: ` : ''}${i.msg}`), items.length ? '' : '  all checks passed'].join('\n');
  return { items, text };
}
